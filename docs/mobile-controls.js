"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("collapseControlsButton");
  const controls = button?.closest(".viewer-controls");
  const viewerRequested = new URLSearchParams(location.search).has("plate");
  const mobileQuery = matchMedia("(max-width: 960px)");
  const storageKey = "plate-viewer:controls-collapsed";

  if (!button || !controls) return;

  if (!viewerRequested) {
    button.hidden = true;
    return;
  }

  function apply(collapsed, persist = true) {
    controls.classList.toggle("is-collapsed", collapsed);
    document.body.classList.toggle("viewer-chrome-collapsed", collapsed);
    button.textContent = collapsed ? "⌄" : "⌃";
    button.setAttribute("aria-expanded", String(!collapsed));
    button.setAttribute("aria-label", collapsed ? "Show checklist controls" : "Hide checklist controls");
    button.title = collapsed ? "Show checklist controls" : "Hide checklist controls";

    if (persist) {
      localStorage.setItem(storageKey, collapsed ? "1" : "0");
    }
  }

  apply(mobileQuery.matches && localStorage.getItem(storageKey) === "1", false);

  button.addEventListener("click", () => {
    apply(!controls.classList.contains("is-collapsed"));
  });

  mobileQuery.addEventListener?.("change", event => {
    if (event.matches) {
      apply(localStorage.getItem(storageKey) === "1", false);
    } else {
      controls.classList.remove("is-collapsed");
      document.body.classList.remove("viewer-chrome-collapsed");
      button.textContent = "⌃";
      button.setAttribute("aria-expanded", "true");
      button.setAttribute("aria-label", "Hide checklist controls");
      button.title = "Hide checklist controls";
    }
  });
});
