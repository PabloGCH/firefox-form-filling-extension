/* Calls OpenAI-compatible and Anthropic endpoints with bounded, readable failures. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { FILL_MAX_TOKENS, REQUEST_TIMEOUT_MS, TEST_MAX_TOKENS } =
    globalThis.AIFormFiller.modelConstants;

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

  // Converts common network failures into safe, readable messages.
  const explainNetworkFailure = (error, timedOut, externallyCanceled) => {
    if (timedOut) {
      return "The model request timed out after 3 minutes.";
    }

    if (externallyCanceled || error?.name === "AbortError") {
      return "The model request was canceled.";
    }

    return "Could not reach the model endpoint. Check the URL and make sure the model server is running.";
  };

  // Sends one provider request with timeout and optional external cancellation.
  const sendRequest = async (model, body, externalSignal) => {
    const controller = new AbortController();
    let timedOut = false;
    const cancelFromCaller = () => controller.abort();
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    externalSignal?.addEventListener("abort", cancelFromCaller, { once: true });

    if (externalSignal?.aborted) {
      controller.abort();
    }

    try {
      const response = await fetch(buildEndpoint(model), {
        method: "POST",
        headers: buildHeaders(model),
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
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

      return response;
    } catch (error) {
      if (error instanceof TypeError || error?.name === "AbortError") {
        throw new Error(
          explainNetworkFailure(error, timedOut, externalSignal?.aborted),
        );
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", cancelFromCaller);
    }
  };

  // Converts shared messages to the provider-specific request envelope.
  const buildBody = (model, messages, maxTokens) => {
    const body = {
      model: model.model,
      temperature: 0,
      messages,
      max_tokens: maxTokens,
    };

    if (model.provider === "anthropic") {
      const systemMessage = messages.find((message) => message.role === "system");
      return {
        ...body,
        system: systemMessage?.content || "",
        messages: messages.filter((message) => message.role !== "system"),
      };
    }

    return body;
  };

  // Extracts text from either provider without exposing the full response in errors.
  const readResponseText = async (model, response) => {
    let payload;

    try {
      payload = await response.json();
    } catch {
      throw new Error("The model endpoint returned an invalid JSON response.");
    }

    const text =
      model.provider === "anthropic"
        ? payload.content?.find((part) => part.type === "text")?.text
        : payload.choices?.[0]?.message?.content;

    if (typeof text !== "string" || !text.trim()) {
      throw new Error("The model endpoint returned no response text.");
    }

    return text;
  };

  // Tests a model with a minimal real completion request.
  const testConnection = async (model) => {
    const messages = [{ role: "user", content: "Reply with OK." }];
    await sendRequest(model, buildBody(model, messages, TEST_MAX_TOKENS));
    return "Connection successful.";
  };

  // Requests fields and optional clicks, validating both extension ID allow-lists.
  const fillFields = async (model, promptData, externalSignal) => {
    const messages = globalThis.AIFormFiller.promptBuilder.buildMessages(promptData);
    const response = await sendRequest(
      model,
      buildBody(model, messages, FILL_MAX_TOKENS),
      externalSignal,
    );
    const responseText = await readResponseText(model, response);
    const allowedIds = promptData.fields.map((field) => field.id);
    const allowedClickIds = (promptData.clickCandidates || []).map(
      (candidate) => candidate.id,
    );
    return globalThis.AIFormFiller.modelResponse.parseFillResponse(
      responseText,
      allowedIds,
      allowedClickIds,
    );
  };

  // Runs the required focused second pass for one unmatched native select.
  const retrySelect = async (model, promptData, externalSignal) => {
    const messages =
      globalThis.AIFormFiller.promptBuilder.buildSelectRetryMessages(promptData);
    const response = await sendRequest(
      model,
      buildBody(model, messages, FILL_MAX_TOKENS),
      externalSignal,
    );
    const responseText = await readResponseText(model, response);
    const values = globalThis.AIFormFiller.modelResponse.parseFieldResponse(
      responseText,
      [promptData.field.id],
    );
    return values[promptData.field.id] ?? null;
  };

  globalThis.AIFormFiller.modelClient = Object.freeze({
    fillFields,
    retrySelect,
    testConnection,
  });
})();
