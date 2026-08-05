import oxlintConfig from "../../.oxlintrc.json";

// Guards the lint safety net itself, not application code.
//
// oxlint's default `correctness` category covers only unambiguous bugs. The rules
// that carried the old ESLint config's discipline (no-explicit-any, prefer-const,
// ban-ts-comment, ...) live in other categories and only run because
// `.oxlintrc.json` lists them explicitly. Deleting an entry there — or dropping a
// plugin from `plugins`, or weakening `categories.correctness` — silently reduces
// coverage while `pnpm lint` keeps passing.
//
// The baselines below are a second, independent record of what must stay enabled,
// so removing a rule fails here and forces a deliberate edit. Rule *names* need no
// guarding: oxlint refuses to start when `.oxlintrc.json` names an unknown rule,
// and `pnpm lint` runs ahead of the tests in CI.

const plugins: readonly string[] = oxlintConfig.plugins;
const rules: Readonly<Record<string, string>> = oxlintConfig.rules;

/** Every plugin that supplies rules we depend on. `plugins` overrides oxlint's
 *  default set rather than extending it, so a missing entry disables that
 *  plugin's rules wholesale. */
const REQUIRED_PLUGINS = ["oxc", "react", "typescript", "unicorn"];

/** Rules that replace `eslint-plugin-react-hooks`. `react/react-compiler` alone
 *  subsumes the former `refs` / `purity` / `immutability` / `set-state-in-effect`
 *  family, so losing it is a much bigger regression than the name suggests. */
const REACT_SAFETY_RULES = [
  "react/exhaustive-deps",
  "react/react-compiler",
  "react/rules-of-hooks",
];

/** Reproduce the former `tseslint.configs.strict` + `stylistic` presets. None of
 *  these are in `correctness`, so each one needs its explicit entry to run. */
const RESTORED_ESLINT_RULES = [
  "no-array-constructor",
  "no-case-declarations",
  "no-empty",
  // oxlint resolves the `typescript/`-prefixed form to this core name.
  "no-empty-function",
  "no-fallthrough",
  "no-prototype-builtins",
  "no-regex-spaces",
  "no-unexpected-multiline",
  "no-useless-assignment",
  "no-useless-constructor",
  "no-var",
  "prefer-const",
  "prefer-rest-params",
  "prefer-spread",
  "preserve-caught-error",
  "typescript/adjacent-overload-signatures",
  "typescript/array-type",
  "typescript/ban-ts-comment",
  "typescript/ban-tslint-comment",
  "typescript/class-literal-property-style",
  "typescript/consistent-generic-constructors",
  "typescript/consistent-indexed-object-style",
  "typescript/consistent-type-assertions",
  "typescript/consistent-type-definitions",
  "typescript/no-confusing-non-null-assertion",
  "typescript/no-dynamic-delete",
  "typescript/no-empty-object-type",
  "typescript/no-explicit-any",
  "typescript/no-extraneous-class",
  "typescript/no-inferrable-types",
  "typescript/no-invalid-void-type",
  "typescript/no-namespace",
  "typescript/no-non-null-asserted-nullish-coalescing",
  "typescript/no-non-null-assertion",
  "typescript/no-require-imports",
  "typescript/no-unnecessary-type-constraint",
  "typescript/no-unsafe-function-type",
  "typescript/prefer-for-of",
  "typescript/prefer-function-type",
  "typescript/prefer-literal-enum-member",
  "typescript/unified-signatures",
];

function notSetToError(expected: readonly string[]): string[] {
  return expected.filter((rule) => rules[rule] !== "error");
}

describe("oxlint configuration", () => {
  it("declares every plugin the rule set depends on", () => {
    expect(REQUIRED_PLUGINS.filter((name) => !plugins.includes(name))).toEqual([]);
  });

  it("keeps the correctness category failing the build", () => {
    expect(oxlintConfig.categories.correctness).toBe("error");
  });

  it("keeps the React safety net enabled", () => {
    expect(notSetToError(REACT_SAFETY_RULES)).toEqual([]);
  });

  it("keeps the rules restored from the former ESLint config enabled", () => {
    expect(notSetToError(RESTORED_ESLINT_RULES)).toEqual([]);
  });
});
