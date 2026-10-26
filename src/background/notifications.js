/* Shows short Firefox desktop notifications without including form or profile data. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { FILL_FAILURE_CATEGORIES, HIDDEN_FIELDS_NOTIFICATION } =
    globalThis.AIFormFiller.constants;

  // Alerts the user to review the detailed, private on-page safety panel.
  const showHiddenFieldsWarning = () =>
    browser.notifications.create({
      type: "basic",
      title: "AI Form Filler",
      message: HIDDEN_FIELDS_NOTIFICATION,
    });

  // Sends one brief final result without including field counts or page data.
  const showFillResult = (outcome, category = "the fill could not be completed") => {
    let message;

    if (outcome === "success") {
      message = "Form fill complete. Review before submitting.";
    } else if (outcome === "partial") {
      message = "Form fill partially complete. Some fields were left unchanged.";
    } else {
      const safeCategory = FILL_FAILURE_CATEGORIES.includes(category)
        ? category
        : "the fill could not be completed";
      message = `Form fill failed: ${safeCategory}.`;
    }

    return browser.notifications.create({
      type: "basic",
      title: "AI Form Filler",
      message,
    });
  };

  globalThis.AIFormFiller.notifications = Object.freeze({
    showFillResult,
    showHiddenFieldsWarning,
  });
})();
