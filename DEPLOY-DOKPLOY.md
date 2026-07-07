# PCI Sales Partner Registration V2 — Deployment Guide (Dokploy)

One Dokploy Application, no separate database service — Insforge (already
self-hosted at `insforge.premierchoiceint.online`) is the store for both
records and files.

## 0. Prerequisites
- `npm run setup:insforge` already run once (creates the table + bucket — see `docs/INSFORGE-SETUP.md`).
- The real `templates/sales-partner-agreement.docx` in place (see `docs/DOCX-TEMPLATE.md`) and committed to the repo.
- Logo at `public/assets/logo.png` — done, committed.
- Dokploy panel: `paas.premierchoiceint.online` (tunneled via cloudflared).
- Repo: `github.com/usmankhan4001/pci-partners-app`, branch `main`.

## 1. Create the app
**Create → Application → GitHub**, repo `usmankhan4001/pci-partners-app`, branch `main`, **Build Type = Dockerfile** (required — installs LibreOffice for DOCX→PDF conversion).

**Volume:** mount `/app/data` (currently unused at runtime but reserved for future local state).

**Environment:**
```
PORT=8080
NODE_ENV=production
INSFORGE_API_BASE_URL=https://insforge.premierchoiceint.online
INSFORGE_API_KEY=<insforge api key>
INSFORGE_TABLE=sales_partners
INSFORGE_BUCKET=sales-partner-documents
MAX_UPLOAD_MB=5
REFERRAL_BASE_URL=https://partners.premierchoiceint.online
TOS_VERSION=2026-07-v1
INTERNAL_BASIC_AUTH_USER=<pick one>
INTERNAL_BASIC_AUTH_PASS=<long random string>
```

**Domain:** `partners.premierchoiceint.online` → **container port 8080**, HTTPS on. No host port published.

## 2. Verify
```bash
curl https://partners.premierchoiceint.online/health
#   {"ok":true,"insforgeConfigured":true}
```
Then open `/internal/link-generator` (Basic Auth), confirm rep links list from `data/reps.json`, and run one real end-to-end test submission — check the record appears in the Insforge `sales_partners` table with all fields, the uploaded documents/signature/PDF are reachable via their stored URLs, and the PDF actually contains the signature image and all filled-in data.

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| `/health` shows `insforgeConfigured:false` | `INSFORGE_API_KEY`/`INSFORGE_API_BASE_URL` missing | Set both env vars |
| Submission fails with "Insforge ... failed" | Table/bucket not provisioned yet | Run `npm run setup:insforge` |
| PDF missing or `status: "partial"` with `agreement_document` failed | `soffice` not found or template path wrong | Confirm Dockerfile installed `libreoffice-writer`; confirm `DOCX_TEMPLATE_PATH` points at the real template |
| Signature/documents missing from the record | Upload step failed (network blip, oversized file) | Check `failedSteps` in the response; the app logs the underlying Insforge error server-side |
| Rep dropdown empty | `data/reps.json` empty or malformed | Edit the file, restart the app (no rebuild needed) |
