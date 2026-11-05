---
"@ilokesto/fetcher": patch
---

Reject path parameters that create standalone dot path segments before sending a request, preventing URL normalization from changing the target endpoint. Preserve dotted identifiers, query and fragment values, and normal percent encoding.
