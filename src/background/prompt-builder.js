/* Builds model messages while clearly separating instructions from untrusted data. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { SYSTEM_PROMPT } = globalThis.AIFormFiller.promptConstants;

  // Verifies internal prompt inputs without echoing their sensitive contents.
  const validatePromptData = (promptData) => {
    if (!promptData || typeof promptData.infoText !== "string") {
      throw new Error("No personal information is loaded for this fill.");
    }

    if (!Array.isArray(promptData.fields) || promptData.fields.length === 0) {
      throw new Error("No fillable fields were provided to the model.");
    }

    if (
      promptData.fields.some(
        (field) => !field || typeof field.id !== "string" || !field.id,
      )
    ) {
      throw new Error("A field description is missing its extension ID.");
    }

    if (
      promptData.alreadyFilled !== undefined &&
      !Array.isArray(promptData.alreadyFilled)
    ) {
      throw new Error("The existing form context is invalid.");
    }
  };

  // Serializes page-derived text as data under fixed system instructions.
  const buildMessages = (promptData) => {
    validatePromptData(promptData);
    const userData = {
      referenceInformation: promptData.infoText,
      fieldsToAnswer: promptData.fields,
      alreadyOnThisForm: promptData.alreadyFilled || [],
    };

    return [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(userData) },
    ];
  };

  globalThis.AIFormFiller.promptBuilder = Object.freeze({ buildMessages });
})();
