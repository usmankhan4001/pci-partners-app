(function () {
  "use strict";

  const STEP_COUNT = 5;
  const DRAFT_KEY = "pci-partner-form-draft";
  const SUBMISSION_ID_KEY = "pci-partner-submission-id";
  const MAX_UPLOAD_MB = 5; // keep in sync with server MAX_UPLOAD_MB

  const form = document.getElementById("partner-form");
  const steps = Array.from(document.querySelectorAll(".step"));
  const progressBar = document.getElementById("progress-bar");
  const progressLabel = document.getElementById("progress-label");
  const btnBack = document.getElementById("btn-back");
  const btnNext = document.getElementById("btn-next");
  const btnSubmit = document.getElementById("btn-submit");
  const repBadge = document.getElementById("rep-badge");
  const repPickerField = document.getElementById("rep-picker-field");
  const repPicker = document.getElementById("repPicker");
  const submitStatus = document.getElementById("submit-status");

  let currentStep = 1;
  let reps = [];
  let repFromLink = null;

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
    // The signature canvas has zero size while its step is display:none, so it
    // must be (re)sized the first time it actually becomes visible.
    if (n === 4 && typeof resizeCanvas === "function") resizeCanvas();
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
    showFieldError(field, "");
    return true;
  }

  function validateStep(n) {
    let ok = true;
    for (const field of fieldsInStep(n)) {
      if (!validateField(field)) ok = false;
    }
    if (n === 4 && !hasSignature()) {
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
      if (!document.getElementById("repId").value) {
        showFieldError(repPicker, "Please select a representative");
        ok = false;
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

  // ── Rep attribution (?rep= link vs internal dropdown fallback) ──
  async function loadReps() {
    try {
      const res = await fetch("/api/reps");
      const data = await res.json();
      reps = data.reps || [];
    } catch {
      reps = [];
    }

    const params = new URLSearchParams(location.search);
    const repParam = params.get("rep");
    repFromLink = repParam ? reps.find((r) => r.id === repParam) : null;

    if (repFromLink) {
      document.getElementById("repId").value = repFromLink.id;
      document.getElementById("repDesignation").value = repFromLink.designation || "";
      document.getElementById("referralSource").value = "rep_link";
      repPickerField.classList.add("hidden");
      repBadge.classList.remove("hidden");
      repBadge.innerHTML = `Registering on behalf of: <strong>${escapeHtml(repFromLink.name)}</strong>`;
    } else {
      repPicker.innerHTML =
        '<option value="">Select representative…</option>' +
        reps.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");
      if (reps.length === 0) {
        repPicker.innerHTML = '<option value="">Unavailable — contact PCI directly</option>';
      }
      repPicker.addEventListener("change", () => {
        const chosen = reps.find((r) => r.id === repPicker.value);
        document.getElementById("repId").value = repPicker.value;
        document.getElementById("repDesignation").value = chosen?.designation || "";
        document.getElementById("referralSource").value = "internal_fallback";
      });
    }
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  // ── Signature pad ───────────────────────────────────────────────
  const canvas = document.getElementById("signature-pad");
  const ctx = canvas.getContext("2d");
  let drawing = false;
  let signed = false;
  let canvasSized = false;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || canvasSized) return;
    canvasSized = true;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1F3864";
  }
  window.addEventListener("resize", resizeCanvas);

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  canvas.addEventListener("pointerdown", (e) => {
    drawing = true;
    signed = true;
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
  document.getElementById("clear-signature").addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    signed = false;
  });
  function hasSignature() {
    return signed;
  }

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

    document.getElementById("signatureDataUrl").value = canvas.toDataURL("image/png");

    setBusy(true);
    submitStatus.classList.add("hidden");
    try {
      const res = await fetch("/api/submissions", { method: "POST", body: new FormData(form) });
      const data = await res.json();
      if (!res.ok) {
        showSubmitResult("error", data.error || "Something went wrong. Please try again.");
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

  function showSubmitResult(kind, message, data) {
    submitStatus.className = `submit-status ${kind}`;
    submitStatus.classList.remove("hidden");
    if (kind === "success") {
      const pdfLink = data.pdfUrl ? `<p><a href="${data.pdfUrl}" target="_blank" rel="noopener">Download your signed agreement (PDF)</a></p>` : "";
      submitStatus.innerHTML = `<h3>Registration received</h3><p>Thank you — your reference number is <strong>${data.id}</strong>. PCI will review your submission shortly.</p>${pdfLink}`;
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
  loadReps();
  const dateField = document.getElementById("onboardingDate");
  if (!dateField.value) dateField.value = new Date().toISOString().slice(0, 10);
  showStep(1);
})();
