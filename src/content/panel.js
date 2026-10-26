/* Renders safety decisions inside a closed shadow root isolated from page CSS and scripts. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { SAFETY_WARNING_TEXT } = globalThis.AIFormFiller.contentConstants;
  let panelHost = null;
  let cancelPendingPrompt = null;

  // Removes the isolated panel and resolves any replaced prompt as canceled.
  const close = () => {
    if (cancelPendingPrompt) {
      const cancel = cancelPendingPrompt;
      cancelPendingPrompt = null;
      cancel();
    }

    panelHost?.remove();
    panelHost = null;
  };

  // Creates shared panel styles inside the closed shadow boundary.
  const createStyles = () => {
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .panel { background: #fff; border: 2px solid #9b1c1c; border-radius: 8px;
        box-shadow: 0 6px 24px rgba(0, 0, 0, .3); color: #171717;
        font: 14px/1.45 system-ui, sans-serif; max-height: min(70vh, 520px);
        overflow: auto; padding: 16px; position: fixed; right: 20px; top: 20px;
        width: min(390px, calc(100vw - 72px)); z-index: 2147483647; }
      h2 { font-size: 18px; margin: 0 0 8px; }
      p { margin: 0 0 10px; }
      ul { margin: 0 0 14px; padding-left: 22px; }
      li { margin-bottom: 5px; overflow-wrap: anywhere; }
      .actions { display: flex; gap: 8px; justify-content: flex-end; }
      button { background: #f4f4f4; border: 1px solid #333; border-radius: 4px;
        color: #171717; cursor: pointer; font: inherit; padding: 7px 11px; }
      button:focus-visible { outline: 3px solid #ffbf47; outline-offset: 2px; }
      .continue { background: #9b1c1c; color: #fff; }
    `;
    return style;
  };

  // Builds a plain-text finding list so page-derived labels cannot become markup.
  const createFindingsList = (findings) => {
    const list = document.createElement("ul");

    findings.forEach((finding) => {
      const item = document.createElement("li");
      item.textContent = finding.description;
      list.append(item);
    });

    return list;
  };

  // Shows the mandatory Cancel/Continue decision and defaults focus to Cancel.
  const showSafetyWarning = (findings, notificationError = null) => {
    close();
    panelHost = document.createElement("div");
    panelHost.id = "ai-form-filler-panel-host";
    const shadow = panelHost.attachShadow({ mode: "closed" });
    const panel = document.createElement("section");
    const heading = document.createElement("h2");
    const message = document.createElement("p");
    const actions = document.createElement("div");
    const cancelButton = document.createElement("button");
    const continueButton = document.createElement("button");

    panel.className = "panel";
    panel.setAttribute("role", "alertdialog");
    panel.setAttribute("aria-modal", "true");
    heading.textContent = "Invisible fields found";
    message.textContent = SAFETY_WARNING_TEXT;
    actions.className = "actions";
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    continueButton.type = "button";
    continueButton.className = "continue";
    continueButton.textContent = "Continue anyway";
    actions.append(cancelButton, continueButton);
    panel.append(heading, message, createFindingsList(findings));

    if (notificationError) {
      const error = document.createElement("p");
      error.textContent = notificationError;
      panel.append(error);
    }

    panel.append(actions);
    shadow.append(createStyles(), panel);
    document.documentElement.append(panelHost);

    return new Promise((resolve) => {
      // Resolves once and removes all UI for either button or Escape.
      const finish = (shouldContinue) => {
        document.removeEventListener("keydown", handleKeydown, true);
        cancelPendingPrompt = null;
        panelHost?.remove();
        panelHost = null;
        resolve(shouldContinue);
      };

      // Treats Escape as the safer Cancel choice.
      const handleKeydown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          finish(false);
        }
      };

      cancelButton.addEventListener("click", () => finish(false), { once: true });
      continueButton.addEventListener("click", () => finish(true), { once: true });
      document.addEventListener("keydown", handleKeydown, true);
      cancelPendingPrompt = () => finish(false);
      cancelButton.focus();
    });
  };

  globalThis.AIFormFiller.panel = Object.freeze({ close, showSafetyWarning });
})();
