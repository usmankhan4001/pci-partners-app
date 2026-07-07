# DOCX Template

`templates/sales-partner-agreement.docx` is generated to mirror the layout
of PCI's actual "Sales Partner Registration Form" PDF: full-width navy
section bars (via single-cell tables — the standard OOXML trick for a true
full-bleed color bar, not just paragraph shading behind the text), Libre
Baskerville for the display title, Work Sans for body text. If PCI later
provides a native Word version of the form, swap it in following the steps
below — the merge tags are what matter, not which tool produced the file.

**Fonts:** the Dockerfile installs Libre Baskerville and Work Sans (from
Google's font repo) system-wide so LibreOffice renders the exported PDF
with the real fonts rather than silently substituting a fallback. This is
best-effort at Docker build time (skipped if unreachable, PDF still
generates either way) — see the Dockerfile comment.

**Logo:** not yet embedded in the docx (pending the logo file — see
`public/assets/logo.png`, same placeholder gap as the web UI).

## Required merge tags
The template is filled with [docx-templates](https://github.com/guigrpa/docx-templates)
using `{tag}` delimiters (not the default `+++tag+++`). Every tag below must
appear **exactly once** somewhere in the document:

```
{company_name} {ntn} {registered_address} {city} {country} {landline}
{mobile1} {mobile2} {company_email}
{signatory_name} {signatory_designation} {signatory_cnic}
{signatory_contact} {signatory_email}
{bank_name} {account_title} {account_iban} {bank_branch}
{rep_name} {rep_designation} {onboarding_date}
{declaration_timestamp} {tos_version}
```

Plus one image tag for the partner's signature, placed where the signature
should appear:
```
{IMAGE signature()}
```

## Swapping in the real template
1. Replace the file at `templates/sales-partner-agreement.docx` (same path/filename, or update `DOCX_TEMPLATE_PATH` in `.env`).
2. Open it and confirm every tag above is present and spelled exactly as shown (docx-templates fails the whole render if a tag is missing or misspelled — it does not silently skip it).
3. If the tags are typed as running text in Word (not their own distinct run), Word sometimes splits a single `{tag}` across multiple hidden "runs" during autocorrect, which docx-templates can fail to parse. If you hit a parse error after pasting tags into a real Word doc, retype the braces directly in Word (don't copy-paste) or use Find & Replace to insert them cleanly.
4. Run `node -e "import('./src/docx/templateFill.js')..."` — or simpler, just submit one test registration through the running app and confirm the generated PDF looks right.

## Why docx-templates instead of docxtemplater
`docxtemplater`'s free image module (`docxtemplater-image-module-free`)
depends on `xmldom`, which has multiple critical/unpatched vulnerabilities
with no fix available. `docx-templates` has a built-in `IMAGE` command and
zero known vulnerabilities in its dependency tree, so it's used for both
text and image fields instead.
