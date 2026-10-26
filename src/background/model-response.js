/* Extracts and allow-list validates fields and click requests from model text. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { MAX_CLICK_REASON_LENGTH, MAX_CLICK_REQUESTS } =
    globalThis.AIFormFiller.promptConstants;

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

  // Parses the first model JSON object without trusting surrounding prose.
  const parseResponseObject = (responseText) => {
    if (typeof responseText !== "string") {
      throw new Error("The model returned an invalid response instead of text.");
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

    return parsed;
  };

  // Validates scalar field values against extension-generated IDs.
  const parseFields = (parsed, allowedFieldIds) => {
    if (!Array.isArray(allowedFieldIds)) {
      throw new Error("The extension field list is invalid.");
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

  // Accepts only bounded, unique requests for click IDs listed by the extension.
  const parseClickRequests = (parsed, allowedClickIds) => {
    if (parsed.clickRequests === undefined) {
      return [];
    }

    if (!Array.isArray(parsed.clickRequests)) {
      throw new Error('The model response field “clickRequests” must be an array.');
    }

    if (parsed.clickRequests.length > MAX_CLICK_REQUESTS) {
      throw new Error("The model requested too many button clicks.");
    }

    const allowedIds = new Set(allowedClickIds);
    const seenIds = new Set();
    return parsed.clickRequests.map((request) => {
      if (
        !request ||
        typeof request !== "object" ||
        Array.isArray(request) ||
        typeof request.candidateId !== "string" ||
        !allowedIds.has(request.candidateId) ||
        seenIds.has(request.candidateId)
      ) {
        throw new Error("The model requested an invalid or unlisted button click.");
      }

      if (request.reason !== undefined && typeof request.reason !== "string") {
        throw new Error("The model returned an invalid button-click reason.");
      }

      seenIds.add(request.candidateId);
      return {
        candidateId: request.candidateId,
        reason: String(request.reason || "").trim().slice(0, MAX_CLICK_REASON_LENGTH),
      };
    });
  };

  // Parses a values-only response for focused native-select retries.
  const parseFieldResponse = (responseText, allowedFieldIds) =>
    parseFields(parseResponseObject(responseText), allowedFieldIds);

  // Parses a normal fill response with separately allow-listed optional clicks.
  const parseFillResponse = (responseText, allowedFieldIds, allowedClickIds) => {
    if (!Array.isArray(allowedClickIds)) {
      throw new Error("The extension click-candidate list is invalid.");
    }

    const parsed = parseResponseObject(responseText);
    return {
      values: parseFields(parsed, allowedFieldIds),
      clickRequests: parseClickRequests(parsed, allowedClickIds),
    };
  };

  globalThis.AIFormFiller.modelResponse = Object.freeze({
    parseFieldResponse,
    parseFillResponse,
  });
})();
