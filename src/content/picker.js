/* Lets the user select and later re-find a container without page clicks escaping. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};

(() => {
  "use strict";

  let selectedElement = null;
  let selectedLocator = null;
  let selectedStyle = null;
  let cancelActivePicker = null;

  // Saves only inline properties the picker temporarily changes.
  const readOutlineStyle = (element) => ({
    outline: element.style.getPropertyValue("outline"),
    outlinePriority: element.style.getPropertyPriority("outline"),
    outlineOffset: element.style.getPropertyValue("outline-offset"),
    outlineOffsetPriority: element.style.getPropertyPriority("outline-offset"),
  });

  // Restores exact inline outline values and priorities.
  const restoreOutline = (element, style) => {
    element.style.setProperty("outline", style.outline, style.outlinePriority);
    element.style.setProperty(
      "outline-offset",
      style.outlineOffset,
      style.outlineOffsetPriority,
    );
  };

  // Applies a picker outline with enough priority to remain visible.
  const applyOutline = (element, kind) => {
    const line = kind === "selected" ? "3px solid #1769aa" : "2px dashed #d9480f";
    element.style.setProperty("outline", line, "important");
    element.style.setProperty("outline-offset", "2px", "important");
  };

  // Stores a stable-enough locator for common framework replacements.
  const createLocator = (element) => {
    if (element.id) {
      return { id: element.id };
    }

    const matches = [...document.querySelectorAll(element.localName)];
    return { tag: element.localName, index: matches.indexOf(element) };
  };

  // Resolves an ID first or a documented tag-and-position fallback.
  const resolveLocator = (locator) => {
    if (locator.id) {
      return document.getElementById(locator.id);
    }

    return document.querySelectorAll(locator.tag)[locator.index] || null;
  };

  // Clears the solid selection while restoring the page's inline style.
  const clear = () => {
    cancelActivePicker?.();

    if (selectedElement && selectedStyle) {
      restoreOutline(selectedElement, selectedStyle);
    }

    selectedElement = null;
    selectedLocator = null;
    selectedStyle = null;
  };

  // Commits one element and keeps its solid outline until clear or reselection.
  const commitSelection = (element) => {
    if (selectedElement && selectedStyle) {
      restoreOutline(selectedElement, selectedStyle);
    }

    selectedElement = element;
    selectedLocator = createLocator(element);
    selectedStyle = readOutlineStyle(element);
    applyOutline(element, "selected");
  };

  // Re-finds a selected element after a DOM replacement or reports failure.
  const getScope = () => {
    if (!selectedLocator) {
      return { missing: false, scope: null, selected: false };
    }

    if (selectedElement?.isConnected) {
      return { missing: false, scope: selectedElement, selected: true };
    }

    const replacement = resolveLocator(selectedLocator);

    if (!replacement) {
      return { missing: true, scope: null, selected: true };
    }

    selectedElement = replacement;
    applyOutline(replacement, "selected");
    return { missing: false, scope: replacement, selected: true };
  };

  // Runs a capture-phase picker and blocks its selection click from the page.
  const select = () => {
    cancelActivePicker?.();

    return new Promise((resolve) => {
      let candidate = null;
      let candidateStyle = null;
      const narrowerHistory = [];

      // Restores the temporary dashed outline without losing a solid selection.
      const restoreCandidate = () => {
        if (!candidate || !candidateStyle) {
          return;
        }

        if (candidate === selectedElement) {
          applyOutline(candidate, "selected");
        } else {
          restoreOutline(candidate, candidateStyle);
        }
      };

      // Moves the dashed outline to a page element outside the extension host.
      const setCandidate = (element) => {
        if (!element || element.id === "ai-form-filler-panel-host") {
          return;
        }

        restoreCandidate();
        candidate = element;
        candidateStyle = readOutlineStyle(element);
        applyOutline(element, "candidate");
      };

      // Removes capture listeners before resolving selection or cancellation.
      const finish = (element) => {
        restoreCandidate();
        document.removeEventListener("mouseover", handleHover, true);
        document.removeEventListener("click", handleClick, true);
        document.removeEventListener("keydown", handleKeydown, true);
        cancelActivePicker = null;

        if (element) {
          commitSelection(element);
        }

        resolve(element);
      };

      // Tracks the deepest element currently under the pointer.
      const handleHover = (event) => {
        const target = event.target;

        if (target instanceof Element) {
          narrowerHistory.length = 0;
          setCandidate(target);
        }
      };

      // Captures selection before the page can react to the click.
      const handleClick = (event) => {
        if (event.target?.id === "ai-form-filler-panel-host") {
          return;
        }

        if (!candidate) {
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        finish(candidate);
      };

      // Supports cancellation plus reversible parent widening.
      const handleKeydown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          finish(null);
        } else if (event.key === "ArrowUp" && candidate?.parentElement) {
          event.preventDefault();
          narrowerHistory.push(candidate);
          setCandidate(candidate.parentElement);
        } else if (event.key === "ArrowDown" && narrowerHistory.length > 0) {
          event.preventDefault();
          setCandidate(narrowerHistory.pop());
        }
      };

      document.addEventListener("mouseover", handleHover, true);
      document.addEventListener("click", handleClick, true);
      document.addEventListener("keydown", handleKeydown, true);
      cancelActivePicker = () => finish(null);
    });
  };

  globalThis.AIFormFiller.picker = Object.freeze({ clear, getScope, select });
})();
