# pele.live

A clean Mermaid playground powered by [Pele](https://github.com/obsidianmd/pele).
No accounts, no subscription — diagrams render locally in your browser and the
diagram data never leaves it (page views are counted by Vercel Analytics).

**Live at [pele-live.vercel.app](https://pele-live.vercel.app/)**

## Features

- **Fast local rendering** — pele renders synchronously with zero dependencies;
  every diagram type built into Mermaid 12.1.0
- **Editor** — CodeMirror with mermaid syntax highlighting, error squiggles on
  the offending line, and a config panel (JSON)
- **Sharing** — links carry the diagram (deflated, base64url); they also open
  in mermaid.live, and mermaid.live links open here
- **Export** — copy SVG (with your theme resolved in), download SVG or PNG
- **Zoom** — wheel/pinch/drag zoom from pele itself
- **Autosave** — source, config, theme and pane split persist in localStorage

## Develop

```sh
bun install
bun run dev
```

## Test

```sh
bun run test    # unit tests (renderer wrapper, serde, diagnostics, samples)
bun run check   # svelte-check
bun run build   # static production build in build/
```

## Deploy

`bun run build` writes a fully static site to `build/`. Host it anywhere that
serves files — Netlify, Vercel, Cloudflare Pages, GitHub Pages, nginx. There is
no backend. `vercel.json` pins the output directory and clean URLs (so the
shared-diagram route `/view` resolves); it lives in `static/` too, so a
drag-and-drop of `build/` works as well. A Vercel git import needs no manual
settings — the file config overrides the dashboard preset.

Page-view analytics use Vercel Web Analytics; enable it once in the Vercel
dashboard (Project → Analytics). Without it the insights script 404s and
nothing is counted.

## Credits

- [pele](https://github.com/obsidianmd/pele) — the renderer (MIT, kepano)
- [mermaid-live-editor](https://github.com/mermaid-js/mermaid-live-editor) —
  the share-link format this playground is interoperable with (MIT)
