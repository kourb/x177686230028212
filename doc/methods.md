# API Methods

Source: `https://133892.ip-ns.net/openapi/v1.json`

## AdminApplications
- `POST /v1/admin/applications/{id}/change-status` - Changes application status (admin transition).
- `POST /v1/admin/applications/{id}/run-flags` - Runs auto-flag detection for an application.
- `GET /v1/admin/applications/{id}` - Returns full application detail with applicants, status log, and flags.
- `POST /v1/admin/applications/flags/{flagId}/resolve` - Resolves a flag by ID.
- `GET /v1/admin/applications` - Returns a paginated list of all applications with filters.

## AdminCustomFields
- `DELETE /v1/admin/custom-fields/{id}` - Deactivates a custom field.
- `PATCH /v1/admin/custom-fields/{id}` - Updates a custom field.
- `POST /v1/admin/custom-fields/reorder/{visaTypeId}` - Reorders custom fields within a visa type.
- `POST /v1/admin/custom-fields` - Creates a new custom field for a visa type.

## AdminPing
- `GET /v1/admin/ping` - Returns 200 for authenticated admin/support/manager users.

## AdminVisaTypes
- `DELETE /v1/admin/visa-types/{id}` - Deactivates a visa type.
- `PATCH /v1/admin/visa-types/{id}` - Updates a visa type.
- `POST /v1/admin/visa-types` - Creates a new visa type with translations.

## ApplicationAggregate
- `GET /v1/app/applications/{id}/full` - Returns the full aggregate for the specified application.

## ApplicationDocuments
- `DELETE /v1/app/applications/{applicationId}/documents/{documentId}` - Removes a document from an application (and deletes the file if unreferenced).
- `GET /v1/app/applications/{applicationId}/documents` - Lists all documents for an application.
- `POST /v1/app/applications/{applicationId}/documents` - Links a previously uploaded file to an application as a document.

## Applications
- `GET /v1/app/applications/{id}/applicants` - Lists applicants attached to an application.
- `POST /v1/app/applications/{id}/applicants` - Adds a new applicant to an application.
- `POST /v1/app/applications/{id}/auto-save` - Auto-saves application and applicant draft data in a single call.
- `POST /v1/app/applications/{id}/clone` - Clones an existing application into a new draft.
- `POST /v1/app/applications/{id}/return-to-draft` - SelfCheck -> Draft.
- `POST /v1/app/applications/{id}/self-check` - Draft -> SelfCheck. Requires at least one applicant.
- `GET /v1/app/applications/{id}/status-log` - Returns the status transition history for an application.
- `POST /v1/app/applications/{id}/submit` - SelfCheck/NeedsEdits -> PendingReview.
- `DELETE /v1/app/applications/{id}` - Soft-deletes an application.
- `GET /v1/app/applications/{id}` - Returns a single application by public ID.
- `PATCH /v1/app/applications/{id}` - Partially updates a draft application.
- `GET /v1/app/applications/applicants/{applicantId}/custom-fields` - Returns custom field values for an applicant.
- `PUT /v1/app/applications/applicants/{applicantId}/custom-fields` - Saves custom field values for an applicant.
- `GET /v1/app/applications/applicants/{applicantId}/vfs` - Returns VFS questionnaire data for an applicant.
- `PUT /v1/app/applications/applicants/{applicantId}/vfs` - Saves VFS questionnaire data for an applicant.
- `DELETE /v1/app/applications/applicants/{applicantId}` - Removes an applicant from an application.
- `PATCH /v1/app/applications/applicants/{applicantId}` - Updates an applicant's Schengen fields or photo.
- `GET /v1/app/applications/latest` - Returns the user's most recently created application.
- `GET /v1/app/applications` - Returns a cursor-paginated list of the current user's applications.
- `POST /v1/app/applications` - Creates a new draft application.

## AppPing
- `GET /v1/app/ping` - Returns 200 for any authenticated app user.

## Auth
- `DELETE /v1/app/auth/account` - Permanently deletes the authenticated user's account.
- `POST /v1/app/auth/apple` - Authenticates via Apple identity token.
- `POST /v1/app/auth/change-password` - Changes password for the authenticated user.
- `POST /v1/app/auth/email/send-otp` - Sends a one-time password to the provided email address.
- `POST /v1/app/auth/email/verify-otp` - Verifies the OTP and returns a token pair on success.
- `POST /v1/app/auth/google` - Authenticates via Google ID token.
- `POST /v1/app/auth/login` - Authenticates with email and password.
- `POST /v1/app/auth/password/reset-confirm` - Confirms password reset with OTP code (not yet implemented).
- `POST /v1/app/auth/password/reset-request` - Requests a password reset OTP (not yet implemented).
- `POST /v1/app/auth/refresh` - Rotates the refresh token and returns a new token pair.
- `POST /v1/app/auth/register` - Registers a new account with email and password.
- `DELETE /v1/app/auth/sessions/{sessionId}` - Revokes a specific session by ID.
- `DELETE /v1/app/auth/sessions` - Revokes all sessions, optionally keeping the current one.
- `GET /v1/app/auth/sessions` - Returns all active sessions for the current user.

## Checklist
- `GET /v1/app/applications/{id}/checklist` - Returns the submission-readiness checklist for the specified application.

## Dashboard
- `GET /v1/app/dashboard` - Returns the aggregated dashboard for the current user.

## Documents
- `POST /v1/app/documents/{id}/ocr` - Triggers OCR processing (not yet implemented - returns 501).
- `POST /v1/app/documents/{id}/photo-check` - Validates a passport photo (not yet implemented - returns 501).
- `GET /v1/app/documents/{publicId}/download` - Returns a presigned download URL for a file.
- `DELETE /v1/app/documents/{publicId}` - Deletes a file by public ID.
- `GET /v1/app/documents/{publicId}` - Returns file metadata by public ID.
- `POST /v1/app/documents/confirm` - Confirms that a file was successfully uploaded to S3.
- `GET /v1/app/documents/my-files` - Lists all files uploaded by the current user.
- `POST /v1/app/documents/upload-url` - Requests a presigned S3 upload URL for a new file.

## Insurance
- `GET /v1/app/insurance/{id}` - Returns an insurance policy by ID.
- `POST /v1/app/insurance/purchase` - Purchases an insurance policy using the specified quote.
- `GET /v1/app/insurance/quotes` - Returns available insurance quotes for the specified country and travel dates.

## Notifications
- `POST /v1/app/notifications/mark-read` - Marks one or more notifications as read. Pass an empty ids list with markAll=true to mark everything.
- `GET /v1/app/notifications` - Returns a cursor-paginated list of notifications for the current user.

## Passport
- `DELETE /v1/app/passports/{publicId}` - Deletes a passport by public ID.
- `GET /v1/app/passports` - Lists all passports for the current user.
- `POST /v1/app/passports` - Creates a new passport for the current user.

## Payments
- `POST /v1/app/payments/{id}/refund` - Refunds a payment.
- `GET /v1/app/payments/{id}` - Returns a payment by ID.
- `POST /v1/app/payments/webhook` - Payment-provider webhook callback. Receives confirmation of a payment event. This endpoint is public - the provider cannot send a Bearer token.
- `GET /v1/app/payments` - Returns all payments for the specified application.
- `POST /v1/app/payments` - Initiates a new payment for the specified application.

## ReferenceData
- `GET /v1/app/reference/countries` - Returns list of countries.
- `GET /v1/app/reference/visa-types/{visaTypeId}/custom-fields` - Returns custom fields for a visa type.
- `GET /v1/app/reference/visa-types` - Returns visa types, optionally filtered by country.

## Slots
- `POST /v1/app/slots/book` - Books a specific appointment slot for the given application.
- `DELETE /v1/app/slots/subscribe/{country}/{city}` - Unsubscribes the current user from slot notifications for the specified location.
- `POST /v1/app/slots/subscribe` - Subscribes the current user to slot availability notifications for the specified location.
- `GET /v1/app/slots` - Returns available appointment slots for the specified country and city.
