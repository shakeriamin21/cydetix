import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "dist/**",
    "coverage/**",
    "node_modules/**",
    "fixtures/**",
    "schemas/**",
    "rules/**",
    ".invariantsec/**",
    ".npm-cache/**",
    ".phase6-cache/**",
    ".docker-vibeshield/**",
  ]),
  eslint.configs.recommended,
  {
    files: ["scripts/*.mjs", "eslint.config.js"],
    languageOptions: {
      globals: { AbortSignal: "readonly", fetch: "readonly", process: "readonly" },
    },
  },
  ...tseslint.configs.strictTypeChecked.map((configuration) => ({
    ...configuration,
    files: ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"],
  })),
  {
    files: ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
]);
