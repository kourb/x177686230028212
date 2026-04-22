# Next bootstrap and first Figma screen
- Web app now runs on Next.js App Router with TypeScript, ESLint, strict mode, and path aliases `~/*` + `@/*`
- Project baseline mirrors quest deployment style via `.xci` target block and cloudflare account mapping
- First page implemented from Figma node `55:371` (Splash Screen) as a 393x852 mobile frame
- Figma asset exported and stored as `public/assets/splash-screen.svg`, page uses `next/image` with responsive phone container
- Verification baseline: `bun run lint` and `bun run build` both pass
