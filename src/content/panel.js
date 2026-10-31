/* Owns the closed-shadow panel host, normal status view, and prompt lifecycle. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  let panelHost = null;
  let panelRoot = null;
  let statusElement = null;
  let handlers = null;
  let cancelPendingPrompt = null;
  let viewVersion = 0;
  let stackingObserver = null;
  let promotionQueued = false;

  // Defines isolated visual styles shared by normal and prompt views.
  const createStyles = () => {
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; border: 0; height: 0; inset: 0; margin: 0;
        overflow: visible; padding: 0; pointer-events: none; position: fixed;
        width: 0; }
      :host(:not(:popover-open)) { display: none; }
      .panel { background: #fff; border: 2px solid #333; border-radius: 8px;
        box-shadow: 0 6px 24px rgba(0, 0, 0, .3); color: #171717;
        font: 14px/1.45 system-ui, sans-serif; max-height: min(70vh, 520px);
        overflow: auto; padding: 16px; position: fixed; right: 20px; top: 20px;
        pointer-events: auto; width: min(410px, calc(100vw - 72px));
        z-index: 2147483647; }
      .warning { border-color: #9b1c1c; }
      h2 { font-size: 18px; margin: 0 0 8px; }
      p { margin: 0 0 10px; overflow-wrap: anywhere; }
      label { display: block; font-weight: 600; margin: 0 0 4px; }
      select { background: #fff; border: 1px solid #333; border-radius: 4px;
        box-sizing: border-box; color: #171717; font: inherit; margin: 0 0 14px;
        padding: 7px; width: 100%; }
      ul { margin: 0 0 14px; padding-left: 22px; }
      li { margin-bottom: 5px; overflow-wrap: anywhere; }
      .actions { display: flex; flex-wrap: wrap; gap: 8px; }
      button { background: #f4f4f4; border: 1px solid #333; border-radius: 4px;
        color: #171717; cursor: pointer; font: inherit; padding: 7px 11px; }
      button:disabled { cursor: not-allowed; opacity: .55; }
      button:focus-visible { outline: 3px solid #ffbf47; outline-offset: 2px; }
      select:focus-visible { outline: 3px solid #ffbf47; outline-offset: 2px; }
      .primary { background: #1769aa; color: #fff; }
      .danger { background: #9b1c1c; color: #fff; }
    `;
    return style;
  };

  // Finds the active modal even when its backdrop covers the sampled point.
  const getTopModal = () => {
    const modalAtPoint = document
      .elementsFromPoint(window.innerWidth / 2, window.innerHeight / 2)
      .find(
        (element) =>
          element instanceof HTMLDialogElement && element.matches(":modal"),
      );

    if (modalAtPoint) {
      return modalAtPoint;
    }

    return [...document.querySelectorAll("dialog:modal")].at(-1) || null;
  };

  // Re-inserts the panel at the end of the active page container's top layer.
  const promoteToTop = () => {
    promotionQueued = false;
    if (!panelHost) {
      return;
    }

    try {
      if (panelHost.matches(":popover-open")) {
        panelHost.hidePopover();
      }
      const container =
        getTopModal() || document.fullscreenElement || document.documentElement;
      if (panelHost.parentElement !== container) {
        container.append(panelHost);
      }
      panelHost.showPopover();
    } catch {
      // A fixed, maximum-z-index panel remains as a fallback during navigation.
    }
  };

  const queuePromotion = (event) => {
    if (event?.target === panelHost || promotionQueued) {
      return;
    }
    promotionQueued = true;
    queueMicrotask(promoteToTop);
  };

  const containsDialog = (nodes) =>
    [...nodes].some(
      (node) =>
        node instanceof HTMLDialogElement || node.querySelector?.("dialog"),
    );

  // Ignores unrelated application rendering to avoid top-layer flicker.
  const handleStackingMutations = (records) => {
    const affectsStacking = records.some(
      (record) =>
        !panelHost?.isConnected ||
        record.target instanceof HTMLDialogElement ||
        containsDialog(record.addedNodes) ||
        containsDialog(record.removedNodes),
    );

    if (affectsStacking) {
      queuePromotion();
    }
  };

  const startStackingProtection = () => {
    stackingObserver = new MutationObserver(handleStackingMutations);
    stackingObserver.observe(document.documentElement, {
      attributeFilter: ["open"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    document.addEventListener("beforetoggle", queuePromotion, true);
    document.addEventListener("toggle", queuePromotion, true);
    document.addEventListener("fullscreenchange", queuePromotion, true);
  };

  const stopStackingProtection = () => {
    stackingObserver?.disconnect();
    stackingObserver = null;
    document.removeEventListener("beforetoggle", queuePromotion, true);
    document.removeEventListener("toggle", queuePromotion, true);
    document.removeEventListener("fullscreenchange", queuePromotion, true);
    promotionQueued = false;
  };

  // Prevents page-level important rules from hiding or clipping the host.
  const isolateHostStyles = (host) => {
    const styles = {
      all: "initial",
      background: "transparent",
      border: "0",
      display: "block",
      height: "0",
      inset: "0",
      margin: "0",
      opacity: "1",
      overflow: "visible",
      padding: "0",
      "pointer-events": "none",
      position: "fixed",
      transform: "none",
      visibility: "visible",
      width: "0",
    };
    Object.entries(styles).forEach(([property, value]) => {
      host.style.setProperty(property, value, "important");
    });
  };

  // Creates the host once; the closed root remains private to content scripts.
  const ensureRoot = () => {
    if (panelHost?.isConnected) {
      return;
    }

    panelHost = document.createElement("div");
    panelHost.id = "ai-form-filler-panel-host";
    panelHost.setAttribute("popover", "manual");
    isolateHostStyles(panelHost);
    panelRoot = panelHost.attachShadow({ mode: "closed" });
    panelRoot.append(createStyles());
    document.documentElement.append(panelHost);
    startStackingProtection();
    promoteToTop();
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

  // Loads public model names into the normal view without exposing credentials.
  const loadModels = async (select, version) => {
    try {
      const summary = await handlers?.getSummary();
      if (version !== viewVersion || !panelHost?.isConnected) {
        return;
      }
      select.replaceChildren();
      if (summary.models.length === 0) {
        const option = document.createElement("option");
        option.textContent = "No models loaded";
        select.append(option);
        select.disabled = true;
        return;
      }
      summary.models.forEach((model) => {
        const option = document.createElement("option");
        option.value = model.name;
        option.textContent = model.name;
        option.selected = model.name === summary.activeModelName;
        select.append(option);
      });
      select.disabled = false;
    } catch (error) {
      if (version !== viewVersion || !panelHost?.isConnected) {
        return;
      }
      setStatus(error.message || "Models could not be loaded.");
    }
  };

  // Restores the normal status view and required controls.
  const show = (status = "Select an area to begin.") => {
    ensureRoot();
    const section = document.createElement("section");
    const heading = document.createElement("h2");
    const modelLabel = document.createElement("label");
    const modelSelect = document.createElement("select");
    const actions = document.createElement("div");
    heading.textContent = "AI Form Filler";
    statusElement = document.createElement("p");
    statusElement.setAttribute("role", "status");
    statusElement.setAttribute("aria-live", "polite");
    statusElement.textContent = status;
    modelLabel.textContent = "Active model";
    modelLabel.htmlFor = "ai-form-filler-active-model";
    modelSelect.id = "ai-form-filler-active-model";
    modelSelect.disabled = true;
    const loadingOption = document.createElement("option");
    loadingOption.textContent = "Loading models…";
    modelSelect.append(loadingOption);
    modelSelect.addEventListener("change", async (event) => {
      const version = viewVersion;
      try {
        await handlers?.selectModel(event.currentTarget.value);
        if (version !== viewVersion || !panelHost?.isConnected) {
          return;
        }
        setStatus("Active model updated.");
      } catch (error) {
        if (version !== viewVersion || !panelHost?.isConnected) {
          return;
        }
        setStatus(error.message || "The active model could not be changed.");
        loadModels(modelSelect, version);
      }
    });
    actions.className = "actions";
    actions.append(createButton("Select area", () => handlers?.selectArea()));
    if (handlers?.canFill()) {
      actions.append(
        createButton("Fill form", () => handlers?.fill(false), "primary"),
      );
    }
    actions.append(
      createButton("Cancel", () => handlers?.cancel()),
      createButton("Settings", () => handlers?.openSettings()),
    );
    section.className = "panel";
    section.append(heading, statusElement, modelLabel, modelSelect, actions);
    panelRoot.replaceChildren(createStyles(), section);
    viewVersion += 1;
    loadModels(modelSelect, viewVersion);
  };

  // Hides every normal control while an operation is active.
  const showBusy = (status) => {
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
    actions.append(createButton("Cancel", () => handlers?.cancel(), "danger"));
    section.className = "panel";
    section.append(heading, statusElement, actions);
    panelRoot.replaceChildren(createStyles(), section);
    viewVersion += 1;
  };

  // Replaces the normal view with one prompt built by the prompt module.
  const showPrompt = (section, cancelPrompt) => {
    ensureRoot();
    statusElement = null;
    cancelPendingPrompt = cancelPrompt;
    viewVersion += 1;
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
    stopStackingProtection();
    panelHost?.remove();
    panelHost = null;
    panelRoot = null;
    statusElement = null;
    viewVersion += 1;
  };

  const isOpen = () => Boolean(panelHost?.isConnected);

  // Routes every user-facing cancellation through the orchestrator.
  const cancel = () => {
    handlers?.cancel();
  };

  // Registers orchestration callbacks without exposing them on the host element.
  const initialize = (nextHandlers) => {
    handlers = nextHandlers;
  };

  globalThis.AIFormFiller.panel = Object.freeze({
    close,
    cancel,
    createButton,
    finishPrompt,
    initialize,
    isOpen,
    setStatus,
    show,
    showBusy,
    showPrompt,
  });
})();
