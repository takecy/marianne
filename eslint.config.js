import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "src-tauri/target/**",
      "src-tauri/gen/**",
      "node_modules/**",
      "coverage/**",
      // Astro Starlight workspace has its own toolchain and TS project; lint it
      // separately via `pnpm --filter ./site lint` when needed. Including it
      // here would trigger `typescript-eslint` projectService parsing errors
      // because the root tsconfig.json only covers `src/`.
      "site/**",
      // GitHub Pages publishing source = Astro build output. Generated HTML/JS
      // should never be linted.
      "docs/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.js"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
);
