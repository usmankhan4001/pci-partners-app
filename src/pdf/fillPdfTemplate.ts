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

export interface SupportingDocumentInput {
  label: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

export interface PdfFillInput {
  data: SalesPartnerFormData;
  signaturePngBuffer: Buffer;
  repSignaturePngBuffer?: Buffer;
  supportingDocuments?: SupportingDocumentInput[];
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

async function appendImageDocument(
  pdfDoc: PDFDocument,
  document: SupportingDocumentInput,
  pageWidth: number,
  pageHeight: number,
  bodyFont: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  titleFont: Awaited<ReturnType<PDFDocument["embedFont"]>>,
) {
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  const margin = 36;
  const headingY = pageHeight - margin - 10;
  const detailY = headingY - 18;
  const image = document.mimeType === "image/png" ? await pdfDoc.embedPng(document.buffer) : await pdfDoc.embedJpg(document.buffer);
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2 - 40;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;

  page.drawText(document.label, {
    x: margin,
    y: headingY,
    size: 14,
    font: titleFont,
    color: rgb(0.12, 0.22, 0.39),
  });
  page.drawText(document.filename, {
    x: margin,
    y: detailY,
    size: 9,
    font: bodyFont,
    color: rgb(0.35, 0.39, 0.45),
  });
  page.drawImage(image, {
    x: margin + (maxWidth - drawWidth) / 2,
    y: margin,
    width: drawWidth,
    height: drawHeight,
  });
}

function appendAttachmentErrorPage(
  pdfDoc: PDFDocument,
  document: SupportingDocumentInput,
  pageWidth: number,
  pageHeight: number,
  bodyFont: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  titleFont: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  errorText: string,
) {
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  const margin = 36;
  page.drawText(document.label, {
    x: margin,
    y: pageHeight - margin - 10,
    size: 14,
    font: titleFont,
    color: rgb(0.12, 0.22, 0.39),
  });
  page.drawText(document.filename, {
    x: margin,
    y: pageHeight - margin - 28,
    size: 9,
    font: bodyFont,
    color: rgb(0.35, 0.39, 0.45),
  });
  page.drawText("This uploaded document could not be rendered into the export.", {
    x: margin,
    y: pageHeight - margin - 68,
    size: 12,
    font: bodyFont,
    color: rgb(0.7, 0.15, 0.12),
  });
  page.drawText(errorText.slice(0, 160), {
    x: margin,
    y: pageHeight - margin - 92,
    size: 10,
    font: bodyFont,
    color: rgb(0.2, 0.2, 0.2),
    maxWidth: pageWidth - margin * 2,
    lineHeight: 14,
  });
}

async function appendSupportingDocuments(
  pdfDoc: PDFDocument,
  documents: SupportingDocumentInput[],
  bodyFont: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  titleFont: Awaited<ReturnType<PDFDocument["embedFont"]>>,
) {
  if (documents.length === 0) return;
  const firstPage = pdfDoc.getPage(0);
  const { width: pageWidth, height: pageHeight } = firstPage.getSize();

  for (const document of documents) {
    try {
      if (document.mimeType === "application/pdf") {
        const attachmentPdf = await PDFDocument.load(document.buffer, { ignoreEncryption: true });
        const copiedPages = await pdfDoc.copyPages(attachmentPdf, attachmentPdf.getPageIndices());
        for (const page of copiedPages) pdfDoc.addPage(page);
        continue;
      }
      if (document.mimeType === "image/png" || document.mimeType === "image/jpeg") {
        await appendImageDocument(pdfDoc, document, pageWidth, pageHeight, bodyFont, titleFont);
        continue;
      }
      appendAttachmentErrorPage(pdfDoc, document, pageWidth, pageHeight, bodyFont, titleFont, `Unsupported mime type: ${document.mimeType}`);
    } catch (err) {
      appendAttachmentErrorPage(
        pdfDoc,
        document,
        pageWidth,
        pageHeight,
        bodyFont,
        titleFont,
        err instanceof Error ? err.message : "Unknown document rendering error.",
      );
    }
  }
}

export async function fillPdfTemplate({ data, signaturePngBuffer, repSignaturePngBuffer, supportingDocuments = [] }: PdfFillInput): Promise<Buffer> {
  const templateBytes = await readFile(env.pdfTemplatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

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
  await appendSupportingDocuments(pdfDoc, supportingDocuments, helv, helvBold);
  const savedBytes = await pdfDoc.save();
  return Buffer.from(savedBytes);
}
