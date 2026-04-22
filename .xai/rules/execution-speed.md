# Execution speed (project hard rule)

- Do not run long repetitive verification loops
- Do not retry heavy commands multiple times unless the user explicitly asks
- During active implementation, skip long build/lint/test runs by default
- Use only the minimum quick check needed for the current change
- If a heavy check is required, run it once and report the result
