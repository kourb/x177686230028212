# Design delivery (project hard rule)

## 1) Figma is source of truth
- Implement only from explicit Figma node IDs provided by user
- Reproduce spacing, sizing, hierarchy, and component structure from node data
- Do not invent substitute layouts when node data is available

## 2) Web app mode only
- Do not wrap pages in phone mockups, preview frames, or decorative device chrome
- Build full responsive web layouts using real app containers

## 3) No visual guess loops
- Avoid repeated micro-tweaks without structural correction
- If alignment fails repeatedly, replace control with simpler deterministic layout (fixed dimensions + flex/grid centering)

## 4) Selector/dropdown quality gate
- Trigger and menu must share explicit width contract
- Menu cannot overflow viewport horizontally
- Text must be vertically centered by layout primitives (`align-items`), not line-height hacks
- No decorative extras unless requested (extra labels, badges, shadows, icons)

## 5) Validation protocol before reporting done
- Check right/left overflow, clipping, vertical centering, and menu anchoring
- If any mismatch remains, fix before sending status update

## 6) Communication mode
- Keep responses short and direct
- When design is off, acknowledge and apply deterministic fix path immediately
