import { Router } from "express";
import { env } from "../config/env.js";
import {
  findSalesPartnerBySubmissionId,
  insertSalesPartner,
  updateSalesPartner,
  type SalesPartnerRecord,
} from "../db/salesPartnerStore.js";
import { saveFile } from "../storage/fileStore.js";
import { upload } from "../middleware/upload.js";
import { decodeSignatureDataUrl, isLikelyBlankSignature } from "../signature/canvasToPng.js";
import { salesPartnerSchema, type SalesPartnerFormData } from "../validation/salesPartnerSchema.js";
import { fillPdfTemplate } from "../pdf/fillPdfTemplate.js";
import { logger } from "../utils/logger.js";

export const submitRouter = Router();

const FILE_FIELDS = [
  { name: "cnicFile", maxCount: 1 },
  { name: "incorpFile", maxCount: 1 },
  { name: "ntnFile", maxCount: 1 },
  { name: "addressFile", maxCount: 1 },
];

function textFieldsFrom(data: SalesPartnerFormData, req: { ip?: string }) {
  return {
    company_name: data.companyName,
    ntn: data.ntn,
    registered_address: data.registeredAddress,
    city: data.city,
    country: data.country,
    landline: data.landline,
    mobile1: data.mobile1,
    mobile2: data.mobile2,
    company_email: data.companyEmail,
    signatory_name: data.signatoryName,
    signatory_designation: data.signatoryDesignation,
    signatory_cnic: data.signatoryCnic,
    signatory_contact: data.signatoryContact,
    signatory_email: data.signatoryEmail,
    bank_name: data.bankName,
    account_title: data.accountTitle,
    account_iban: data.accountIban,
    bank_branch: data.bankBranch,
    rep_name: data.repName,
    referral_source: data.referralSource,
    onboarding_date: data.onboardingDate,
    declaration_accepted: (data.declarationAccepted ? 1 : 0) as 0 | 1,
    declaration_ip: req.ip ?? "unknown",
    tos_version: env.tosVersion,
  };
}

submitRouter.post("/api/submissions", upload.fields(FILE_FIELDS), async (req, res) => {
  const submissionId = String(req.body.submissionId || "").trim();
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(submissionId)) {
    res.status(400).json({ error: "Missing or invalid submissionId" });
    return;
  }

  const parsed = salesPartnerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
    return;
  }

  const files = req.files as Record<string, Express.Multer.File[]> | undefined;

  let signatureBuffer: Buffer;
  try {
    signatureBuffer = decodeSignatureDataUrl(String(req.body.signatureDataUrl || ""));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Invalid signature" });
    return;
  }
  if (isLikelyBlankSignature(signatureBuffer)) {
    res.status(400).json({ error: "Please sign in the signature box before submitting" });
    return;
  }

  // The PCI representative's signature is optional — not every submission
  // happens with a rep physically present to sign alongside the partner.
  let repSignatureBuffer: Buffer | undefined;
  const repSignatureDataUrl = String(req.body.repSignatureDataUrl || "").trim();
  if (repSignatureDataUrl) {
    try {
      repSignatureBuffer = decodeSignatureDataUrl(repSignatureDataUrl);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Invalid PCI representative signature" });
      return;
    }
    if (isLikelyBlankSignature(repSignatureBuffer)) {
      repSignatureBuffer = undefined;
    }
  }

  const data: SalesPartnerFormData = parsed.data;

  try {
    // Idempotency: a resend of the same submissionId (double-click, or the
    // partner going back to fix something after a partial failure) reuses
    // the existing row — but always refreshes its text fields, so an edit
    // made on retry isn't silently dropped.
    let record = findSalesPartnerBySubmissionId(submissionId);
    const fields = textFieldsFrom(data, req);

    if (!record) {
      try {
        record = insertSalesPartner({
          client_submission_id: submissionId,
          ...fields,
          declaration_timestamp: new Date().toISOString(),
          doc_cnic_url: "",
          doc_incorp_url: "",
          doc_ntn_url: "",
          doc_address_url: "",
          signature_url: "",
          rep_signature_url: "",
          pdf_url: "",
          status: "submitted",
          upload_errors: "",
        });
      } catch (err) {
        // Two near-simultaneous submits (double-click, retry) can both pass
        // the lookup above and race on the UNIQUE constraint — the loser
        // isn't a real failure, it just means the winner already created
        // the row a moment earlier, so fetch and continue instead of
        // surfacing a scary 502.
        record = findSalesPartnerBySubmissionId(submissionId);
        if (!record) throw err;
      }
    } else {
      updateSalesPartner(record.id, fields);
      record = { ...record, ...fields };
    }

    // Phase B: save documents + signature, fill the PDF template.
    const uploadErrors: string[] = [];
    const docUploads: Record<string, string> = {};

    const docSlots: Array<{ field: string; column: string }> = [
      { field: "cnicFile", column: "doc_cnic_url" },
      { field: "incorpFile", column: "doc_incorp_url" },
      { field: "ntnFile", column: "doc_ntn_url" },
      { field: "addressFile", column: "doc_address_url" },
    ];
    for (const slot of docSlots) {
      // Documents are optional now — only attempt (and only count as a real
      // failure) the ones the partner actually provided.
      const file = files?.[slot.field]?.[0];
      if (!file) continue;
      try {
        const saved = await saveFile(`${record.id}/${file.originalname}`, file.buffer);
        docUploads[slot.column] = saved.url;
      } catch (err) {
        logger.error(`Document save failed for ${slot.field} on record ${record.id}`, err);
        uploadErrors.push(slot.field);
      }
    }

    try {
      const savedSignature = await saveFile(`${record.id}/signature.png`, signatureBuffer);
      docUploads.signature_url = savedSignature.url;
    } catch (err) {
      logger.error(`Signature save failed on record ${record.id}`, err);
      uploadErrors.push("signature");
    }

    if (repSignatureBuffer) {
      try {
        const savedRepSignature = await saveFile(`${record.id}/rep-signature.png`, repSignatureBuffer);
        docUploads.rep_signature_url = savedRepSignature.url;
      } catch (err) {
        logger.error(`PCI representative signature save failed on record ${record.id}`, err);
        uploadErrors.push("rep_signature");
      }
    }

    let pdfUrl = "";
    try {
      const pdfBuffer = await fillPdfTemplate({ data, signaturePngBuffer: signatureBuffer, repSignaturePngBuffer: repSignatureBuffer });
      const savedPdf = await saveFile(`${record.id}/sales-partner-agreement.pdf`, pdfBuffer);
      pdfUrl = savedPdf.url;
    } catch (err) {
      logger.error(`PDF generation failed for record ${record.id}`, err);
      uploadErrors.push("agreement_document");
    }

    const status = uploadErrors.length > 0 ? "partial" : "complete";
    updateSalesPartner(record.id, {
      ...(docUploads as Partial<SalesPartnerRecord>),
      pdf_url: pdfUrl,
      status,
      upload_errors: uploadErrors.join(", "),
    });

    res.json({ id: record.id, submissionId, status, pdfUrl, failedSteps: uploadErrors });
  } catch (err) {
    logger.error("Submission failed", err);
    res.status(500).json({ error: "Something went wrong saving your submission — please try again shortly." });
  }
});
