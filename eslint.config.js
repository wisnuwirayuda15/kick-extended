import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

// Deliberately minimal. Prettier owns formatting; this only catches real
// mistakes. The source is migrated JavaScript, so the rules that would
// demand a rewrite are off.
export default tseslint.config(
  { ignores: ["dist/", "node_modules/", "*.user.js"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        GM_xmlhttpRequest: "readonly",
        GM_addStyle: "readonly",
        GM_setClipboard: "readonly",
        GM_info: "readonly",
        Hls: "readonly",
      },
    },
    rules: {
      // `any` at the Kick API boundary is a deliberate choice: those
      // responses are not stable enough to be worth typing.
      "@typescript-eslint/no-explicit-any": "off",
      // The migrated code uses empty catch blocks to mean "already gone".
      "no-empty": ["error", { allowEmptyCatch: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { caughtErrors: "none", argsIgnorePattern: "^_" },
      ],
    },
  },
);
