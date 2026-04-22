# /x/7/@kourb/visa-assistent/.xai/memory
- `web-app-scope-and-scalar.md` — Scope locked to web app; Scalar API source is `doc/scalar.txt`; product requirements summary in `doc/summary.txt`
- `implementation-reference-and-style.md` — Use `/x/7/@kourb/quest-app` as implementation reference; follow XEAM-style code expectations
- `scalar-openapi-resolution.md` — Scalar UI at `/scalar/v1` resolves actual OpenAPI JSON at `/openapi/v1.json` with Basic Auth
- `next-bootstrap-and-first-figma-screen.md` — Next.js app initialized with quest-style baseline and first Figma screen rendered from exported SVG asset
- `xjs-localstorage-runtime-shim.md` — xjs/node runtime can expose broken `globalThis.localStorage`; add server shim before app render
- `figma-no-ios-chrome.md` — Do not include iOS status bar/header and home indicator in web layouts from mobile Figma screens
