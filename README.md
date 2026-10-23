# pele.live

A clean Mermaid playground powered by [Pele](https://github.com/obsidianmd/pele).
No accounts, no subscription, no tracking — diagrams render locally in your
browser and nothing ever leaves it.

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
npm install
npm run dev
```

## Test

```sh
npm test        # unit tests (renderer wrapper, serde, diagnostics, samples)
npm run check   # svelte-check
npm run build   # static production build in build/
```

## Deploy

`npm run build` writes a fully static site to `build/`. Host it anywhere that
serves files — Netlify, Vercel, Cloudflare Pages, GitHub Pages, nginx. There is
no backend.

## Credits

- [pele](https://github.com/obsidianmd/pele) — the renderer (MIT, kepano)
- [mermaid-live-editor](https://github.com/mermaid-js/mermaid-live-editor) —
  the share-link format this playground is interoperable with (MIT)
