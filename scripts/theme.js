// theme.js
const KEY = "profile-theme";

/** Register available themes in one place */
export const THEMES = [
  { id: "system", label: "System" },          // resolves via matchMedia
  { id: "light",  label: "Light"  },
  { id: "dark",   label: "Dark"   },
  { id: "solarized", label: "Solarized" },    // future
  { id: "hc",     label: "High contrast" },   // future
];

const mql = window.matchMedia("(prefers-color-scheme: dark)");

export function getTheme() {
  return localStorage.getItem(KEY) || "system";
}
export function setTheme(id) {
  const exists = THEMES.some(t => t.id === id);
  const next = exists ? id : "system";
  localStorage.setItem(KEY, next);
  applyTheme(next);
}

export function applyTheme(id = getTheme()) {
  const html = document.documentElement;
  if (id === "system") {
    // reflect system as data-theme for your CSS
    html.setAttribute("data-theme", mql.matches ? "dark" : "light");
    html.setAttribute("data-bs-theme", mql.matches ? "dark" : "light");
  } else {
    html.setAttribute("data-theme", id);
    html.setAttribute("data-bs-theme", id === "hc" ? "dark" : id); // map if needed
  }
  // optional: announce to AT
  const live = document.getElementById("themeLive") || Object.assign(document.body.appendChild(document.createElement("div")), { id:"themeLive", className:"visually-hidden", role:"status","aria-live":"polite" });
  live.textContent = `Theme: ${id}`;
}

export function cycleTheme() {
  const ids = THEMES.map(t => t.id);
  const cur = getTheme();
  const i = ids.indexOf(cur);
  setTheme(ids[(i + 1) % ids.length]);
}

(function early(){ try{ applyTheme(getTheme()); }catch{} })();

export function bootTheme() {
  // bind buttons
  document.getElementById("themeToggle")?.addEventListener("click", cycleTheme);
  document.querySelectorAll("[data-theme]").forEach(btn => {
    btn.addEventListener("click", () => setTheme(btn.getAttribute("data-theme")));
  });
  // keep “system” live
  mql.addEventListener("change", () => { if (getTheme()==="system") applyTheme("system"); });
  applyTheme();
}

// in theme.js
export function renderThemeMenu(containerSelector = "[data-theme-menu]") {
  const host = document.querySelector(containerSelector);
  if (!host) return;
  host.innerHTML = ""; // clear any static stuff

  const grp = document.createElement("div");
  grp.className = "btn-group btn-group-sm";

  THEMES.forEach(t => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-outline-secondary";
    b.textContent = t.label;
    b.setAttribute("data-theme", t.id);
    grp.appendChild(b);
  });

  host.appendChild(grp);

  // wire clicks
  grp.querySelectorAll("[data-theme]").forEach(btn => {
    btn.addEventListener("click", () => setTheme(btn.getAttribute("data-theme")));
  });
}

