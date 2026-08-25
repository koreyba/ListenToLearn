---
phase: deployment
title: Deployment Strategy
description: Define deployment process, infrastructure, and release procedures
---

# Deployment Strategy

## Infrastructure

The existing Cloudflare Worker, static assets, and D1 deployment remain
unchanged. The feature adds one static browser helper and changes the existing
trainer page; it adds no binding, route, migration, or secret. Deployment
target selection is now explicit because the Vinext-generated
`dist/server/wrangler.json` does not carry the source `env.preview` details.

## Release Gates

Before publication, run `npm test`, `npx tsc --noEmit`, `npm run lint`,
`git diff --check`, `node --test tests/deployment-config.test.mjs`, and
`npx ai-devkit@latest lint --feature phrase-navigation`. Manual smoke must
cover YouGlish timing events, cached and unobserved neighbors, repeat on/off,
provider fallback, and the existing video controls.

## Deployment Target Safety

Do not deploy the Vinext-generated config directly with `--env preview`: it can
fall back to the production Worker when the generated file has no environment
definition. Build first, then use the committed target wrapper:

```sh
npm run deploy:preview
ALLOW_PRODUCTION_DEPLOY=1 npm run deploy:production
```

The wrapper pins `wrangler.preview.jsonc` or `wrangler.production.jsonc`, checks
the expected Worker name and build artifacts, rejects target overrides, and
blocks production unless `ALLOW_PRODUCTION_DEPLOY=1` is present. Verify the
reported Worker name and version after every deployment.

The original Workers Builds trigger promoted every feature branch to the active
shared preview deployment. The current branch-preview workflow supersedes that
behavior. Its non-production deploy command is:

```sh
npm run deploy:branch-preview
```

This uploads a version of `listen-to-learn-preview`, advances Cloudflare's
stable branch alias, and leaves both the active shared preview deployment and
the shared preview D1 schema unchanged. `npm run deploy:preview` remains an
explicit manual operation for replacing the active shared preview deployment.

The production trigger's deploy command is:

```sh
npx wrangler d1 migrations apply listen-to-learn-db --remote --config wrangler.production.jsonc && ALLOW_PRODUCTION_DEPLOY=1 npm run deploy:production
```

`wrangler versions upload` intentionally does not move active deployment
traffic. Cloudflare routes the branch alias and immutable version URL directly
to the uploaded version.

## Deployment Status

The phrase-navigation PR is the release vehicle for the first-caption fix and
the deployment-target guard. Merge only after the branch gates pass; deploy
production from the merged `main` checkout with the explicit production
command above.

## Rollback

If published later, use the existing Worker version rollback. Since no schema or
server contract changes are involved, rollback is a static asset/code rollback;
there is no migration to reverse.
