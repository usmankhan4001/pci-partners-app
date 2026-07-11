(function () {
  "use strict";

  document.getElementById("build").addEventListener("click", () => {
    const name = document.getElementById("repName").value.trim();
    if (!name) return;
    const url = `${location.origin}/register?rep=${encodeURIComponent(name)}`;
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
