# PostPilot AI API

Base URL for local development: `http://localhost:4000/api`. JSON responses use `{ "success": true, ... }` on success and `{ "success": false, "message": "..." }` for errors. Authenticated routes use the HTTP-only `postpilot_session` cookie created by register/login; send requests with credentials enabled.

## Authentication

| Method | Path | Auth | Purpose |
|---|---|---:|---|
| POST | `/auth/register` | No | Create an account (`name`, `email`, `password`; password minimum 8) |
| POST | `/auth/login` | No | Sign in |
| POST | `/auth/logout` | No | Clear the session cookie |
| POST | `/auth/forgot-password` | No | Request reset email; development returns a reset token |
| POST | `/auth/reset-password` | No | Reset using `token` and a new `password` |
| GET | `/auth/me` | Yes | Current user and plan |
| PUT | `/auth/password` | Yes | Change password with `currentPassword` and `newPassword` |

## Workspace

| Method | Path | Auth | Purpose |
|---|---|---:|---|
| GET | `/ai/status` | Yes | Report the account/server provider and configuration readiness; never returns the API key |
| PUT | `/ai/connection` | Yes | Save/update an account AI provider (`provider`, `model`, `apiKey`; compatible providers also require `baseUrl`); keys are encrypted at rest |
| DELETE | `/ai/connection` | Yes | Remove the account provider and fall back to server environment configuration |
| POST | `/ai/test` | Yes | Make a small provider request and return model/provider/latency diagnostics; does not consume user generation quota, but does make a provider call |
| GET | `/ai/research-connection` | Yes | Report whether a Tavily research key is configured; never returns the key |
| PUT / DELETE | `/ai/research-connection` | Yes | Securely save/replace or remove the account's encrypted Tavily Search API key |
| POST | `/ai/research-test` | Yes | Test Tavily Search and report how many sources were returned |
| GET / PUT | `/user/profile` | Yes | Read/update profile name |
| GET / POST | `/brands` | Yes | List/create brand profiles |
| GET / PUT / DELETE | `/brands/:id` | Yes | Read/update/delete an owned brand |
| GET | `/templates` | Yes | List database-backed templates |
| GET | `/content` | Yes | Search/filter/paginate (`search`, `platform`, `contentType`, `saved`, `favorite`, `from`, `to`, `page`, `pageSize`) |
| POST | `/content/generate` | Yes | Generate and store a post; optional `variations: true` creates four tone variations; `deepResearch: true` performs advanced Tavily search and returns a separate cited `research` report |
| POST | `/content/regenerate` | Yes | Generate replacement text; supports the same `deepResearch` option |
| POST | `/content/improve`, `/content/shorten`, `/content/expand` | Yes | AI-edit supplied post text |
| GET / PUT / DELETE | `/content/:id` | Yes | Read/update/delete owned content |
| POST | `/content/:id/save` | Yes | Save generated content to the library |
| POST | `/content/:id/favorite` | Yes | Set `{ "favorite": boolean }` |
| POST | `/content/:id/schedule` | Yes | Schedule existing content at a future ISO date/time |
| POST | `/ideas/generate` | Yes | Generate approximately ten ideas (`industry`, `platform`, optional `audience`, `goal`) |
| POST | `/hashtags/generate` | Yes | Generate hashtags (`topic`, `platform`, optional `industry`) |
| GET / POST | `/calendar` | Yes | List/create calendar entries |
| PUT / DELETE | `/calendar/:id` | Yes | Update/delete an owned calendar entry |
| GET | `/analytics` | Yes | Content, usage, platform, type, and monthly analytics |
| GET | `/subscription` | Yes | Plan limits, current usage, and billing availability |

Generation endpoints reserve monthly usage; local drafts work without provider configuration, but deep research requires both a connected AI provider and Tavily Search. A user's prompt topic, brand industry, and campaign goal are sent to Tavily; audience, contact details, price, and private brand fields are deliberately excluded. Research uses Tavily's `advanced` depth (2 API credits per search), returns source titles, URLs, excerpts, and any available publication dates separately from post copy, and persists that report with the content. The model is instructed to treat retrieved pages as untrusted reference material and ground factual claims in sources. Review citations and claims before publishing.

Every generated draft has an enforced minimum word count: Short 51+, Medium 71+, Long 101+. The backend retries short AI outputs twice, then returns an explicit error rather than a draft below the minimum. Word minimums take priority over social-platform character guides; the generator reports the overage in content insights. Account AI and Tavily keys are encrypted with AES-256-GCM using the server-only `AI_CREDENTIALS_SECRET`; configure it as 64 hexadecimal characters before saving keys and keep it stable so existing connections remain decryptable. Keys are never returned by status or save responses. Failed provider calls are marked failed and do not count toward the monthly generation allowance. The backend enforces generation, saved-post, brand-count, premium-template, advanced-editing, hashtag, and calendar plan restrictions; frontend display is not the enforcement boundary. Business/agency team workspaces and advanced analytics are not implemented yet.

## Status and limitations

- No social platform publishing API is called. Calendar entries are planning records only.
- The subscription endpoint is read-only; paid checkout/plan changes are not enabled until a payment provider is integrated.
- The health endpoint is `GET /health` under the API prefix and does not require authentication.
- Request bodies are validated; unauthenticated, missing-resource, validation, limit, AI-provider, and server errors return non-success HTTP status codes.
