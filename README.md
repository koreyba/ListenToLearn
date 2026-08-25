# Unmumble

Unmumble is an English listening trainer for understanding connected speech through real examples from YouGlish and Tatoeba.

## Product

- **Library** — collect phrases worth revisiting.
- **Practice** — listen, reveal, and repeat at your own pace.
- **Videos** — save YouTube videos and resume from remembered positions.
- **Settings** — connect optional integrations and manage application data.

Guest progress stays in the browser. Signed-in data is stored in Cloudflare D1 behind Cloudflare Access.

## Stack

- React with vinext
- Cloudflare Workers and static assets
- Cloudflare D1 with Drizzle migrations
- Cloudflare Access
- YouGlish, Tatoeba, and optional DeepL integrations

## Local development

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Useful checks:

```bash
npm run build
npm test
npm run lint
npm run db:generate
```

## Deployment boundary

- `wrangler.preview.jsonc` targets `unmumble-preview` and `unmumble-preview-db`.
- `wrangler.production.jsonc` targets `unmumble-prod` and `unmumble-prod-db`.
- Apply D1 migrations before deploying application code that depends on them.
- A branch preview upload does not promote a production release.
- Production deployment remains explicitly opt-in.
- `unmumble.online` is the Custom Domain for `unmumble-prod`.
- Cloudflare issues and renews the edge TLS certificate automatically after the custom domain is active.
- Production is temporarily restricted to the owner's Cloudflare account until the parallel Google-auth work is merged and route-level guest access is revalidated.

## Browser data compatibility

The Unmumble browser-storage keys migrate data from the previous ListenToLearn keys and temporarily dual-write both formats for rollback safety. Existing integration-encryption AAD values remain unchanged so previously encrypted secrets can still be read.

## Migration plan

The staged blue-green rename and cutover plan is documented in [`docs/ai/planning/2026-08-25-feature-unmumble-blue-green-migration.md`](docs/ai/planning/2026-08-25-feature-unmumble-blue-green-migration.md).
