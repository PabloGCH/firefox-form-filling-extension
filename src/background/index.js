/* Routes extension messages while keeping secrets inside trusted extension contexts. */

(() => {
  "use strict";

  const { modelClient, sessionState, validators } = globalThis.AIFormFiller;

  // Allows secret-bearing responses only to extension-owned pages, never tabs.
  const requireExtensionPage = (sender) => {
    const extensionRoot = browser.runtime.getURL("");

    if (sender.tab || !sender.url?.startsWith(extensionRoot)) {
      throw new Error("This data is available only on the extension settings page.");
    }
  };

  // Rejects invalid model data even if a caller bypasses page validation.
  const validateModelOrThrow = (model, originalName = null) => {
    const names = sessionState
      .getPublicSnapshot()
      .models.map((item) => item.name);
    const result = validators.validateModel(model, names, originalName);

    if (Object.keys(result.errors).length > 0) {
      throw new Error("The model configuration is invalid.");
    }

    return result.value;
  };

  // Re-validates an entire import inside the trusted background boundary.
  const validateDocumentOrThrow = (documentValue) => {
    const result = validators.validateModelsDocument(documentValue);

    if (result.errors.length > 0) {
      throw new Error(result.errors.join(" "));
    }

    return result.value;
  };

  // Handles session and settings messages from extension pages.
  const handleMessage = async (message, sender) => {
    if (!message || typeof message.type !== "string") {
      throw new Error("The extension received an invalid message.");
    }

    switch (message.type) {
      case "session:get-summary":
        return sessionState.getPublicSnapshot();
      case "session:clear":
        return sessionState.clearAllData();
      case "settings:get-info":
        requireExtensionPage(sender);
        return sessionState.getInfoForOptions();
      case "settings:set-info":
        requireExtensionPage(sender);
        return sessionState.setInfoFile(message.fileName, message.text);
      case "settings:update-info":
        requireExtensionPage(sender);
        return sessionState.updateInfoText(message.text);
      case "settings:add-model":
        requireExtensionPage(sender);
        return sessionState.addModel(validateModelOrThrow(message.model));
      case "settings:update-model":
        requireExtensionPage(sender);
        return sessionState.updateModel(
          message.originalName,
          validateModelOrThrow(message.model, message.originalName),
          message.apiKeyAction,
        );
      case "settings:remove-model":
        requireExtensionPage(sender);
        return sessionState.removeModel(message.name);
      case "settings:replace-models":
        requireExtensionPage(sender);
        return sessionState.replaceModels(
          validateDocumentOrThrow(message.document),
        );
      case "settings:set-active-model":
        return sessionState.setActiveModel(message.name);
      case "settings:set-replace":
        return sessionState.setReplaceExistingValues(message.enabled);
      case "settings:export-models":
        requireExtensionPage(sender);
        return sessionState.getModelsForExport();
      case "settings:test-model": {
        requireExtensionPage(sender);
        const model = sessionState.getModel(message.name);

        if (!model) {
          throw new Error("The model to test is no longer loaded.");
        }

        return modelClient.testConnection(model);
      }
      default:
        throw new Error("The extension received an unknown message.");
    }
  };

  browser.runtime.onMessage.addListener(handleMessage);
})();
