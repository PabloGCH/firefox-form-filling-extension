/* Defines request limits shared by model-client operations. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  globalThis.AIFormFiller.modelConstants = Object.freeze({
    FILL_MAX_TOKENS: 4096,
    REQUEST_TIMEOUT_MS: 180000,
    TEST_MAX_TOKENS: 4,
  });
})();
