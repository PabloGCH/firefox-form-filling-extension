/* Formats, merges, and notifies final fill outcomes without exposing page data. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  // Sends one approved final notification and reports notification failure in-panel.
  const notify = async (outcome, category) => {
    try {
      await browser.runtime.sendMessage({
        type: "notification:fill-result",
        outcome,
        category,
      });
    } catch {
      globalThis.AIFormFiller.panel.setStatus(
        "The fill finished, but its desktop notification could not be shown.",
      );
    }
  };

  // Reduces detailed errors to an approved general notification category.
  const getFailureCategory = (message) => {
    if (/no personal information|no active model/i.test(message)) {
      return "setup is incomplete";
    }

    if (/reach|timed out|HTTP|canceled/i.test(message)) {
      return "the model was unavailable";
    }

    if (/invalid JSON|model response|response text/i.test(message)) {
      return "the model response was invalid";
    }

    return "the fill could not be completed";
  };

  // Formats required counts and specific unmatched native selects for the panel.
  const format = (summary) => {
    const counts =
      `Done: filled ${summary.filled}, left ${summary.leftBlank} blank, ` +
      `skipped ${summary.skippedHidden} hidden fields, ` +
      `${summary.unmatchedSelects} unmatched selects, and ` +
      `${summary.deniedClicks} denied clicks. Review the form, then submit it yourself.`;
    const details = summary.unmatchedSelectDetails.join("; ");
    return details ? `${counts} ${details}.` : counts;
  };

  // Combines first and dependent passes into one final user summary.
  const merge = (first, second) => ({
    deniedClicks: first.deniedClicks + second.deniedClicks,
    filled: first.filled + second.filled,
    leftBlank: first.leftBlank + second.leftBlank,
    skippedHidden: first.skippedHidden + second.skippedHidden,
    unmatchedSelectDetails: [
      ...first.unmatchedSelectDetails,
      ...second.unmatchedSelectDetails,
    ],
    unmatchedSelects: first.unmatchedSelects + second.unmatchedSelects,
  });

  // Captures first-pass controls so dependent rescanning cannot refill them.
  const getBindingElements = (bindings) => {
    const elements = new Set();
    bindings.forEach((binding) => {
      (binding.elements || [binding.element]).forEach((element) => {
        elements.add(element);
      });
    });
    return elements;
  };

  globalThis.AIFormFiller.fillSummary = Object.freeze({
    format,
    getBindingElements,
    getFailureCategory,
    merge,
    notify,
  });
})();
