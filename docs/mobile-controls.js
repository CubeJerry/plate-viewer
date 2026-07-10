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
    const shouldCollapse = Boolean(collapsed && mobileQuery.matches);

    controls.classList.toggle("is-collapsed", shouldCollapse);
    document.body.classList.toggle("viewer-chrome-collapsed", shouldCollapse);
    controls.dataset.collapsed = String(shouldCollapse);

    button.textContent = shouldCollapse ? "⌄" : "⌃";
    button.setAttribute("aria-expanded", String(!shouldCollapse));
    button.setAttribute("aria-pressed", String(shouldCollapse));
    button.setAttribute("aria-label", shouldCollapse ? "Show checklist controls" : "Hide checklist controls");
    button.title = shouldCollapse ? "Show checklist controls" : "Hide checklist controls";

    if (persist) {
      localStorage.setItem(storageKey, shouldCollapse ? "1" : "0");
    }
  }

  apply(localStorage.getItem(storageKey) === "1", false);

  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    apply(!controls.classList.contains("is-collapsed"));
    button.blur();
  });

  mobileQuery.addEventListener?.("change", event => {
    if (event.matches) {
      apply(localStorage.getItem(storageKey) === "1", false);
    } else {
      apply(false, false);
    }
  });
});
