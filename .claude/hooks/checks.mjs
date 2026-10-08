// Port de .opencode/plugin/checks.js : des qu'un agent ecrit un fichier .ts, on relance
// typecheck + lint + tests (scripts/checks.sh) et on renvoie la sortie a l'agent.
//
// INFRA-231 : le hook ne bloque pas l'agent en plein travail, il l'avertit. Le blocage
// a lieu plus tard : pre-commit (husky), commande /ship et CI lancent `npm run check`.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const file = input.tool_input?.file_path ?? "";
if (!file.endsWith(".ts")) process.exit(0);

let out;
try {
  out = execSync("bash scripts/checks.sh", { cwd: input.cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
} catch (err) {
  out = `--- le script de checks n'a pas pu s'executer : ${err.message}\n--- au moins un check est rouge`;
}
out = out.replace(/\x1b\[[0-9;]*m/g, "");
const red = out.includes("au moins un check est rouge");

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext:
      (red ? "CHECKS ROUGES apres ton edition : corrige avant de rendre la main.\n" : "Checks verts.\n") +
      "--- checks post-ecriture ---\n" + out
  }
}));
