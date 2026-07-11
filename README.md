# PCI Sales Partner Registration V2

Digitizes PCI's paper "Sales Partner Registration Form" into a mobile-first
web form that:

1. Captures all form fields (grouped into sections: Company, Signatory, Bank, Documents & Signature, Representative & Terms) plus a hand-drawn e-signature (works on mobile/touch).
2. Fills PCI's real fillable PDF form template directly with the submitted data and the signature image.
3. Stores everything — form data, uploaded documents, signature, generated PDF — in a local SQLite database and on-disk file storage (both on the same Docker volume). No external database, no CRM.

Each PCI rep can get a shareable link (`/register?rep=<their name>`) that
pre-fills and locks the representative field — no directory/lookup table,
the name in the link is used as-is. Build one at `/internal/link-generator`
(Basic Auth). Without a `?rep=`, the field is a plain required text box.

PCI staff can view every submission at `/internal/admin` (same Basic Auth).

The 4 supporting documents (CNIC, incorporation certificate, NTN
certificate, address proof) are optional at submission time — only the
signature is required. Partners can follow up with paperwork later.

## First-time setup
```bash
npm install
cp .env.example .env
npm run dev
```
The SQLite database and uploaded files are created automatically on first
run under `data/` (override with `DB_PATH` / `UPLOADS_DIR`).

## Deploying
See [`DEPLOY-DOKPLOY.md`](DEPLOY-DOKPLOY.md).
