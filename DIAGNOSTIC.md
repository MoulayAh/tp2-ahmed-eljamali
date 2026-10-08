# DIAGNOSTIC — salles-api, « le repo malade »

TP 2 — Outils d'IA pour développeurs. Auteur : Ahmed Eljamali.

## Méthode

- **Outil : Claude Code** (CLI 2.1.293), et non OpenCode. La chaîne d'agents OpenCode du
  dépôt a d'abord été **portée à l'identique** vers Claude Code (commit `3a5a4f8`), défauts
  compris : `.claude/agents/` (mêmes prompts, mêmes droits effectifs), `.claude/settings.json`
  (agent principal `architect`, droits d'après le commit « unblock »), `.claude/commands/ship.md`,
  hook post-écriture `.claude/hooks/checks.mjs` (équivalent du plugin), `.mcp.json` (les 6 MCP),
  `CLAUDE.md` qui importe `AGENTS.md`.
- **Exercice 1 avant** : la tâche lancée sur cette chaîne malade, session neuve
  (`claude -p … --output-format stream-json`). Puis diagnostic et réparation. Puis **exercice 1
  après** : même tâche, même commande, session neuve, sur la chaîne réparée.
- **Preuves** : tout est montré par une commande lancée, avec capture PNG d'une vraie
  console Windows (`captures/`). Les journaux bruts des sessions sont dans `captures/logs/`
  (`*.jsonl`) ; les captures `ex1-*` en sont des résumés produits par un script qui ne
  fait que les relire.
- `captures/avant/` = état d'origine, `captures/reparation/` = le filet qui attrape les bugs
  puis l'état réparé, `captures/apres/` = exercice 1 relancé.

## Exercice 1 — ce qu'on a observé

| | Avant (chaîne malade) | Après (chaîne réparée) |
|---|---|---|
| Qui travaille | `architect` lit lui-même le code (`cat src/...` en Bash) et **écrit lui-même le plan** (Write) ; puis `dev`, puis `reviewer` | `architect` ne lit que le plan : `explorer` → `planner` → `dev` ×3 (une étape du plan par appel) → `reviewer` + `tester` en parallèle (`apres/ex1-2`) |
| Qui ne travaille jamais | `finder`, `explorer`, `planner`, `tester` | `finder` (l'explorer a suffi : pas de « where is X » isolé) |
| Qui écrit quoi | l'architecte écrit le plan, le dev écrit le code, le reviewer a le droit d'écrire | seul `dev` touche au code ; planner et explorer n'écrivent que dans `.opencode/plans/` ; l'explorer a tenté `Edit` : outil absent, refusé |
| Ce qui échoue sans le dire | le plan demande des tests `test/availability*.test.ts` : **vitest ne les aurait jamais exécutés** (`include: *.spec.ts`), et le hook post-écriture affichait « vert » sur 2 fichiers de test. Le `dev` s'en est aperçu par hasard et a renommé ses fichiers. 2 bugs existants restent dans le code sous une suite « verte ». Le `tester` n'existe pas pour la chaîne. | rien de silencieux : les refus de droits sont visibles et reformulés ; le reviewer dit qu'il n'a pas pu tout lancer ; le tester lance l'API (port 3100), envoie 41 requêtes (75 appels Bash) et trouve une **fuite de pile d'appels** (corrigée, n° 33) ; 5 réserves listées honnêtement dans le rapport |
| MCP | `salles-db` failed, `sentry` needs-auth, `github`/`notion`/`slack`/`playwright` pending → aucun outil MCP utilisable | aucun MCP du dépôt (les connecteurs `claude.ai …` affichés sont ceux du compte, hors dépôt) |
| Fin | 23 tests, 7 tours, 0,60 $ | 61 tests (63 après correction n° 33), couverture 99 %, `npm run check` vert, 0,91 $ |

Une première relance « après » (`captures/logs/exercice1-apres-essai1.jsonl`, `reparation/13`)
a montré que mes propres droits empêchaient le `tester` de démarrer l'API (n° 32) ; corrigé,
puis la relance définitive a été faite depuis une session neuve.

Captures : `avant/ex1-1` à `ex1-4`, `apres/ex1-1` à `ex1-4`. Diff produit avant : `captures/logs/exercice1-avant.diff`.

---

## Problèmes trouvés

Format : **symptôme** (preuve) — **cause** (fichier) — **brique** — **correction**.

### Rules

1. **`AGENTS.md` cite des commandes qui n'existent pas.** `npm test` (« à lancer avant tout
   commit ») et `npm run build` → `Missing script` (`avant/01`). — `AGENTS.md`, `package.json`
   — *rules* — scripts `test`, `coverage`, `check` ajoutés ; la ligne `build` retirée (pas de
   build : l'API tourne avec `tsx`) ; tableau des commandes réécrit.
2. **`AGENTS.md` impose les `Result`, le code fait des `throw`.** `src/lib/validate.ts`
   lève `ValidationError`, attrapée par un `try/catch` dans `src/routes/bookings.ts`
   (constaté par la chaîne elle-même, `avant/ex1-3`). — `AGENTS.md` — *rules* — la règle
   dit maintenant la vérité : `Result` pour le nouveau code, exception existante documentée.
3. **Dates : la règle dit « ISO 8601 UTC », le code accepte une date sans fuseau** (voir
   bug B3). — `AGENTS.md`, `src/lib/validate.ts` — *rules* — règle précisée + code corrigé.
4. **Sous Claude Code, la règle locale `src/lib/AGENTS.md` n'est jamais chargée** (Claude Code
   lit les `CLAUDE.md` des sous-dossiers, pas les `AGENTS.md`). — *rules* — `src/lib/CLAUDE.md`
   qui importe `@AGENTS.md`.

### MCP

5. **Aucun des 6 MCP ne répond ni ne sert.** (`avant/10`, `avant/ex1-1`) — `opencode.json` /
   `.mcp.json` — *MCP*
   - `salles-db` : `mcp.internal.salles.lan` n'existe pas dans le DNS, `SALLES_MCP_TOKEN` vide → `failed`.
   - `github`, `slack`, `notion` : aucun jeton (`GITHUB_PERSONAL_ACCESS_TOKEN`, `SLACK_BOT_TOKEN`,
     `NOTION_TOKEN` vides) ; aucun besoin dans un service de 6 fichiers.
   - `sentry` : HTTP 401 sans authentification → `needs-auth`.
   - `playwright@latest` : aucun front (0 fichier html/tsx/css) et version non épinglée (`@latest`
     = code tiers qui change à chaque lancement, risque supply-chain).
   - Correction : tous retirés de `.mcp.json`, `enabled: false` dans `opencode.json`. Absence
     défendable : rien ici n'en a besoin ; on en remettra un quand il aura un usage, un jeton
     et une version épinglée.

### Skills et commands

6. **`/ship` livre n'importe quoi.** `git add -A` (aurait embarqué `.env`, non ignoré :
   `avant/11`, `avant/13`), « ne relance pas les checks » alors que le hook ne bloque jamais
   (exit 0), « ne demande pas de relecture », `git push` sans question, même depuis `main`. —
   `.opencode/command/ship.md` — *commands* — réécrite : refuse `main`, relance `npm run check`
   (le rouge arrête), ajoute les fichiers un par un, exige un verdict `reviewer`, demande
   l'accord avant commit, ne pousse pas ; côté Claude Code `disable-model-invocation: true`
   (seul un humain la déclenche) et `allowed-tools` restreint.
7. Aucune skill packagée : absence défendable (rien de répétitif à packager à part `/ship`).

### Subagents

8. **`finder` répond sans avoir rien lu.** Ses droits OpenCode listent `read/glob/grep: allow`
   puis `"*": deny` **en dernier** : dans OpenCode la dernière règle qui correspond gagne, il
   n'a donc plus aucun outil. Démontré par exécution (port fidèle, `tools: TodoWrite`) : il ne
   lit rien et conjecture « le plus probable est une définition dans `src/lib/` »
   (`avant/16`). — `.opencode/agent/finder.md` — *subagents / droits* — `"*": deny` placé en
   premier ; côté Claude Code `tools: Read, Grep, Glob`. Après : `def: src/lib/overlap.ts:6` +
   tous les usages, en 7 s (`reparation/12`).
9. **`finder` contredit son rôle.** Description « Locate code and explain », sortie « prose,
   be generous with context », alors que l'architecte l'utilise pour « where is X » sur le
   modèle bon marché, et que l'explication est le rôle d'`explorer`. — `finder.md` — *subagents*
   — description et format de sortie ramenés à « liste `def:/use: path:line` ».
10. **`planner` n'est pas joignable.** `mode: primary` : un agent primaire n'est pas appelable
    par `task`. Avant : jamais appelé, l'architecte écrit le plan lui-même (`avant/ex1-2`). —
    `.opencode/agent/planner.md` — *subagents* — `mode: subagent`.
11. **`tester` n'est jamais utilisé** : il n'est pas dans le tableau « Your team » de
    l'architecte (`avant/ex1-2` : jamais appelé). — `architect.md` — *subagents* — ajouté à
    l'équipe et à l'étape « Verify ».

### Droits

12. **L'architecte « qui n'écrit jamais de code » a `edit: allow` et `bash "*": allow`.**
    Commit `865177b` « unblock, trop de refus de permission » (`avant/12`). Conséquence
    observée : il lit le code avec `cat` et écrit lui-même (`avant/ex1-2`). —
    `architect.md` — *droits* — droits d'avant `865177b` rétablis (lecture, git en lecture,
    `npm run check`/`npm test`) ; côté Claude Code pas d'`Edit`/`Write`.
13. **Le prompt de l'architecte dit le contraire de sa propre règle** : « If a question can
    be answered by a subagent, it **can also** be answered by you » + « you also have full
    access to the repository — use whichever is faster ». — `architect.md` — *droits / rules*
    — « it **must not** be answered by you » ; l'architecte lit plans, briefs et diffs, pas le
    code.
14. **Le `reviewer` corrige ce qu'il relit** (`edit: allow` + « Fix what you find »,
    description « fixes what it finds ») : il n'est plus indépendant, et c'est le seul
    argument de son verdict. — `reviewer.md` — *droits* — `edit: deny`, il signale, `dev` corrige.
15. **`dev` peut déléguer à d'autres `dev`** (`task: allow` + « send the parts to other `dev`
    agents ») alors que l'architecte doit garantir « never two dev agents at the same files ».
    — `dev.md` — *droits* — `task: deny`, il propose un découpage à l'architecte ; format de
    rapport imposé (fichiers, checks, surprises).
16. **`explorer` peut écrire partout et exfiltrer** : `edit: allow` sans restriction de chemin,
    `curl*: allow` + `webfetch` (« use curl freely … an internal service »), alors que `.env`
    (mot de passe BDD, secret de session) était versionné et lisible. — `explorer.md` —
    *droits* — édition limitée à `.opencode/plans/*-notes.md`, plus de `curl` ni `webfetch`.
17. **Côté Claude Code, droits de session** : `.claude/settings.json` autorise une liste de
    commandes (npm, git en lecture, curl), demande pour `git add/commit` et `npm install`,
    interdit `Read(.env)`, `git push`, `git reset --hard`, `rm -rf` (`reparation/10`).

### Hooks

18. **Le pre-commit husky n'a jamais tourné.** Pas de `husky` dans les dépendances, pas de
    script `prepare`, `core.hooksPath` vide, pas de `.git/hooks/pre-commit` (`avant/08`) ; il
    utilisait en plus l'ancien format (`. "$(dirname "$0")/_/husky.sh"`). — `package.json`,
    `.husky/pre-commit` — *hooks* — `husky` v9 + `prepare` (branché par `npm install`),
    pre-commit = `npm run check`. Preuve qu'il bloque : `reparation/06` (`eqeqeq` → commit refusé).
19. **Le hook post-écriture était vert pour de mauvaises raisons** : il lance `test:unit`,
    qui n'exécutait que 2 fichiers sur 4 (`avant/02`). — corrigé par T1.
20. **Commentaire mensonger** : `scripts/checks.sh` se dit « branché dans opencode.json
    (`experimental.hook.file_edited`) » ; cette clé n'existe pas, c'est le plugin
    `.opencode/plugin/checks.js` qui l'appelle. — `scripts/checks.sh` — *hooks* — corrigé.
21. **Le hook dépend de `bash`**, absent du PATH Windows hors Git Bash : « 'bash' n'est pas
    reconnu… » — trouvé en testant le hook porté. — `.claude/hooks/checks.mjs` — *hooks* — le
    hook Claude Code lance les scripts npm depuis Node et signale clairement le rouge
    (« CHECKS ROUGES … », `reparation/07`).

### Lint et types

22. **ESLint ne vérifie rien** : `rules: {}`, aucune config recommandée. `eval`, `==`,
    `debugger` passent, code de sortie 0 (`avant/06`). — `eslint.config.js` — *lint* —
    `js.configs.recommended` + `tseslint.configs.recommended` + `eqeqeq`, `no-eval`,
    `ban-ts-comment`. Relancé sur le code existant : il attrape `@ts-nocheck` (`reparation/01`).
23. **Le typecheck ne vérifie presque rien** : `strict: false`, `noImplicitAny: false`,
    `strictNullChecks: false`, et `// @ts-nocheck` sur `src/lib/price.ts` (`avant/07`). —
    `tsconfig.json`, `price.ts` — *types* — `strict: true`, `@ts-nocheck` retiré. Relancé : il
    attrape le bug B2 (`TS2322 string → number`, `reparation/01`).

### Tests

24. **T1 — la moitié des tests ne s'exécute jamais.** `vitest.config.ts` n'inclut que
    `*.spec.ts` ; `test/bookings.test.ts` et `test/price.test.ts` sont ignorés en silence
    (`avant/03` : « No test files found »). Exécutés à la main : 2 échecs (`avant/04`). —
    `vitest.config.ts` — *tests* — la convention `*.spec.ts` (INFRA-205) est gardée, les deux
    fichiers sont renommés, et la config **fait échouer la suite** si un test est hors convention.
25. **T2 — tests skippés ou vides** : « bout à bout » skippé (il échoue : bug B1) ; « inclus »
    et « identiques » = `expect(true).toBe(true)` (`avant/02`). — `test/overlap.spec.ts` —
    *tests* — réactivés et écrits pour de vrai.
26. **T3 — `store.spec.ts` teste un double, pas le store** : 2 tests sur 3 ne prouvent rien
    sur le code. — *tests* — réécrit sur le vrai store (lecture seule, `store.ts` non touché).
27. **T4 — ce que prouvent les tests, mesuré** : couverture **21 %** des lignes, routes à 0 %
    (`avant/14`) → **98,8 %** avec seuils dans la config (`reparation/05`). Mutation testing
    (Stryker) : score **4,6 %** (139 mutants jamais couverts) → **81,9 %**
    (`avant/15`, `reparation/04`). Tests ajoutés : `test/rooms.spec.ts`, et dans
    `bookings.spec.ts` création + prix, majoration week-end, 409, champs invalides, date sans
    fuseau, `GET /bookings`, `DELETE`.

### Bugs du code trouvés par le filet réparé

- **B1 — deux réservations bout à bout sont refusées (409).** `overlaps()` compare avec `<=`
  alors que son commentaire dit `[début, fin[` (`avant/04`, `avant/05`). — `src/lib/overlap.ts`
  — `<` strict (`reparation/09` : 201 puis 201).
- **B2 — la majoration week-end est une concaténation de chaînes** : `WEEKEND_SURCHARGE = "20"`,
  prix renvoyé `"5020"` au lieu de `70` (`avant/04`, `avant/05`), masqué par `@ts-nocheck`. —
  `src/lib/price.ts` — `20` (nombre) (`reparation/09` : `"price":70`).
- **B3 — une date sans fuseau est acceptée** et lue à l'heure locale du serveur (signalé par
  le `reviewer` pendant l'exercice 1 avant, `avant/ex1-3`, puis confirmé par un test,
  `reparation/03`). — `src/lib/validate.ts` — fuseau explicite exigé (`reparation/09` : 400).

### CI et Git

28. **La CI ne lance pas les tests** : `# - run: npm run test:unit   # TODO remettre, ca
    bloquait les merges` (commit `07a2c4d` « fix ci »), et pas de typecheck (`avant/09`). Les
    tests « bloquaient » parce que le code avait des bugs. — `.github/workflows/ci.yml` — *CI*
    — typecheck + lint + tests avec couverture et seuils.
29. **`.env` versionné** avec le mot de passe de la base de recette et le secret de session
    (commit `ecd0790`), et non ignoré (`avant/11`). — `.env`, `.gitignore` — *Git* — retiré de
    l'index, ignoré, `.env.example` ajouté (`reparation/11`) ; lecture interdite aux agents.

### Spécifique au port Claude Code

30. **Claude Code ignorait toute la chaîne** : il ne lit ni `AGENTS.md`, ni `.opencode/`, ni
    `opencode.json`. — *rules / subagents* — `CLAUDE.md`, `.claude/agents`, `.claude/settings.json`,
    `.claude/commands/ship.md`, `.claude/hooks/checks.mjs`. Les deux configurations sont
    gardées alignées (mêmes prompts, mêmes droits).
31. **Le modèle configuré n'existe pas sans compte OpenCode Zen** :
    `opencode models opencode/deepseek-v4-pro` → `Provider not found`. Sous Claude Code les
    agents tournent sur `opus` (architecte), `sonnet` (planner, dev, reviewer) et `haiku`
    (finder, explorer, tester), même logique de coût.

### Trouvé en relançant la chaîne réparée

32. **Mes propres droits étaient trop serrés pour le `tester`.** À la première relance de
    l'exercice 1 (`captures/logs/exercice1-apres-essai1.jsonl`), la chaîne a bien délégué
    (explorer → planner → dev ×2 → reviewer + tester), mais le `tester` n'a jamais pu lancer
    l'API : ses commandes composées (`cd … && npm start`, `curl … ; echo …`) sont refusées par
    la liste d'autorisations, et le port 3000 était pris par un serveur que j'avais laissé
    tourner. L'architecte l'a dit honnêtement dans son rapport (`reparation/13`). —
    `.claude/settings.json`, `.claude/agents/tester.md`, `CLAUDE.md` — *droits* — `PORT=3100 npm
    start` autorisé, consigne « une commande simple par appel, pas de `cd` ni `&&` » dans
    `CLAUDE.md` et le prompt du tester. Relance définitive : `apres/ex1-*`.
    Compromis assumé : des droits stricts font perdre quelques appels aux agents (commandes
    refusées puis reformulées), en échange d'une chaîne qui ne peut ni lire `.env`, ni pousser,
    ni lancer n'importe quoi.
33. **Les erreurs d'Express fuient la pile d'appels et les chemins du serveur.** Trouvé par le
    `tester` de la chaîne réparée : `GET /rooms/%E0%A4%A` (et tout corps JSON invalide)
    renvoie la page HTML d'erreur d'Express avec `URIError … at decode_param
    (C:\Users\…\node_modules\express\…)` (`reparation/14`). Bug antérieur à la tâche. —
    `src/app.ts` — *code / tests* — gestionnaire d'erreurs JSON (`{"error":"requete
    invalide"}`, 400 ; 500 sans détail), deux tests écrits d'abord en rouge (`reparation/15`).

---

## Ce qui ressemble à une erreur et n'en est pas une (laissé tel quel)

- **`scripts/checks.sh` renvoie toujours 0** : choix documenté (INFRA-231), le hook avertit
  l'agent sans l'interrompre. Gardé. Ce qui manquait, c'était un point qui bloque : il est
  maintenant au pre-commit, dans `/ship` et en CI.
- **Le test « export de l'ancien système » reste skippé** : la fixture
  `test/fixtures/legacy-bookings.json` n'a jamais été versée (INFRA-198), le commentaire
  l'explique ; le réactiver ferait échouer au chargement, pas sur une assertion.
- **`src/lib/` sans JSDoc** alors que la règle racine l'exige : règle de chemin
  (`src/lib/AGENTS.md`), la plus locale gagne. Seule correction : la rendre visible à Claude Code.
- **Convention `*.spec.ts`** (INFRA-205) : gardée ; c'est le nommage des fichiers qui était faux.
- **`src/store.ts` non modifié** (« disparaît avec INFRA-140 ») : les tests le lisent seulement.
- **`dev` : `git push*: deny`**, **`tester` : écriture limitée à `.opencode/scratch/**`**,
  **`planner` : écriture limitée à `.opencode/plans/*.md`** : droits corrects pour leur rôle.
- **`STRIPE_SECRET_KEY` de `.env`** : marquée « jeu de données pédagogique, aucune valeur
  réelle ». Ce n'est pas elle le problème, ce sont les deux autres secrets.

## Ce que j'ai choisi de ne pas corriger

- **L'historique Git contient toujours `.env`** (`ecd0790`). Le réécrire demande un
  force-push sur un dépôt partagé ; la vraie correction est la **rotation** du mot de passe
  BDD et de `SESSION_SECRET` par l'équipe qui les possède.
- **`validate.ts` lève toujours des exceptions** au lieu de renvoyer des `Result` : migration
  hors tâche, aucun bug ; la règle documente maintenant l'exception.
- **`src/lib/AGENTS.md` exige un `export default` par module**, aucun module ne l'a : les
  « scripts de facturation » qui en dépendraient ne sont pas dans le dépôt, impossible de
  vérifier l'usage. Signalé, pas modifié.
- **Le plugin OpenCode appelle toujours `bash scripts/checks.sh`** : correct sous Linux/macOS
  et Git Bash ; le hook Claude Code, lui, ne dépend plus de bash.
- **Les noms de modèles d'`opencode.json`** sont gardés : ils sont valides avec un compte Zen.
- **Réserves du rapport final de l'exercice 1 après** (date `9999-12-31` → année à 6 chiffres,
  message d'erreur confus pour un `date` répété, un test « date répétée » trop faible) : mineures,
  propres au nouvel endpoint, laissées pour un ticket de suivi.
- **Le `tester` n'a pas pu arrêter son serveur** (pas de `kill`/`taskkill` dans les droits) et
  l'a signalé ; arrêté à la main. Donner ce droit sans restriction permettrait de tuer
  n'importe quel processus : je préfère le signalement.
- **Pas d'étape de build** ajoutée : le service tourne avec `tsx` en production depuis huit
  mois ; ce n'est pas l'objet du TP.

## Index des captures

`captures/avant/` : 01 rules · 02 tests verts + skips · 03 `*.test.ts` jamais exécutés ·
04 tests cachés = 2 bugs · 05 API (409 bout à bout, prix `"5020"`) · 06 lint vide ·
07 types · 08 husky absent · 09 CI · 10 MCP · 11 `.env` · 12 droits des agents ·
13 `/ship` · 14 couverture 21 % · 15 mutation 4,6 % · 16 finder sans outils ·
ex1-1..4 exercice 1 avant.

`captures/reparation/` : 01 lint + types attrapent `price.ts` · 02 tests attrapent 2 bugs ·
03 test attrape la date sans fuseau · 04 mutation 81,9 % · 05 couverture 98,8 % ·
06 pre-commit bloque · 07 hook signale le rouge · 08 `npm test` / `npm run check` ·
09 API corrigée · 10 agents et droits · 11 `.env` hors dépôt · 12 finder lit ·
13 première relance : tester bloqué par mes droits · 14 fuite de pile trouvée par le tester ·
15 erreurs JSON corrigées.

`captures/apres/` : ex1-1..4 exercice 1 relancé depuis une session neuve.
