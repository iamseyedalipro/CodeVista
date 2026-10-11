import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";
const key = "codevista-theme";
let preference: Theme = "system";
const listeners = new Set<() => void>();
const system = window.matchMedia("(prefers-color-scheme: dark)");
function normalize(value: string | null): Theme {
  return value === "light" || value === "dark" ? value : "system";
}
function apply() {
  document.documentElement.dataset.theme =
    preference === "system" ? (system.matches ? "dark" : "light") : preference;
  listeners.forEach((listener) => listener());
}
export function initializeTheme() {
  try {
    preference = normalize(localStorage.getItem(key));
  } catch {
    /* Storage is optional. */
  }
  apply();
  system.addEventListener("change", apply);
  window.addEventListener("storage", (event) => {
    if (event.key === key || event.key === null) {
      preference = normalize(event.newValue);
      apply();
    }
  });
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function ThemePicker() {
  const value = useSyncExternalStore(subscribe, () => preference);
  return (
    <select
      aria-label="Color theme"
      value={value}
      onChange={(event) => {
        preference = normalize(event.target.value);
        try {
          localStorage.setItem(key, preference);
        } catch {
          /* Keep the choice for this page. */
        }
        apply();
      }}
    >
      <option value="system">System theme</option>
      <option value="light">Light mode</option>
      <option value="dark">Dark mode</option>
    </select>
  );
}
