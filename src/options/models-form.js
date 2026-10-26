/* Manages manual model creation and editing with inline shared validation. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};
globalThis.AIFormFiller.options = globalThis.AIFormFiller.options || {};

(() => {
  "use strict";

  const fieldIds = Object.freeze({
    name: "model-name",
    provider: "model-provider",
    baseUrl: "model-base-url",
    model: "model-id",
    apiKey: "model-api-key",
  });

  // Reads the form without retaining a second model configuration copy.
  const readForm = () => ({
    name: document.querySelector("#model-name").value,
    provider: document.querySelector("#model-provider").value,
    baseUrl: document.querySelector("#model-base-url").value,
    model: document.querySelector("#model-id").value,
    apiKey: document.querySelector("#model-api-key").value,
  });

  // Uses rendered model cards as the current list of unique names.
  const getExistingNames = () =>
    [...document.querySelectorAll(".model-card")].map(
      (card) => card.dataset.modelName,
    );

  // Clears and then displays field-specific validation feedback.
  const showErrors = (errors = {}) => {
    Object.entries(fieldIds).forEach(([field, inputId]) => {
      const error = document.querySelector(`#${inputId}-error`);
      error.textContent = errors[field] || "";
    });
  };

  // Restores add mode and ensures no secret remains in the input.
  const reset = () => {
    document.querySelector("#model-form").reset();
    document.querySelector("#editing-name").value = "";
    document.querySelector("#model-form-heading").textContent = "Add a model";
    document.querySelector("#save-model").textContent = "Add model";
    document.querySelector("#cancel-model-edit").hidden = true;
    document.querySelector("#clear-api-key-label").hidden = true;
    document.querySelector("#model-api-key").type = "password";
    document.querySelector("#toggle-api-key").textContent = "Show";
    showErrors();
  };

  // Adds or updates only after the shared validator accepts every field.
  const handleSubmit = async (event) => {
    event.preventDefault();
    const originalName = document.querySelector("#editing-name").value || null;
    const result = globalThis.AIFormFiller.validators.validateModel(
      readForm(),
      getExistingNames(),
      originalName,
    );
    showErrors(result.errors);

    if (Object.keys(result.errors).length > 0) {
      globalThis.AIFormFiller.optionsApp.showStatus(
        "Correct the highlighted model fields.",
        true,
      );
      return;
    }

    try {
      if (originalName) {
        const clearKey = document.querySelector("#clear-api-key").checked;
        const apiKeyAction = clearKey
          ? "clear"
          : result.value.apiKey
            ? "replace"
            : "preserve";
        await globalThis.AIFormFiller.optionsApp.send({
          type: "settings:update-model",
          originalName,
          model: result.value,
          apiKeyAction,
        });
      } else {
        await globalThis.AIFormFiller.optionsApp.send({
          type: "settings:add-model",
          model: result.value,
        });
      }

      reset();
      await globalThis.AIFormFiller.optionsApp.refresh();
      globalThis.AIFormFiller.optionsApp.showStatus(
        originalName ? "Model updated." : "Model added.",
      );
    } catch (error) {
      globalThis.AIFormFiller.optionsApp.showStatus(error.message, true);
    }
  };

  // Loads public model fields for editing while keeping the API key blank.
  const beginEdit = (event) => {
    const model = event.detail;
    document.querySelector("#editing-name").value = model.name;
    document.querySelector("#model-name").value = model.name;
    document.querySelector("#model-provider").value = model.provider;
    document.querySelector("#model-base-url").value = model.baseUrl;
    document.querySelector("#model-id").value = model.model;
    document.querySelector("#model-api-key").value = "";
    document.querySelector("#clear-api-key").checked = false;
    document.querySelector("#clear-api-key-label").hidden = false;
    document.querySelector("#model-form-heading").textContent = "Edit model";
    document.querySelector("#save-model").textContent = "Save changes";
    document.querySelector("#cancel-model-edit").hidden = false;
    document.querySelector("#model-name").focus();
    showErrors();
  };

  // Toggles key visibility only for text the user entered this time.
  const toggleKey = () => {
    const input = document.querySelector("#model-api-key");
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    document.querySelector("#toggle-api-key").textContent = showing
      ? "Show"
      : "Hide";
  };

  // Registers form mode, submission, and secret visibility controls.
  const init = () => {
    document.querySelector("#model-form").addEventListener("submit", handleSubmit);
    document.querySelector("#cancel-model-edit").addEventListener("click", reset);
    document.querySelector("#toggle-api-key").addEventListener("click", toggleKey);
    document.addEventListener("model-edit-requested", beginEdit);
  };

  globalThis.AIFormFiller.options.modelsForm = Object.freeze({ init, reset });
})();
