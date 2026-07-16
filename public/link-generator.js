(function () {
  "use strict";

  const nameInput = document.getElementById("repName");
  const copy = document.getElementById("builder-copy");
  let currentUser = null;

  fetch("/internal/api/me")
    .then((r) => r.json())
    .then((user) => {
      currentUser = user;
      if (user.role === "rep") {
        nameInput.value = user.displayName;
        nameInput.readOnly = true;
        copy.textContent = `Your referral link will always use your assigned representative name: ${user.displayName}`;
      }
    })
    .catch(() => {});

  document.getElementById("build").addEventListener("click", async () => {
    const name = nameInput.value.trim();
    if (!name && currentUser?.role !== "rep") return;

    const res = await fetch("/internal/api/referral-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repName: name }),
    });
    if (!res.ok) return;

    const data = await res.json();
    const url = data.url;
    const box = document.getElementById("result");
    box.style.display = "block";
    box.innerHTML = `<code>${url}</code> <button type="button" id="copy">Copy</button>`;
    document.getElementById("copy").addEventListener("click", (e) => {
      navigator.clipboard.writeText(url);
      e.target.textContent = "Copied!";
      setTimeout(() => (e.target.textContent = "Copy"), 1500);
    });
  });
})();
