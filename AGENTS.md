# salles-api — conventions du depot

Service interne de reservation de salles. Express + TypeScript, stockage en memoire pour
l'instant (la vraie base arrive avec INFRA-140).

## Commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm install` | installe les dependances et branche le hook git pre-commit (husky) |
| `npm start` | demarre l'API sur le port 3000 |
| `npm test` | lance la suite de tests (vitest) — **a lancer avant tout commit** |
| `npm run lint` | ESLint (regles recommandees JS + TypeScript) sur `src` et `test` |
| `npm run typecheck` | `tsc --noEmit` en mode `strict` |
| `npm run coverage` | tests + couverture, avec seuils (echoue sous 90 % de lignes) |
| `npm run check` | typecheck + lint + tests : ce que lancent le pre-commit et la CI |

Il n'y a pas d'etape de build : l'API tourne avec `tsx`.

## Conventions

1. **Toute fonction exportee porte une JSDoc** d'une ligne minimum, qui dit ce qu'elle
   fait et pas comment. Exception : `src/lib/`, qui a ses propres regles
   (`src/lib/AGENTS.md`).
2. **Erreurs.** Le nouveau code qui peut echouer renvoie un `Result` :
   `{ ok: true, value }` ou `{ ok: false, error }`. Le code existant n'est pas encore
   migre : `src/lib/validate.ts` leve une `ValidationError`, attrapee dans
   `src/routes/bookings.ts`. Ne pas reecrire ce code sans ticket.
3. Les dates circulent en **ISO 8601 avec fuseau explicite** (`Z` ou `+hh:mm`), toujours
   en `string`, jamais en `Date`. Une date sans fuseau est refusee (400).
4. Un module par responsabilite dans `src/lib/`. Pas de fichier `utils.ts`.
5. Les imports relatifs portent l'extension `.js` (ESM).
6. **Les tests s'appellent `test/**/*.spec.ts`** (INFRA-205). Un fichier de test avec un
   autre nom fait echouer la suite au lieu d'etre ignore en silence.

## Ce qu'il ne faut pas faire

- Ne pas ajouter de dependance sans en parler.
- Ne pas commiter dans `main` directement.
- Ne pas toucher a `src/store.ts` : il disparait avec INFRA-140 (le lire est permis).
- Ne pas lire ni commiter `.env` : les secrets restent hors du depot (`.env.example`).
