/* Defines safety, display, and bounded click-flow constants for content scripts. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  globalThis.AIFormFiller.contentConstants = Object.freeze({
    CLIP_TOLERANCE_PX: 1,
    CLICK_OUTLINE: "4px solid #1769aa",
    CLICK_REASON_MAX_LENGTH: 240,
    CLICK_TEXT_MAX_LENGTH: 120,
    DEPENDENT_RESCAN_DELAY_MS: 150,
    FAR_OFFSCREEN_PX: 1000,
    FILLED_HIGHLIGHT: "0 0 0 3px #ffd54f",
    LABEL_MAX_LENGTH: 180,
    MAX_CONTEXT_VALUE_LENGTH: 500,
    MAX_CLICK_REQUESTS_PER_FILL: 10,
    NEAR_ZERO_PX: 2,
    SAFETY_WARNING_TEXT:
      "Invisible fields were found. Nothing has been sent to the model. Cancel, or continue with visible fields only.",
    SKIPPED_BUTTON_PATTERN:
      /\b(cancel|close|delete|discard|log\s*out|remove|reset|sign\s*out)\b/i,
    SUBMIT_LIKE_PATTERN:
      /\b(apply|book|buy|checkout|confirm|continue|donate|finish|next|order|pay|place\s+order|purchase|register|save|send|sign\s*up|submit)\b/i,
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
