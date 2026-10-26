/* Owns all session-only user data in the persistent background page. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const DEFAULT_SETTINGS = Object.freeze({
    replaceExistingValues: true,
  });

  // Creates a clean state for startup and explicit data clearing.
  const createInitialState = () => ({
    infoFile: null,
    models: [],
    activeModelName: null,
    settings: { ...DEFAULT_SETTINGS },
    cachedFieldDescriptions: [],
    cachedFieldValues: [],
    pendingPermissionPrompts: [],
    activeFillController: null,
  });

  let state = createInitialState();

  // Masks a key without exposing more than its final four characters.
  const maskApiKey = (apiKey) => {
    if (!apiKey) {
      return "Not set";
    }

    const visibleLength = Math.min(4, Math.max(0, apiKey.length - 1));
    const visibleSuffix = visibleLength === 0 ? "" : apiKey.slice(-visibleLength);
    const hiddenLength = Math.max(4, apiKey.length - visibleSuffix.length);
    return `${"•".repeat(hiddenLength)}${visibleSuffix}`;
  };

  // Returns only metadata safe for extension pages to display.
  const getPublicSnapshot = () => ({
    infoFile: state.infoFile
      ? {
          loaded: true,
          fileName: state.infoFile.fileName,
          characterCount: state.infoFile.text.length,
        }
      : { loaded: false },
    models: state.models.map((model) => ({
      name: model.name,
      provider: model.provider,
      baseUrl: model.baseUrl,
      model: model.model,
      maskedApiKey: maskApiKey(model.apiKey),
    })),
    activeModelName: state.activeModelName,
    settings: { ...state.settings },
    fillInProgress: Boolean(state.activeFillController),
  });

  // Cancels active work and replaces every data container with defaults.
  const clearAllData = () => {
    if (state.activeFillController) {
      state.activeFillController.abort();
    }

    state = createInitialState();
    return getPublicSnapshot();
  };

  globalThis.AIFormFiller.sessionState = Object.freeze({
    clearAllData,
    getPublicSnapshot,
  });
})();
