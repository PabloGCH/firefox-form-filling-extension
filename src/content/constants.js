/* Defines visibility thresholds and approved safety-panel text for content scripts. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  globalThis.AIFormFiller.contentConstants = Object.freeze({
    CLIP_TOLERANCE_PX: 1,
    DEPENDENT_RESCAN_DELAY_MS: 150,
    FAR_OFFSCREEN_PX: 1000,
    FILLED_HIGHLIGHT: "0 0 0 3px #ffd54f",
    LABEL_MAX_LENGTH: 180,
    MAX_CONTEXT_VALUE_LENGTH: 500,
    NEAR_ZERO_PX: 2,
    SAFETY_WARNING_TEXT:
      "Invisible fields were found. Nothing has been sent to the model. Cancel, or continue with visible fields only.",
    SKIPPED_INPUT_TYPES: Object.freeze([
      "hidden",
      "submit",
      "button",
      "reset",
      "image",
      "file",
      "password",
    ]),
    SUBMIT_BLOCK_MS: 2000,
    STATUS_VALUE_MAX_LENGTH: 80,
  });
})();
