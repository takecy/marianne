import "@testing-library/jest-dom/vitest";

// Lock the test locale to en-US so component tests are deterministic regardless
// of the CI machine's environment. Individual tests (e.g. translate.test.ts)
// can override this via Object.defineProperty.
Object.defineProperty(navigator, "language", {
  value: "en-US",
  configurable: true,
  writable: true,
});
