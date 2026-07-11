(function () {
  "use strict";

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function docLink(url, label) {
    return url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${label}</a>` : "";
  }
  async function load() {
    const res = await fetch("/internal/api/submissions");
    if (!res.ok) {
      document.getElementById("count").textContent = "Failed to load submissions.";
      return;
    }
    const rows = await res.json();
    document.getElementById("count").textContent = `${rows.length} submission${rows.length === 1 ? "" : "s"}`;
    if (rows.length === 0) {
      document.getElementById("empty").hidden = false;
      return;
    }
    const tbody = document.getElementById("tbody");
    tbody.innerHTML = rows
      .map((r) => {
        const docs = [
          docLink(r.pdf_url, "PDF"),
          docLink(r.signature_url, "Signature"),
          docLink(r.rep_signature_url, "Rep Signature"),
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
    document.getElementById("table").hidden = false;
  }
  load();
})();
