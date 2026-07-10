"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const ROWS = ["A","B","C","D","E","F","G","H"];
  const COLS = Array.from({length:12}, (_,i) => String(i+1));
  const grid = document.getElementById("plateEditor");
  const raw = document.getElementById("platePaste");
  const pasteButton = document.getElementById("clipboardButton");
  const clearButton = document.getElementById("clearButton");
  let updateTimer;

  if (!grid || !raw) return;

  buildGrid();
  restoreGrid();
  wireGrid();
  watchPlateColours();

  function buildGrid() {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(header("↘", "editor-corner"));

    COLS.forEach(col => fragment.appendChild(header(col)));

    for (let row = 0; row < 8; row++) {
      fragment.appendChild(header(ROWS[row], "editor-row"));
      for (let col = 0; col < 12; col++) {
        const index = row * 12 + col;
        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 120;
        input.className = "plate-editor-input";
        input.dataset.index = String(index);
        input.autocomplete = "off";
        input.spellcheck = false;
        input.setAttribute("aria-label", `${ROWS[row]}${col+1} plate value`);
        fragment.appendChild(input);
      }
    }

    grid.replaceChildren(fragment);
  }

  function header(text, extra = "") {
    const node = document.createElement("div");
    node.className = `editor-head ${extra}`.trim();
    node.textContent = text;
    return node;
  }

  function inputs() {
    return [...grid.querySelectorAll(".plate-editor-input")];
  }

  function parseExcel(text) {
    if (!text.trim()) throw new Error("Copy an Excel plate range first.");
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    while (lines.length && lines.at(-1) === "") lines.pop();
    if (lines.length > 8) throw new Error(`Detected ${lines.length} rows. Paste no more than 8.`);

    return lines.map((line,row) => {
      const values = line.split("\t");
      if (values.length > 12) throw new Error(`Row ${row+1} has ${values.length} columns. Paste no more than 12.`);
      return values.map(value => String(value).replace(/^"|"$/g, "").trim().slice(0,120));
    });
  }

  function fill(matrix, startIndex = 0, clearFirst = false) {
    const startRow = Math.floor(startIndex / 12);
    const startCol = startIndex % 12;
    if (startRow + matrix.length > 8) throw new Error("The pasted block extends below row H.");
    if (matrix.some(row => startCol + row.length > 12)) throw new Error("The pasted block extends beyond column 12.");

    const wells = inputs();
    if (clearFirst) wells.forEach(input => input.value = "");
    matrix.forEach((row,r) => row.forEach((value,c) => {
      wells[(startRow+r)*12 + startCol+c].value = value;
    }));
  }

  function restoreGrid() {
    const wells = inputs();
    wells.forEach(input => input.value = "");
    if (!raw.value.trim()) return;
    try {
      fill(parseExcel(raw.value), 0, false);
    } catch {
      raw.value = "";
    }
  }

  function syncRaw() {
    const wells = inputs();
    raw.value = Array.from({length:8}, (_,row) =>
      Array.from({length:12}, (_,col) => wells[row*12+col].value).join("\t")
    ).join("\n");
    raw.dispatchEvent(new Event("input", {bubbles:true}));
  }

  function refreshPreview() {
    syncRaw();
    if (typeof window.parseDraft === "function") window.parseDraft(true);
    recolourPlate();
  }

  function scheduleRefresh() {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(refreshPreview, 120);
  }

  function wireGrid() {
    grid.addEventListener("input", scheduleRefresh);

    grid.addEventListener("paste", event => {
      const text = event.clipboardData?.getData("text/plain");
      if (!text || (!text.includes("\t") && !/[\r\n]/.test(text))) return;

      event.preventDefault();
      try {
        const matrix = parseExcel(text);
        const startIndex = Number(event.target.closest(".plate-editor-input")?.dataset.index || 0);
        fill(matrix, startIndex, false);
        refreshPreview();
        notify(`Pasted ${matrix.length} × ${Math.max(...matrix.map(row => row.length))} block into the grid.`);
      } catch (error) {
        notify(error.message, true);
      }
    });

    grid.addEventListener("keydown", event => {
      const input = event.target.closest(".plate-editor-input");
      if (!input) return;
      const index = Number(input.dataset.index);
      let next = null;
      if (event.key === "ArrowLeft") next = index - 1;
      if (event.key === "ArrowRight") next = index + 1;
      if (event.key === "ArrowUp") next = index - 12;
      if (event.key === "ArrowDown" || event.key === "Enter") next = index + 12;
      if (next === null || next < 0 || next >= 96) return;
      event.preventDefault();
      const target = grid.querySelector(`[data-index="${next}"]`);
      target?.focus();
      target?.select();
    });

    pasteButton.onclick = async () => {
      try {
        const text = await navigator.clipboard.readText();
        const matrix = parseExcel(text);
        fill(matrix, 0, true);
        refreshPreview();
        notify(`Loaded ${matrix.length} × ${Math.max(...matrix.map(row => row.length))} Excel block.`);
      } catch {
        notify("Clipboard access was blocked. Click A1 and paste manually.", true);
        grid.querySelector('[data-index="0"]')?.focus();
      }
    };

    clearButton.onclick = () => {
      const hasContent = inputs().some(input => input.value.trim());
      if (hasContent && !confirm("Clear the current plate draft?")) return;
      inputs().forEach(input => input.value = "");
      raw.value = "";
      if (typeof window.clearDraft === "function") window.clearDraft();
    };
  }

  function notify(message, bad = false) {
    if (typeof window.toast === "function") window.toast(message, bad);
  }

  function watchPlateColours() {
    const observer = new MutationObserver(recolourPlate);
    observer.observe(document.body, {childList:true, subtree:true, characterData:true});
    recolourPlate();
  }

  function recolourPlate() {
    document.querySelectorAll(".value,.touch-value").forEach(node => {
      const value = node.textContent.trim().toLowerCase();
      node.style.color = value === "buffer"
        ? "#00d4ff"
        : value === "regen"
          ? "#ff00ff"
          : "#d7d9e0";
    });
  }
});
