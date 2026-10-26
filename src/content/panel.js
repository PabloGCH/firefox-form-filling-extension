/* Owns the closed-shadow panel host, normal status view, and prompt lifecycle. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  let panelHost = null;
  let panelRoot = null;
  let statusElement = null;
  let handlers = null;
  let cancelPendingPrompt = null;

  // Defines isolated visual styles shared by normal and prompt views.
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

  // Creates the host once; the closed root remains private to content scripts.
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

  // Creates a button whose callback remains inside the closed shadow tree.
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
    const section = document.createElement("section");
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
    section.className = "panel";
    section.append(heading, statusElement, actions);
    panelRoot.replaceChildren(createStyles(), section);
  };

  // Replaces the normal view with one prompt built by the prompt module.
  const showPrompt = (section, cancelPrompt) => {
    ensureRoot();
    statusElement = null;
    cancelPendingPrompt = cancelPrompt;
    panelRoot.replaceChildren(createStyles(), section);
  };

  // Clears a resolved prompt without accidentally invoking its cancel callback.
  const finishPrompt = () => {
    cancelPendingPrompt = null;
  };

  // Updates status while leaving the normal panel controls available.
  const setStatus = (message) => {
    if (!panelHost?.isConnected || !statusElement) {
      show(message);
      return;
    }
    statusElement.textContent = message;
  };

  // Removes all panel state and safely cancels an unresolved prompt.
  const close = () => {
    const cancel = cancelPendingPrompt;
    cancelPendingPrompt = null;
    cancel?.();
    panelHost?.remove();
    panelHost = null;
    panelRoot = null;
    statusElement = null;
  };

  // Registers orchestration callbacks without exposing them on the host element.
  const initialize = (nextHandlers) => {
    handlers = nextHandlers;
  };

  globalThis.AIFormFiller.panel = Object.freeze({
    close,
    createButton,
    finishPrompt,
    initialize,
    setStatus,
    show,
    showPrompt,
  });
})();
