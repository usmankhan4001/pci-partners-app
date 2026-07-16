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
DB_PATH=data/app.db
UPLOADS_DIR=data/uploads
PERSISTENT_STORAGE_PATH=data
REQUIRE_PERSISTENT_STORAGE=true
MAX_UPLOAD_MB=5
REFERRAL_BASE_URL=https://partners.premierchoiceint.online
TOS_VERSION=2026-07-v1
INTERNAL_USERS=[{"username":"admin","password":"<long random string>","role":"admin","displayName":"PCI Admin"},{"username":"siddique","password":"<long random string>","role":"rep","displayName":"Siddique Akbar"}]
```
`REQUIRE_PERSISTENT_STORAGE=true` is mandatory in production. The app will
refuse to start unless Docker/Dokploy has mounted persistent storage at
`/app/data`. This prevents a redeploy from silently creating a fresh empty
SQLite database inside disposable container storage.

Do not disable this in Dokploy. If the app refuses to start, fix the volume
mount instead of setting this to `false`.

If `INTERNAL_USERS` is left blank, the app still accepts the old
`INTERNAL_BASIC_AUTH_USER` / `INTERNAL_BASIC_AUTH_PASS` variables and seeds
that as a single `admin` account. Prefer `INTERNAL_USERS` for RBAC.

**Domain:** `partners.premierchoiceint.online` → **container port 8080**. HTTPS **off** in Dokploy (`certificateType: none`) — the Cloudflare Tunnel already terminates TLS at the edge; Dokploy/Traefik just needs to route the plain-HTTP internal port. No host port published.

## 2. Verify
```bash
curl https://partners.premierchoiceint.online/health
#   {"ok":true,"maxUploadMb":5}
```
Then open `/internal/link-generator` (Basic Auth) to build a rep's referral
link, and run one real end-to-end test submission with all four required
documents — check it shows up at `/internal/admin` (Basic Auth) with all
fields, the uploaded documents/signature/PDF are reachable via their links,
and the PDF contains the signature image, filled-in data, and appended
supporting documents.

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| Submission fails with a generic 500 | DB write failed — usually the `/app/data` volume isn't writable or isn't mounted | Confirm the volume mount in Dokploy and that the container user can write to `/app/data` |
| App refuses to start with `Persistent storage is not mounted at /app/data` | Dokploy did not mount the data volume | Attach a persistent volume mounted exactly at `/app/data`, keep `REQUIRE_PERSISTENT_STORAGE=true`, and redeploy |
| PDF missing or `status: "partial"` with `agreement_document` failed | Template path wrong or missing a field the code expects | Confirm `PDF_TEMPLATE_PATH` points at the real template and its field names match `src/pdf/fillPdfTemplate.ts` |
| Required document validation blocks submit | One of CNIC/incorporation/NTN/address proof is missing or the browser lost the file selection on reload | Re-select all four required documents and submit again |
| Signature/documents missing from the record | Save step failed (oversized file, disk full) | Check `failedSteps` in the response; the app logs the underlying error server-side |
| Rep cannot see submissions in admin | Rep user's `displayName` does not exactly match the `rep_name` stored on submissions | Update the `displayName` in `INTERNAL_USERS` to match the referral-link representative name |
| Domain shows a Cloudflare 502/504 | cloudflared tunnel not pointed at this app, or app crashed | Check the tunnel's ingress rule for `partners.premierchoiceint.online` and the Dokploy app logs |
| Redeploying wiped past submissions | The `/app/data` volume wasn't attached on the new deployment | Always verify the volume mount survives redeploys/restarts in Dokploy |

## Emergency data check
Run this inside the Dokploy container/terminal to confirm whether the active
SQLite database has rows:

```bash
node -e "const Database=require('better-sqlite3'); const db=new Database('/app/data/app.db'); console.log(db.prepare('select count(*) as count from sales_partners').get()); console.log(db.prepare('select rep_name,count(*) as count from sales_partners group by rep_name').all());"
```

If the count is `0`, search old Docker volumes on the host for an older
`app.db` and copy it back into the currently mounted `/app/data` volume before
accepting new submissions.
