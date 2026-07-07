import { z } from "zod";

// Pakistani formats. IBAN/NTN are intentionally soft (warn, don't hard-reject —
// bank/FBR document formats have enough edge cases that blocking legitimate
// partners on regex mismatch would do more harm than the validation is worth).
const CNIC_RE = /^\d{5}-?\d{7}-?\d{1}$/;
const MOBILE_RE = /^(\+92|0)?3\d{9}$/;
const IBAN_RE = /^PK\d{2}[A-Z]{4}\d{16}$/;

export const salesPartnerSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required"),
  ntn: z.string().trim().min(1, "NTN is required"),
  registeredAddress: z.string().trim().min(5, "Registered address is required"),
  city: z.string().trim().min(1, "City is required"),
  country: z.string().trim().min(1, "Country is required"),
  landline: z.string().trim().optional().default(""),
  mobile1: z.string().trim().regex(MOBILE_RE, "Enter a valid mobile number, e.g. 0300xxxxxxx"),
  mobile2: z.string().trim().optional().default(""),
  companyEmail: z.string().trim().email("Enter a valid company email"),

  signatoryName: z.string().trim().min(2, "Signatory name is required"),
  signatoryDesignation: z.string().trim().min(1, "Designation is required"),
  signatoryCnic: z.string().trim().regex(CNIC_RE, "Enter a valid CNIC, e.g. 12345-1234567-1"),
  signatoryContact: z.string().trim().regex(MOBILE_RE, "Enter a valid contact number"),
  signatoryEmail: z.string().trim().email("Enter a valid personal email"),

  bankName: z.string().trim().optional().default(""),
  accountTitle: z.string().trim().optional().default(""),
  accountIban: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => v === "" || IBAN_RE.test(v.toUpperCase()), {
      message: "IBAN format looks off (PK + 22 chars) — double check, but you may still continue",
    }),
  bankBranch: z.string().trim().optional().default(""),

  repId: z.string().trim().min(1, "Please select the onboarding representative"),
  repDesignation: z.string().trim().optional().default(""),
  onboardingDate: z.string().trim().min(1),
  referralSource: z.enum(["rep_link", "internal_fallback"]),

  declarationAccepted: z
    .union([z.literal("true"), z.literal("on"), z.boolean()])
    .transform((v) => v === true || v === "true" || v === "on")
    .refine((v) => v === true, { message: "You must accept the Terms of Engagement to continue" }),
});

export type SalesPartnerInput = z.infer<typeof salesPartnerSchema>;

// repId in SalesPartnerInput is a slug into data/reps.json (not client-trusted
// as a name) — repName is resolved server-side from that config before this
// richer shape is used to build the DB record / fill the docx template.
export type SalesPartnerFormData = SalesPartnerInput & { repName: string };

export const REQUIRED_DOC_FIELDS = ["cnic", "incorp", "ntn", "address", "signature"] as const;
export type RequiredDocField = (typeof REQUIRED_DOC_FIELDS)[number];

export const ALLOWED_DOC_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
