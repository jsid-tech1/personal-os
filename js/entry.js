/* Entry recovery is independent of Firebase and the workspace boot code. */
(function () {
  "use strict";
  let failed = false;
  function reload() {
    const url = new URL(location.href);
    url.searchParams.set("reload", Date.now());
    location.replace(url);
  }
  function recover() {
    if (document.documentElement.dataset.appBooted === "true") return;
    const error = document.getElementById("welcome-error");
    if (!error) return;
    failed = true;
    error.textContent = "Some app files did not load. Reload Personal OS to reconnect.";
    error.hidden = false;
    document.getElementById("welcome-status").textContent = "Your saved work is still in this browser.";
    document.getElementById("welcome-signin-label").textContent = "Reload Personal OS";
    document.querySelectorAll("[data-signin]").forEach(button => { button.disabled = false; });
    const button = document.getElementById("welcome-reload");
    button.hidden = false;
  }
  document.addEventListener("click", event => {
    if (!failed || document.documentElement.dataset.appBooted === "true") return;
    if (!event.target.closest("[data-signin], #welcome-reload")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    reload();
  }, true);
  document.addEventListener("DOMContentLoaded", () => setTimeout(recover, 0));
  setTimeout(recover, 15000);
})();
