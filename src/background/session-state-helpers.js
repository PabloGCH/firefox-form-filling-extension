/* Copies and summarizes background session state without owning mutable data. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  // Copies model objects so callers cannot mutate background state by reference.
  const copyModel = (model) => ({ ...model });

  // Omits an absent optional key so exports match the documented JSON format.
  const copyModelForExport = (model) => {
    const exportedModel = copyModel(model);
    if (!exportedModel.apiKey) {
      delete exportedModel.apiKey;
    }
    return exportedModel;
  };

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

  // Produces only metadata safe for extension pages to display.
  const createPublicSnapshot = (state) => ({
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

  globalThis.AIFormFiller.sessionStateHelpers = Object.freeze({
    copyModel,
    copyModelForExport,
    createPublicSnapshot,
  });
})();
