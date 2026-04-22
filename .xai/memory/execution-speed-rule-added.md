# Execution speed rule added
- Added `.xai/rules/execution-speed.md` as a hard project rule
- Rule enforces minimal checks and forbids repeated long verification runs by default
- Heavy build/lint/test commands should run only when explicitly needed or requested
