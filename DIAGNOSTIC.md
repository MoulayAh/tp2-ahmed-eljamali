# DIAGNOSTIC — TP 2 « Le repo malade »

Ahmed El Jamali — `salles-api`

Les preuves sont des **captures d'écran de fenêtres console réelles** dans
[`captures/avant/`](captures/avant) (dépôt d'origine, commit `ab57521`, ou clone neuf) et
[`captures/apres/`](captures/apres) (dépôt réparé). Chaque problème renvoie à sa capture.

## Comment j'ai travaillé

- Tout ce qui est affirmé ci-dessous a été **exécuté** : `npm test`, `vitest`, `eslint`,
  `tsc`, `opencode agent list` (règles de permission résolues par OpenCode lui-même),
  `opencode mcp list`, `opencode run` (tokens consommés), couverture v8, mutation testing
  Stryker, et un vrai commit sur un clone neuf.
- Les captures « avant » sont prises sur une copie vierge du dépôt d'origine, pas sur mes
  fichiers modifiés. Pour le hook, sur un **clone neuf depuis GitHub** : une copie
  partageant la config Git de mon dépôt aurait faussé la mesure.
- **Modèle** : sur mon poste, `opencode/deepseek-v4-pro` et `-flash` ne sont pas dans
  `opencode models` (je n'ai que le palier gratuit). Pour faire tourner la chaîne, j'ai
  remplacé le modèle par `opencode/big-pickle` **dans des copies de travail, jamais
  commitées**. Le dépôt garde les modèles d'origine.

## Récapitulatif

| # | Symptôme (démontré) | Cause | Brique |
|---|---|---|---|
| 2.1 | Prix week-end `"5020"` au lieu de 70 | `src/lib/price.ts` | tests, types, lint |
| 2.2 | Réservation bout à bout refusée (409) | `src/lib/overlap.ts` | tests |
| 2.3 | `npm test` / `npm run build` n'existent pas ; convention `Result` fausse | `AGENTS.md`, `package.json` | rules |
| 2.4 | 2 fichiers de test sur 4 jamais exécutés | `vitest.config.ts` + nommage | tests |
| 2.5 | Couverture 21 %, mutation 4,57 %, test d'un double | `test/store.spec.ts`, `test/overlap.spec.ts` | tests |
| 2.6 | Lint sans règle, `strict: false`, `@ts-nocheck` | `eslint.config.js`, `tsconfig.json` | lint et types |
| 2.7 | Commit cassé accepté sur `main` (hook jamais installé) | `.husky/pre-commit`, `package.json` | hooks, Git |
| 2.8 | Tests commentés en CI | `.github/workflows/ci.yml` | CI |
| 2.9 | `finder` ne peut rien lire | `.opencode/agent/finder.md` | subagents, droits |
| 2.10 | `planner` injoignable, `tester` hors de l'équipe | `planner.md`, `architect.md` | subagents |
| 2.11 | L'architect « qui n'écrit jamais » a tous les droits | `architect.md` (commit « unblock ») | droits |
| 2.12 | `dev` délègue et commite, `reviewer` corrige, `explorer` écrit et `curl` | `dev.md`, `reviewer.md`, `explorer.md` | droits |
| 2.13 | `/ship` pousse sans checks, sans relecture, sans question | `.opencode/command/ship.md` | commands |
| 2.14 | 6 MCP : 3 en panne, 0 utilisable, +31 k tokens de contexte | `opencode.json` | MCP, contexte |
| 2.15 | `.env` avec mot de passe versionné | `.env`, `.gitignore` | Git |
| 2.16 | Hook post-écriture : commentaire faux, ne voit pas tous les tests | `scripts/checks.sh`, `.opencode/plugin/checks.js` | hooks |

L'exercice 1 (chaîne d'origine puis chaîne réparée sur la même tâche) est
[en fin de document](#exercice-1--avant--après).

---

## 2. Problèmes trouvés

Format : **symptôme** → **cause (fichier)** → **brique du cours** → **correction** → **preuve**.

### 2.1 Bug métier : la majoration de week-end concatène au lieu d'additionner

- **Symptôme** : une réservation de 2 h un samedi en salle A (25 €/h) est facturée
  `"5020"` — une **chaîne**, pas 70. Visible en production via `POST /bookings`.
- **Cause** : `src/lib/price.ts` — `const WEEKEND_SURCHARGE = "20"` ; `number + string`
  donne une chaîne. L'erreur de type est **masquée** par `// @ts-nocheck` en ligne 1.
- **Briques** : tests (le test qui l'attrape n'est pas exécuté, cf. 2.4), types (`@ts-nocheck`),
  lint (aucune règle ne l'interdit, cf. 2.6).
- **Correction** : `WEEKEND_SURCHARGE = 20`, retrait du `@ts-nocheck` (le commentaire
  FACT-88 est conservé). Test d'intégration qui vérifie que le prix est le **nombre** 50.
- **Preuve** : `avant/04-bugs-en-production-api.png`, `avant/02-tests-verts-mais-incomplets.png`, `avant/03-lint-et-types-ne-verifient-rien.png`, `apres/03-api-corrigee.png`
  (`tsc` sans le `@ts-nocheck` : `TS2322 Type 'string' is not assignable to type 'number'`).

### 2.2 Bug métier : deux réservations bout à bout sont refusées (409)

- **Symptôme** : `bk-1001` finit à 11 h ; réserver 11 h–12 h dans la même salle renvoie
  `409 creneau deja reserve`. La JSDoc dit pourtant « un créneau est [début, fin[ ».
- **Cause** : `src/lib/overlap.ts:11` — `a1 <= b2 && b1 <= a2` (bornes fermées) au lieu de
  `a1 < b2 && b1 < a2`.
- **Briques** : tests. Le test qui le prouve (`accepte deux creneaux bout a bout`) était
  en `it.skip` sans justification ; le test HTTP équivalent était dans un fichier non exécuté.
- **Correction** : comparaison stricte ; les 3 `it.skip` injustifiés sont réactivés et
  **écrits** (deux n'étaient que `expect(true).toBe(true)`), + un cas « recouvrement d'une
  minute ».
- **Preuve** : `avant/04-bugs-en-production-api.png` (409), `apres/03-api-corrigee.png` (201), `avant/10-mutation-testing.png` : le mutant
  `a1 < b2` — c'est-à-dire **la correction elle-même** — survit, aucun test actif ne
  distingue `<` de `<=`. Après : `overlap.ts` 100 % de mutants tués.

### 2.3 Rules : `AGENTS.md` ne dit pas la vérité sur le dépôt

- **Symptômes** :
  - `npm test` est documenté (« **à lancer avant tout commit** ») mais n'existe pas :
    `npm error Missing script: "test"`. Même chose pour `npm run build` (et `tsconfig` est
    en `noEmit`, il n'y a rien à compiler).
  - Convention 2 : « les erreurs remontent en `Result`, jamais en `throw`, plus de
    `try/catch` dans les routes ». Le code fait exactement l'inverse : `validate.ts` lance
    des `ValidationError`, `bookings.ts` les attrape dans un `try/catch`. L'historique montre
    que ce code date de janvier, la doc de la « refonte de mars » du 12 mars, et **aucun
    commit de code n'a suivi** : la refonte n'a jamais eu lieu. Un agent qui obéit à la règle
    écrit du code incompatible avec ses voisins — et `dev.md` lui demande justement d'être
    « indiscernable du code autour ».
- **Cause** : `AGENTS.md`, `package.json`.
- **Brique** : rules.
- **Correction** : `AGENTS.md` décrit les commandes réelles (et ce que lancent hook et CI),
  la convention d'erreur réelle, la convention de nommage `*.spec.ts`. Script `test` ajouté.
- **Preuve** : `avant/01-npm-test-absent.png`, `avant/15-agents-md-ment.png`.

### 2.4 Tests : la moitié des tests ne s'exécute jamais

- **Symptôme** : `npm run test:unit` → vert, **5 passed / 4 skipped**. Les mêmes tests avec
  tous les fichiers → **2 failed** (les deux bugs ci-dessus). `bookings.test.ts` et
  `price.test.ts` ne sont jamais lancés, ni par le hook, ni par la CI, ni par le plugin.
- **Cause** : `vitest.config.ts` n'inclut que `test/**/*.spec.ts` (convention INFRA-205),
  et deux fichiers n'ont pas été renommés.
- **Brique** : tests.
- **Correction** : les fichiers sont **renommés** en `*.spec.ts`. Je n'ai pas élargi
  l'`include` : la convention est délibérée et commentée, c'est le nommage qui était faux.
- **Preuve** : `avant/02-tests-verts-mais-incomplets.png`.

### 2.5 Tests : ce qui tourne ne prouve presque rien

- **Symptômes** (mesurés) :
  - Couverture : **21 % des lignes** ; routes, validation et tarification à **0 %** ;
    `findRoom` / `bookingsForRoom` jamais appelées.
  - Mutation testing : **score 4,57 %** (8 mutants tués sur 175).
  - `test/store.spec.ts` teste un **double** (`storeDouble`) écrit dans le test : il
    vérifie que le double renvoie ce qu'on lui a dit de renvoyer. Supprimer `findRoom` ne
    ferait échouer aucun test.
  - Deux tests en `it.skip` ne contenaient que `expect(true).toBe(true)`.
- **Cause** : `test/store.spec.ts`, `test/overlap.spec.ts`.
- **Brique** : tests.
- **Correction** : `store.spec.ts` teste le **vrai** module (en lecture seule : la règle
  « ne pas toucher à `src/store.ts` » est respectée). Tests d'intégration sur toutes les
  routes, `validate.spec.ts`, cas limites trouvés grâce aux mutants survivants (capacité
  exactement atteinte, durée nulle, dimanche, chaîne d'espaces, décimal).
  Seuils de couverture dans `vitest.config.ts`, appliqués en CI.
- **Résultat** : 5 → **42 tests** exécutés ; couverture des lignes 21 % → **98,8 %** ;
  score de mutation **4,57 % → 90,8 %** (entre 90,8 et 91,4 % selon l'exécution ; les
  survivants restants sont surtout des libellés de données de `store.ts`).
- **Preuve** : `avant/09-couverture.png`, `avant/10-mutation-testing.png`,
  `apres/01-npm-test-et-couverture.png`, `apres/07-mutation-testing.png`.

### 2.6 Lint et types : ils ne vérifient rien

- **Symptôme** : `npm run lint` passe… parce que `eslint.config.js` a `rules: {}` : le parser
  est branché, **aucune règle**. `tsconfig.json` est en `strict: false` et `price.ts` en
  `@ts-nocheck`. Avec les règles recommandées de `typescript-eslint` (déjà en dépendance),
  le même code sort **2 erreurs**, dont le `@ts-nocheck` qui cachait le bug 2.1.
- **Cause** : `eslint.config.js`, `tsconfig.json`, `src/lib/price.ts`.
- **Brique** : lint et types.
- **Correction** : `tseslint.configs.recommended` (+ `no-unused-vars` qui tolère `_x`,
  interdiction de commiter un `it.only`) ; `strict: true` (aucune erreur hors tests, deux
  ajustements de typage dans les tests).
- **Preuve** : `avant/03-lint-et-types-ne-verifient-rien.png`, `apres/02-lint-et-types.png`.

### 2.7 Hooks Git : le pre-commit n'a jamais tourné

- **Symptôme** : sur un **clone neuf** + `npm ci`, je casse un test et je commite **sur
  `main`** : le commit est **accepté**.
- **Cause** : `.husky/pre-commit` existe mais husky n'est **ni en dépendance ni installé**,
  aucun script `prepare`, `core.hooksPath` non défini, `.husky/_/husky.sh` (sourcé en
  ligne 2) n'existe pas, et le fichier n'est même pas exécutable dans Git (`100644`).
- **Brique** : hooks, Git.
- **Correction** : sans ajouter de dépendance — `"prepare": "git config core.hooksPath .husky"`
  (exécuté par `npm install`), fichier rendu exécutable (`100755`), plus de `husky.sh`,
  `.gitattributes` pour garder le script en LF sous Windows. Le hook lance typecheck,
  lint, `npm test`, et **refuse un commit sur `main`** (règle d'`AGENTS.md` qui n'était
  appliquée par rien).
- **Preuve** : `avant/05-hook-pre-commit-jamais-branche.png`, `apres/04-hook-pre-commit-bloque.png` (commit
  bloqué). En cours de TP, le hook a d'ailleurs bloqué un de mes propres commits.

### 2.8 CI : les tests ont été commentés pour « débloquer les merges »

- **Symptôme** : la CI est verte parce qu'elle ne lance que le lint (qui ne vérifie rien).
- **Cause** : `.github/workflows/ci.yml`, commit `07a2c4d « fix ci »` :
  `# - run: npm run test:unit   # TODO remettre, ca bloquait les merges`. Pas de typecheck.
- **Brique** : CI et Git.
- **Correction** : `npm ci` → typecheck → lint → `npm run test:coverage` (tous les
  `*.spec.ts`, avec seuils). Sur chaque PR et chaque push sur `main`.
- **Preuve** : `avant/06-ci-tests-commentes.png`, `apres/09-ci.png`, `apres/13-ci-sur-la-pr.png` (run GitHub Actions sur la PR #1 : 59 tests, couverture 98 %).

### 2.9 Subagents : `finder` ne peut rien lire

- **Symptôme** : `opencode agent list` (règles résolues par OpenCode) : pour `finder`,
  `read`, `glob`, `grep` = **deny**. Dans le run de l'exercice 1, l'appel à `finder` est
  le premier à échouer.
- **Cause** : `.opencode/agent/finder.md` — `"*": deny` est placé **en dernier**. OpenCode
  applique la **dernière** règle qui correspond, donc elle écrase les `allow` du dessus.
  Tous les autres agents ont `"*": deny` en tête. C'est l'agent qui « répond sans avoir
  rien lu ».
- **Brique** : subagents, droits.
- **Correction** : `"*": deny` remis en tête. Sa description et son format de sortie
  avaient aussi dérivé vers ceux d'`explorer` (« Locate code **and explain** », « Prose…
  be generous with context ») alors que l'architect l'utilise pour « Where is X? » et
  surtout pas pour expliquer, sur le modèle bon marché : rôle recentré sur `file:line`.
  Ajout de `git grep` / `git ls-files` (lecture seule).
- **Preuve** : `avant/07-droits-effectifs-des-agents.png`, `apres/05-droits-effectifs-des-agents.png`, `apres/08-finder-lit-avant-de-repondre.png`.
- **Note honnête** : sur mon poste, un agent **sans aucun outil bash** est refusé par le
  palier gratuit d'OpenCode (`403 free tier can only be used from within OpenCode`) —
  vérifié : même le `finder` corrigé est refusé sans bash, et fonctionne dès qu'il a
  `git grep`. Ce 403 est un artefact de mon environnement ; le défaut du dépôt, lui, est
  démontré par la résolution des permissions. Avec un modèle payant, `finder` aurait reçu
  la tâche sans aucun outil : c'est ce que le sujet appelle répondre sans avoir rien lu
  (déduit, pas observé chez moi).

### 2.10 Subagents : `planner` est injoignable, `tester` est absent de l'équipe

- **Symptômes** :
  - `planner` est en `mode: primary` : il n'apparaît pas comme subagent, l'architect ne peut
    pas lui déléguer. Dans le run d'origine, **l'architect écrit le plan lui-même**.
  - `tester` n'est pas dans le tableau « Your team » de l'architect (5 lignes pour
    6 subagents) et aucune étape de la boucle ne l'appelle. Dans mon run il a quand même
    été appelé, parce que le modèle l'a vu dans la liste des subagents de l'outil `task` :
    c'est le modèle qui rattrape la config, pas la config qui le prévoit — un modèle plus
    obéissant au prompt ne l'appellerait jamais.
  - Le README annonce « six subagents » : il n'y en avait que cinq joignables.
- **Cause** : `.opencode/agent/planner.md`, `.opencode/agent/architect.md`.
- **Brique** : subagents.
- **Correction** : `planner` en `mode: subagent` ; `tester` ajouté à l'équipe et à l'étape
  « Verify » de la boucle.
- **Preuve** : `avant/13-roles-incoherents.png`, `avant/07-droits-effectifs-des-agents.png`, `avant/16-exercice1-chaine-avant-resume.png`.

### 2.11 Droits : l'architect « qui n'écrit jamais de code » a tous les droits

- **Symptôme** : l'architect peut éditer, lancer n'importe quelle commande, `git commit`,
  `git push`. Son prompt dit en plus : « *If a question can be answered by a subagent, it
  can also be answered by you* » et « *you also have full access to the repository — use
  whichever is faster* », ce qui inverse toute la logique d'orchestration (sa propre
  description : « Never writes code »). Dans le run d'origine, il lit lui-même 13 fichiers
  et relance lui-même les commandes.
- **Cause** : `.opencode/agent/architect.md`, commit `865177b « architect: unblock, trop de
  refus de permission en session »` (passage de `edit: deny` / bash en liste blanche à
  `edit: allow` / `bash: "*": allow`).
- **Brique** : droits, subagents.
- **Correction** : permissions d'origine restaurées (+ `npm test`, `typecheck`, `lint`
  pour qu'il vérifie lui-même — c'est de la lecture), règle de délégation remise dans le
  bon sens.
- **Preuve** : `avant/12-architect-unblock.png`, `avant/07-droits-effectifs-des-agents.png`.

### 2.12 Droits : `dev`, `reviewer`, `explorer` ne correspondent pas à leur rôle

| Agent | Problème (avant) | Pourquoi c'est faux | Correction |
|---|---|---|---|
| `dev` | `task: allow` + « split it and send the parts to other `dev` agents » | contredit l'architect (« never send two `dev` agents at the same files ») : délégation récursive incontrôlée | `task: deny`, il rend la main pour découper |
| `dev` | `git commit` autorisé | son prompt : « Do not commit » | `git commit*: deny` |
| `dev` | « Report back in whatever shape fits » | l'architect exige des preuves | format de retour avec les commandes lancées et leurs codes |
| `reviewer` | `edit: allow`, description « fixes what it finds », règle « Fix what you find » | son prompt : « *You did not write this code, and that is the only reason your opinion is worth anything* ». Un relecteur qui corrige relit son propre code | `edit: deny`, il signale ; il peut lancer tests et mutation pour démontrer |
| `explorer` | `edit: allow` partout, `curl*: allow` « to check an internal service » | rôle de lecture ; `curl` libre + `.env` lisible = fuite possible | édition limitée à `.opencode/plans/*-notes.md` (son prompt dit d'y écrire), plus de `curl`, `webfetch: ask` |

- **Brique** : droits. **Preuve** : `avant/13-roles-incoherents.png`, `avant/07-droits-effectifs-des-agents.png`,
  et le run d'origine (le reviewer a modifié le code qu'il relisait).

### 2.13 Commande `/ship` : livrer sans vérifier, sans relire, sans demander

- **Symptôme** : `/ship` fait `git add -A && git commit && git push` « sans poser de
  question », « ne relance pas les checks », « ne demande pas de relecture ».
- **Cause** : `.opencode/command/ship.md`. Combiné à : un hook post-écriture qui ne bloque
  jamais (voulu, cf. 3), un pre-commit jamais branché (2.7), une CI sans tests (2.8), un
  architect qui peut pousser (2.11) et `.env` versionné (2.15) → `git add -A` + push sur
  `main` sans aucune barrière, en contradiction avec « ne pas commiter dans `main` » et
  « the human decides when work is shipped » (`dev.md`).
- **Brique** : skills / commands.
- **Correction** : `/ship` relance les checks, exige un verdict du `reviewer`, résume et
  **demande confirmation** ; commit sur une branche, push et PR par l'humain.
- **Preuve** : `avant/14-ship-et-hook-post-ecriture.png`.

### 2.14 MCP : six déclarés, trois répondent, aucun ne sert

- **Symptôme** (`opencode mcp list`) : `salles-db` **failed** (hôte `.lan` injoignable),
  `slack` **failed**, `sentry` **needs authentication** ; `github`, `notion`, `playwright`
  « connected » mais sans jeton (github, notion) ou sans objet (playwright pour une API
  sans interface).
  - **Aucun** agent de la chaîne ne peut les utiliser : tous ont `"*": deny` sans autoriser
    leurs outils. Mesure : l'architect consomme **6 912 tokens** avec ou sans MCP.
  - Mais tout agent qui les voit (agent `build` par défaut, `Tab` dans la TUI) paie
    **41 515 tokens au lieu de 10 511** au premier appel : **+31 000 tokens** de schémas
    d'outils inutiles à chaque requête, et des serveurs `npx` lancés à chaque session.
  - `"Bearer ${SALLES_MCP_TOKEN}"` : ce n'est pas la syntaxe OpenCode (`{env:VAR}`), la
    chaîne littérale serait envoyée.
  - `@modelcontextprotocol/server-github` est un paquet **déprécié** sur npm ;
    `@playwright/mcp@latest` n'est pas épinglé.
- **Cause** : `opencode.json` (commits `859b197`, `ab57521`).
- **Brique** : MCP, contexte.
- **Correction** : `notion`, `slack`, `sentry`, `playwright` retirés (hors du périmètre du
  service). `salles-db` et `github` conservés mais **`enabled: false`** avec la bonne
  syntaxe `{env:…}` : `salles-db` n'a de sens qu'avec la vraie base (INFRA-140, le
  stockage est en mémoire), `github` exige un jeton. `.env.example` documente
  `SALLES_MCP_TOKEN`.
- **Preuve** : `avant/08-mcp-declares-repondent-servent.png`, `apres/06-mcp-et-contexte.png` (contexte de l'agent `build` : 41 515 → 10 876 tokens).

### 2.15 Secrets : `.env` est versionné

- **Symptôme** : `.env` est suivi par Git (commit `ecd0790`) et absent du `.gitignore`,
  avec une URL Postgres **mot de passe compris** et un `SESSION_SECRET`.
- **Cause** : `.env`, `.gitignore`.
- **Brique** : Git (et droits : un agent avec `curl` libre et `read` sur `.env` peut
  l'exfiltrer, cf. `explorer`).
- **Correction** : `.env` retiré de l'index et ajouté au `.gitignore`, `.env.example` créé.
  **Ce qui reste à faire hors dépôt** : les valeurs restent dans l'historique Git, il faut
  **changer le mot de passe de la base et le `SESSION_SECRET`**. Je n'ai pas réécrit
  l'historique (dépôt partagé, réécriture = force-push sur `main`).
- **Je ne compte pas** la `STRIPE_SECRET_KEY` : elle est explicitement annotée « JEU DE
  DONNÉES PÉDAGOGIQUE, aucune valeur réelle » et vaut `sk_test_FAKE_…`.
- **Preuve** : `avant/11-secrets-env-versionne.png`.

### 2.16 Hook post-écriture : il ment sur son branchement et ne voit pas tous les tests

- **Symptôme** : `scripts/checks.sh` dit être « branché dans `opencode.json`
  (`experimental.hook.file_edited`) » : `opencode.json` ne contient aucun hook. C'est en
  réalité `.opencode/plugin/checks.js` qui l'appelle. Et il lance `test:unit`, donc ne voit
  pas les tests de 2.4 : un agent qui casse la tarification n'en est jamais averti.
- **Cause** : `scripts/checks.sh`, `.opencode/plugin/checks.js`.
- **Brique** : hooks.
- **Correction** : commentaire corrigé ; `npm test` ; le plugin réagit aussi aux outils
  `multiedit` / `patch` / `apply_patch` (sinon une écriture par patch échappe au check) et
  utilise `.nothrow()`.
- **Preuve** : `avant/14-ship-et-hook-post-ecriture.png` ;
  `avant/19-hook-post-ecriture-dans-la-session-dev.png` : dans le run de l'exercice 1, le
  plugin **tourne** (9 déclenchements dans la session `dev`) mais n'affiche que les
  `*.spec.ts` — « 22 passed » alors que le test de tarification, jamais lancé, est rouge.

---

## 3. Ce qui ressemble à une erreur mais est voulu — non signalé comme défaut

| Élément | Pourquoi je le garde |
|---|---|
| `scripts/checks.sh` renvoie toujours `0` | Délibéré et commenté (INFRA-231) : un hook **post**-écriture informe l'agent, il ne doit pas l'interrompre. Le verrou bloquant est ailleurs — et c'est lui qui était cassé (2.7, 2.8). |
| `it.skip` « ne trouve aucun chevauchement dans l'export de l'ancien système » | « SKIP ASSUMÉ » : la fixture `test/fixtures/legacy-bookings.json` n'a jamais été versée (INFRA-198) ; le réactiver échouerait au chargement. Conservé tel quel. |
| `vitest.config.ts` n'inclut que `*.spec.ts` | Convention INFRA-205, commentée. J'ai renommé les fichiers, pas élargi la règle. |
| Pas de JSDoc dans `src/lib/` alors que `AGENTS.md` l'exige partout | Règle de chemin : `src/lib/AGENTS.md` dit « Pas de JSDoc ici ». |
| `src/store.ts` jamais modifié, données en mémoire | « Ne pas toucher à `src/store.ts` : il disparaît avec INFRA-140 ». Respecté ; je le teste sans le modifier. |
| `STRIPE_SECRET_KEY` dans `.env` | Fausse clé de test annotée comme jeu de données pédagogique. |
| `tester` avec `bash "*": allow` et écriture limitée à `.opencode/scratch/**` | Son rôle est de lancer l'appli ; il ne peut ni commiter, ni pousser, ni modifier le code. `.opencode/scratch/` est dans le `.gitignore`. |
| `planner` n'écrit que dans `.opencode/plans/*.md` | Par conception (« You cannot touch anything else, by design »). |
| `finder` / `explorer` / `tester` sur le modèle `flash` | Discipline de coût explicite dans le prompt de l'architect. |
| Pas de skills dans le dépôt | Absence défendable : le seul workflow packagé utile (`/ship`) est une command ; rien ne justifie un skill de plus. |

## 4. Ce que j'ai choisi de ne pas corriger

- **Historique Git contenant `.env`** : pas de réécriture d'historique (force-push sur un
  dépôt partagé) ; rotation des secrets à faire par l'équipe.
- **`src/lib/AGENTS.md` exige « un `export default` par module »** pour des « scripts de
  facturation » ; aucun module de `src/lib/` n'en a, et ces scripts ne sont pas dans le
  dépôt. Je ne peux pas vérifier qui dépend de quoi : je le signale plutôt que d'ajouter
  des exports au hasard.
- **Convention 1 (JSDoc)** non respectée par `createApp` et les fonctions de `store.ts` :
  `store.ts` est intouchable, et l'imposer par le lint demanderait une nouvelle
  dépendance (`eslint-plugin-jsdoc`), à discuter avec l'équipe.
- **Les modèles `deepseek-v4-*`** restent ceux du dépôt : leur indisponibilité chez moi
  vient de mon compte, pas du dépôt.
- **Protection de branche sur GitHub** : « ne pas commiter dans `main` » est maintenant
  vérifié en local par le hook ; la vraie barrière est une règle de protection côté
  GitHub, qui se règle dans les paramètres du dépôt et non dans le code.
- **Dépendances ajoutées** (la règle dit « pas sans en parler » — j'en parle ici) :
  `@vitest/coverage-v8` (couverture en CI) et `@stryker-mutator/core` +
  `@stryker-mutator/vitest-runner` (mutation testing). Toutes en `devDependencies`. Husky
  n'a **pas** été ajouté : `core.hooksPath` suffit.
- **Un test instable observé une fois** : un commit a été bloqué par 2 échecs que je n'ai
  pas pu reproduire en 37 exécutions. Plutôt que de deviner, j'ai durci le helper HTTP des
  tests (attente de l'événement `listening`, fermeture des connexions keep-alive).

## Exercice 1 — avant / après

Même tâche, même prompt, lancée par `opencode run --agent architect` depuis une session
neuve, une fois sur le dépôt d'origine, une fois sur le dépôt réparé (modèle `big-pickle`
dans les deux cas, cf. « Comment j'ai travaillé »).

### Avant (dépôt d'origine)

Captures : `avant/16-exercice1-chaine-avant-resume.png`,
`avant/17-exercice1-tui-fin-de-session-avant.png`, `avant/18-exercice1-livre-mais-rouge.png`,
`avant/19-hook-post-ecriture-dans-la-session-dev.png`.

| Agent | Ce qui s'est passé |
|---|---|
| `finder` | **échec** au premier appel, aucun outil (0 appel) |
| `explorer` ×2 | travaillent (36 lectures), écrivent leurs notes |
| `planner` | **jamais appelé** (injoignable) : l'architect **écrit le plan lui-même** |
| architect | **13 lectures de fichiers et 9 commandes bash lui-même** ; ~420 000 tokens d'entrée cumulés dans sa session |
| `dev` | implémente, et suit la convention `Result` d'`AGENTS.md`… que le reste du code ne suit pas (`availability.ts` renvoie des `Result`, `validate.ts` lance des exceptions) ; corrige au passage `overlaps` (hors périmètre, mais signalé) |
| `reviewer` | **modifie lui-même** 3 fichiers qu'il est censé relire (2 `edit`, 2 `write`) |
| `tester` | appelé alors qu'il n'est pas dans l'équipe de l'architect (le modèle l'a vu dans la liste des subagents) ; trouve le bug de prix |

Ce qui échoue sans le dire : la chaîne conclut « **C'est livré** » sur la foi de
`npm run test:unit` (25 passed). Avec tous les fichiers de test, la suite est **rouge**
(`priceFor > ajoute la majoration de week-end` : `'5020'` au lieu de 70) ; le bug de prix est
mentionné « hors périmètre » et laissé en place ; le hook post-écriture a affiché du vert
au `dev` à chaque écriture.

### Après (dépôt réparé, session neuve)

Captures : `apres/10-exercice1-chaine-apres-resume.png`,
`apres/11-exercice1-tui-fin-de-session-apres.png`, `apres/12-exercice1-resultat-verifie.png`.

| Agent | Ce qui s'est passé |
|---|---|
| `finder` | **répond**, après 5 `glob`, 6 `grep`, 10 lectures |
| `explorer` | lit (22 lectures), écrit ses notes dans `.opencode/plans/rooms-availability-notes.md` — seul fichier qu'il a le droit d'écrire |
| `planner` | **appelé** ; écrit `.opencode/plans/rooms-availability.md` (hypothèses, cas limites, vérification écrite avant le code) |
| architect | 6 lectures (les notes et le plan qu'on lui désigne, quelques fichiers), 7 commandes de vérification ; **zéro écriture** ; une commande composée avec `echo` lui est refusée et il s'adapte |
| `dev` | implémente dans le style **réel** du dépôt (`ValidationError` attrapée dans la route, `export default` et pas de JSDoc dans `src/lib/`), rend la main avec ses checks |
| `reviewer` | **ne touche à rien** (0 écriture), lance les tests, et trouve un vrai bug : `?date=2026-10-05%0A` passait la regex (`$` accepte un saut de ligne final) → 200 avec les 12 créneaux libres. Verdict **BLOCKING** |
| `dev` (2ᵉ appel) | corrige sur la base du constat du reviewer, ajoute le test de non-régression |
| `tester` | appelé explicitement ; ~25 commandes sur l'appli réelle, confirme le 400 sur le cas piégé |

Résultat : **59 tests verts** (dont 17 nouveaux), typecheck strict et lint propres, et
l'architect ne commite pas : il demande. Le pre-commit refuserait de toute façon un commit
sur `main`.

### Comparatif

| | Avant | Après |
|---|---|---|
| Subagents qui ont réellement travaillé | 4 sur 6 (`finder` en échec, `planner` injoignable) | **6 sur 6** |
| Qui a écrit le plan | l'architect | le `planner` |
| Écritures par le `reviewer` | 4 | **0** |
| Lectures de fichiers par l'architect | 13 | 6 |
| Contexte final de l'architect (TUI) | 61,8 k tokens (31 %) | **50,7 k tokens (25 %)** |
| Tokens d'entrée cumulés, session architect | ~420 k | ~487 k (deux tours `dev` de plus, plus la relecture) |
| Ce que la chaîne a vérifié | `test:unit` (2 fichiers de test sur 4) | `npm test`, typecheck strict, lint réel, appli réelle |
| Suite complète à la fin | **rouge** (prix week-end) | **verte** |
| Bug introduit attrapé en cours de route | aucun | 1 (date avec saut de ligne) |

Le run « après » n'est **pas** moins cher en tokens cumulés : la boucle complète (un
plan, une réfutation, une correction) coûte des tours de plus. Ce qui baisse, c'est le
contexte que l'orchestrateur garde sur le dos, et ce qui monte, c'est la qualité de ce qui
sort.
