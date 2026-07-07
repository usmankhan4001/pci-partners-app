import { env } from "../config/env.js";

export interface SalesPartnerRecord {
  id: string;
  client_submission_id: string;
  company_name: string;
  ntn: string;
  registered_address: string;
  city: string;
  country: string;
  landline: string;
  mobile1: string;
  mobile2: string;
  company_email: string;
  signatory_name: string;
  signatory_designation: string;
  signatory_cnic: string;
  signatory_contact: string;
  signatory_email: string;
  bank_name: string;
  account_title: string;
  account_iban: string;
  bank_branch: string;
  rep_id: string;
  rep_name: string;
  referral_source: string;
  onboarding_date: string;
  declaration_accepted: boolean;
  declaration_timestamp: string;
  declaration_ip: string;
  tos_version: string;
  doc_cnic_url: string;
  doc_incorp_url: string;
  doc_ntn_url: string;
  doc_address_url: string;
  signature_url: string;
  docx_url: string;
  pdf_url: string;
  status: string;
  upload_errors: string;
  created_at: string;
  updated_at: string;
}

export function createTableSql(): string {
  return `CREATE TABLE IF NOT EXISTS ${env.insforgeTable} (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_submission_id text UNIQUE,
  company_name text NOT NULL,
  ntn text,
  registered_address text,
  city text,
  country text,
  landline text,
  mobile1 text,
  mobile2 text,
  company_email text,
  signatory_name text,
  signatory_designation text,
  signatory_cnic text,
  signatory_contact text,
  signatory_email text,
  bank_name text,
  account_title text,
  account_iban text,
  bank_branch text,
  rep_id text,
  rep_name text,
  referral_source text,
  onboarding_date date,
  declaration_accepted boolean DEFAULT false,
  declaration_timestamp timestamptz,
  declaration_ip text,
  tos_version text,
  doc_cnic_url text,
  doc_incorp_url text,
  doc_ntn_url text,
  doc_address_url text,
  signature_url text,
  docx_url text,
  pdf_url text,
  status text NOT NULL DEFAULT 'submitted',
  upload_errors text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);`;
}
