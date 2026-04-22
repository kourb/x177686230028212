# Visa Assistent — Project Decomposition

## Current state
- Repository is in bootstrap stage; no app source tree yet.
- Existing artifacts: `doc/task.txt`, `doc/summary.txt`, `doc/scalar.txt`.

## Active product scope
- Implementation focus is the user web application flow.
- iOS, marketing landing, and admin panel remain in requirements but are not primary build target now.

## Source documents
- `doc/task.txt`: full functional and technical requirements (v4.0).
- `doc/summary.txt`: condensed requirements summary for execution planning.
- `doc/scalar.txt`: Scalar API endpoint and auth source for API exploration/testing.

## Immediate implementation direction
- Start web app architecture and feature slicing from the user flow in `doc/summary.txt`.
- Prioritize: auth/session model, multi-step visa form flow, document/photo upload UX, insurance path, status tracking.
