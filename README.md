# PCI Sales Partner Registration V2

Digitizes PCI's paper "Sales Partner Registration Form" into a mobile-first
web wizard that:

1. Captures all form fields plus a hand-drawn e-signature (works on mobile/touch).
2. Fills a Word (.docx) template with the submitted data and embeds the signature image.
3. Converts the filled document to a signed PDF (via LibreOffice headless).
4. Stores everything — form data, uploaded documents, signature, generated docx + PDF — in Insforge (self-hosted Postgres + S3-compatible storage). No Bitrix, no other CRM.

Each PCI sales rep can get a shareable link (`/register?rep=<id>`, backed by
`data/reps.json`) that auto-attributes a submission to them; without a
`?rep=` the form shows a dropdown fallback.

## Pending before this is production-ready
- **Logo** — drop a file at `public/assets/logo.png`; the header uses it automatically and falls back to a text wordmark if absent. Not yet embedded in the generated docx/PDF either.
- **DOCX template** — `templates/sales-partner-agreement.docx` is generated to mirror the real PDF form (navy section bars, Libre Baskerville/Work Sans). See [`docs/DOCX-TEMPLATE.md`](docs/DOCX-TEMPLATE.md) if PCI later provides a native Word version to swap in instead.

## First-time setup
```bash
npm install
cp .env.example .env
npm run setup:insforge   # after filling INSFORGE_API_BASE_URL / INSFORGE_API_KEY
npm run dev
```
See [`docs/INSFORGE-SETUP.md`](docs/INSFORGE-SETUP.md) for details.

DOCX→PDF conversion needs LibreOffice installed locally for `npm run dev`
(`soffice` on PATH, or set `SOFFICE_PATH`). The Docker image installs it
automatically for deployment.

## Deploying
See [`DEPLOY-DOKPLOY.md`](DEPLOY-DOKPLOY.md).
