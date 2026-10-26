/* Builds model messages while clearly separating instructions from untrusted data. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { LONG_OPTION_THRESHOLD, MAX_PLAUSIBLE_OPTIONS, SYSTEM_PROMPT } =
    globalThis.AIFormFiller.promptConstants;

  // Normalizes reference and option text for conservative candidate filtering.
  const normalizeText = (value) =>
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  // Limits unusually long lists only when the reference contains plausible text.
  const limitOptions = (field, infoText) => {
    if (!Array.isArray(field.options) || field.options.length <= LONG_OPTION_THRESHOLD) {
      return field;
    }

    const normalizedInfo = normalizeText(infoText);
    const candidates = field.options.filter((option) => {
      const value = normalizeText(option.value);
      const label = normalizeText(option.label);
      return (
        (value.length >= 2 && normalizedInfo.includes(value)) ||
        (label.length >= 2 && normalizedInfo.includes(label))
      );
    });

    if (candidates.length === 0) {
      return field;
    }

    return { ...field, options: candidates.slice(0, MAX_PLAUSIBLE_OPTIONS) };
  };

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
      fieldsToAnswer: promptData.fields.map((field) =>
        limitOptions(field, promptData.infoText),
      ),
      alreadyOnThisForm: promptData.alreadyFilled || [],
    };

    return [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(userData) },
    ];
  };

  // Builds a focused retry asking for one closest listed option or null.
  const buildSelectRetryMessages = (promptData) => {
    validatePromptData({
      fields: [promptData.field],
      infoText: promptData.infoText,
    });
    const userData = {
      instruction:
        "For this one field, choose the closest listed option value supported by the reference, or null. Return the standard fields JSON object.",
      previousAnswer: promptData.previousAnswer,
      referenceInformation: promptData.infoText,
      field: promptData.field,
    };
    return [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(userData) },
    ];
  };

  globalThis.AIFormFiller.promptBuilder = Object.freeze({
    buildMessages,
    buildSelectRetryMessages,
  });
})();
