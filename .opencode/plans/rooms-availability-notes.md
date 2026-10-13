# Rooms & bookings subsystem — grounded brief (for `GET /rooms/:id/availability`)

## Answer
Rooms and bookings are plain module-level arrays in `src/store.ts`; there is no
persistence, no repository layer and **no concept of opening hours, business day or slot
duration anywhere in the repo**. A booking is an arbitrary ISO-8601 `[startsAt, endsAt[`
pair tied to a room by `roomId`. Routes are Express routers mounted in `src/app.ts`, and
the canonical request pattern is the `POST /bookings` handler (`src/routes/bookings.ts`):
`satisfies helpers -> throw ValidationError -> catch -> 400`. The new availability
endpoint has **no existing definition of "free slot"** to reuse — that is an open product
question, not a code lookup.

## How it works
1. Entry: `src/app.ts:5` `createApp()` builds an Express app; mounts `roomsRouter` at
   `/rooms` (`:9`) and `bookingsRouter` at `/bookings` (`:10`), plus `/health` (`:8`).
   `src/server.ts:5` is the only place that calls `.listen()`.
2. Routers are `Router()` instances defined at `src/routes/rooms.ts:4` and
   `src/routes/bookings.ts:7`; handlers are inline arrow functions.
3. Canonical POST shape (`src/routes/bookings.ts:18-65`): wrap body in `try`; read
   `req.body ?? {}` (`:20`); validate with `requireString/requirePositiveInt/requireDate`
   (`:21-25`); do business checks that `throw new ValidationError` (`:27-37`); return
   `409` directly for conflicts (`:43`); persist then `201` (`:56-57`); `catch` only
   `ValidationError` and reply `res.status(err.status).json({ error: err.message })`
   (`:58-61`), otherwise `throw err` (`:63`).
4. `GET /rooms/:id` (`src/routes/rooms.ts:10-16`): `findRoom(req.params.id)`; if missing
   → `404 { error: "salle inconnue" }` directly (no exception); else
   `{ room, bookings: bookingsForRoom(room.id) }`.
5. `GET /bookings` (`src/routes/bookings.ts:9-16`) filters by optional `?roomId=` string;
   `DELETE /bookings/:id` (`:67-75`) splices the array and returns `{ cancelled: id }` or
   `404`.
6. Model: `Room { id, name, capacity, hourlyRate }` (`src/store.ts:1-6`); `Booking
   { id, roomId, who, people, startsAt, endsAt, price }` (`:8-16`). Dates are ISO strings;
   price stored as number.
7. Store API: `findRoom(id): Room | undefined` (`:53-55`, `.find` by id) and
   `bookingsForRoom(roomId): Booking[]` (`:57-59`, `.filter` by `roomId`).
8. Date semantics: `overlaps` treats each interval as half-open `[debut, fin[`
   (`src/lib/overlap.ts:4`, formula `a1 < b2 && b1 < a2` `:11`), so back-to-back slots do
   not clash. `requireDate` only rejects `NaN` from `Date.parse` (`src/lib/validate.ts:16-22`).
9. Helpers are pure and consumed by routes: `src/lib/{validate,overlap,price}.ts`.
10. Tests exercise the real HTTP app: `createApp()` per call, ephemeral port, `fetch`
    (`test/bookings.spec.ts:17-35`). Store is **not** reset between tests.

## Key files
`src/app.ts:5-11` — app factory and router mounting
`src/routes/bookings.ts:18-65` — the reference route pattern (parse/validate/throw/catch)
`src/routes/rooms.ts:10-16` — existing `/rooms/:id` handler (the route you extend)
`src/store.ts:1-59` — Room/Booking types, seed data, `findRoom`, `bookingsForRoom`
`src/lib/validate.ts:4-30` — `ValidationError` (`status = 400`) + `require*` helpers
`src/lib/overlap.ts:6-12` — half-open interval overlap test
`src/lib/price.ts:6-20` — `isWeekend` / `hoursBetween` / `priceFor` (hourly, weekend +20)
`test/bookings.spec.ts:17-42` — test harness (per-call server) and route specs
`test/store.spec.ts:1-30` — store unit tests
`vitest.config.ts:6-16` — `include: ["test/**/*.spec.ts"]`, coverage thresholds

## Gotchas
- **No opening hours / day bounds / slot size exist.** Grep for
  `open|opening|business|hours|heure|horaire|slot|creneau|duration|duree|dayStart|dayEnd`
  finds only test data and price helpers; nothing defines a room's available day. "Free
  time slots" must be invented.
- Unknown room answers two different ways: `GET /rooms/:id` → `404` (`rooms.ts:13`), but
  `POST /bookings` → `ValidationError` → `400` (`bookings.ts:33`). No single convention.
- Store is module-level mutable state shared by every `createApp()`; `rooms.ts:2` imports
  the live arrays. Tests never reset it, so `POST /bookings` tests persist data for later
  tests in the same file (e.g. `bk-1002` deletion at `test/bookings.spec.ts:227`).
- `requireDate` accepts date-only strings: `Date.parse("2026-11-02")` is valid and is read
  as UTC midnight. It does not enforce a `YYYY-MM-DD` shape nor a full ISO timestamp.
- `ValidationError.status` is hardcoded `400` (`validate.ts:5`); the catch uses
  `err.status`, not a literal.
- `src/lib/AGENTS.md:5` mandates a `default` export per module, but `validate.ts`,
  `overlap.ts` and `price.ts` have **none** — the convention is aspirational/violated.
- `overlap.spec.ts:91-101` has an `it.skip` needing a missing fixture
  (`test/fixtures/legacy-bookings.json`, INFRA-198).
- `priceFor` weekend surcharge keys off `startsAt` only (`price.ts:17`).

## Unknowns
- **Definitive shape of "availability"**: day start/end (09:00–18:00? 00:00–24:00?), slot
  granularity, timezone, and whether availability is closed-form or derived from booked
  intervals — none of this is in the repo. Requires a product/API decision.
- Whether unknown room should yield `404` (like `GET /rooms/:id`) or `400` (like POST).
- Whether tests are intended to be order-independent; the shared mutable store suggests
  not, but no reset/isolation mechanism exists to confirm intent.
- `scripts/checks.sh` and `.opencode/plugin/*` exist but are agent tooling, unrelated to
  the runtime subsystem; not traced further.
