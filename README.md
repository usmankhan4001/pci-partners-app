# PCI Sales Partner Registration V2

Digitizes PCI's paper "Sales Partner Registration Form" into a mobile-first
web form that:

1. Captures all form fields (grouped into sections: Company, Signatory, Bank, Documents & Signature, Representative & Terms) plus a hand-drawn e-signature (works on mobile/touch).
2. Fills a Word (.docx) template with the submitted data and embeds the signature image and PCI logo.
3. Converts the filled document to a signed PDF (via LibreOffice headless).
4. Stores everything — form data, uploaded documents, signature, generated docx + PDF — in Insforge (self-hosted Postgres + S3-compatible storage). No Bitrix, no other CRM.

Each PCI rep can get a shareable link (`/register?rep=<their name>`) that
pre-fills and locks the representative field — no directory/lookup table,
the name in the link is used as-is. Build one at `/internal/link-generator`
(Basic Auth). Without a `?rep=`, the field is a plain required text box.

The 4 supporting documents (CNIC, incorporation certificate, NTN
certificate, address proof) are optional at submission time — only the
signature is required. Partners can follow up with paperwork later.

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
