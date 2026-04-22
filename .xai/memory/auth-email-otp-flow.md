# Auth email OTP flow
- Working app auth path for current screen: `POST /v1/app/auth/email/send-otp` then `POST /v1/app/auth/email/verify-otp`
- `verify-otp` requires `device` with `deviceId` and `deviceName` (from OpenAPI)
- Successful login/registration response shape is `ApiResponseOfAuthTokenResponse` with token pair in `data`
- Frontend can run from localhost with `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:3000`)
