// ---- config ----
const DATA_URL = "data/colors.json";

// ---- utilities ----
const slugify = (str) =>
  String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const escapeHTML = (value = "") =>
  String(value).replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  }[char]));

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
const normalize = (value = "") => String(value).trim().toLowerCase();

function showToast(message) {
  const toastEl = document.getElementById("liveToast");
  if (!toastEl) return;
  const body = toastEl.querySelector(".toast-body");
  if (body) body.textContent = message;
  if (window.bootstrap) bootstrap.Toast.getOrCreateInstance(toastEl).show();
}

// ---- OWNED (Inventory -> My Filaments) ----
const KEY_OWNED = "filament-owned";

const getOwned = () => {
  try { return JSON.parse(localStorage.getItem(KEY_OWNED) || "[]"); }
  catch { return []; }
};
const setOwned = (arr) => localStorage.setItem(KEY_OWNED, JSON.stringify(arr));

function normalizeOwnedItem(item) {
  const amount = Number(item.amount || 0);
  return {
    ...item,
    amount,
    spoolSizeKey: item.spoolSizeKey || "1000g",
    startingWeight: Math.max(Number(item.startingWeight || 0), amount, 1000),
    usage: Array.isArray(item.usage) ? item.usage : [],
  };
}

function addOwned(item) {
  const list = getOwned();
  const nextItem = normalizeOwnedItem(item);
  const idx = list.findIndex(x => x.id === nextItem.id);
  if (idx >= 0) {
    const nextAmount = Number(list[idx].amount || 0) + Number(nextItem.amount || 0);
    list[idx] = normalizeOwnedItem({
      ...list[idx],
      rolls: Number(list[idx].rolls || 0) + Number(nextItem.rolls || 1),
      amount: nextAmount,
      startingWeight: Math.max(Number(list[idx].startingWeight || 0), nextAmount),
    });
  } else {
    list.push(nextItem);
  }
  setOwned(list);
  return list;
}

function ownedSummary(id) {
  const item = getOwned().find(x => x.id === id);
  if (!item) return { owned: false, rolls: 0, amount: 0 };
  return {
    owned: true,
    rolls: Number(item.rolls || 0),
    amount: Number(item.amount || 0),
  };
}

function statusText(summary) {
  if (!summary.owned) return "Not in inventory";
  return `${plural(summary.rolls, "roll")} owned`;
}

// ---- favorites (shared with inventory) ----
const KEY_FAVS = "filament-favorites";

const getFavorites = () => {
  try { return JSON.parse(localStorage.getItem(KEY_FAVS) || "[]"); }
  catch { return []; }
};
const setFavorites = (arr) => localStorage.setItem(KEY_FAVS, JSON.stringify(arr));
const isFavorite = (id) => getFavorites().some(f => f.id === id);

// ---- activity (shared with inventory) ----
const KEY_ACT = "profile-activity";
const actUid = () => Math.random().toString(36).slice(2, 10);
function addActivity(type, payload) {
  const max = 200;
  let list = [];
  try { list = JSON.parse(localStorage.getItem(KEY_ACT) || "[]"); } catch { }
  list = [{ id: `evt_${actUid()}`, ts: Date.now(), type, payload }, ...list].slice(0, max);
  localStorage.setItem(KEY_ACT, JSON.stringify(list));
}

function toggleFavorite(item) {
  const favs = getFavorites();
  const idx = favs.findIndex(f => f.id === item.id);
  if (idx >= 0) {
    favs.splice(idx, 1);
  } else {
    favs.push(item);
  }
  setFavorites(favs);
  return isFavorite(item.id);
}

// ---- catalog state ----
const state = {
  allItems: [],
  material: "all",
  quick: "all",
  query: "",
  sort: "color",
};

const els = {
  grid: document.getElementById("catalogGrid"),
  summary: document.getElementById("catalogSummary"),
  search: document.getElementById("catalogSearch"),
  clear: document.getElementById("catalogClear"),
  material: document.getElementById("materialFilter"),
  sort: document.getElementById("catalogSort"),
  quickButtons: Array.from(document.querySelectorAll("[data-quick-filter]")),
};

function flattenCatalog(categories = {}) {
  return Object.entries(categories).flatMap(([category, items]) =>
    (items || []).map((it) => ({
      id: slugify(`${category}-${it.color}`),
      color: it.color || "Unnamed",
      hex: it.hex || "#eeeeee",
      brand: it.brand || "",
      material: category,
      rolls: Number(it.rolls ?? 1),
      amount: Number(it.amount ?? 0),
      spoolSizeKey: "1000g",
      startingWeight: Math.max(Number(it.amount ?? 0), 1000),
      usage: [],
    }))
  );
}

function populateMaterialFilter(items) {
  if (!els.material) return;
  const materials = Array.from(new Set(items.map(it => it.material))).sort((a, b) => a.localeCompare(b));
  els.material.innerHTML = '<option value="all">All Materials</option>' + materials.map((material) =>
    `<option value="${escapeHTML(material)}">${escapeHTML(material)}</option>`
  ).join("");
}

function getCatalogStats(view) {
  const total = state.allItems.length;
  const owned = state.allItems.filter(it => ownedSummary(it.id).owned).length;
  const favorites = state.allItems.filter(it => isFavorite(it.id)).length;
  return { total, owned, favorites, shown: view.length };
}

function updateSummary(view) {
  if (!els.summary) return;
  const stats = getCatalogStats(view);
  els.summary.textContent = `${stats.total} colors | ${stats.owned} owned | ${stats.favorites} favorites | ${stats.shown} shown`;
}

function updateQuickButtons() {
  els.quickButtons.forEach((btn) => {
    const active = btn.dataset.quickFilter === state.quick;
    btn.setAttribute("aria-pressed", active ? "true" : "false");
    btn.classList.toggle("btn-primary", active);
    btn.classList.toggle("btn-outline-secondary", !active);
  });
}

function filterItems() {
  const q = normalize(state.query);
  const selectedMaterial = state.material;

  return state.allItems.filter((item) => {
    const summary = ownedSummary(item.id);
    const favorite = isFavorite(item.id);
    const materialNorm = normalize(item.material);

    if (selectedMaterial !== "all" && item.material !== selectedMaterial) return false;
    if (state.quick === "favorites" && !favorite) return false;
    if (state.quick === "owned" && !summary.owned) return false;
    if (state.quick === "not-owned" && summary.owned) return false;
    if (state.quick === "PLA" && !materialNorm.includes("pla")) return false;
    if (state.quick === "PETG" && !materialNorm.includes("petg")) return false;

    if (!q) return true;
    return [item.color, item.material, item.brand].some(value => normalize(value).includes(q));
  });
}

function sortItems(items) {
  const view = [...items];
  view.sort((a, b) => {
    const favA = isFavorite(a.id) ? 1 : 0;
    const favB = isFavorite(b.id) ? 1 : 0;
    const ownedA = ownedSummary(a.id).owned ? 1 : 0;
    const ownedB = ownedSummary(b.id).owned ? 1 : 0;

    if (state.sort === "favorites" && favA !== favB) return favB - favA;
    if (state.sort === "owned" && ownedA !== ownedB) return ownedB - ownedA;
    if (state.sort === "not-owned" && ownedA !== ownedB) return ownedA - ownedB;
    if (state.sort === "material") {
      const materialCompare = a.material.localeCompare(b.material);
      if (materialCompare !== 0) return materialCompare;
    }

    const colorCompare = a.color.localeCompare(b.color);
    if (colorCompare !== 0) return colorCompare;
    return a.material.localeCompare(b.material);
  });
  return view;
}

function cardHTML(item) {
  const active = isFavorite(item.id);
  const summary = ownedSummary(item.id);
  const color = escapeHTML(item.color);
  const material = escapeHTML(item.material);
  const brand = escapeHTML(item.brand);
  const hex = escapeHTML(item.hex);
  const favoriteLabel = active ? `Remove ${item.color} from favorites` : `Add ${item.color} to favorites`;
  const addLabel = summary.owned ? `Add another roll of ${item.color}` : `Add ${item.color} to inventory`;

  return `
    <div class="col-sm-6 col-lg-4">
      <div class="card catalog-card h-100" data-owned-card="${escapeHTML(item.id)}">
        <div class="card-body d-flex gap-3 align-items-start">
          <div class="catalog-swatch" style="background:${hex};" aria-hidden="true"></div>
          <div class="flex-grow-1 min-width-0">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div class="min-width-0">
                <div class="fw-semibold text-truncate">${color}</div>
                <div class="text-secondary small">${material}</div>
                ${brand ? `<div class="text-secondary small">${brand}</div>` : ""}
                <div class="text-secondary small">${plural(item.rolls, "roll")} - ${item.amount.toLocaleString()}g</div>
              </div>

              <button
                class="btn btn-link p-0 fav-btn icon-button"
                data-fav-id="${escapeHTML(item.id)}"
                data-fav-color="${color}"
                data-fav-hex="${hex}"
                data-fav-category="${material}"
                data-fav-rolls="${item.rolls}"
                data-fav-amount="${item.amount}"
                aria-pressed="${active ? "true" : "false"}"
                aria-label="${escapeHTML(favoriteLabel)}"
                title="${escapeHTML(favoriteLabel)}"
                type="button"
              >
                <i class="${active ? "fa-solid" : "fa-regular"} fa-star ${active ? "text-warning" : "text-secondary"}" aria-hidden="true"></i>
              </button>
            </div>

            <div class="d-flex flex-wrap align-items-center gap-2 mt-3">
              <button
                class="btn btn-sm ${summary.owned ? "btn-outline-success" : "btn-success"} owned-add"
                data-owned-id="${escapeHTML(item.id)}"
                data-owned-color="${color}"
                data-owned-hex="${hex}"
                data-owned-category="${material}"
                data-owned-rolls="${item.rolls}"
                data-owned-amount="${item.amount}"
                aria-label="${escapeHTML(addLabel)}"
                type="button"
              >${summary.owned ? "+1 Roll" : "Add to Inventory"}</button>
              <span class="inventory-status badge ${summary.owned ? "text-bg-success" : "text-bg-light"}">${statusText(summary)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function emptyStateHTML() {
  const hasFilters = state.query || state.material !== "all" || state.quick !== "all";
  return `
    <div class="col-12">
      <div class="empty-state text-center">
        <div class="fw-semibold">${hasFilters ? "No catalog matches." : "No catalog colors yet."}</div>
        <div class="text-secondary small">${hasFilters ? "Try a different search, material, or quick filter." : "Add colors to data/colors.json when ready."}</div>
      </div>
    </div>`;
}

function renderCatalog() {
  if (!els.grid) return;
  const view = sortItems(filterItems());
  els.grid.innerHTML = view.length ? view.map(cardHTML).join("") : emptyStateHTML();
  updateSummary(view);
  updateQuickButtons();
}

function flashCatalogCard(id) {
  window.requestAnimationFrame(() => {
    const card = document.querySelector(`[data-owned-card="${CSS.escape(id)}"]`);
    if (!card) return;
    card.classList.add("is-updated");
    setTimeout(() => card.classList.remove("is-updated"), 900);
  });
}

function resetFilters({ clearSearch = false } = {}) {
  state.material = "all";
  state.quick = "all";
  if (clearSearch) state.query = "";
  if (els.material) els.material.value = "all";
  if (els.search && clearSearch) els.search.value = "";
}

// ---- events ----
document.addEventListener("click", (e) => {
  const quick = e.target.closest("[data-quick-filter]");
  if (quick) {
    const value = quick.dataset.quickFilter;
    if (value === "all") {
      resetFilters();
    } else {
      state.quick = value;
      if (value === "PLA" || value === "PETG") {
        state.material = "all";
        if (els.material) els.material.value = "all";
      }
    }
    renderCatalog();
    return;
  }

  const favBtn = e.target.closest(".fav-btn");
  if (favBtn) {
    const item = {
      id: favBtn.dataset.favId,
      color: favBtn.dataset.favColor,
      hex: favBtn.dataset.favHex,
      category: favBtn.dataset.favCategory,
      rolls: Number(favBtn.dataset.favRolls || 0),
      amount: Number(favBtn.dataset.favAmount || 0),
    };

    const nowFav = toggleFavorite(item);
    addActivity(nowFav ? "favorite:add" : "favorite:remove", {
      id: item.id,
      color: item.color,
      category: item.category,
      hex: item.hex
    });

    showToast(nowFav ? `${item.color} added to favorites.` : `${item.color} removed from favorites.`);
    renderCatalog();
    flashCatalogCard(item.id);
    return;
  }

  const addBtn = e.target.closest(".owned-add");
  if (addBtn) {
    const item = {
      id: addBtn.dataset.ownedId,
      color: addBtn.dataset.ownedColor,
      hex: addBtn.dataset.ownedHex,
      brand: "",
      material: addBtn.dataset.ownedCategory || "",
      rolls: Number(addBtn.dataset.ownedRolls || 1),
      amount: Number(addBtn.dataset.ownedAmount || 0),
      spoolSizeKey: "1000g",
      startingWeight: Math.max(Number(addBtn.dataset.ownedAmount || 0), 1000),
      usage: [],
    };

    addOwned(item);
    addActivity("owned:add", {
      id: item.id,
      color: item.color,
      brand: item.brand || "",
      material: item.material || item.category || "",
      hex: item.hex
    });

    showToast(`${item.color} added to Inventory.`);
    renderCatalog();
    flashCatalogCard(item.id);
  }
});

els.search?.addEventListener("input", (e) => {
  state.query = e.target.value;
  renderCatalog();
});

els.clear?.addEventListener("click", () => {
  resetFilters({ clearSearch: true });
  state.sort = "color";
  if (els.sort) els.sort.value = "color";
  renderCatalog();
});

els.material?.addEventListener("change", (e) => {
  state.material = e.target.value;
  if (state.material !== "all" && (state.quick === "PLA" || state.quick === "PETG")) {
    state.quick = "all";
  }
  renderCatalog();
});

els.sort?.addEventListener("change", (e) => {
  state.sort = e.target.value;
  renderCatalog();
});

// ---- boot ----
(async () => {
  try {
    const res = await fetch(DATA_URL);
    const data = await res.json();
    const titles = Object.keys(data?.categories ?? {});
    localStorage.setItem("filament-material-options", JSON.stringify(titles));
    state.allItems = flattenCatalog(data.categories || {});
    populateMaterialFilter(state.allItems);
    renderCatalog();
  } catch (err) {
    console.error("Failed loading data:", err);
    if (els.grid) {
      els.grid.innerHTML = `<div class="col-12"><div class="alert alert-danger">Could not load filament categories.</div></div>`;
    }
    if (els.summary) els.summary.textContent = "Catalog unavailable";
  }
})();