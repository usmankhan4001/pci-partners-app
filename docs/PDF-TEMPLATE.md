# PDF Template

`templates/SALES PARTNER REGISTRATION FORM (Digital).pdf` is PCI's real
"Sales Partner Registration Form", already built as a fillable PDF
(AcroForm). The app fills it directly — see `src/pdf/fillPdfTemplate.ts` —
rather than recreating the layout elsewhere, so the generated document
always matches the template exactly.

## Required form fields
The template must contain these 22 text fields, named exactly as shown
(case- and punctuation-sensitive):

```
Company Name, NTN #, Registered Address, City, Country, Landline,
Mobile # I, Mobile # II, Company Email Address,
Name of Autorized Signatory, Designation, CNIC #, Contact #, Personal Email,
Bank Name, Account Title, Account Number / IBAN, Branch,
PCI Internal Representative, Date of Onboarding,
Sales Partner - Signature with Company Stamp, PCI Authorized Representative
```

Two things worth knowing about the current template:

- **`Designation` is reused for two different boxes** — the signatory's
  designation (page 1) and the PCI rep's designation (page 2). In a normal
  AcroForm, fields with the same name always share one value, so filling it
  the standard way would put the same text in both boxes. `fillPdfTemplate.ts`
  works around this by leaving that field's value untouched and drawing each
  box's text by hand (matched to the box's page). If the template is ever
  rebuilt in Acrobat, giving these two boxes distinct names (e.g.
  `Designation (Signatory)` / `Designation (Rep)`) would let the code drop
  the workaround and fill both normally — not required, just simpler.
- **`Sales Partner - Signature with Company Stamp` is a plain text field**,
  not an image/signature field. The code never fills it with text — it draws
  the partner's signature PNG into that box's rectangle instead.
- **`PCI Authorized Representative`** isn't filled by the app at all (no
  corresponding data is collected from the partner) — it's left blank for
  PCI's internal use.

## Swapping in an updated template
1. Replace the file at `templates/SALES PARTNER REGISTRATION FORM (Digital).pdf` (same path/filename, or update `PDF_TEMPLATE_PATH` in `.env`).
2. Open it in Acrobat (or any PDF form editor) and confirm every field name above is present and spelled exactly as shown — pdf-lib throws if a named field is missing.
3. Submit one test registration through the running app and confirm the generated PDF looks right.
