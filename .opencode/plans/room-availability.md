# Ajouter GET /rooms/:id/availability?date=YYYY-MM-DD (creneaux libres d'une salle)

## Goal
`GET /rooms/salle-a/availability?date=2026-10-05` repond 200 `{ roomId, date, slots: [{ startsAt, endsAt }] }` avec les intervalles libres maximaux du jour UTC, en ISO `Z` (`toISOString`). `npm run check` est vert, avec tests unitaires et HTTP.

## Non-goals
- Pas d'horaires d'ouverture, pas de grille de creneaux, pas de prix dans la reponse.
- Pas de modification de `src/store.ts`, `src/lib/validate.ts`, ni du code existant (sauf ajout de la route dans `rooms.ts`).
- Pas de nouvelle dependance, pas de seed supplementaire (casserait `store.spec.ts`), pas de mise a jour de README sauf si le dev le juge necessaire (non requis).

## Assumptions and open questions
Decisions fixees par l'architecte, a surcharger par un humain si besoin :
- assumption: le jour est le jour UTC `[dateT00:00:00.000Z, lendemain T00:00:00.000Z[`.
- assumption: pas d'horaires ni de grille : on renvoie le complement des reservations de la salle, tronque au jour, reservations qui se chevauchent ou se touchent fusionnees.
- assumption: les reservations sont comparees par instant (`Date.parse` de la chaine brute, qui peut avoir un offset non-Z), jamais par prefixe de chaine.
- assumption: jour completement reserve -> `slots: []`. Dates passees acceptees.
- assumption: salle inconnue -> 404 `{ error: "salle inconnue" }` (comme `GET /rooms/:id`). `date` absent, non `YYYY-MM-DD` strict, ou impossible (`2026-02-30`) -> 400 `{ error: "<message>" }` (forme de `bookings.ts:60`). Ordre : salle inconnue (404) testee avant la date (400).
- assumption: `date` repete (`?date=a&date=b`, type tableau) est traite comme invalide (400).
- assumption: `Result` n'existe pas dans le depot (notes explorer) : on le cree dans `src/lib/result.ts`.
- assumption: `src/lib/AGENTS.md` prime dans `src/lib/` : un `export default` par module, pas de JSDoc, fonctions pures. La convention JSDoc de la racine ne s'y applique donc pas.
- assumption: `overlaps` (`overlap.ts`) ne sert pas : le calcul travaille sur des epoch fusionnes, pas sur des paires. Pas de reutilisation forcee.
- assumption: les tests HTTP lisent les seeds existants (salle-a le 2026-10-05 09-11 UTC ; amphi le 2026-10-06 14-17 UTC, a reverifier dans `store.ts`) sans POST, donc sans effet de bord sur les autres tests.
- BLOCKING: aucun.

## Files to touch
| File | Change | Why |
|---|---|---|
| `src/lib/result.ts` | new | type `Result<T, E>` + constructeurs |
| `src/lib/day.ts` | new | parse `YYYY-MM-DD` strict -> bornes du jour UTC (Result) |
| `src/lib/availability.ts` | new | calcul pur des intervalles libres |
| `src/routes/rooms.ts` | add route | `GET /:id/availability` |
| `test/availability.spec.ts` | new | unitaires (day + availability) |
| `test/rooms.spec.ts` | add describe | tests HTTP 200/404/400 |

## Steps
### 1. Result et parsing du jour
- What: `result.ts` : `type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E }`, `export default function ok<T>(value: T)` et export nomme `fail<E>(error: E)`. `day.ts` : `export default function parseDay(date: unknown): Result<{ date: string; start: number; end: number }>` (epoch ms ; `end = start + 86400000`). Regex stricte `^\d{4}-\d{2}-\d{2}$`, puis aller-retour `new Date(\`${date}T00:00:00.000Z\`).toISOString().slice(0,10) === date` pour refuser `2026-02-30`. Entree non-string ou absente -> `fail` avec un message en francais. Imports en `.js`, pas de JSDoc.
- Where: `src/lib/result.ts`, `src/lib/day.ts`, `test/availability.spec.ts` (describe "parseDay").
- Done when: tests parseDay verts (valide, `2026-02-30`, `2026-13-01`, `2026-1-5`, `2026-10-05T00:00:00Z`, vide, `undefined`, tableau) et `npm run check` vert.

### 2. Calcul pur des intervalles libres
- What: `availability.ts` : `export default function freeSlots(bookings: { startsAt: string; endsAt: string }[], dayStart: number, dayEnd: number): { startsAt: string; endsAt: string }[]`. Parse par `Date.parse`, tronque a `[dayStart, dayEnd[`, ignore les reservations hors jour ou vides apres troncature, trie, fusionne chevauchantes et adjacentes, renvoie le complement en `toISOString()`. Pure, ne mute pas l'entree.
- Where: `src/lib/availability.ts`, `test/availability.spec.ts` (describe "freeSlots").
- Done when: tests verts pour : jour vide (un seul creneau = jour entier) ; reservation a cheval sur minuit cote debut (veille 23:00 -> 02:00) et cote fin (22:00 -> lendemain 01:00) ; reservation en offset `+02:00` (ex. `2026-10-05T01:00:00+02:00` = 2026-10-04T23:00Z, verifie qu'un prefixe de chaine donnerait faux) ; chevauchantes ; adjacentes (fusionnees, pas de creneau de 0 ms) ; reservation hors jour ignoree ; entrees non triees ; jour entierement reserve -> `[]`. `npm run check` vert.

### 3. Route HTTP et tests
- What: dans `roomsRouter`, `GET /:id/availability` : `findRoom` -> 404 `{ error: "salle inconnue" }` ; `parseDay(typeof req.query.date === "string" ? req.query.date : undefined)` -> si `!ok`, 400 `{ error: result.error }` ; sinon 200 `{ roomId, date, slots: freeSlots(bookingsForRoom(room.id), start, end) }`. Declarer apres `/:id` est sans danger (`/:id` ne capture qu'un segment).
- Where: `src/routes/rooms.ts`, `test/rooms.spec.ts` (reutiliser le helper `call`).
- Done when: tests HTTP verts : 200 salle-a le 2026-10-05 (deux creneaux autour de 09-11 UTC), 200 jour sans reservation (jour entier), 200 `slots` pour amphi le 2026-10-06, 404 salle `cave` (avec date valide), 400 sans `date`, 400 `date=2026-10-05T10:00:00Z`, 400 `date=2026-02-30`, 400 `date=a&date=b`, `Content` JSON `{ error: string }`. `npm run check` vert.

## How this is verified
Tests ecrits d'abord par le dev a partir de cette liste, puis code. Cas limites : minuit des deux cotes, offset non-Z, adjacence (pas de creneau vide), jour plein, date impossible, date repetee, 404 avant 400. En plus : `npm run coverage` reste au-dessus de 90 % de lignes ; `npm run check` vert (typecheck strict, lint, tests). Verification manuelle optionnelle : `npm start` puis requete sur `/rooms/salle-a/availability?date=2026-10-05`.

## Risks and rollback
- `store.spec.ts` assert les seeds exacts : ne rien ajouter au store, pas de POST dans les nouveaux tests.
- Contradiction entre racine (JSDoc) et `src/lib/AGENTS.md` (pas de JSDoc, default export) : tranchee en faveur du dossier local, voir assumptions.
- Les reservations stockees avec un offset non-Z sont gerees par epoch ; une chaine non parsable donnerait `NaN` mais `requireDate` empeche ce cas a l'ecriture.
- Rollback : revert du commit ; les 3 modules et la route sont purement additifs.
