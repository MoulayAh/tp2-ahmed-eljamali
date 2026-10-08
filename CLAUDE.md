# Claude Code

Les conventions du depot sont dans AGENTS.md (partage avec OpenCode) :

@AGENTS.md

## La chaine d'agents

- Agent principal : `architect` (`.claude/settings.json` > `agent`). Il delegue, il
  n'ecrit pas de code.
- Subagents (`.claude/agents/`) : `finder`, `explorer`, `planner`, `dev`, `reviewer`,
  `tester`. Seul `dev` modifie le code.
- Hook post-ecriture : `.claude/hooks/checks.mjs` relance typecheck + lint + tests apres
  chaque ecriture de `.ts` et renvoie le resultat a l'agent (il avertit, il ne bloque pas).
- Ce qui bloque : le pre-commit husky, la commande `/ship` et la CI (`npm run check`).
- Droits : `.claude/settings.json` (commandes autorisees, `.env` illisible, pas de push).
- MCP : aucun (`.mcp.json` vide, voir DIAGNOSTIC.md).

La config OpenCode (`.opencode/`, `opencode.json`) est gardee alignee sur celle-ci.
