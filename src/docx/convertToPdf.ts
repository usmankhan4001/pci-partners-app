// Converts a filled .docx buffer to PDF via LibreOffice headless (`soffice
// --headless --convert-to pdf`). This is the same "install a system binary
// into the Docker image" pattern already used elsewhere in PCI's stack
// (Puppeteer/Chromium for the WhatsApp bot's proposal PDFs) — LibreOffice is
// the standard, reliable way to get faithful DOCX->PDF rendering headlessly.
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { env } from "../config/env.js";

const execFileAsync = promisify(execFile);

export async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  const workDir = await mkdtemp(path.join(tmpdir(), "pci-partner-"));
  const docxPath = path.join(workDir, `${randomUUID()}.docx`);
  const pdfPath = docxPath.replace(/\.docx$/, ".pdf");

  try {
    await writeFile(docxPath, docxBuffer);
    await execFileAsync(env.sofficePath, [
      "--headless",
      "--norestore",
      "--convert-to",
      "pdf",
      "--outdir",
      workDir,
      docxPath,
    ], { timeout: 60_000 });

    return await readFile(pdfPath);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
