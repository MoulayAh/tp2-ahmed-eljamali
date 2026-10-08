// Port de .opencode/plugin/checks.js : des qu'un agent ecrit un fichier .ts, on relance
// typecheck + lint + tests et on renvoie la sortie a l'agent.
// Memes etapes que scripts/checks.sh, lancees depuis Node : le hook ne depend pas de bash
// (absent du PATH Windows hors Git Bash).
//
// INFRA-231 : le hook ne bloque pas l'agent en plein travail, il l'avertit. Le blocage
// a lieu plus tard : pre-commit (husky), commande /ship et CI lancent `npm run check`.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8").replace(/^﻿/, ""));
const file = input.tool_input?.file_path ?? "";
if (!file.endsWith(".ts")) process.exit(0);

let out = "";
let red = false;
for (const [label, script] of [["typecheck", "typecheck"], ["lint", "lint"], ["tests", "test"]]) {
  const res = spawnSync(`npm run --silent ${script}`, {
    cwd: input.cwd,
    encoding: "utf8",
    shell: true,
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" }
  });
  out += `--- ${label}${res.status === 0 ? "" : " : ROUGE"}\n${res.stdout ?? ""}${res.stderr ?? ""}`;
  if (res.status !== 0) red = true;
}
out = out.replace(/\x1b\[[0-9;]*m/g, "");

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext:
      (red ? "CHECKS ROUGES apres ton edition : corrige avant de rendre la main.\n" : "Checks verts.\n") +
      "--- checks post-ecriture ---\n" + out
  }
}));
