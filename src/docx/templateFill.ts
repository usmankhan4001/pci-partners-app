// Fills templates/sales-partner-agreement.docx using docx-templates
// (MIT, zero known vulnerabilities — deliberately NOT docxtemplater's free
// image module, which pulls in a critically-vulnerable unmaintained
// `xmldom` with no fix available). The template itself is authored by PCI,
// not uploaded by an end user, so docx-templates' "templates can run
// arbitrary JS" caveat does not apply to untrusted input here.
import { readFile } from "node:fs/promises";
import { createReport } from "docx-templates";
import { env } from "../config/env.js";
import type { SalesPartnerFormData } from "../validation/salesPartnerSchema.js";

export interface TemplateFillInput {
  data: SalesPartnerFormData;
  signaturePngBuffer: Buffer;
}

export async function fillTemplate({ data, signaturePngBuffer }: TemplateFillInput): Promise<Buffer> {
  const template = await readFile(env.docxTemplatePath);

  const buffer = await createReport({
    template,
    cmdDelimiter: ["{", "}"],
    data: {
      company_name: data.companyName,
      ntn: data.ntn,
      registered_address: data.registeredAddress,
      city: data.city,
      country: data.country,
      landline: data.landline || "",
      mobile1: data.mobile1,
      mobile2: data.mobile2 || "",
      company_email: data.companyEmail,
      signatory_name: data.signatoryName,
      signatory_designation: data.signatoryDesignation,
      signatory_cnic: data.signatoryCnic,
      signatory_contact: data.signatoryContact,
      signatory_email: data.signatoryEmail,
      bank_name: data.bankName || "",
      account_title: data.accountTitle || "",
      account_iban: data.accountIban || "",
      bank_branch: data.bankBranch || "",
      rep_name: data.repName,
      rep_designation: data.repDesignation || "",
      onboarding_date: data.onboardingDate,
      declaration_timestamp: new Date().toISOString(),
      tos_version: env.tosVersion,
    },
    additionalJsContext: {
      signature: () => ({
        width: 7,
        height: 3.5,
        data: signaturePngBuffer,
        extension: ".png",
      }),
    },
  });

  return Buffer.from(buffer);
}
