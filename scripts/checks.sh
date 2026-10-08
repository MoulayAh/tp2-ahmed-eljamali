#!/usr/bin/env bash
# Checks post-ecriture. Lance par les hooks des agents : .claude/hooks/checks.mjs (Claude Code)
# et .opencode/plugin/checks.js (OpenCode).
# Objectif : l'agent voit le resultat de ses checks sans qu'on ait a le lui demander.
set +e
status=0

echo "--- typecheck"
npm run --silent typecheck || status=1
echo "--- lint"
npm run --silent lint || status=1
echo "--- tests"
npm run --silent test:unit || status=1

if [ "$status" -ne 0 ]; then
  echo "--- au moins un check est rouge (voir plus haut)"
fi

# On renvoie toujours 0 : un check rouge ne doit pas interrompre l'agent en plein
# travail, il le verra dans la sortie et corrigera de lui-meme. (ticket INFRA-231)
exit 0
