# Auth CORS proxy for localhost
- Direct browser calls from `http://localhost:3000` to `https://133892.ip-ns.net` fail preflight due to missing `Access-Control-Allow-Origin`
- Keep auth requests same-origin via Next route handlers: `/api/auth/email/send-otp` and `/api/auth/email/verify-otp`
- Proxy target is server-side env `AUTH_API_BASE_URL` (default remote host), so localhost UI testing works without backend CORS changes
