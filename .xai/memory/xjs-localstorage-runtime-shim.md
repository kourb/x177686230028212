# xjs localStorage runtime shim
- In xjs dev/build runtime, Node may expose `globalThis.localStorage` without Web Storage methods and print `--localstorage-file` warning
- Next SSR can crash with `TypeError: localStorage.getItem is not a function` even when app code does not use localStorage
- Fix: initialize a server-side localStorage shim module and import it first in `src/app/layout.tsx`
- Shim condition: only on server and only when `localStorage` is missing or lacks `getItem`
