// Port de .opencode/plugin/checks.js : des qu'un agent ecrit un fichier .ts, on relance
// typecheck + lint + tests (scripts/checks.sh) et on renvoie la sortie a l'agent.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const file = input.tool_input?.file_path ?? "";
if (!file.endsWith(".ts")) process.exit(0);

const out = execSync("bash scripts/checks.sh", { cwd: input.cwd, encoding: "utf8" });
console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: "--- checks post-ecriture ---\n" + out
  }
}));
