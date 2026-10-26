/* Routes extension messages to the in-memory session state. */

(() => {
  "use strict";

  const { sessionState } = globalThis.AIFormFiller;

  // Handles the small set of state messages available in the project skeleton.
  const handleMessage = (message) => {
    if (!message || typeof message.type !== "string") {
      return Promise.reject(new Error("The extension received an invalid message."));
    }

    if (message.type === "session:get-summary") {
      return Promise.resolve(sessionState.getPublicSnapshot());
    }

    if (message.type === "session:clear") {
      return Promise.resolve(sessionState.clearAllData());
    }

    return Promise.reject(new Error("The extension received an unknown message."));
  };

  browser.runtime.onMessage.addListener(handleMessage);
})();
