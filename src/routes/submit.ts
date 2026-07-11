import { Router } from "express";
import { env } from "../config/env.js";
import { insertRecord, listRecords, updateRecord, uploadFile } from "../insforge/client.js";
import type { SalesPartnerRecord } from "../insforge/schema.js";
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

  const data: SalesPartnerFormData = parsed.data;

  try {
    // Idempotency: a double-click resend of the same submissionId reuses the existing row.
    const existingRows = await listRecords<SalesPartnerRecord>(
      env.insforgeTable,
      `client_submission_id=eq.${encodeURIComponent(submissionId)}`,
    );
    let record = existingRows[0];

    if (!record) {
      // Phase A: durable record with all text fields. No file I/O — if this
      // fails, nothing was created and the client can safely retry.
      record = await insertRecord<Partial<SalesPartnerRecord>>(env.insforgeTable, {
        client_submission_id: submissionId,
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
        declaration_accepted: data.declarationAccepted,
        declaration_timestamp: new Date().toISOString(),
        declaration_ip: req.ip ?? "unknown",
        tos_version: env.tosVersion,
        status: "submitted",
      }) as SalesPartnerRecord;
    }

    // Phase B: upload documents + signature, fill the docx, render the PDF.
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
        const uploaded = await uploadFile(env.insforgeBucket, `${record.id}/${file.originalname}`, file.buffer, file.mimetype);
        docUploads[slot.column] = uploaded.url;
      } catch (err) {
        logger.error(`Document upload failed for ${slot.field} on record ${record.id}`, err);
        uploadErrors.push(slot.field);
      }
    }

    try {
      const signatureUpload = await uploadFile(env.insforgeBucket, `${record.id}/signature.png`, signatureBuffer, "image/png");
      docUploads.signature_url = signatureUpload.url;
    } catch (err) {
      logger.error(`Signature upload failed on record ${record.id}`, err);
      uploadErrors.push("signature");
    }

    let pdfUrl = "";
    try {
      const pdfBuffer = await fillPdfTemplate({ data, signaturePngBuffer: signatureBuffer });
      const pdfUpload = await uploadFile(env.insforgeBucket, `${record.id}/sales-partner-agreement.pdf`, pdfBuffer, "application/pdf");
      pdfUrl = pdfUpload.url;
    } catch (err) {
      logger.error(`PDF generation failed for record ${record.id}`, err);
      uploadErrors.push("agreement_document");
    }

    const status = uploadErrors.length > 0 ? "partial" : "complete";
    await updateRecord(env.insforgeTable, record.id, {
      ...docUploads,
      pdf_url: pdfUrl,
      status,
      upload_errors: uploadErrors.join(", "),
    });

    res.json({ id: record.id, submissionId, status, pdfUrl, failedSteps: uploadErrors });
  } catch (err) {
    logger.error("Submission failed", err);
    res.status(502).json({ error: "Could not reach the database — please try again shortly." });
  }
});
