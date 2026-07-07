# Insforge Setup (one-time, safe to re-run)

Insforge is the self-hosted BaaS at `insforge.premierchoiceint.online`
already configured for this workspace. It provides both the Postgres
database and S3-compatible file storage this app uses — there's no Bitrix
or any other CRM involved in V2.

## 1. Fill in `.env`
```bash
cp .env.example .env
```
Set `INSFORGE_API_BASE_URL` and `INSFORGE_API_KEY`.

## 2. Run the setup script
```bash
npm install
npm run setup:insforge
```
This creates (or confirms) the `sales_partners` table via raw SQL
(`CREATE TABLE IF NOT EXISTS`, safe to re-run) and the
`sales-partner-documents` storage bucket.

## 3. Verify
Check the Insforge dashboard for the new table and bucket. The table columns
are defined in `src/insforge/schema.ts` (`createTableSql()`) — that file is
the single source of truth if the schema ever needs to change (add a column
there, then re-run `npm run setup:insforge`; it won't touch existing data).

## Auth note
Insforge documents two header conventions across its API surface
(`x-api-key` for its own admin tooling, `Authorization: Bearer` for
application REST calls). `src/insforge/client.ts` sends both on every
request so it keeps working regardless of which family a given endpoint
expects.
