/* Owns all session-only user data in the persistent background page. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { copyModel, copyModelForExport, createPublicSnapshot } =
    globalThis.AIFormFiller.sessionStateHelpers;

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
    activeFillController: null,
  });

  let state = createInitialState();

  // Returns only metadata safe for extension pages to display.
  const getPublicSnapshot = () => createPublicSnapshot(state);

  // Returns the editable info text only to the trusted settings page.
  const getInfoForOptions = () =>
    state.infoFile ? { ...state.infoFile } : null;

  // Replaces the single markdown document held for this session.
  const setInfoFile = (fileName, text) => {
    if (typeof fileName !== "string" || typeof text !== "string") {
      throw new Error("The information file could not be loaded.");
    }

    state.infoFile = { fileName, text };
    return getPublicSnapshot();
  };

  // Updates edits to the in-memory markdown without touching the source file.
  const updateInfoText = (text) => {
    if (!state.infoFile || typeof text !== "string") {
      throw new Error("Load an information file before editing it.");
    }

    state.infoFile.text = text;
    return getPublicSnapshot();
  };

  // Adds a model and selects it when it is the first loaded model.
  const addModel = (model) => {
    state.models.push(copyModel(model));
    state.activeModelName = state.activeModelName || model.name;
    return getPublicSnapshot();
  };

  // Updates one model while preserving or explicitly changing its secret.
  const updateModel = (originalName, model, apiKeyAction) => {
    const index = state.models.findIndex((item) => item.name === originalName);

    if (index === -1) {
      throw new Error("The model to edit is no longer loaded.");
    }

    if (!["preserve", "replace", "clear"].includes(apiKeyAction)) {
      throw new Error("The API key edit choice is invalid.");
    }

    const current = state.models[index];
    let apiKey = model.apiKey;

    if (apiKeyAction === "preserve") {
      apiKey = current.apiKey;
    } else if (apiKeyAction === "clear") {
      apiKey = "";
    }

    state.models[index] = { ...copyModel(model), apiKey };

    if (state.activeModelName === originalName) {
      state.activeModelName = model.name;
    }

    return getPublicSnapshot();
  };

  // Removes a model and selects the first remaining model when necessary.
  const removeModel = (name) => {
    if (!state.models.some((model) => model.name === name)) {
      throw new Error("The model to remove is no longer loaded.");
    }

    state.models = state.models.filter((model) => model.name !== name);

    if (state.activeModelName === name) {
      state.activeModelName = state.models[0]?.name || null;
    }

    return getPublicSnapshot();
  };

  // Atomically replaces all model configuration after import validation.
  const replaceModels = ({ models, activeModel }) => {
    state.models = models.map(copyModel);
    state.activeModelName = activeModel;
    return getPublicSnapshot();
  };

  // Selects one existing model for subsequent requests.
  const setActiveModel = (name) => {
    if (!state.models.some((model) => model.name === name)) {
      throw new Error("The selected model is no longer loaded.");
    }

    state.activeModelName = name;
    return getPublicSnapshot();
  };

  // Returns one secret-bearing model only for trusted background operations.
  const getModel = (name) => {
    const model = state.models.find((item) => item.name === name);
    return model ? copyModel(model) : null;
  };

  // Returns the active secret-bearing model only to background orchestration.
  const getActiveModel = () => getModel(state.activeModelName);

  // Returns personal reference text only inside the background page.
  const getInfoText = () => state.infoFile?.text || null;

  // Registers one cancellable fill and caches only its current field descriptions.
  const beginFill = (fieldDescriptions) => {
    state.activeFillController?.abort();
    state.activeFillController = new AbortController();
    state.cachedFieldDescriptions = fieldDescriptions.map((field) => ({ ...field }));
    state.cachedFieldValues = [];
    return state.activeFillController;
  };

  // Finishes only the matching request so a newer fill cannot be cleared by an older one.
  const finishFill = (controller, fieldValues = null) => {
    if (state.activeFillController !== controller) {
      return;
    }

    state.cachedFieldValues = fieldValues ? { ...fieldValues } : [];
    state.activeFillController = null;
  };

  // Builds the exact export shape, including secrets, on explicit request.
  const getModelsForExport = () => ({
    activeModel: state.activeModelName,
    models: state.models.map(copyModelForExport),
  });

  // Changes the session-only replacement preference.
  const setReplaceExistingValues = (enabled) => {
    state.settings.replaceExistingValues = Boolean(enabled);
    return getPublicSnapshot();
  };

  // Cancels active work and replaces every data container with defaults.
  const clearAllData = () => {
    if (state.activeFillController) {
      state.activeFillController.abort();
    }

    state = createInitialState();
    return getPublicSnapshot();
  };

  globalThis.AIFormFiller.sessionState = Object.freeze({
    addModel,
    beginFill,
    clearAllData,
    finishFill,
    getActiveModel,
    getInfoForOptions,
    getInfoText,
    getModel,
    getModelsForExport,
    getPublicSnapshot,
    removeModel,
    replaceModels,
    setActiveModel,
    setInfoFile,
    setReplaceExistingValues,
    updateInfoText,
    updateModel,
  });
})();
