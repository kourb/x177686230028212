# Scalar OpenAPI resolution
- Scalar docs page endpoint is `https://133892.ip-ns.net/scalar/v1`
- The actual OpenAPI spec URL is `https://133892.ip-ns.net/openapi/v1.json`
- `/scalar/v1/openapi/v1.json` returns 404 in this deployment
- Method extraction should parse `paths` from root OpenAPI JSON after Basic Auth
