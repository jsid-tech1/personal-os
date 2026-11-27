/* The entry screen is a shell state, not a separate account system. */
(function () {
  "use strict";
  const POS = window.POS;
  let initialized = false;

  function update(status) {
    const button = document.getElementById("welcome-signin");
    const label = document.getElementById("welcome-signin-label");
    const progress = document.getElementById("welcome-status");
    const error = document.getElementById("welcome-error");
    const retry = document.getElementById("welcome-retry");
    const opening = status.busy === "signing-in" || status.busy === "redirecting";
    document.querySelectorAll("[data-signin]").forEach(control => {
      control.disabled = opening;
      control.setAttribute("aria-busy", String(opening || status.busy === "loading"));
    });
    button.disabled = opening;
    label.textContent = status.busy === "signing-in" ? "Google window is open…" :
      status.busy === "redirecting" ? "Opening Google…" :
      status.busy === "loading" ? "Connecting to Google…" : !status.ready ? "Reconnect to Google" : "Continue with Google";
    progress.textContent = status.busy === "loading" ? "Checking your sign-in…" :
      status.busy === "signing-in" ? "Choose your account in the Google window. If you closed it, this button will reset shortly." :
      status.busy === "redirecting" ? "Taking you to Google in this tab…" :
      status.user ? "Opening your workspace…" : !status.ready ? "Google sign-in is unavailable right now." : "";
    error.textContent = status.error;
    error.hidden = !status.error;
    retry.hidden = status.ready || status.busy === "loading";
    retry.disabled = !!status.busy;
    document.getElementById("welcome-redirect").hidden = status.errorCode !== "auth/popup-blocked";
  }

  function init() {
    if (initialized) return;
    initialized = true;
    const signin = async () => {
      // Keep popup opening in a direct click. Awaiting SDK loading first loses the
      // user gesture in popup-restricting browsers, so loading is its own action.
      const status = POS.cloud.getStatus();
      if (!status.ready) {
        document.getElementById("welcome-status").textContent = "Connecting to Google. The button will say Continue with Google when ready.";
        await POS.cloud.start();
        return;
      }
      try { await POS.cloud.signIn(); } catch (error) { /* Displayed inline. */ }
    };
    document.querySelectorAll("[data-signin]").forEach(button => button.addEventListener("click", signin));
    document.getElementById("welcome-retry").addEventListener("click", () => POS.cloud.start());
    document.getElementById("welcome-redirect").addEventListener("click", async () => {
      try { await POS.cloud.signInRedirect(); } catch (error) { /* Displayed inline. */ }
    });
    document.getElementById("welcome-reload").addEventListener("click", () => {
      const url = new URL(location.href);
      url.searchParams.set("reload", Date.now());
      location.replace(url);
    });
    POS.cloud.subscribe(update);
    update(POS.cloud.getStatus());
  }

  POS.welcome = { init, update };
  // Wire recovery before the workspace boots, so a workspace error cannot leave
  // the entry screen with an unexplained, disabled button.
  document.addEventListener("DOMContentLoaded", init);
})();
