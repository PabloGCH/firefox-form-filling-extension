/* Loads and edits one UTF-8 markdown information file in session memory. */

globalThis.AIFormFiller = globalThis.AIFormFiller || {};
globalThis.AIFormFiller.options = globalThis.AIFormFiller.options || {};

(() => {
  "use strict";

  const { INFO_EDIT_DELAY_MS, LARGE_FILE_BYTES, LARGE_FILE_WARNING } =
    globalThis.AIFormFiller.constants;
  let editTimer = null;

  // Updates the large-file warning from UTF-8 byte size, not character count.
  const renderSizeWarning = (text) => {
    const warning = document.querySelector("#info-warning");
    warning.hidden = new Blob([text]).size <= LARGE_FILE_BYTES;
    warning.textContent = warning.hidden ? "" : LARGE_FILE_WARNING;
  };

  // Reads bytes with FileReader so invalid UTF-8 can be rejected explicitly.
  const readUtf8File = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.addEventListener("load", () => {
        try {
          const decoder = new TextDecoder("utf-8", { fatal: true });
          resolve(decoder.decode(reader.result));
        } catch {
          reject(new Error("The markdown file is not valid UTF-8."));
        }
      });
      reader.addEventListener("error", () => {
        reject(new Error("The markdown file could not be read."));
      });
      reader.readAsArrayBuffer(file);
    });

  // Accepts markdown-like text files while rejecting other file types.
  const validateFileType = (file) => {
    const hasMarkdownName = file.name.toLowerCase().endsWith(".md");
    const hasTextType = !file.type || file.type.startsWith("text/");

    if (!hasMarkdownName || !hasTextType) {
      throw new Error("Choose a text file with a .md extension.");
    }
  };

  // Loads a replacement only after all local validation succeeds.
  const handleFile = async (event) => {
    const input = event.currentTarget;
    const file = input.files[0];

    if (!file) {
      return;
    }

    try {
      validateFileType(file);
      const text = await readUtf8File(file);
      await globalThis.AIFormFiller.optionsApp.send({
        type: "settings:set-info",
        fileName: file.name,
        text,
      });
      await globalThis.AIFormFiller.optionsApp.refresh();
      globalThis.AIFormFiller.optionsApp.showStatus("Information file loaded.");
    } catch (error) {
      input.value = "";
      globalThis.AIFormFiller.optionsApp.showStatus(error.message, true);
    }
  };

  // Debounces edits before replacing only the background page's memory copy.
  const handleTextEdit = (event) => {
    const text = event.currentTarget.value;
    clearTimeout(editTimer);
    editTimer = setTimeout(async () => {
      try {
        await globalThis.AIFormFiller.optionsApp.send({
          type: "settings:update-info",
          text,
        });
        document.querySelector("#info-count").textContent =
          ` — ${text.length.toLocaleString()} characters`;
        renderSizeWarning(text);
        globalThis.AIFormFiller.optionsApp.showStatus(
          "Session information updated.",
        );
      } catch (error) {
        globalThis.AIFormFiller.optionsApp.showStatus(error.message, true);
      }
    }, INFO_EDIT_DELAY_MS);
  };

  // Wires file replacement and in-session editing controls.
  const init = () => {
    document.querySelector("#info-file").addEventListener("change", handleFile);
    document.querySelector("#info-text").addEventListener("input", handleTextEdit);
  };

  // Reflects the current background-owned document in the editor.
  const render = (info) => {
    const empty = document.querySelector("#info-empty");
    const editor = document.querySelector("#info-editor");

    empty.hidden = Boolean(info);
    editor.hidden = !info;

    if (!info) {
      clearTimeout(editTimer);
      document.querySelector("#info-text").value = "";
      document.querySelector("#info-file").value = "";
      return;
    }

    document.querySelector("#info-name").textContent = info.fileName;
    document.querySelector("#info-count").textContent =
      ` — ${info.text.length.toLocaleString()} characters`;
    document.querySelector("#info-text").value = info.text;
    renderSizeWarning(info.text);
  };

  globalThis.AIFormFiller.options.markdownUpload = Object.freeze({ init, render });
})();
