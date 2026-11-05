---
"@ilokesto/fetcher": minor
---

Require an explicit HTTP method on callable and safe callable requests for registered typed paths, even when the client's default is GET. Migrate `api('/x')` to `api('/x', { method: 'GET' })` or `api.get('/x', envelope)`, and use the matching safe form.

Infer the response from the selected method and enforce its required request body, including options held in variables. Shortcuts and ky runtime defaults for unregistered or wide URLs and URL/Request inputs remain unchanged. This intentional type compatibility change ships as a minor release during beta by explicit user decision.
