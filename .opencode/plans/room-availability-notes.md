# Notes explorer — GET /rooms/:id/availability?date=YYYY-MM-DD (aucun code ecrit)

## Answer
- Le routeur `rooms` existe : `roomsRouter` monte sur `/rooms` (app.ts:9). Il n'a que `GET /` et `GET /:id`. Aucune route availability.
- Briques reutilisables : `findRoom`, `bookingsForRoom` (store.ts:53-59), `overlaps` (lib/overlap.ts:6). Aucune notion d'horaires, de granularite, ni de type `Result` dans le depot.
- Bloquants pour la spec : fuseau du "jour", horaires d'ouverture (globaux ou par salle), granularite des creneaux, forme de la reponse.

## How it works (faits lus)
1. Demarrage : `src/server.ts:3` lit `PORT` (defaut 3000), `:5` appelle `createApp().listen`.
2. Assemblage : `src/app.ts:5-12` : `express.json()` (:7), `/health` (:8), `app.use("/rooms", roomsRouter)` (:9), `app.use("/bookings", bookingsRouter)` (:10). Express `^4.21.2` (package.json:19).
3. `src/routes/rooms.ts:6` GET `/` ; `:10` GET `/:id` : 404 `{error:"salle inconnue"}` (:13), sinon `{room, bookings}` (:16). `/:id` ne capture qu'un segment : `/:id/availability` n'est pas avale.
4. `src/routes/bookings.ts:18-65` POST : validation (:21-25), fin > debut (:27), salle inconnue -> 400 (:31-34), capacite -> 400 (:35-37), chevauchement -> 409 `{error, conflictsWith}` (:39-45), `priceFor` (:54), 201 (:57).
5. Mapping d'erreurs : `bookings.ts:58-63` attrape `ValidationError` et renvoie `err.status` (400, `validate.ts:5`). Autre erreur relancee (:63) -> defaut Express (500). Les 404/409 sont ecrits en dur dans les routes.
6. Chevauchement : `overlap.ts:11` `a1 < b2 && b1 < a2` : semi-ouvert `[debut, fin[`, bouts a bouts autorises (overlap.spec.ts:27-36).

## Key files
- src/app.ts:1-12 — assemblage Express, montage des routeurs
- src/server.ts:1-7 — ecoute sur PORT
- src/routes/rooms.ts:1-17 — routeur salles (lieu naturel de la nouvelle route)
- src/routes/bookings.ts:58-63 — mapping ValidationError -> HTTP ; :39-45 detection de conflit
- src/store.ts:1-59 — modele et accesseurs (lecture seule, AGENTS.md:40)
- src/lib/validate.ts:4-33 — ValidationError, requireString/requireDate/requirePositiveInt
- src/lib/overlap.ts:6-11 — test de chevauchement
- src/lib/price.ts:7 — seul calcul de "jour" du depot (getUTCDay)
- test/rooms.spec.ts:4-14 — helper `call()` et tests GET /rooms

## Data model (store.ts)
- `Room {id, name, capacity, hourlyRate}` (store.ts:1-6). Pas d'horaires d'ouverture.
- `Booking {id, roomId, who, people, startsAt, endsAt, price}` (store.ts:8-16). `startsAt`/`endsAt` sont des `string` ISO, jamais `Date`.
- Seed : 4 salles (store.ts:18-23), 2 reservations le 2026-10-05 (salle-a, 09-11 UTC) et 2026-10-06 (amphi, 14-17 UTC) (store.ts:25-44).
- Compteur `seq = 1002` (store.ts:46), `nextBookingId()` (:48-51).
- Accesseurs : `findRoom(id)` (:53-55), `bookingsForRoom(roomId)` (:57-59). Pas de filtre par date.
- Fuseau : aucun dans store.ts. Chaines stockees telles que recues (bookings.ts:52-53, aucune normalisation).

## Validation (validate.ts)
- `requireDate` exige un suffixe explicite `Z` ou `+hh:mm` (regex :17) et `Date.parse` valide (:21). Message : `date invalide : <champ>` (:22).
- Commentaire :16 : sans fuseau, `Date.parse` lit l'heure locale du serveur.
- Aucun `Result` dans `src/` (grep `Result<`, `ok: false` : rien). AGENTS.md:25-27 l'exige pour le nouveau code, mais le type n'existe pas.

## Opening hours / bornes / granularite
- Aucune occurrence de horaire/ouverture/opening/slot dans src/, test/, README.md, AGENTS.md, CLAUDE.md, .github, .claude, .opencode.
- README.md:15-16 documente `GET /rooms` et `GET /rooms/:id` seulement.
- POST n'impose ni plage horaire ni granularite : seul `endsAt > startsAt` est verifie (bookings.ts:27).
- Seule "regle de jour" : `price.ts:7` `getUTCDay()` (week-end en UTC). Commentaire `price.ts:1` : "repris du script de facturation, a nettoyer (ticket FACT-88)".
- README.md:36 et CLAUDE.md:19 citent `DIAGNOSTIC.md` : fichier absent du depot.
- Tickets cites : INFRA-140 (vraie base, AGENTS.md:4), INFRA-198 (fixture manquante, overlap.spec.ts:79-82), INFRA-205 (nommage tests, vitest.config.ts:4). Aucun ticket sur les horaires.

## Tests
- Fichiers : `test/bookings.spec.ts`, `test/rooms.spec.ts`, `test/store.spec.ts`, `test/overlap.spec.ts`, `test/price.spec.ts`. Include `test/**/*.spec.ts` (vitest.config.ts:17) ; un `.ts` hors convention fait echouer la config (:8-13).
- Pas de supertest. Helper `call()` : `createApp()`, `app.listen(0)`, `fetch`, `server.close()` en `finally` (bookings.spec.ts:4-14, rooms.spec.ts:4-14). POST via helper `post` (bookings.spec.ts:16-21).
- Pas de reset du store : tableau module-level partage. Chaque test POST utilise une date distincte (11-02, 11-03, 11-09, 11-14, 11-20). Le test 409 depend du seed bk-1001 (bookings.spec.ts:113-122).
- store.spec.ts:4 : "On teste le vrai store (lecture seule)". Il assert la liste exacte des ids (:7) et `bookingsForRoom("salle-b")` vide (:27) : un nouveau seed casse ces tests.
- Probable (non verifie) : vitest isole les modules par fichier.

## Dates (src/lib)
- Aucun helper de jour (parse YYYY-MM-DD, bornes de journee, formatage). Existants : `overlaps` (overlap.ts:6), `isWeekend`, `hoursBetween`, `priceFor` (price.ts:6-21). Pas de `utils.ts` (AGENTS.md, convention 4).
- src/lib/AGENTS.md:5-6 exige un `export default` par module ; overlap.ts et price.ts n'en ont pas (fait observe).

## Gotchas
- `startsAt` est stocke tel quel : `+02:00` reste `+02:00`. Filtrer par prefixe `YYYY-MM-DD` serait faux pour ces entrees. Le chevauchement compare des epoch (overlap.ts:7-10), donc reste juste.
- Le week-end se calcule en UTC (price.ts:7). Un "jour" Paris peut differer de la journee UTC pres de minuit. Non documente.
- Aucune verification de date passee (bookings.ts). Seeds en octobre 2026 ; date du jour 2026-10-08.
- Erreurs non-ValidationError (bookings.ts:63) passent par le handler par defaut Express 4.
- `req.query` est typee `string | string[] | ParsedQs` : bookings.ts:10-11 teste `typeof === "string"`.

## Open questions (pour la spec)
1. Fuseau du "jour" : UTC (comme price.ts:7) ou Europe/Paris ? Sans reponse, `date=2026-10-08` n'a pas de bornes.
2. Horaires d'ouverture : globaux, par salle, ou 24h ? Valeurs et fuseau.
3. Granularite : creneaux fixes (30 min, 1 h) sur une grille, ou intervalles libres maximaux ?
4. Forme de la reponse : `{startsAt, endsAt}` ? Cle `slots` ? Prix inclus ?
5. Erreurs : `date` absent/invalide -> 400 via ValidationError ? Salle inconnue -> 404 `"salle inconnue"` (rooms.ts:13) ?
6. Date passee ou hors plage : acceptee ? Jour sans reservation = journee entiere libre ?
7. Type `Result` : le creer (AGENTS.md:25-27) ou rester sur ValidationError pour coherence avec le code existant ?
8. Module : nouveau `src/lib/<nom>.ts` avec `export default` (src/lib/AGENTS.md:5-6) ? Nom a choisir.
9. Reservation qui chevauche minuit : tronquee au jour demande ou exclue ?

## Unknowns
- DIAGNOSTIC.md et tickets INFRA-140/198/205/FACT-88 : absents du depot. Impossible de savoir ce qu'ils disent des horaires.
- Tests et `npm run check` non lances (lecture seule demandee).
- Diff de 7851ec5 non lu ; historique seulement par liste de commits.
