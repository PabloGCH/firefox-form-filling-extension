/* Sends model connection tests without exposing credentials outside the background page. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const REQUEST_TIMEOUT_MS = 180000;

  // Joins a configured base URL to the provider's request path.
  const buildEndpoint = (model) => {
    const baseUrl = model.baseUrl.replace(/\/$/, "");

    if (model.provider === "anthropic") {
      return baseUrl.endsWith("/v1")
        ? `${baseUrl}/messages`
        : `${baseUrl}/v1/messages`;
    }

    return `${baseUrl}/chat/completions`;
  };

  // Creates provider-specific headers while omitting absent OpenAI keys.
  const buildHeaders = (model) => {
    const headers = { "Content-Type": "application/json" };

    if (model.provider === "anthropic") {
      headers["anthropic-version"] = "2023-06-01";
      headers["anthropic-dangerous-direct-browser-access"] = "true";

      if (model.apiKey) {
        headers["x-api-key"] = model.apiKey;
      }
    } else if (model.apiKey) {
      headers.Authorization = `Bearer ${model.apiKey}`;
    }

    return headers;
  };

  // Creates a minimal real completion request supported by each provider.
  const buildTestBody = (model) => {
    const common = {
      model: model.model,
      temperature: 0,
      messages: [{ role: "user", content: "Reply with OK." }],
    };

    if (model.provider === "anthropic") {
      return { ...common, max_tokens: 4 };
    }

    return { ...common, max_tokens: 4 };
  };

  // Converts network failures into readable messages without response secrets.
  const explainFailure = (error) => {
    if (error?.name === "AbortError") {
      return "The model request timed out after 3 minutes.";
    }

    return "Could not reach the model endpoint. Check the URL and make sure the model server is running.";
  };

  // Tests one loaded model through the same provider endpoint used for fills.
  const testConnection = async (model) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(buildEndpoint(model), {
        method: "POST",
        headers: buildHeaders(model),
        body: JSON.stringify(buildTestBody(model)),
        signal: controller.signal,
      });

      if (!response.ok) {
        const ollamaHint =
          response.status === 403
            ? ' If this is Ollama, try OLLAMA_ORIGINS="moz-extension://*".'
            : "";
        throw new Error(
          `The model endpoint returned HTTP ${response.status}.${ollamaHint}`,
        );
      }

      return "Connection successful.";
    } catch (error) {
      if (error instanceof TypeError || error?.name === "AbortError") {
        throw new Error(explainFailure(error));
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  globalThis.AIFormFiller.modelClient = Object.freeze({ testConnection });
})();
