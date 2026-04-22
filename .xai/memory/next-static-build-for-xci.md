# Next static build for xci
- Next default artifacts in `.next` are runtime build internals, not deploy-static output
- Project build flow now uses static export (`output: 'export'`) and mirrors artifacts to `build/`
- `.xci/config.json` dist is set to `build` to match quest-app deploy behavior
