# Visa Assistent — Project Decomposition

## Current state
- Next.js web app scaffold is initialized and buildable.
- Core docs remain in `doc/task.txt`, `doc/summary.txt`, `doc/scalar.txt`.

## Implemented structure
- `src/app/layout.tsx`: base app shell and metadata.
- `src/app/page.tsx`: first screen implementation.
- `src/app/globals.css`: responsive frame and base visual shell.
- `public/assets/splash-screen.svg`: exported Figma asset for the first page.
- Root config: `package.json`, `next.config.mjs`, `tsconfig.json`, `eslint.config.mjs`, `.xci`.

## Active product scope
- Implementation focus is the user web application flow.
- iOS, marketing landing, and admin panel remain in requirements but are not primary build target now.

## Source documents
- `doc/task.txt`: full functional and technical requirements (v4.0).
- `doc/summary.txt`: condensed requirements summary for execution planning.
- `doc/scalar.txt`: Scalar API endpoint and auth source for API exploration/testing.

## Immediate implementation direction
- Continue screen-by-screen Figma implementation into reusable web app sections/components.
- Start feature slicing for user flow: auth/session, visa stepper flow, applicant tabs, uploads/photo checks, insurance flow, status table/drawer.
