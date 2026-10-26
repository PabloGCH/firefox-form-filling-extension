/* Routes extension messages while keeping secrets inside trusted extension contexts. */

(() => {
  "use strict";

  const { modelClient, notifications, sessionState, validators } =
    globalThis.AIFormFiller;

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

  // Clears state first, then asks every injected page to clear selection and UI.
  const clearSessionData = async () => {
    const snapshot = sessionState.clearAllData();
    const tabs = await browser.tabs.query({});
    await Promise.allSettled(
      tabs.map((tab) =>
        browser.tabs.sendMessage(tab.id, { type: "session:cleared" }),
      ),
    );
    return snapshot;
  };

  // Keeps reference text and model credentials inside the background page.
  const fillFields = async (message, sender) => {
    if (!sender.tab || message.safetyChecked !== true) {
      throw new Error("The form safety check did not authorize this fill.");
    }

    if (!Array.isArray(message.fields) || message.fields.length === 0) {
      throw new Error("No fillable fields were provided.");
    }

    const infoText = sessionState.getInfoText();
    const model = sessionState.getActiveModel();

    if (!infoText) {
      throw new Error("No personal information is loaded.");
    }

    if (!model) {
      throw new Error("No active model is loaded.");
    }

    const controller = sessionState.beginFill(message.fields);

    try {
      const result = await modelClient.fillFields(
        { ...model },
        {
          alreadyFilled: Array.isArray(message.alreadyFilled)
            ? message.alreadyFilled
            : [],
          fields: message.fields,
          infoText,
          clickCandidates: Array.isArray(message.clickCandidates)
            ? message.clickCandidates
            : [],
        },
        controller.signal,
      );
      sessionState.finishFill(controller, result.values);
      return result;
    } catch (error) {
      sessionState.finishFill(controller);
      throw error;
    }
  };

  // Runs one safety-authorized focused retry for an unmatched select.
  const retrySelect = async (message, sender) => {
    if (!sender.tab || message.safetyChecked !== true || !message.field) {
      throw new Error("The form safety check did not authorize this retry.");
    }

    const infoText = sessionState.getInfoText();
    const model = sessionState.getActiveModel();

    if (!infoText || !model) {
      throw new Error("The model setup is no longer available.");
    }

    const controller = sessionState.beginFill([message.field]);

    try {
      const value = await modelClient.retrySelect(
        { ...model },
        {
          field: message.field,
          infoText,
          previousAnswer: message.previousAnswer,
        },
        controller.signal,
      );
      sessionState.finishFill(controller, { [message.field.id]: value });
      return value;
    } catch (error) {
      sessionState.finishFill(controller);
      throw error;
    }
  };

  // Handles session and settings messages from extension pages.
  const handleMessage = async (message, sender) => {
    if (!message || typeof message.type !== "string") {
      throw new Error("The extension received an invalid message.");
    }

    switch (message.type) {
      case "session:get-summary":
        return sessionState.getPublicSnapshot();
      case "session:get-fill-readiness": {
        const snapshot = sessionState.getPublicSnapshot();
        return {
          infoLoaded: snapshot.infoFile.loaded,
          modelLoaded: Boolean(snapshot.activeModelName),
          replaceExistingValues: snapshot.settings.replaceExistingValues,
        };
      }
      case "session:clear":
        return clearSessionData();
      case "notification:hidden-fields":
        return notifications.showHiddenFieldsWarning();
      case "notification:fill-result":
        return notifications.showFillResult(message.outcome, message.category);
      case "fill:request":
        return fillFields(message, sender);
      case "fill:retry-select":
        return retrySelect(message, sender);
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
