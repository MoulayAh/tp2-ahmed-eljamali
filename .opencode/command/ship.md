---
description: Livre le travail en cours (checks, relecture du diff, commit sur une branche)
agent: architect
---


Livre le travail en cours. Chaque etape doit reussir avant la suivante ; au premier
echec, arrete-toi et montre la sortie.

1. `git branch --show-current` : si c'est `main`, refuse (AGENTS.md : on ne commite pas
   dans `main`) et propose de creer une branche.
2. `npm run check` : typecheck + lint + tests. Le hook post-ecriture ne bloque pas
   (INFRA-231), c'est donc ici que le rouge arrete la livraison. Rouge = pas de commit.
3. `git status --short` et `git diff --stat` : liste les fichiers modifies. N'ajoute que
   les fichiers de la tache, un par un (`git add <fichier>`), jamais `git add -A`, jamais
   `.env` ni un fichier qui contient un secret.
4. Verifie qu'un `reviewer` a rendu un verdict sur ce diff dans la session. Sinon,
   dis-le : un diff non relu ne part pas.
5. Montre au developpeur la liste des fichiers et le message de commit propose
   (`feat: <resume en une ligne>`), puis commite apres son accord.
6. Ne pousse pas : le push et la PR sont faits par le developpeur, la CI tourne sur la PR.
