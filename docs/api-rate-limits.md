# Quillnote API Rate Limits

The Quillnote REST API v2 enforces sliding-window rate limits per API token based on your subscription tier. Free plan tokens have a rate limit of 60 requests per minute and 1,000 requests per day. Plus plan tokens allow 300 requests per minute and 15,000 requests per day, while Team plan tokens allow 1,200 requests per minute and 100,000 requests per day.

Each API request has a maximum JSON payload size of 5 MB for standard endpoints and 25 MB for multipart attachment uploads, with a concurrent connection cap of 10 simultaneous in-flight requests per token. Every API response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` HTTP headers so integrations can monitor quota usage.

When a client exceeds the rate limit, the Quillnote API returns HTTP status code `429 Too Many Requests` along with a `Retry-After` header indicating how many seconds to wait before retrying. Each user account can create up to 5 active Personal Access Tokens at a time in Settings > Developer API.
