---
description: Prepare la livraison du travail en cours (checks, revue, branche, commit) — sans pousser sur main
agent: architect
---

Prepare la livraison du travail en cours. Chaque etape doit etre prouvee par une commande
lancee et sa sortie, pas par un rappel de ce qui a ete fait plus tot.

1. `git status` et `git diff --stat` : liste ce qui va partir. Si `.env`, un secret ou un
   fichier hors du perimetre de la tache apparait, arrete-toi et signale-le.
2. Relance les checks toi-meme : `npm run typecheck`, `npm run lint`, `npm test`. Le hook
   post-ecriture ne bloque rien (INFRA-231) : un rouge qu'il a affiche peut etre reste rouge.
   Un seul check rouge et la livraison s'arrete, avec la sortie.
3. Envoie le diff au `reviewer`. Seul `VERDICT: NOTHING FOUND` ou `VERDICT: NON-BLOCKING`
   permet de continuer.
4. Donne a l'humain le resume du diff, les sorties des checks et le verdict, puis demande
   sa confirmation. Le commit (sur une branche `feat/<slug>`, jamais sur `main`), le push et
   la PR sont faits par l'humain : la CI tourne sur la PR.
