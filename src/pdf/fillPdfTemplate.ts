// Fills templates/SALES PARTNER REGISTRATION FORM (Digital).pdf directly —
// it's PCI's real, already-designed form and it ships as a proper AcroForm
// (22 named fields), so there's no need to hand-recreate the layout in a
// separate .docx and round-trip it through LibreOffice (the old pipeline in
// git history). Filling the real PDF guarantees the output always matches
// the template pixel-for-pixel, and drops the LibreOffice/soffice runtime
// dependency entirely (a major source of prior failures: missing binary in
// local dev, 60s conversion timeouts, docx-templates tag typos).
import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFWidgetAnnotation } from "pdf-lib";
import { env } from "../config/env.js";
import type { SalesPartnerFormData } from "../validation/salesPartnerSchema.js";

export interface PdfFillInput {
  data: SalesPartnerFormData;
  signaturePngBuffer: Buffer;
  repSignaturePngBuffer?: Buffer;
}

// Simple 1:1 field-name -> value mappings. Excludes "Designation" (see
// below — the template reuses that one field name for two different boxes)
// and the signature box (filled with an image, not text).
function textFieldValues(data: SalesPartnerFormData): Record<string, string> {
  return {
    "Company Name": data.companyName,
    "NTN #": data.ntn,
    "Registered Address": data.registeredAddress,
    City: data.city,
    Country: data.country,
    Landline: data.landline || "",
    "Mobile # I": data.mobile1,
    "Mobile # II": data.mobile2 || "",
    "Company Email Address": data.companyEmail,
    "Name of Autorized Signatory": data.signatoryName,
    "CNIC #": data.signatoryCnic,
    "Contact #": data.signatoryContact,
    "Personal Email": data.signatoryEmail,
    "Bank Name": data.bankName || "",
    "Account Title": data.accountTitle || "",
    "Account Number / IBAN": data.accountIban || "",
    Branch: data.bankBranch || "",
    "PCI Internal Representative": data.repName,
    "Date of Onboarding": data.onboardingDate,
  };
}

// Finds which page a widget's annotation lives on by matching the widget's
// underlying dict against each page's /Annots array (pdf-lib doesn't expose
// a widget -> page lookup directly).
function findWidgetPage(pdfDoc: PDFDocument, widget: PDFWidgetAnnotation): PDFPage | undefined {
  for (const page of pdfDoc.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (let i = 0; i < annots.size(); i++) {
      if (pdfDoc.context.lookup(annots.get(i)) === widget.dict) return page;
    }
  }
  return undefined;
}

// Draws a signature image into a text field's box (the template uses plain
// text fields for signature boxes, not image/signature fields), scaled to
// fit while preserving aspect ratio, then removes the now-redundant field.
async function drawSignatureField(pdfDoc: PDFDocument, form: ReturnType<PDFDocument["getForm"]>, fieldName: string, pngBuffer: Buffer) {
  const field = form.getTextField(fieldName);
  const [widget] = field.acroField.getWidgets();
  const page = findWidgetPage(pdfDoc, widget);
  if (page) {
    const rect = widget.getRectangle();
    const image = await pdfDoc.embedPng(pngBuffer);
    const padding = 4;
    const maxWidth = rect.width - padding * 2;
    const maxHeight = rect.height - padding * 2;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    page.drawImage(image, {
      x: rect.x + (rect.width - drawWidth) / 2,
      y: rect.y + (rect.height - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });
  }
  form.removeField(field);
}

export async function fillPdfTemplate({ data, signaturePngBuffer, repSignaturePngBuffer }: PdfFillInput): Promise<Buffer> {
  const templateBytes = await readFile(env.pdfTemplatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const [name, value] of Object.entries(textFieldValues(data))) {
    const field = form.getTextField(name);
    field.setText(value);
  }
  form.updateFieldAppearances(helv);

  // "Designation" is the one field name the template reuses for two
  // different boxes (signatory designation on page 1, PCI rep designation
  // on page 2) — an AcroForm quirk of the source PDF, not something we can
  // fix by filling: same field name means same value everywhere it's used.
  // Draw each box's text by hand instead, one widget per page.
  const designationField = form.getTextField("Designation");
  const designationValues: Record<number, string> = {
    0: data.signatoryDesignation,
    1: data.repDesignation || "",
  };
  for (const widget of designationField.acroField.getWidgets()) {
    const page = findWidgetPage(pdfDoc, widget);
    if (!page) continue;
    const pageIndex = pdfDoc.getPages().indexOf(page);
    const value = designationValues[pageIndex];
    if (value === undefined) continue;
    const rect = widget.getRectangle();
    page.drawText(value, {
      x: rect.x + 4,
      y: rect.y + (rect.height - 12) / 2 + 2,
      size: 12,
      font: helv,
      color: rgb(0, 0, 0),
    });
  }
  form.removeField(designationField);

  // Signature boxes are plain text fields in the template, but we have
  // actual signature images — draw them into the boxes instead of filling
  // text. The PCI representative's signature is optional (not every
  // submission happens with a PCI rep physically present), so its box is
  // just left blank — matching the field name — when none was provided.
  await drawSignatureField(pdfDoc, form, "Sales Partner - Signature with Company Stamp", signaturePngBuffer);
  if (repSignaturePngBuffer) {
    await drawSignatureField(pdfDoc, form, "PCI Authorized Representative", repSignaturePngBuffer);
  } else {
    form.removeField(form.getTextField("PCI Authorized Representative"));
  }

  form.flatten();
  const savedBytes = await pdfDoc.save();
  return Buffer.from(savedBytes);
}
