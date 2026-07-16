(function () {
  "use strict";

  const STEP_COUNT = 5;
  const DRAFT_KEY = "pci-partner-form-draft";
  const SUBMISSION_ID_KEY = "pci-partner-submission-id";
  // Placeholder until /health reports the server's real MAX_UPLOAD_MB — kept
  // in sync at runtime instead of hardcoded, so the two can't drift apart.
  let MAX_UPLOAD_MB = 5;
  fetch("/health")
    .then((r) => r.json())
    .then((h) => {
      if (typeof h.maxUploadMb === "number") MAX_UPLOAD_MB = h.maxUploadMb;
    })
    .catch(() => {});

  // Mirrors the server's tolerant regexes (src/validation/salesPartnerSchema.ts)
  // so obviously-invalid input is caught before the final submit instead of
  // only at the end of a 5-step wizard.
  const MOBILE_RE = /^(\+92|0)?3\d{9}$/;
  const CNIC_RE = /^\d{5}-?\d{7}-?\d{1}$/;
  const IBAN_RE = /^PK\d{2}[A-Z]{4}\d{16}$/;
  const stripFormatting = (v) => v.replace(/[\s-]/g, "");
  const CUSTOM_VALIDATORS = {
    mobile1: (v) => !v || MOBILE_RE.test(stripFormatting(v)) || "Enter a valid mobile number, e.g. 0300xxxxxxx",
    mobile2: (v) => !v || MOBILE_RE.test(stripFormatting(v)) || "Enter a valid mobile number, e.g. 0300xxxxxxx",
    signatoryContact: (v) => !v || MOBILE_RE.test(stripFormatting(v)) || "Enter a valid contact number",
    signatoryCnic: (v) => !v || CNIC_RE.test(stripFormatting(v)) || "Enter a valid CNIC, e.g. 12345-1234567-1",
    accountIban: (v) =>
      !v || IBAN_RE.test(stripFormatting(v).toUpperCase()) || "IBAN format looks off (PK + 22 chars)",
  };

  const form = document.getElementById("partner-form");
  const steps = Array.from(document.querySelectorAll(".step"));
  const progressBar = document.getElementById("progress-bar");
  const progressLabel = document.getElementById("progress-label");
  const btnBack = document.getElementById("btn-back");
  const btnNext = document.getElementById("btn-next");
  const btnSubmit = document.getElementById("btn-submit");
  const repBadge = document.getElementById("rep-badge");
  const repNameInput = document.getElementById("repName");
  const submitStatus = document.getElementById("submit-status");

  let currentStep = 1;

  // ── Submission/idempotency id ──────────────────────────────────
  function getOrCreateSubmissionId() {
    let id = sessionStorage.getItem(SUBMISSION_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SUBMISSION_ID_KEY, id);
    }
    return id;
  }
  document.getElementById("submissionId").value = getOrCreateSubmissionId();

  // ── Autosave (text fields only — files/signature can't survive a reload) ──
  function autosaveFields() {
    return Array.from(form.querySelectorAll("input, textarea, select")).filter(
      (el) => el.type !== "file" && el.type !== "hidden",
    );
  }
  function saveDraft() {
    const data = {};
    for (const el of autosaveFields()) {
      data[el.name || el.id] = el.type === "checkbox" ? el.checked : el.value;
    }
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  }
  function restoreDraft() {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      for (const el of autosaveFields()) {
        const key = el.name || el.id;
        if (!(key in data)) continue;
        if (el.type === "checkbox") el.checked = data[key];
        else el.value = data[key];
        // Restored values may already be invalid (e.g. a draft saved before
        // the browser tab closed mid-typo) — surface that immediately
        // instead of waiting for the field to be touched again.
        if (el.value) validateField(el);
      }
    } catch {
      /* ignore corrupt draft */
    }
  }
  form.addEventListener("input", saveDraft);

  // ── Step navigation ────────────────────────────────────────────
  function showStep(n) {
    currentStep = n;
    for (const s of steps) {
      s.classList.toggle("hidden", Number(s.dataset.step) !== n);
    }
    progressBar.style.width = `${(n / STEP_COUNT) * 100}%`;
    progressLabel.textContent = `Step ${n} of ${STEP_COUNT}`;
    btnBack.classList.toggle("hidden", n === 1);
    btnNext.classList.toggle("hidden", n === STEP_COUNT);
    btnSubmit.classList.toggle("hidden", n !== STEP_COUNT);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Signature canvases have zero size while their step is display:none, so
    // they must be (re)sized the first time they actually become visible.
    if (n === 4) partnerSignaturePad.resize();
    if (n === 5) repSignaturePad.resize();
  }

  function fieldsInStep(n) {
    const el = steps.find((s) => Number(s.dataset.step) === n);
    return Array.from(el.querySelectorAll("input, textarea, select")).filter((f) => !f.disabled);
  }

  function showFieldError(field, message) {
    const small = field.closest(".field, .doc-field, .signature-field")?.querySelector(".field-error");
    field.classList.toggle("invalid", Boolean(message));
    field.classList.toggle("valid", !message && field.value);
    if (small) small.textContent = message || "";
  }

  function validateField(field) {
    if (field.type === "file") {
      if (field.required && field.files.length === 0) {
        showFieldError(field, "This document is required");
        return false;
      }
      const file = field.files[0];
      if (file && file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        showFieldError(field, `File is too large (max ${MAX_UPLOAD_MB}MB)`);
        return false;
      }
      showFieldError(field, "");
      return true;
    }
    if (!field.checkValidity()) {
      showFieldError(field, field.validationMessage);
      return false;
    }
    const customValidator = CUSTOM_VALIDATORS[field.name];
    if (customValidator) {
      const result = customValidator(field.value.trim());
      if (result !== true) {
        showFieldError(field, result);
        return false;
      }
    }
    showFieldError(field, "");
    return true;
  }

  function validateStep(n) {
    let ok = true;
    for (const field of fieldsInStep(n)) {
      if (!validateField(field)) ok = false;
    }
    if (n === 4 && !partnerSignaturePad.hasSignature()) {
      document.getElementById("signature-error").textContent = "Please sign in the box above";
      ok = false;
    }
    if (n === 5) {
      const declaration = document.getElementById("declarationAccepted");
      if (!declaration.checked) {
        document.getElementById("declaration-error").textContent = "You must accept the Terms of Engagement";
        ok = false;
      } else {
        document.getElementById("declaration-error").textContent = "";
      }
    }
    return ok;
  }

  for (const field of form.querySelectorAll("input, textarea, select")) {
    field.addEventListener("blur", () => validateField(field));
  }

  btnNext.addEventListener("click", () => {
    if (validateStep(currentStep)) showStep(Math.min(currentStep + 1, STEP_COUNT));
  });
  btnBack.addEventListener("click", () => showStep(Math.max(currentStep - 1, 1)));

  // ── Rep attribution (?rep=<name> link vs a plain text field) ──
  // No directory to look up against — the name in the link IS the value.
  function applyRepFromLink() {
    const repParam = new URLSearchParams(location.search).get("rep");
    if (!repParam) return;
    repNameInput.value = repParam;
    repNameInput.readOnly = true;
    document.getElementById("referralSource").value = "rep_link";
    repBadge.classList.remove("hidden");
    repBadge.innerHTML = `Registering on behalf of: <strong>${escapeHtml(repParam)}</strong>`;
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  // ── Signature pad ───────────────────────────────────────────────
  // Factory so the same pointer/resize/clear logic backs both the partner's
  // (required) and the PCI representative's (optional) signature pads.
  function createSignaturePad(canvasId, clearBtnId, errorId) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext("2d");
    let drawing = false;
    let signed = false;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const ratio = window.devicePixelRatio || 1;
      const newWidth = rect.width * ratio;
      const newHeight = rect.height * ratio;
      // Already matches the current CSS box — nothing to do. Without this
      // check, every resize (including e.g. the on-screen keyboard opening)
      // would re-run below and wipe/rescale a signature already drawn.
      if (canvas.width === newWidth && canvas.height === newHeight) return;

      // A canvas resize clears its bitmap, so preserve any strokes already
      // drawn (e.g. the user rotates their phone mid-signature) by
      // snapshotting and redrawing them into the newly-sized canvas.
      const snapshot = signed ? canvas.toDataURL("image/png") : null;

      canvas.width = newWidth;
      canvas.height = newHeight;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#1F3864";

      if (snapshot) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = snapshot;
      }
    }
    window.addEventListener("resize", resize);

    function pointerPos(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    canvas.addEventListener("pointerdown", (e) => {
      drawing = true;
      signed = true;
      if (errorId) document.getElementById(errorId).textContent = "";
      const p = pointerPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!drawing) return;
      const p = pointerPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });
    window.addEventListener("pointerup", () => (drawing = false));
    document.getElementById(clearBtnId).addEventListener("click", () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      signed = false;
    });

    return {
      resize,
      hasSignature: () => signed,
      toDataUrl: () => canvas.toDataURL("image/png"),
    };
  }

  const partnerSignaturePad = createSignaturePad("signature-pad", "clear-signature", "signature-error");
  const repSignaturePad = createSignaturePad("rep-signature-pad", "clear-rep-signature");

  // ── File input visual feedback ──────────────────────────────────
  for (const input of form.querySelectorAll('input[type="file"]')) {
    input.addEventListener("change", () => validateField(input));
  }

  // ── Submit ────────────────────────────────────────────────────────
  function setBusy(busy) {
    btnSubmit.disabled = busy;
    btnSubmit.textContent = busy ? "Submitting…" : "Submit Registration";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateStep(5)) return;

    document.getElementById("signatureDataUrl").value = partnerSignaturePad.toDataUrl();
    document.getElementById("repSignatureDataUrl").value = repSignaturePad.hasSignature()
      ? repSignaturePad.toDataUrl()
      : "";

    setBusy(true);
    submitStatus.classList.add("hidden");
    try {
      const res = await fetch("/api/submissions", { method: "POST", body: new FormData(form) });
      const data = await res.json();
      if (!res.ok) {
        if (data.details) {
          applyServerFieldErrors(data.details);
        } else {
          showSubmitResult("error", data.error || "Something went wrong. Please try again.");
        }
        return;
      }
      if (data.status === "complete") {
        sessionStorage.removeItem(DRAFT_KEY);
        showSubmitResult("success", null, data);
      } else {
        showSubmitResult("partial", null, data);
      }
    } catch {
      showSubmitResult("error", "Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  form.addEventListener("submit", handleSubmit);

  // The server validates the same fields the client does, but a bit more
  // strictly in places — if something still fails server-side, highlight it
  // on its actual step instead of leaving the user stuck on a generic
  // "Validation failed" banner with no idea what to fix.
  function applyServerFieldErrors(details) {
    let firstStep = null;
    for (const [name, messages] of Object.entries(details)) {
      const field = form.elements[name];
      if (!field) continue;
      showFieldError(field, messages[0]);
      const step = Number(field.closest(".step")?.dataset.step);
      if (step && (firstStep === null || step < firstStep)) firstStep = step;
    }
    if (firstStep) showStep(firstStep);
    showSubmitResult("error", "Please fix the highlighted fields and submit again.");
  }

  function showSubmitResult(kind, message, data) {
    submitStatus.className = `submit-status ${kind}`;
    submitStatus.classList.remove("hidden");
    if (kind === "success") {
      // Show the actual generated document inline so they can verify it
      // looks right before downloading it, rather than downloading blind.
      const preview = data.pdfUrl
        ? `<p class="preview-label">Preview your completed registration pack — the filled form and uploaded supporting documents are combined in this PDF:</p>
           <iframe class="pdf-preview" src="${data.pdfUrl}" title="Signed agreement preview"></iframe>
           <div class="preview-downloads">
              ${data.pdfUrl ? `<a href="${data.pdfUrl}" target="_blank" rel="noopener" class="btn-ghost">Download PDF</a>` : ""}
            </div>`
        : "";
      submitStatus.innerHTML = `<h3>Registration received</h3><p>Thank you — your reference number is <strong>${data.id}</strong>. PCI will review your submission shortly.</p>${preview}`;
      form.classList.add("hidden");
      document.querySelector(".wizard-nav").classList.add("hidden");
    } else if (kind === "partial") {
      submitStatus.innerHTML = `<h3>Almost done</h3><p>Your registration was saved (reference <strong>${data.id}</strong>), but a step didn't finish: <strong>${data.failedSteps.join(", ")}</strong>.</p><p>Press "Submit Registration" again — it's safe to retry and won't create a duplicate.</p>`;
    } else {
      submitStatus.textContent = message;
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  }

  // ── Logo (falls back to text wordmark if no real logo file is present) ──
  const logoImg = document.getElementById("pci-logo");
  function showLogo() {
    logoImg.classList.remove("hidden");
    document.getElementById("pci-wordmark-fallback").classList.add("hidden");
  }
  // A cached image can finish loading before this script even runs, in which
  // case the "load" event already fired and would never be seen — check
  // `.complete` for that case instead of relying on the event alone.
  if (logoImg.complete && logoImg.naturalWidth > 0) showLogo();
  else logoImg.addEventListener("load", showLogo);

  // ── Init ──────────────────────────────────────────────────────
  restoreDraft();
  applyRepFromLink();
  const dateField = document.getElementById("onboardingDate");
  if (!dateField.value) dateField.value = new Date().toISOString().slice(0, 10);
  showStep(1);
})();
