# PCI Sales Partner Registration V2 — Deployment Guide (Dokploy)

One Dokploy Application, no separate database service — submissions and
uploaded files are stored locally (SQLite + disk) on the app's own Docker
volume.

## 0. Prerequisites
- The real `templates/SALES PARTNER REGISTRATION FORM (Digital).pdf` in place (see `docs/PDF-TEMPLATE.md`) and committed to the repo.
- Logo at `public/assets/logo.png` — done, committed.
- Dokploy panel: `paas.premierchoiceint.online` (tunneled via cloudflared).
- Repo: `github.com/usmankhan4001/pci-partners-app`, branch `main`.

## 1. Create the app
**Create → Application → GitHub**, repo `usmankhan4001/pci-partners-app`, branch `main`, **Build Type = Dockerfile**.

**Volume:** mount `/app/data` — this is where the SQLite database and every
uploaded document/signature/PDF live. Losing this volume loses all
submissions, so make sure Dokploy is actually persisting it (not recreating
the container without the volume attached).

**Environment:**
```
PORT=8080
NODE_ENV=production
MAX_UPLOAD_MB=5
REFERRAL_BASE_URL=https://partners.premierchoiceint.online
TOS_VERSION=2026-07-v1
INTERNAL_BASIC_AUTH_USER=<pick one>
INTERNAL_BASIC_AUTH_PASS=<long random string>
```
(`DB_PATH` / `UPLOADS_DIR` default to `data/app.db` / `data/uploads` — no need to set them unless relocating within the volume.)

**Domain:** `partners.premierchoiceint.online` → **container port 8080**. HTTPS **off** in Dokploy (`certificateType: none`) — the Cloudflare Tunnel already terminates TLS at the edge; Dokploy/Traefik just needs to route the plain-HTTP internal port. No host port published.

## 2. Verify
```bash
curl https://partners.premierchoiceint.online/health
#   {"ok":true,"maxUploadMb":5}
```
Then open `/internal/link-generator` (Basic Auth) to build a rep's referral
link, and run one real end-to-end test submission — check it shows up at
`/internal/admin` (Basic Auth) with all fields, the uploaded
documents/signature/PDF are reachable via their links, and the PDF actually
contains the signature image and all filled-in data.

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| Submission fails with a generic 500 | DB write failed — usually the `/app/data` volume isn't writable or isn't mounted | Confirm the volume mount in Dokploy and that the container user can write to `/app/data` |
| PDF missing or `status: "partial"` with `agreement_document` failed | Template path wrong or missing a field the code expects | Confirm `PDF_TEMPLATE_PATH` points at the real template and its field names match `src/pdf/fillPdfTemplate.ts` |
| Signature/documents missing from the record | Save step failed (oversized file, disk full) — documents are optional, so only signature/agreement failures actually block completion | Check `failedSteps` in the response; the app logs the underlying error server-side |
| Domain shows a Cloudflare 502/504 | cloudflared tunnel not pointed at this app, or app crashed | Check the tunnel's ingress rule for `partners.premierchoiceint.online` and the Dokploy app logs |
| Redeploying wiped past submissions | The `/app/data` volume wasn't attached on the new deployment | Always verify the volume mount survives redeploys/restarts in Dokploy |
