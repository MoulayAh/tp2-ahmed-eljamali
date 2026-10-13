# `GET /rooms/:id/availability?date=YYYY-MM-DD` — free slots per day

## Goal

Calling `GET /rooms/:id/availability?date=YYYY-MM-DD` on the running app returns, for a
known room and a valid day, the ordered list of free 60-minute slots inside an 08:00–20:00
UTC window, computed from the room's existing bookings under half-open `[debut, fin[`
semantics. Unknown room → `404`, missing/invalid `date` → `400`. Covered by a new
`test/availability.spec.ts`. `npm run check` passes.

Observable success: `GET /rooms/salle-a/availability?date=2026-10-05` returns `slots`
with 10 entries; the `2026-10-05T09:00:00Z` and `2026-10-05T10:00:00Z` slots are absent.

## Non-goals

- No persistence change: `src/store.ts` is **not touched** (it disappears with INFRA-140).
- No configurable opening hours per room, no timezone handling beyond UTC, no
  variable-length slots. The window/slot size are module constants (see assumptions).
- No change to `GET /rooms/:id` or any bookings route.
- No `Result`-type error refactor (AGENTS.md: keep the `throw ValidationError` style).

## Assumptions and open questions

- **assumption — day window 08:00→20:00 UTC, slot 60 min.** Nothing in the repo defines
  business hours (`rooms-availability-notes.md` confirms this); 12 slots/day. Implemented
  as named constants so the human can change one line. Flagged for review.
- **assumption — `date` is validated before the room lookup.** This is the decided order.
  Consequence: `GET /rooms/cave/availability` (no `date`) answers `400`, not `404`; the
  "unknown room" test must pass a valid `date`. If product wants room-first, say so — it
  changes which error wins.
- **assumption — `date` is echoed to the response exactly as received** (no normalization).
- **assumption — new spec file gets fresh seed state.** `vitest.config.ts` does not set
  `isolate`, so Vitest's default `isolate: true` gives each test file its own module
  registry. `test/bookings.spec.ts` DELETEs `bk-1002`, but that cannot leak into
  `test/availability.spec.ts`. If this assumption were ever disabled, the salle-a/amphi
  seed assertions below would break.
- **CONFLICT found — lib default-export rule is aspirational, not enforced.**
  `src/lib/AGENTS.md` mandates a default export, but `validate.ts`, `overlap.ts` and
  `price.ts` have none and `eslint.config.js` does not enforce it (only
  `tseslint.configs.recommended` + two custom rules). The decided design adds
  `export default freeSlots`, which follows the written convention (good) but diverges from
  every existing lib module. No code conflict — plan implements the decision.
- **CONFLICT found — no existing concept of a free slot / opening hours.** The decided
  constants are the first definition in the repo; there is nothing to reuse or contradict.
- **assumption — no follow-up ticket number** for this feature; commit message can be
  generic. Not blocking.

## Files to touch

| File | Change | Why |
|---|---|---|
| `src/lib/availability.ts` | **new** — `isValidDay`, `freeSlots`, `Slot`, constants, default export | pure slot computation, per `src/lib/` convention |
| `src/routes/rooms.ts` | add `GET /:id/availability` handler | expose the computation |
| `test/availability.spec.ts` | **new** — unit + HTTP tests | prove grid, half-open boundary, 400/404 |
| `src/store.ts` | **do not touch** | read-only source of types and seed data |

## Steps

### 1. Add the pure availability module and its unit tests
- **What:** create `src/lib/availability.ts`:
  - named constants `DAY_START_HOUR = 8`, `DAY_END_HOUR = 20`, `SLOT_MINUTES = 60`;
  - `export interface Slot { startsAt: string; endsAt: string }`;
  - `export function isValidDay(date: string): boolean` — strict `^\d{4}-\d{2}-\d{2}$`
    shape, then a UTC round-trip: build `Date.UTC(y, m-1, d)` and require the resulting
    `getUTCFullYear/getUTCMonth+1/getUTCDate` to equal the parsed numbers. This rejects
    `2026-13-99`, `2026-10-5`, `2026-02-30`, `2026-00-10` and `la semaine prochaine`;
  - `export function freeSlots(bookings: Booking[], date: string): Slot[]` — build slots
    from `DAY_START_HOUR` to `DAY_END_HOUR` in `SLOT_MINUTES` steps (zero-padded hours),
    keep a slot iff `!bookings.some(b => overlaps(slot.startsAt, slot.endsAt, b.startsAt, b.endsAt))`;
  - `export default freeSlots;`
  - imports: `import type { Booking } from "../store.js";` and
    `import { overlaps } from "./overlap.js";`. No IO, no JSDoc (per `src/lib/AGENTS.md`).
  - create `test/availability.spec.ts` with direct unit tests (no HTTP yet) for
    `isValidDay` (valid, month 13, day 32, non-padded, prose, Feb 30) and `freeSlots`
    (a no-booking day returns 12 ordered slots; the salle-a and amphi seed intervals
    remove the right slots; half-open boundary keeps the slot starting exactly at a
    booking's end).
- **Where:** `src/lib/availability.ts` (new), `test/availability.spec.ts` (new)
- **Done when:** `npx vitest run test/availability.spec.ts` passes and
  `npm run typecheck` exits `0`.

### 2. Wire the route and add the HTTP integration tests
- **What:** in `src/routes/rooms.ts`, add
  `roomsRouter.get("/:id/availability", handler)` (append after the existing `/:id`
  handler). Handler body, mirroring `src/routes/bookings.ts:18-65`:
  - `try { ... } catch (err) { if (err instanceof ValidationError) { res.status(err.status).json({ error: err.message }); return; } throw err; }`
  - read `const date = req.query.date;` — if `typeof date !== "string" || date.trim() === ""`
    → `throw new ValidationError("champ manquant ou vide : date")`; else if
    `!isValidDay(date)` → `throw new ValidationError("date invalide : date")`.
  - `const room = findRoom(req.params.id);` → if missing,
    `res.status(404).json({ error: "salle inconnue" }); return;`
  - else `res.json({ room, date, slots: freeSlots(bookingsForRoom(room.id), date) });`
  - add the imports for `ValidationError` and `freeSlots` (`.js` extension).
  - In `test/availability.spec.ts`, add a `call` helper copied from
    `test/bookings.spec.ts:17-35` and HTTP cases for: unknown room → `404`
    `{ error: "salle inconnue" }` (with a valid `date`); missing `date` → `400`
    `"champ manquant ou vide : date"`; `2026-13-99` / `2026-10-5` /
    `la semaine prochaine` → `400` `"date invalide : date"`; a no-booking room/day → 12
    slots; `salle-a@2026-10-05` and `amphi@2026-10-06` → correct gaps; the boundary slot.
- **Route-order note:** Express 4 `/:id` matches a single path segment, so
  `/salle-a/availability` (two segments) cannot be captured by `/:id` regardless of
  declaration order. Order does not matter here; declaring the more specific route is
  still the chosen convention.
- **Where:** `src/routes/rooms.ts`, `test/availability.spec.ts`
- **Done when:** `npm run check` exits `0` (typecheck + lint + full test suite green).

### 3. Confirm CI-parity coverage
- **What:** run the coverage gate that CI uses, to prove the new module and route branches
  meet `vitest.config.ts` thresholds (lines 90 / functions 90 / branches 85 / statements 90).
  No new code — this is the definition-of-done gate.
- **Where:** n/a (command only)
- **Done when:** `npm run test:coverage` exits `0` with no threshold error, and the report
  lists `src/lib/availability.ts` fully or near-fully covered.

## How this is verified

Written before implementation. Exact response contracts:

- `200`: `{ "room": Room, "date": "YYYY-MM-DD", "slots": Slot[] }`, `Slot` =
  `{ "startsAt": string, "endsAt": string }`, both ISO-8601 UTC, at most 12 entries,
  strictly ascending, first `08:00:00Z` … last ends `20:00:00Z`.
- `400` `{ "error": "champ manquant ou vide : date" }` — missing/empty/array `date`.
- `400` `{ "error": "date invalide : date" }` — wrong shape or impossible calendar date.
- `404` `{ "error": "salle inconnue" }` — unit room, `date` valid.

Boundary cases that MUST have tests:

1. `GET /rooms/cave/availability?date=2026-10-05` → `404`, exact error body.
2. `GET /rooms/salle-a/availability` (no `date`) → `400`, missing-field message.
3. `date=2026-13-99`, `date=2026-10-5`, `date=la%20semaine%20prochaine` → `400`,
   invalid-date message. (Optionally `?date=2026-10-05&date=2026-10-06` → `400`.)
4. `salle-b` on a day with no seed bookings → exactly 12 slots, in order, matching
   `08:00:00Z`→`20:00:00Z`.
5. `salle-a` on `2026-10-05` (bk-1001 `09:00–11:00Z`) → 10 slots; `09:00` and `10:00`
   absent; `11:00` present (half-open: booking ends when slot starts).
6. `amphi` on `2026-10-06` (bk-1002 `14:00–17:00Z`) → 9 slots; `14:00`,`15:00`,`16:00`
   absent; `13:00` and `17:00` present.
7. Unit-level `isValidDay` false cases (`2026-02-30`, `2026-10-5`, `2026-13-99`) and
   `freeSlots` ordering/length independent of HTTP.

Commands for the definition of done: `npm run check` then `npm run test:coverage`.
(`npm test` == `vitest run` is the test-only subset.)

## Risks and rollback

- **Low blast radius.** One new module, one new route, one new spec. `src/store.ts` and
  existing routes are untouched.
- **Shared mutable store:** if Vitest isolation were turned off, `bk-1002` deleted by
  `test/bookings.spec.ts:227` would remove the amphi gap and test 6 would fail. Mitigation
  if that ever happens: create the amphi booking inside the test via `POST /bookings`
  instead of relying on seed. Not needed under the current default.
- **Constants are a product call:** if 08:00–20:00 / 60 min is wrong, only
  `DAY_START_HOUR`, `DAY_END_HOUR`, `SLOT_MINUTES` and the test expectations change.
- **Rollback:** delete `src/lib/availability.ts` and `test/availability.spec.ts`, and revert
  the added handler/imports in `src/routes/rooms.ts`. No data migration, no persisted state.
