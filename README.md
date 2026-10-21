# Laughter Portfolio

Next.js website for [laughterephraim.com](https://laughterephraim.com).
Content is edited in the separate [Sanity Studio](https://studio.laughterephraim.com).
Schemas and Studio configuration live in the sibling `laughter-studio` project.

## Local development

```bash
bun install
bun run dev
```

Open [localhost:3000](http://localhost:3000).

## Content configuration

Set the following in `.env.local` and the portfolio hosting environment:

```dotenv
NEXT_PUBLIC_SANITY_PROJECT_ID=your-project-id
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_SANITY_API_VERSION=YYYY-MM-DD
```

Use the same Sanity project and dataset as the Studio. The `sanity/env.ts` and
`sanity/lib/` modules belong to the website: they configure its client, queries,
and content fallbacks. The JSON data and public assets are still used by the
website and the optional seed script.

The home and works pages have a 60-second revalidation interval. For webhook-based
refreshes, configure `SANITY_REVALIDATE_SECRET` and send POST requests to
`/api/revalidate` with the matching `x-revalidate-secret` header and a JSON body
containing the changed document's `_type`.

## Contact form

The server-side `/api/contact` route sends email through Resend.

Required environment variables:

```dotenv
RESEND_API_KEY=
RESEND_FROM_EMAIL="Laughter Portfolio <hello@yourdomain.com>"
CONTACT_EMAIL_TO="recipient@example.com"
```

Optional:

```dotenv
CONTACT_EMAIL_SUBJECT_PREFIX="Portfolio"
```

## Optional content seeding

The seed script remains here because it reads this project's JSON and public
assets. It uses `@sanity/client` directly and does not require Studio tooling.
Set a server-only `SANITY_API_WRITE_TOKEN` with write permissions, then run:

```bash
bun run sanity:seed
```

This replaces singleton content and updates matching works and testimonials from
local data. Run it deliberately; it can overwrite edits made in the Studio.
Do not expose the token through a `NEXT_PUBLIC_` or `SANITY_STUDIO_` variable.

## Validation and deployment

```bash
bun run lint
bun run format:check
bun run build
```

Deploy this folder as its own Next.js project in Vercel. The Studio is deployed
separately, so schema changes belong in `laughter-studio`.
