import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Mise en place du lint — ticket INFRA-212.
// Socle : regles recommandees JS + TypeScript, plus les regles qui protegent les
// conventions de AGENTS.md.
export default tseslint.config(
  { ignores: ["node_modules/", "coverage/", "dist/"] },
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      eqeqeq: "error",
      "no-eval": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  },
  {
    // Les tests HTTP lisent des corps JSON arbitraires.
    files: ["test/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" }
  }
);
