(function () {
  "use strict";

  var STORAGE_KEY = "theme";
  var root = document.documentElement;
  var toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  var darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function systemTheme() {
    return darkQuery.matches ? "dark" : "light";
  }

  function currentTheme() {
    var stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : systemTheme();
  }

  // The button is a plain action button whose label names what a click
  // will do ("Dark mode" while light, "Light mode" while dark). It isn't
  // an aria-pressed toggle: that pattern needs a fixed label, and mixing
  // the two leaves screen readers announcing a contradictory state.
  function render(theme) {
    toggle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  }

  toggle.addEventListener("click", function () {
    var next = currentTheme() === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    root.setAttribute("data-theme", next);
    render(next);
  });

  // With no stored override the page follows the OS, so the button label
  // has to follow OS changes too. (addListener is the pre-2020 Safari
  // spelling of addEventListener on MediaQueryList.)
  function onSystemChange() {
    render(currentTheme());
  }
  if (darkQuery.addEventListener) {
    darkQuery.addEventListener("change", onSystemChange);
  } else if (darkQuery.addListener) {
    darkQuery.addListener(onSystemChange);
  }

  render(currentTheme());
})();
