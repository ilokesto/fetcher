---
"@ilokesto/fetcher": patch
---

Infer JSON from all numeric and string 200-299 response keys and OpenAPI 2XX ranges before considering default responses. Return the union of declared success JSON schemas instead of preferring one status, while preserving default/unknown fallback and runtime request behavior.
