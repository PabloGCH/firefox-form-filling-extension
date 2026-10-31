/* Defines shared, non-sensitive constants for extension pages and background scripts. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const EXAMPLE_MODELS_JSON = `{
  "activeModel": "Local Ollama",
  "models": [
    {
      "name": "Local Ollama",
      "provider": "openai",
      "baseUrl": "http://localhost:11434/v1",
      "model": "llama3.1"
    },
    {
      "name": "Local LM Studio",
      "provider": "openai",
      "baseUrl": "http://localhost:1234/v1",
      "model": "your-model-name"
    },
    {
      "name": "Cloud (OpenAI-compatible)",
      "provider": "openai",
      "baseUrl": "https://api.example.com/v1",
      "model": "your-model-name",
      "apiKey": "YOUR_API_KEY"
    },
    {
      "name": "Anthropic",
      "provider": "anthropic",
      "baseUrl": "https://api.anthropic.com",
      "model": "your-model-name",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}`;

  globalThis.AIFormFiller.constants = Object.freeze({
    CLEAR_CONFIRMATION:
      "Clear all in-memory data? This cancels any fill in progress. Files you previously exported to disk will not be deleted.",
    CLEAR_SUCCESS:
      "All data cleared. Load your info file and models again to continue.",
    EXAMPLE_MODELS_JSON,
    EXPORT_FILE_NAME: "ai-form-filler-models.json",
    EXPORT_WARNING:
      "This file includes API keys in plain text. Anyone with the file can read them. Store it securely. Export models now?",
    FILL_FAILURE_CATEGORIES: Object.freeze([
      "setup is incomplete",
      "no inputs were found",
      "the model was unavailable",
      "the model response was invalid",
      "the fill could not be completed",
    ]),
    INFO_EDIT_DELAY_MS: 300,
    LARGE_FILE_BYTES: 50 * 1024,
    LARGE_FILE_WARNING:
      "This file is over 50 KB. Its full contents are sent on every fill, and smaller local models may struggle with it.",
    MODEL_PROVIDERS: Object.freeze(["openai", "anthropic"]),
  });
})();
