// Local SQLite store for sales-partner submissions — replaces the Insforge
// (remote Postgres) backend. Stored on the same Docker volume as uploaded
// files (see src/storage/fileStore.ts), so a single volume mount is all the
// persistence this app needs.
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
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
  rep_name: string;
  referral_source: string;
  onboarding_date: string;
  declaration_accepted: 0 | 1;
  declaration_timestamp: string;
  declaration_ip: string;
  tos_version: string;
  doc_cnic_url: string;
  doc_incorp_url: string;
  doc_ntn_url: string;
  doc_address_url: string;
  signature_url: string;
  pdf_url: string;
  status: string;
  upload_errors: string;
  created_at: string;
  updated_at: string;
}

export type NewSalesPartnerRecord = Omit<SalesPartnerRecord, "id" | "created_at" | "updated_at">;

mkdirSync(path.dirname(env.dbPath), { recursive: true });
const db = new Database(env.dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS sales_partners (
    id text PRIMARY KEY,
    client_submission_id text UNIQUE NOT NULL,
    company_name text NOT NULL DEFAULT '',
    ntn text NOT NULL DEFAULT '',
    registered_address text NOT NULL DEFAULT '',
    city text NOT NULL DEFAULT '',
    country text NOT NULL DEFAULT '',
    landline text NOT NULL DEFAULT '',
    mobile1 text NOT NULL DEFAULT '',
    mobile2 text NOT NULL DEFAULT '',
    company_email text NOT NULL DEFAULT '',
    signatory_name text NOT NULL DEFAULT '',
    signatory_designation text NOT NULL DEFAULT '',
    signatory_cnic text NOT NULL DEFAULT '',
    signatory_contact text NOT NULL DEFAULT '',
    signatory_email text NOT NULL DEFAULT '',
    bank_name text NOT NULL DEFAULT '',
    account_title text NOT NULL DEFAULT '',
    account_iban text NOT NULL DEFAULT '',
    bank_branch text NOT NULL DEFAULT '',
    rep_name text NOT NULL DEFAULT '',
    referral_source text NOT NULL DEFAULT '',
    onboarding_date text NOT NULL DEFAULT '',
    declaration_accepted integer NOT NULL DEFAULT 0,
    declaration_timestamp text NOT NULL DEFAULT '',
    declaration_ip text NOT NULL DEFAULT '',
    tos_version text NOT NULL DEFAULT '',
    doc_cnic_url text NOT NULL DEFAULT '',
    doc_incorp_url text NOT NULL DEFAULT '',
    doc_ntn_url text NOT NULL DEFAULT '',
    doc_address_url text NOT NULL DEFAULT '',
    signature_url text NOT NULL DEFAULT '',
    pdf_url text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'submitted',
    upload_errors text NOT NULL DEFAULT '',
    created_at text NOT NULL,
    updated_at text NOT NULL
  );
`);

const insertStmt = db.prepare(`
  INSERT INTO sales_partners (
    id, client_submission_id, company_name, ntn, registered_address, city, country, landline,
    mobile1, mobile2, company_email, signatory_name, signatory_designation, signatory_cnic,
    signatory_contact, signatory_email, bank_name, account_title, account_iban, bank_branch,
    rep_name, referral_source, onboarding_date, declaration_accepted, declaration_timestamp,
    declaration_ip, tos_version, status, created_at, updated_at
  ) VALUES (
    @id, @client_submission_id, @company_name, @ntn, @registered_address, @city, @country, @landline,
    @mobile1, @mobile2, @company_email, @signatory_name, @signatory_designation, @signatory_cnic,
    @signatory_contact, @signatory_email, @bank_name, @account_title, @account_iban, @bank_branch,
    @rep_name, @referral_source, @onboarding_date, @declaration_accepted, @declaration_timestamp,
    @declaration_ip, @tos_version, @status, @created_at, @updated_at
  )
`);

const findBySubmissionIdStmt = db.prepare(`SELECT * FROM sales_partners WHERE client_submission_id = ?`);
const listAllStmt = db.prepare(`SELECT * FROM sales_partners ORDER BY created_at DESC`);

export function insertSalesPartner(data: NewSalesPartnerRecord): SalesPartnerRecord {
  const now = new Date().toISOString();
  const record: SalesPartnerRecord = { ...data, id: randomUUID(), created_at: now, updated_at: now };
  insertStmt.run(record);
  return record;
}

export function findSalesPartnerBySubmissionId(clientSubmissionId: string): SalesPartnerRecord | undefined {
  return findBySubmissionIdStmt.get(clientSubmissionId) as SalesPartnerRecord | undefined;
}

export function updateSalesPartner(id: string, patch: Partial<SalesPartnerRecord>): void {
  const fields = Object.keys(patch);
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = @${f}`).join(", ");
  db.prepare(`UPDATE sales_partners SET ${setClause}, updated_at = @updated_at WHERE id = @id`).run({
    ...patch,
    id,
    updated_at: new Date().toISOString(),
  });
}

export function listSalesPartners(): SalesPartnerRecord[] {
  return listAllStmt.all() as SalesPartnerRecord[];
}
