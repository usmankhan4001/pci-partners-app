(function () {
  "use strict";

  const ALL_REPS = "__all__";
  let allRows = [];
  let selectedRep = ALL_REPS;
  let searchTerm = "";

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function docLink(url, label) {
    return url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${label}</a>` : "";
  }

  // Columns shared by the table and both exports, kept in one place so the
  // three stay in sync. Signature images are deliberately excluded — they're
  // baked into the PDF already and aren't meant to be distributed as
  // separate downloadable image files.
  const COLUMNS = [
    { label: "Submitted", get: (r) => (r.created_at ? new Date(r.created_at).toLocaleString() : "") },
    { label: "Status", get: (r) => r.status },
    { label: "Company Name", get: (r) => r.company_name },
    { label: "NTN", get: (r) => r.ntn },
    { label: "Registered Address", get: (r) => r.registered_address },
    { label: "City", get: (r) => r.city },
    { label: "Country", get: (r) => r.country },
    { label: "Landline", get: (r) => r.landline },
    { label: "Mobile 1", get: (r) => r.mobile1 },
    { label: "Mobile 2", get: (r) => r.mobile2 },
    { label: "Company Email", get: (r) => r.company_email },
    { label: "Signatory Name", get: (r) => r.signatory_name },
    { label: "Signatory Designation", get: (r) => r.signatory_designation },
    { label: "Signatory CNIC", get: (r) => r.signatory_cnic },
    { label: "Signatory Contact", get: (r) => r.signatory_contact },
    { label: "Signatory Email", get: (r) => r.signatory_email },
    { label: "Bank Name", get: (r) => r.bank_name },
    { label: "Account Title", get: (r) => r.account_title },
    { label: "Account IBAN", get: (r) => r.account_iban },
    { label: "Bank Branch", get: (r) => r.bank_branch },
    { label: "Representative", get: (r) => r.rep_name },
    { label: "Onboarding Date", get: (r) => r.onboarding_date },
    { label: "PDF", get: (r) => r.pdf_url ? `${location.origin}${r.pdf_url}` : "" },
  ];

  function filteredRows() {
    const term = searchTerm.trim().toLowerCase();
    return allRows.filter((r) => {
      if (selectedRep !== ALL_REPS && (r.rep_name || "(no representative)") !== selectedRep) return false;
      if (!term) return true;
      return [r.company_name, r.signatory_name, r.company_email, r.mobile1, r.rep_name]
        .some((v) => String(v ?? "").toLowerCase().includes(term));
    });
  }

  function renderStats(rows) {
    const counts = { complete: 0, partial: 0, submitted: 0 };
    for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
    const stats = [
      { label: "Total", value: rows.length, cls: "" },
      { label: "Complete", value: counts.complete || 0, cls: "complete" },
      { label: "Partial", value: counts.partial || 0, cls: "partial" },
      { label: "Submitted only", value: counts.submitted || 0, cls: "" },
    ];
    document.getElementById("stats").innerHTML = stats
      .map((s) => `<div class="stat-card ${s.cls}"><div class="stat-value">${s.value}</div><div class="stat-label">${esc(s.label)}</div></div>`)
      .join("");
  }

  function renderRepList() {
    const counts = new Map();
    for (const r of allRows) {
      const name = r.rep_name || "(no representative)";
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    const reps = Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const items = [[ALL_REPS, allRows.length, "All Representatives"], ...reps.map(([name, count]) => [name, count, name])];
    document.getElementById("rep-list").innerHTML = items
      .map(
        ([key, count, label]) =>
          `<button type="button" class="rep-item ${key === selectedRep ? "active" : ""}" data-rep="${esc(key)}">
            <span>${esc(label)}</span><span class="rep-count">${count}</span>
          </button>`,
      )
      .join("");
    for (const btn of document.querySelectorAll(".rep-item")) {
      btn.addEventListener("click", () => {
        selectedRep = btn.dataset.rep;
        render();
      });
    }
  }

  function renderTable(rows) {
    document.getElementById("count").textContent = `${rows.length} submission${rows.length === 1 ? "" : "s"}`;
    const table = document.getElementById("table");
    const empty = document.getElementById("empty");
    if (rows.length === 0) {
      table.hidden = true;
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    table.hidden = false;
    document.getElementById("tbody").innerHTML = rows
      .map((r) => {
        const docs = [
          docLink(r.pdf_url, "PDF"),
          docLink(r.doc_cnic_url, "CNIC"),
          docLink(r.doc_incorp_url, "Incorp"),
          docLink(r.doc_ntn_url, "NTN"),
          docLink(r.doc_address_url, "Address"),
        ]
          .filter(Boolean)
          .join(" · ");
        const submitted = r.created_at ? new Date(r.created_at).toLocaleString() : "";
        return `<tr>
          <td>${esc(submitted)}</td>
          <td><span class="badge ${esc(r.status)}">${esc(r.status)}</span></td>
          <td>${esc(r.company_name)}</td>
          <td>${esc(r.signatory_name)}</td>
          <td>${esc(r.mobile1)}</td>
          <td>${esc(r.company_email)}</td>
          <td>${esc(r.rep_name)}</td>
          <td>${docs}</td>
        </tr>`;
      })
      .join("");
  }

  function render() {
    const rows = filteredRows();
    renderStats(rows);
    renderRepList();
    renderTable(rows);
  }

  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const rows = filteredRows();
    const escapeCsv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [COLUMNS.map((c) => escapeCsv(c.label)).join(",")];
    for (const r of rows) lines.push(COLUMNS.map((c) => escapeCsv(c.get(r))).join(","));
    downloadBlob("﻿" + lines.join("\r\n"), "sales-partner-submissions.csv", "text/csv;charset=utf-8");
  }

  // Excel "SpreadsheetML 2003" XML format — plain text, no library needed,
  // and Excel opens it as a proper spreadsheet (not a renamed CSV).
  function exportXls() {
    const rows = filteredRows();
    const cell = (v) => `<Cell><Data ss:Type="String">${esc(v ?? "")}</Data></Cell>`;
    const headerRow = `<Row>${COLUMNS.map((c) => cell(c.label)).join("")}</Row>`;
    const dataRows = rows.map((r) => `<Row>${COLUMNS.map((c) => cell(c.get(r))).join("")}</Row>`).join("");
    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Submissions">
<Table>${headerRow}${dataRows}</Table>
</Worksheet>
</Workbook>`;
    downloadBlob(xml, "sales-partner-submissions.xls", "application/vnd.ms-excel");
  }

  document.getElementById("search").addEventListener("input", (e) => {
    searchTerm = e.target.value;
    render();
  });
  document.getElementById("export-csv").addEventListener("click", exportCsv);
  document.getElementById("export-xls").addEventListener("click", exportXls);

  async function load() {
    const res = await fetch("/internal/api/submissions");
    if (!res.ok) {
      document.getElementById("count").textContent = "Failed to load submissions.";
      return;
    }
    allRows = await res.json();
    render();
  }
  load();
})();
