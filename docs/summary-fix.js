"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("plateEditor");
  const summary = document.getElementById("pasteSummary");
  const updateButton = document.getElementById("parseButton");

  if (!grid || !summary) return;

  function updateSummary() {
    const inputs = [...grid.querySelectorAll(".plate-editor-input")];
    const used = inputs
      .map((input, index) => ({ value: input.value.trim(), row: Math.floor(index / 12), col: index % 12 }))
      .filter(cell => cell.value);

    if (!used.length) {
      summary.textContent = "Awaiting plate data.";
      summary.className = "helper";
      return;
    }

    const populatedRows = new Set(used.map(cell => cell.row)).size;
    const furthestColumn = Math.max(...used.map(cell => cell.col)) + 1;
    summary.textContent = `${populatedRows} populated row${populatedRows === 1 ? "" : "s"}; furthest used column ${furthestColumn}.`;
    summary.className = "helper success";
  }

  grid.addEventListener("input", () => setTimeout(updateSummary, 180));
  grid.addEventListener("paste", () => setTimeout(updateSummary, 220));
  updateButton?.addEventListener("click", () => setTimeout(updateSummary, 0));

  setTimeout(updateSummary, 250);
});
