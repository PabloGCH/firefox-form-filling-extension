/* Validates manual and imported model configurations with identical rules. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { MODEL_PROVIDERS } = globalThis.AIFormFiller.constants;

  // Accepts only absolute HTTP or HTTPS endpoint URLs.
  const isHttpUrl = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  // Produces a normalized model plus field-specific validation errors.
  const validateModel = (candidate, existingNames = [], originalName = null) => {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const value = {
      name: typeof source.name === "string" ? source.name.trim() : "",
      provider: typeof source.provider === "string" ? source.provider : "",
      baseUrl: typeof source.baseUrl === "string" ? source.baseUrl.trim() : "",
      model: typeof source.model === "string" ? source.model.trim() : "",
      apiKey: typeof source.apiKey === "string" ? source.apiKey : "",
    };
    const errors = {};

    if (!value.name) {
      errors.name = "Name is required.";
    } else if (
      value.name !== originalName &&
      existingNames.includes(value.name)
    ) {
      errors.name = "Name must be unique.";
    }

    if (!MODEL_PROVIDERS.includes(value.provider)) {
      errors.provider = 'Provider must be “openai” or “anthropic”.';
    }

    if (!value.baseUrl) {
      errors.baseUrl = "Base URL is required.";
    } else if (!isHttpUrl(value.baseUrl)) {
      errors.baseUrl = "Enter a valid HTTP or HTTPS URL.";
    }

    if (!value.model) {
      errors.model = "Model name is required.";
    }

    if (source.apiKey !== undefined && typeof source.apiKey !== "string") {
      errors.apiKey = "API key must be text.";
    }

    return { errors, value };
  };

  // Validates a complete import without mutating the currently loaded models.
  const validateModelsDocument = (document) => {
    if (!document || typeof document !== "object" || Array.isArray(document)) {
      return { errors: ["The JSON root must be an object."] };
    }

    if (!Array.isArray(document.models) || document.models.length === 0) {
      return { errors: ["The models list must contain at least one model."] };
    }

    const names = [];
    const models = [];
    const errors = [];

    document.models.forEach((candidate, index) => {
      const result = validateModel(candidate, names);
      const label = `Model ${index + 1}`;

      Object.entries(result.errors).forEach(([field, message]) => {
        errors.push(`${label}, field “${field}”: ${message}`);
      });

      if (result.value.name && !names.includes(result.value.name)) {
        names.push(result.value.name);
      }

      if (Object.keys(result.errors).length === 0) {
        models.push(result.value);
      }
    });

    if (
      document.activeModel !== undefined &&
      (typeof document.activeModel !== "string" ||
        !names.includes(document.activeModel))
    ) {
      errors.push("Field “activeModel” must name a model in the models list.");
    }

    if (errors.length > 0) {
      return { errors };
    }

    return {
      errors: [],
      value: {
        activeModel: document.activeModel || models[0].name,
        models,
      },
    };
  };

  globalThis.AIFormFiller.validators = Object.freeze({
    validateModel,
    validateModelsDocument,
  });
})();
