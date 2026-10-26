/* Imports, exports, and copies model configuration JSON on explicit user actions. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};
globalThis.AIFormFiller.options = globalThis.AIFormFiller.options || {};

(() => {
  "use strict";

  const {
    EXAMPLE_MODELS_JSON,
    EXPORT_FILE_NAME,
    EXPORT_WARNING,
  } = globalThis.AIFormFiller.constants;

  // Reads an import as text with a clear local file error.
  const readTextFile = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result));
      reader.addEventListener("error", () => {
        reject(new Error("The models JSON file could not be read."));
      });
      reader.readAsText(file, "utf-8");
    });

  // Parses JSON separately so malformed syntax has a precise message.
  const parseJson = (text) => {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("The selected file contains invalid JSON.");
    }
  };

  // Validates fully before asking the background page to replace any models.
  const importModels = async (event) => {
    const input = event.currentTarget;
    const file = input.files[0];

    if (!file) {
      return;
    }

    try {
      if (!file.name.toLowerCase().endsWith(".json")) {
        throw new Error("Choose a file with a .json extension.");
      }

      const documentValue = parseJson(await readTextFile(file));
      const result =
        globalThis.AIFormFiller.validators.validateModelsDocument(documentValue);

      if (result.errors.length > 0) {
        throw new Error(result.errors.join(" "));
      }

      const summary = await globalThis.AIFormFiller.optionsApp.send({
        type: "session:get-summary",
      });
      const count = summary.models.length;

      if (count > 0 && !confirm(`Replace the ${count} loaded models?`)) {
        input.value = "";
        globalThis.AIFormFiller.optionsApp.showStatus("Import canceled.");
        return;
      }

      await globalThis.AIFormFiller.optionsApp.send({
        type: "settings:replace-models",
        document: result.value,
      });
      input.value = "";
      await globalThis.AIFormFiller.optionsApp.refresh();
      globalThis.AIFormFiller.optionsApp.showStatus("Models imported.");
    } catch (error) {
      input.value = "";
      globalThis.AIFormFiller.optionsApp.showStatus(error.message, true);
    }
  };

  // Downloads an exact secret-bearing snapshot only after the approved warning.
  const exportModels = async () => {
    if (!confirm(EXPORT_WARNING)) {
      globalThis.AIFormFiller.optionsApp.showStatus("Export canceled.");
      return;
    }

    try {
      const documentValue = await globalThis.AIFormFiller.optionsApp.send({
        type: "settings:export-models",
      });
      const blob = new Blob([`${JSON.stringify(documentValue, null, 2)}\n`], {
        type: "application/json",
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = EXPORT_FILE_NAME;
      link.click();
      setTimeout(URL.revokeObjectURL, 0, objectUrl);
      globalThis.AIFormFiller.optionsApp.showStatus("Models exported.");
    } catch (error) {
      globalThis.AIFormFiller.optionsApp.showStatus(error.message, true);
    }
  };

  // Copies the hidden example or reports clipboard denial explicitly.
  const copyExample = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable in this browser.");
      }

      await navigator.clipboard.writeText(EXAMPLE_MODELS_JSON);
      globalThis.AIFormFiller.optionsApp.showStatus("Copied.");
    } catch (error) {
      const message = error.message || "Clipboard access was denied.";
      globalThis.AIFormFiller.optionsApp.showStatus(message, true);
    }
  };

  // Registers the three explicit model file and clipboard actions.
  const init = () => {
    document.querySelector("#models-file").addEventListener("change", importModels);
    document.querySelector("#export-models").addEventListener("click", exportModels);
    document.querySelector("#copy-example").addEventListener("click", copyExample);
  };

  // Prevents export attempts when there is no configuration to save.
  const render = (summary) => {
    document.querySelector("#export-models").disabled =
      summary.models.length === 0;
  };

  globalThis.AIFormFiller.options.modelsImportExport = Object.freeze({
    init,
    render,
  });
})();
