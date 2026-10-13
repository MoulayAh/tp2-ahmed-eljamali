import tseslint from "typescript-eslint";

// Mise en place du lint — ticket INFRA-212.
// Socle : les regles recommandees de typescript-eslint. Elles interdisent notamment
// `@ts-nocheck`, qui masquait un bug de type dans src/lib/price.ts.
export default tseslint.config({
  files: ["src/**/*.ts", "test/**/*.ts"],
  extends: [tseslint.configs.recommended],
  languageOptions: {
    parserOptions: { ecmaVersion: "latest", sourceType: "module" }
  },
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    // Un test desactive doit etre justifie par un commentaire (cf. test/overlap.spec.ts).
    "no-restricted-properties": [
      "warn",
      { object: "it", property: "only", message: "it.only ne doit pas etre commite." },
      { object: "describe", property: "only", message: "describe.only ne doit pas etre commite." }
    ]
  }
});
