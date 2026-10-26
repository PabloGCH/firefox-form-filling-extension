/* Defines visibility thresholds and approved safety-panel text for content scripts. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  globalThis.AIFormFiller.contentConstants = Object.freeze({
    CLIP_TOLERANCE_PX: 1,
    FAR_OFFSCREEN_PX: 1000,
    NEAR_ZERO_PX: 2,
    SAFETY_WARNING_TEXT:
      "Invisible fields were found. Nothing has been sent to the model. Cancel, or continue with visible fields only.",
  });
})();
