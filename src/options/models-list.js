/* Renders loaded models and handles active selection, testing, editing, and removal. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};
globalThis.AIFormFiller.options = globalThis.AIFormFiller.options || {};

(() => {
  "use strict";

  // Creates one labeled metadata row without interpreting values as markup.
  const addDefinition = (list, label, value) => {
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = label;
    detail.textContent = value;
    list.append(term, detail);
  };

  // Switches the active model immediately in background memory.
  const selectModel = async (name) => {
    try {
      await globalThis.AIFormFiller.optionsApp.send({
        type: "settings:set-active-model",
        name,
      });
      globalThis.AIFormFiller.optionsApp.showStatus(`Active model: ${name}.`);
    } catch (error) {
      globalThis.AIFormFiller.optionsApp.showStatus(error.message, true);
      await globalThis.AIFormFiller.optionsApp.refresh();
    }
  };

  // Runs a real provider request and reports its readable result beside the model.
  const testModel = async (name, resultElement, button) => {
    button.disabled = true;
    resultElement.textContent = "Testing connection…";

    try {
      resultElement.textContent = await globalThis.AIFormFiller.optionsApp.send({
        type: "settings:test-model",
        name,
      });
    } catch (error) {
      resultElement.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };

  // Removes one model and refreshes active selection if it changed.
  const removeModel = async (name) => {
    try {
      await globalThis.AIFormFiller.optionsApp.send({
        type: "settings:remove-model",
        name,
      });
      await globalThis.AIFormFiller.optionsApp.refresh();
      globalThis.AIFormFiller.optionsApp.showStatus("Model removed.");
    } catch (error) {
      globalThis.AIFormFiller.optionsApp.showStatus(error.message, true);
    }
  };

  // Builds an accessible card and keeps all model values as plain text.
  const createCard = (model, activeModelName) => {
    const card = document.createElement("article");
    const heading = document.createElement("h4");
    const activeLabel = document.createElement("label");
    const activeInput = document.createElement("input");
    const details = document.createElement("dl");
    const actions = document.createElement("div");
    const testButton = document.createElement("button");
    const editButton = document.createElement("button");
    const removeButton = document.createElement("button");
    const result = document.createElement("p");

    card.className = "model-card";
    card.dataset.modelName = model.name;
    heading.textContent = model.name;
    activeInput.type = "radio";
    activeInput.name = "active-model";
    activeInput.checked = model.name === activeModelName;
    activeInput.addEventListener("change", () => selectModel(model.name));
    activeLabel.className = "checkbox";
    activeLabel.append(activeInput, " Active model");
    addDefinition(details, "Provider", model.provider);
    addDefinition(details, "URL", model.baseUrl);
    addDefinition(details, "Model", model.model);
    addDefinition(details, "API key", model.maskedApiKey);

    actions.className = "actions";
    testButton.type = "button";
    testButton.textContent = "Test connection";
    testButton.addEventListener("click", () =>
      testModel(model.name, result, testButton),
    );
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => {
      document.dispatchEvent(
        new CustomEvent("model-edit-requested", { detail: model }),
      );
    });
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => removeModel(model.name));
    actions.append(testButton, editButton, removeButton);
    result.className = "model-result";
    result.setAttribute("role", "status");
    card.append(heading, activeLabel, details, actions, result);
    return card;
  };

  // Rebuilds the list from the latest safe background snapshot.
  const render = (summary) => {
    const list = document.querySelector("#models-list");
    const empty = document.querySelector("#models-empty");
    list.replaceChildren();
    empty.hidden = summary.models.length > 0;

    summary.models.forEach((model) => {
      list.append(createCard(model, summary.activeModelName));
    });
  };

  globalThis.AIFormFiller.options.modelsList = Object.freeze({ render });
})();
