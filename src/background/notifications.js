/* Shows short Firefox desktop notifications without including form or profile data. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { HIDDEN_FIELDS_NOTIFICATION } = globalThis.AIFormFiller.constants;

  // Alerts the user to review the detailed, private on-page safety panel.
  const showHiddenFieldsWarning = () =>
    browser.notifications.create({
      type: "basic",
      title: "AI Form Filler",
      message: HIDDEN_FIELDS_NOTIFICATION,
    });

  globalThis.AIFormFiller.notifications = Object.freeze({
    showHiddenFieldsWarning,
  });
})();
