/* Extracts and validates field values from untrusted model response text. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  // Removes Markdown fence markers that models sometimes add around JSON.
  const stripCodeFences = (text) =>
    text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();

  // Finds the first complete JSON object while respecting braces inside strings.
  const extractFirstObject = (text) => {
    const start = text.indexOf("{");

    if (start === -1) {
      throw new Error("The model returned invalid JSON: no object was found.");
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const character = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }

        continue;
      }

      if (character === '"') {
        inString = true;
      } else if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;

        if (depth === 0) {
          return text.slice(start, index + 1);
        }
      }
    }

    throw new Error("The model returned invalid JSON: the object is incomplete.");
  };

  // Accepts only scalar values, null, or scalar arrays for listed fields.
  const isAllowedValue = (value) => {
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      return true;
    }

    return (
      Array.isArray(value) &&
      value.every((item) =>
        ["string", "number", "boolean"].includes(typeof item),
      )
    );
  };

  // Parses one object and rejects fields the extension did not enumerate.
  const parseFieldResponse = (responseText, allowedFieldIds) => {
    if (typeof responseText !== "string") {
      throw new Error("The model returned an invalid response instead of text.");
    }

    if (!Array.isArray(allowedFieldIds)) {
      throw new Error("The extension field list is invalid.");
    }

    let parsed;

    try {
      parsed = JSON.parse(extractFirstObject(stripCodeFences(responseText)));
    } catch (error) {
      if (error.message.startsWith("The model returned")) {
        throw error;
      }

      throw new Error("The model returned invalid JSON.");
    }

    if (!parsed.fields || typeof parsed.fields !== "object" || Array.isArray(parsed.fields)) {
      throw new Error('The model response must contain a JSON object named “fields”.');
    }

    const allowedIds = new Set(allowedFieldIds);
    const values = {};

    Object.entries(parsed.fields).forEach(([fieldId, value]) => {
      if (!allowedIds.has(fieldId)) {
        throw new Error("The model returned a value for an unlisted field.");
      }

      if (!isAllowedValue(value)) {
        throw new Error(`The model returned an invalid value for field “${fieldId}”.`);
      }

      values[fieldId] = value;
    });

    return values;
  };

  globalThis.AIFormFiller.modelResponse = Object.freeze({ parseFieldResponse });
})();
