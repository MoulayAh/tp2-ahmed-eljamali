# Claude Code

Les conventions du depot sont dans AGENTS.md (partage avec OpenCode) :

@AGENTS.md

La chaine d'agents est portee dans `.claude/` : agent principal `architect`
(`.claude/settings.json` > `agent`), subagents dans `.claude/agents/`, commande `/ship`,
hook post-ecriture dans `.claude/hooks/checks.mjs`, serveurs MCP dans `.mcp.json`.
