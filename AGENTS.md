# salles-api — conventions du depot

Service interne de reservation de salles. Express + TypeScript, stockage en memoire pour
l'instant (la vraie base arrive avec INFRA-140).

## Commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm install` | installe les dependances et active les hooks Git (`core.hooksPath .husky`) |
| `npm start` | demarre l'API sur le port 3000 (via `tsx`, pas de build) |
| `npm test` | lance toute la suite (`test/**/*.spec.ts`) — **a lancer avant tout commit** |
| `npm run typecheck` | `tsc --noEmit` en mode `strict` |
| `npm run lint` | ESLint + regles recommandees typescript-eslint |
| `npm run check` | typecheck + lint + tests, comme le pre-commit |
| `npm run test:coverage` | tests + couverture, avec les seuils de `vitest.config.ts` (lance en CI) |
| `npm run test:mutation` | mutation testing Stryker sur `src/` (long, a la demande) |

Il n'y a pas de build : `tsconfig.json` est en `noEmit` et le service tourne sous `tsx`.

Le pre-commit (`.husky/pre-commit`) refuse un commit sur `main` et lance typecheck, lint
et tests. La CI (`.github/workflows/ci.yml`) relance les memes checks + la couverture sur
chaque PR et chaque push sur `main`.

## Conventions

1. **Toute fonction exportee porte une JSDoc** d'une ligne minimum, qui dit ce qu'elle
   fait et pas comment. Exception : `src/lib/` (voir `src/lib/AGENTS.md`).
2. **Erreurs de validation : `throw new ValidationError(...)`** (`src/lib/validate.ts`),
   attrapee dans la route qui renvoie `400` avec `{ error }`. C'est le schema de
   `src/routes/bookings.ts` : suivez-le pour les nouvelles routes. Les autres statuts
   (`404`, `409`) sont renvoyes directement par la route. Le passage a un type `Result`
   a ete discute en mars mais n'a jamais ete fait : ne melangez pas les deux styles.
3. Les dates circulent en **ISO 8601 UTC**, toujours en `string`, jamais en `Date`.
4. Un module par responsabilite dans `src/lib/`. Pas de fichier `utils.ts`.
5. Les imports relatifs portent l'extension `.js` (ESM).
6. Les tests s'appellent `*.spec.ts` (INFRA-205) : un autre suffixe n'est **pas execute**.
   Un test desactive (`it.skip`) porte un commentaire qui dit pourquoi.

## Ce qu'il ne faut pas faire

- Ne pas ajouter de dependance sans en parler.
- Ne pas commiter dans `main` directement (bloque par le pre-commit).
- Ne pas toucher a `src/store.ts` : il disparait avec INFRA-140.
- Ne pas commiter `.env` : il est ignore, partir de `.env.example`.
