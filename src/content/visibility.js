/* Classifies concealed controls for field collection and button click checks. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  const { CLIP_TOLERANCE_PX, FAR_OFFSCREEN_PX, NEAR_ZERO_PX } =
    globalThis.AIFormFiller.contentConstants;

  // Reports clipping when an overflow ancestor excludes the field rectangle.
  const getClippingReason = (fieldRect, ancestors) => {
    for (const ancestor of ancestors) {
      const style = getComputedStyle(ancestor);
      const clipsX = ["hidden", "clip"].includes(style.overflowX);
      const clipsY = ["hidden", "clip"].includes(style.overflowY);

      if (!clipsX && !clipsY) {
        continue;
      }

      const rect = ancestor.getBoundingClientRect();
      const outsideX =
        clipsX &&
        (fieldRect.right <= rect.left + CLIP_TOLERANCE_PX ||
          fieldRect.left >= rect.right - CLIP_TOLERANCE_PX);
      const outsideY =
        clipsY &&
        (fieldRect.bottom <= rect.top + CLIP_TOLERANCE_PX ||
          fieldRect.top >= rect.bottom - CLIP_TOLERANCE_PX);

      if (outsideX || outsideY) {
        return "clipped outside a hidden-overflow container";
      }
    }

    return null;
  };

  // Walks ancestors because computed styles can conceal a field indirectly.
  const getStyleReason = (field, ancestors) => {
    for (const element of ancestors) {
      const style = getComputedStyle(element);

      if (element.hasAttribute("hidden")) {
        return "the hidden attribute";
      }

      if (style.display === "none") {
        return "display:none";
      }

      if (style.visibility === "hidden") {
        return "visibility:hidden";
      }

      if (Number(style.opacity) === 0) {
        return "opacity:0";
      }

      if (Number.parseFloat(style.fontSize) === 0) {
        return "font-size:0";
      }

      if (
        element.getAttribute("aria-hidden") === "true" &&
        field.tabIndex < 0
      ) {
        return "aria-hidden on a non-focusable field";
      }
    }

    return null;
  };

  // Returns the first strong invisibility signal or null for a visible element.
  const getInvisibleReason = (field) => {
    if (field.disabled) {
      return "the control is disabled";
    }

    if (field instanceof HTMLInputElement && field.type === "hidden") {
      return "the hidden input type";
    }

    const ancestors = [];
    let current = field;

    while (current instanceof Element) {
      ancestors.push(current);
      current = current.parentElement;
    }

    const styleReason = getStyleReason(field, ancestors);

    if (styleReason) {
      return styleReason;
    }

    const rect = field.getBoundingClientRect();

    if (rect.width <= NEAR_ZERO_PX || rect.height <= NEAR_ZERO_PX) {
      return "a near-zero rendered size";
    }

    if (
      rect.right < -FAR_OFFSCREEN_PX ||
      rect.bottom < -FAR_OFFSCREEN_PX ||
      rect.left > document.documentElement.scrollWidth + FAR_OFFSCREEN_PX
    ) {
      return "positioning far off-screen";
    }

    return getClippingReason(rect, ancestors.slice(1));
  };

  globalThis.AIFormFiller.visibility = Object.freeze({
    getInvisibleReason,
  });
})();
