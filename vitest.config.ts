import { readdirSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Normalisation du nommage des tests — ticket INFRA-205.
// La convention du depot est *.spec.ts.
// Un fichier de test qui ne suit pas la convention n'est jamais execute, en silence :
// on prefere casser la suite que de laisser passer ca.
const strays = readdirSync("test", { recursive: true, encoding: "utf8" }).filter(
  (f) => f.endsWith(".ts") && !f.endsWith(".spec.ts")
);
if (strays.length > 0) {
  throw new Error(`tests hors convention *.spec.ts, jamais executes : ${strays.join(", ")}`);
}

export default defineConfig({
  test: {
    include: ["test/**/*.spec.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/server.ts"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 }
    }
  }
});
