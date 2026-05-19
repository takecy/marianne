// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import rehypeMermaid from "rehype-mermaid";

// https://astro.build/config
export default defineConfig({
  site: "https://takecy.github.io",
  base: "/marianne",
  trailingSlash: "always",
  // Build output goes to the repo's /docs directory, which is served by
  // GitHub Pages (Branch: main / Folder: /docs).
  outDir: "../docs",
  markdown: {
    // Object form is required to opt mermaid out of Shiki. The string form
    // `syntaxHighlight: "shiki"` makes Shiki claim every code fence early,
    // leaving rehype-mermaid nothing to operate on.
    syntaxHighlight: {
      type: "shiki",
      excludeLangs: ["mermaid"],
    },
    rehypePlugins: [
      // `inline-svg` renders Mermaid to real <svg> at build time via a
      // headless Chromium (Playwright). Requires `playwright install chromium`
      // once. The build output contains pre-rendered SVG that needs no
      // client-side JS — important for GitHub Pages where we want diagrams
      // to work even with JS disabled.
      [rehypeMermaid, { strategy: "inline-svg" }],
    ],
  },
  integrations: [
    starlight({
      title: "Marianne docs",
      defaultLocale: "root",
      locales: {
        root: { label: "English", lang: "en" },
        ja: { label: "日本語", lang: "ja" },
      },
      sidebar: [
        // Use `slug` (not `link`) so Starlight resolves the base prefix,
        // honours trailingSlash, and wires up the i18n locale switch.
        {
          label: "User Guide",
          translations: { ja: "ユーザーガイド" },
          collapsed: false,
          items: [
            { slug: "installation" },
            { slug: "features" },
            { slug: "keyboard-shortcuts" },
            { slug: "image-input" },
            { slug: "export" },
          ],
        },
        {
          label: "For Contributors",
          translations: { ja: "開発者向け" },
          collapsed: true,
          items: [
            { slug: "getting-started" },
            { slug: "running-locally" },
            { slug: "architecture" },
            { slug: "releasing" },
          ],
        },
        {
          label: "About",
          translations: { ja: "このプロジェクトについて" },
          collapsed: true,
          items: [
            { slug: "tribute" },
          ],
        },
      ],
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/takecy/marianne" },
      ],
    }),
  ],
});
