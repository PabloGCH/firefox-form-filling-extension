/* Renders status, controls, and safety decisions in one closed shadow root. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { SAFETY_WARNING_TEXT } = globalThis.AIFormFiller.contentConstants;
  let panelHost = null;
  let panelRoot = null;
  let statusElement = null;
  let handlers = null;
  let cancelPendingPrompt = null;

  // Defines isolated visual styles shared by normal and warning views.
  const createStyles = () => {
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .panel { background: #fff; border: 2px solid #333; border-radius: 8px;
        box-shadow: 0 6px 24px rgba(0, 0, 0, .3); color: #171717;
        font: 14px/1.45 system-ui, sans-serif; max-height: min(70vh, 520px);
        overflow: auto; padding: 16px; position: fixed; right: 20px; top: 20px;
        width: min(410px, calc(100vw - 72px)); z-index: 2147483647; }
      .warning { border-color: #9b1c1c; }
      h2 { font-size: 18px; margin: 0 0 8px; }
      p { margin: 0 0 10px; overflow-wrap: anywhere; }
      ul { margin: 0 0 14px; padding-left: 22px; }
      li { margin-bottom: 5px; overflow-wrap: anywhere; }
      .actions { display: flex; flex-wrap: wrap; gap: 8px; }
      button { background: #f4f4f4; border: 1px solid #333; border-radius: 4px;
        color: #171717; cursor: pointer; font: inherit; padding: 7px 11px; }
      button:disabled { cursor: not-allowed; opacity: .55; }
      button:focus-visible { outline: 3px solid #ffbf47; outline-offset: 2px; }
      .primary { background: #1769aa; color: #fff; }
      .danger { background: #9b1c1c; color: #fff; }
    `;
    return style;
  };

  // Creates the host once; the closed root is retained only inside this module.
  const ensureRoot = () => {
    if (panelHost?.isConnected) {
      return;
    }

    panelHost = document.createElement("div");
    panelHost.id = "ai-form-filler-panel-host";
    panelRoot = panelHost.attachShadow({ mode: "closed" });
    panelRoot.append(createStyles());
    document.documentElement.append(panelHost);
  };

  // Creates a button whose callbacks never become visible to the page.
  const createButton = (text, callback, className = "") => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.className = className;
    button.addEventListener("click", callback);
    return button;
  };

  // Restores the normal status view and required controls.
  const show = (status = "Ready to fill this page.") => {
    ensureRoot();
    const panel = document.createElement("section");
    const heading = document.createElement("h2");
    const actions = document.createElement("div");
    heading.textContent = "AI Form Filler";
    statusElement = document.createElement("p");
    statusElement.setAttribute("role", "status");
    statusElement.setAttribute("aria-live", "polite");
    statusElement.textContent = status;
    actions.className = "actions";
    actions.append(
      createButton("Fill form", () => handlers?.fill(false), "primary"),
      createButton("Fill new fields only", () => handlers?.fill(true)),
      createButton("Select area", () => handlers?.selectArea()),
      createButton("Close", () => close()),
    );
    panel.className = "panel";
    panel.append(heading, statusElement, actions);
    panelRoot.replaceChildren(createStyles(), panel);
  };

  // Updates status while leaving the panel controls available.
  const setStatus = (message) => {
    if (!panelHost?.isConnected || !statusElement) {
      show(message);
      return;
    }

    statusElement.textContent = message;
  };

  // Removes all panel state and treats an unresolved warning as canceled.
  const close = () => {
    if (cancelPendingPrompt) {
      const cancel = cancelPendingPrompt;
      cancelPendingPrompt = null;
      cancel();
    }

    panelHost?.remove();
    panelHost = null;
    panelRoot = null;
    statusElement = null;
  };

  // Builds a plain-text list so page-derived values cannot become markup.
  const createFindingsList = (findings) => {
    const list = document.createElement("ul");
    findings.forEach((finding) => {
      const item = document.createElement("li");
      item.textContent = finding.description;
      list.append(item);
    });
    return list;
  };

  // Pauses the normal panel for the mandatory hidden-field decision.
  const showSafetyWarning = (findings, notificationError = null) => {
    ensureRoot();
    const panel = document.createElement("section");
    const heading = document.createElement("h2");
    const message = document.createElement("p");
    const actions = document.createElement("div");
    const cancelButton = createButton("Cancel", () => finish(false));
    const continueButton = createButton(
      "Continue anyway",
      () => finish(true),
      "danger",
    );
    panel.className = "panel warning";
    panel.setAttribute("role", "alertdialog");
    panel.setAttribute("aria-modal", "true");
    heading.textContent = "Invisible fields found";
    message.textContent = SAFETY_WARNING_TEXT;
    actions.className = "actions";
    actions.append(cancelButton, continueButton);
    panel.append(heading, message, createFindingsList(findings));

    if (notificationError) {
      const error = document.createElement("p");
      error.textContent = notificationError;
      panel.append(error);
    }

    panel.append(actions);
    panelRoot.replaceChildren(createStyles(), panel);

    let resolvePrompt;

    // Resolves once, removes the Escape listener, and restores normal controls.
    const finish = (shouldContinue) => {
      document.removeEventListener("keydown", handleKeydown, true);
      cancelPendingPrompt = null;
      show(shouldContinue ? "Continuing with visible fields only." : "Fill canceled.");
      resolvePrompt(shouldContinue);
    };

    // Treats Escape as Cancel even if focus has moved outside the panel.
    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finish(false);
      }
    };

    document.addEventListener("keydown", handleKeydown, true);
    cancelPendingPrompt = () => finish(false);
    cancelButton.focus();
    return new Promise((resolve) => {
      resolvePrompt = resolve;
    });
  };

  // Registers orchestration callbacks without exposing them on the panel host.
  const initialize = (nextHandlers) => {
    handlers = nextHandlers;
  };

  globalThis.AIFormFiller.panel = Object.freeze({
    close,
    initialize,
    setStatus,
    show,
    showSafetyWarning,
  });
})();
