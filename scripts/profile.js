/* Inventory page: My Filaments + Activity + Favorites */

const KEY_FAVS = "filament-favorites";
const KEY_OWNED = "filament-owned";
const KEY_ACT = "profile-activity";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const setText = (sel, value) => {
  const el = $(sel);
  if (el) el.textContent = value;
};

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const uid = () => Math.random().toString(36).slice(2, 10);
const actUid = () => Math.random().toString(36).slice(2, 10);
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
const escapeHTML = (value = "") =>
  String(value).replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  }[char]));

function showToast(message) {
  const toastEl = document.getElementById("liveToast");
  if (!toastEl) return;
  const body = toastEl.querySelector(".toast-body");
  if (body) body.textContent = message;
  if (window.bootstrap) bootstrap.Toast.getOrCreateInstance(toastEl).show();
}

/* ---------- stores ---------- */
const getFavorites = () => {
  try { return JSON.parse(localStorage.getItem(KEY_FAVS) || "[]"); }
  catch { return []; }
};
const setFavorites = (arr) => localStorage.setItem(KEY_FAVS, JSON.stringify(arr));

const getOwned = () => {
  try { return JSON.parse(localStorage.getItem(KEY_OWNED) || "[]"); }
  catch { return []; }
};
const setOwned = (arr) => localStorage.setItem(KEY_OWNED, JSON.stringify(arr));

const getActivity = () => {
  try { return JSON.parse(localStorage.getItem(KEY_ACT) || "[]"); }
  catch { return []; }
};
const setActivity = (arr) => localStorage.setItem(KEY_ACT, JSON.stringify(arr));

function addActivity(type, payload) {
  const max = 200;
  const next = [{ id: `evt_${actUid()}`, ts: Date.now(), type, payload }, ...getActivity()].slice(0, max);
  setActivity(next);
  renderActivity();
}

/* ---------- activity ---------- */
const timeAgo = (t) => {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return `${d}d ago`;
};

function gramChange(p) {
  if (Number.isFinite(Number(p.before)) && Number.isFinite(Number(p.after))) {
    return ` <span class="text-secondary">${Number(p.before).toLocaleString()}g to ${Number(p.after).toLocaleString()}g</span>`;
  }
  return "";
}

function labelFor(evt) {
  const p = evt.payload || {};
  const color = p.color ? `<strong>${escapeHTML(p.color)}</strong>` : "item";
  const cat = escapeHTML(p.category || p.material || p.brand || "");
  const badge = cat ? ` <span class="text-secondary">(${cat})</span>` : "";

  switch (evt.type) {
    case "favorite:add": return `Favorited ${color}${badge}`;
    case "favorite:remove": return `Unfavorited ${color}${badge}`;
    case "owned:add": return `Added ${color}${badge} to Inventory`;
    case "owned:edit": return `Edited ${color}${badge}`;
    case "owned:delete": return `Deleted ${color}${badge}`;
    case "owned:use": return `Used <strong>${Math.abs(p.deltaGrams || 0)}g</strong> from ${color}${badge}${gramChange(p)}`;
    case "rolls:inc": return `Increased ${color}${badge} from ${Number(p.before || 0)} to ${Number(p.after || 0)} rolls`;
    case "rolls:dec": return `Decreased ${color}${badge} from ${Number(p.before || 0)} to ${Number(p.after || 0)} rolls`;
    case "undo": return `Undo: ${escapeHTML(p.note || "last change")}${gramChange(p)}`;
    default: return escapeHTML(evt.type);
  }
}

function updateActivityControls() {
  const btn = document.getElementById("clearActivity");
  if (!btn) return;
  const count = getActivity().length;
  btn.disabled = count === 0;
  btn.setAttribute("aria-disabled", count === 0 ? "true" : "false");
}

function renderActivity() {
  const list = $("#activityList");
  if (!list) return;
  const items = getActivity();
  list.innerHTML = items.slice(0, 30).map(evt => `
    <li class="list-group-item d-flex justify-content-between gap-3">
      <span>${labelFor(evt)}</span>
      <span class="text-secondary small text-nowrap">${timeAgo(evt.ts)}</span>
    </li>`).join("") || `
    <li class="list-group-item empty-state text-center">
      <div class="fw-semibold">No activity yet.</div>
      <div class="text-secondary small">Inventory changes will appear here.</div>
    </li>`;
  updateActivityControls();
}

function clearActivity() {
  setActivity([]);
  renderActivity();
  showToast("Activity cleared.");
}

window.addEventListener("storage", (e) => {
  if (e.key === KEY_ACT) renderActivity();
});

/* ---------- statuses + totals ---------- */
function statusFor(amount) {
  const grams = Number(amount || 0);
  if (grams <= 0) return { key: "out", label: "Out", rank: 0 };
  if (grams < 250) return { key: "low", label: "Low", rank: 1 };
  if (grams <= 700) return { key: "partial", label: "Partial", rank: 2 };
  return { key: "full", label: "Full", rank: 3 };
}

function renderOwnedTotals(items) {
  const stats = items.reduce(
    (acc, it) => {
      const amount = Number(it.amount || 0);
      const status = statusFor(amount);
      acc.colors += 1;
      acc.rolls += Number(it.rolls || 0);
      acc.weight += amount;
      if (status.key === "low") acc.low += 1;
      if (status.key === "out") acc.out += 1;
      return acc;
    },
    { colors: 0, rolls: 0, weight: 0, low: 0, out: 0 }
  );

  setText("#ownedColors", stats.colors);
  setText("#ownedRolls", stats.rolls);
  setText("#ownedWeight", `${stats.weight.toLocaleString()} g`);
  setText("#ownedLow", stats.low);
  setText("#ownedOut", stats.out);
  setText("#inventorySubtext", `${stats.colors} ${stats.colors === 1 ? "color" : "colors"} tracked across ${stats.rolls} ${stats.rolls === 1 ? "roll" : "rolls"}.`);
}

function renderHeaderStats(items) {
  const totalsObj = items.reduce(
    (acc, it) => {
      acc.count += 1;
      acc.rolls += Number(it.rolls || 0);
      acc.weight += Number(it.amount || 0);
      return acc;
    },
    { count: 0, rolls: 0, weight: 0 }
  );
  setText("#statFavorites", totalsObj.count);
  setText("#statRolls", totalsObj.rolls);
  setText("#statWeight", `${totalsObj.weight.toLocaleString()} g`);
}

/* ---------- favorites ---------- */
function favoriteCardHTML(it) {
  const color = escapeHTML(it.color || "Unnamed");
  const category = escapeHTML(it.category || "Uncategorized");
  const hex = escapeHTML(it.hex || "#eeeeee");
  const rolls = Number(it.rolls || 0);
  const amount = Number(it.amount || 0);

  return `
    <div class="col-sm-6 col-lg-4">
      <div class="card inventory-card h-100">
        <div class="card-body d-flex gap-3 align-items-start">
          <div class="swatch" style="background:${hex}" aria-hidden="true"></div>
          <div class="flex-grow-1 min-width-0">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div class="min-width-0">
                <div class="fw-semibold text-truncate">${color}</div>
                <div class="text-secondary small">${category}</div>
              </div>
              <button
                class="btn btn-link p-0 fav-toggle icon-button"
                data-id="${escapeHTML(it.id)}"
                data-color="${color}"
                data-hex="${hex}"
                data-category="${category}"
                data-rolls="${rolls}"
                data-amount="${amount}"
                title="Remove ${color} from favorites"
                aria-label="Remove ${color} from favorites"
                aria-pressed="true"
                type="button">
                <i class="fa-solid fa-star text-warning" aria-hidden="true"></i>
              </button>
            </div>
            <div class="text-secondary small mt-2">${plural(rolls, "roll")} - ${amount.toLocaleString()} g</div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderFavorites(filter = "", sort = "name") {
  const grid = $("#favoritesGrid");
  if (!grid) return;

  const items = getFavorites();
  const q = filter.trim().toLowerCase();
  let view = items.filter(it =>
    (it.color || "").toLowerCase().includes(q) ||
    (it.category || "").toLowerCase().includes(q)
  );

  view.sort((a, b) => {
    if (sort === "rolls") return (b.rolls || 0) - (a.rolls || 0);
    if (sort === "weight") return (b.amount || 0) - (a.amount || 0);
    return String(a.color || "").localeCompare(String(b.color || ""));
  });

  if (!view.length) {
    grid.innerHTML = `
      <div class="col-12">
        <div class="empty-state text-center">
          <div class="fw-semibold">${q ? "No favorites match your search." : "No favorites yet."}</div>
          <div class="text-secondary small mb-3">Use the star on catalog cards to keep colors close.</div>
          <a class="btn btn-sm btn-outline-primary" href="home.html">Open Catalog</a>
        </div>
      </div>`;
  } else {
    grid.innerHTML = view.map(favoriteCardHTML).join("");
  }

  setText("#statFavorites", view.length);
}

/* ---------- owned inventory ---------- */
const expandedRows = new Set();

function statusBadgeHTML(status) {
  return `<span class="status-badge status-${status.key}">${status.label}</span>`;
}

function ownedRowHTML(it) {
  const id = escapeHTML(it.id);
  const color = escapeHTML(it.color || "");
  const brand = escapeHTML(it.brand || "-");
  const material = escapeHTML(it.material || "-");
  const hex = escapeHTML(it.hex || "#eeeeee");
  const rolls = Number(it.rolls || 0);
  const amount = Number(it.amount || 0);
  const status = statusFor(amount);
  const expanded = expandedRows.has(it.id);

  return `
    <tr class="inventory-main-row row-status-${status.key}" data-id="${id}">
      <td>
        <button class="btn btn-sm btn-outline-secondary row-expand" data-id="${id}" type="button"
          aria-expanded="${expanded ? "true" : "false"}" aria-label="${expanded ? "Hide" : "Show"} details for ${color}">
          <i class="fa-solid fa-chevron-${expanded ? "down" : "right"}" aria-hidden="true"></i>
        </button>
      </td>
      <td><div class="swatch-sm" style="background:${hex}" aria-hidden="true"></div></td>
      <td class="fw-medium">${color}</td>
      <td>${material}</td>
      <td class="text-nowrap">
        <div class="roll-stepper" role="group" aria-label="Roll count for ${color}">
          <button class="btn btn-outline-secondary btn-sm owned-dec" data-id="${id}" title="Decrease rolls" aria-label="Decrease rolls" type="button">-</button>
          <span class="roll-count" aria-live="polite">${rolls}</span>
          <button class="btn btn-outline-secondary btn-sm owned-inc" data-id="${id}" title="Increase rolls" aria-label="Increase rolls" type="button">+</button>
        </div>
      </td>
      <td class="text-nowrap">
        <div class="remaining-cell">
          <strong>${amount.toLocaleString()}g</strong>
          ${statusBadgeHTML(status)}
        </div>
      </td>
      <td class="text-end">
        <div class="btn-group btn-group-sm action-group">
          <button class="btn btn-outline-primary owned-edit" data-id="${id}" type="button">
            <i class="fa-solid fa-pen me-1" aria-hidden="true"></i>Edit
          </button>
          <button class="btn btn-outline-danger owned-del" data-id="${id}" type="button">
            <i class="fa-solid fa-trash me-1" aria-hidden="true"></i>Delete
          </button>
        </div>
      </td>
    </tr>
    <tr class="inventory-detail-row ${expanded ? "is-open" : ""}" data-detail-for="${id}">
      <td colspan="7">
        <div class="detail-panel">
          <div class="detail-meta">
            <span><strong>Brand:</strong> ${brand}</span>
            <span><strong>Material:</strong> ${material}</span>
            <span><strong>Status:</strong> ${status.label}</span>
          </div>
          <div class="detail-actions">
            <div class="weight-actions" role="group" aria-label="Adjust weight for ${color}">
              <button class="btn btn-outline-secondary btn-sm use-chip" data-id="${id}" data-use="5" type="button">-5g</button>
              <button class="btn btn-outline-secondary btn-sm use-chip" data-id="${id}" data-use="10" type="button">-10g</button>
              <button class="btn btn-outline-secondary btn-sm use-chip" data-id="${id}" data-use="25" type="button">-25g</button>
              <button class="btn btn-outline-secondary btn-sm use-custom" data-id="${id}" type="button">Custom</button>
            </div>
            <div class="btn-group btn-group-sm action-group">
              <button class="btn btn-outline-primary owned-edit" data-id="${id}" type="button">Edit</button>
              <button class="btn btn-outline-danger owned-del" data-id="${id}" type="button">Delete</button>
            </div>
          </div>
        </div>
      </td>
    </tr>`;
}

function sortOwned(view, sort) {
  view.sort((a, b) => {
    if (sort === "rolls") return (b.rolls || 0) - (a.rolls || 0);
    if (sort === "weight") return (b.amount || 0) - (a.amount || 0);
    if (sort === "status") return statusFor(a.amount).rank - statusFor(b.amount).rank;
    if (sort === "brand") return String(a.brand || "").localeCompare(String(b.brand || ""));
    if (sort === "material") return String(a.material || "").localeCompare(String(b.material || ""));
    return String(a.color || "").localeCompare(String(b.color || ""));
  });
  return view;
}

function renderOwned(filter = "", sort = "color") {
  const body = $("#ownedTableBody");
  if (!body) return;

  const fullList = getOwned();
  const q = filter.trim().toLowerCase();
  let view = fullList.filter(it =>
    (it.color || "").toLowerCase().includes(q) ||
    (it.brand || "").toLowerCase().includes(q) ||
    (it.material || "").toLowerCase().includes(q)
  );

  view = sortOwned(view, sort);

  body.innerHTML = view.map(ownedRowHTML).join("") || `
    <tr>
      <td colspan="7">
        <div class="empty-state text-center">
          <div class="fw-semibold">${q ? "No filaments match your search." : "No filaments yet."}</div>
          <div class="text-secondary small mb-3">${q ? "Try another color, brand, or material." : "Add your first spool from the catalog or the Add Filament button."}</div>
          ${q ? `<button id="emptyClearSearch" class="btn btn-sm btn-outline-secondary" type="button">Clear Search</button>` : `<a class="btn btn-sm btn-outline-primary" href="home.html">Open Catalog</a>`}
        </div>
      </td>
    </tr>`;

  renderOwnedTotals(fullList);
  updateUndoControls();
}

function rerenderOwned() {
  renderOwned($("#ownedSearch")?.value || "", $("#ownedSort")?.value || "color");
}

function findOwned(id) {
  const list = getOwned();
  return { list, item: list.find(x => x.id === id) };
}

/* ---------- usage + undo ---------- */
const _undoStack = [];
const MAX_UNDO = 10;

function updateUndoControls() {
  const btn = $("#undoUse");
  if (!btn) return;
  btn.disabled = _undoStack.length === 0;
  btn.setAttribute("aria-disabled", btn.disabled ? "true" : "false");
}

function useFilament(id, grams) {
  const requested = Math.abs(Number(grams || 0));
  if (!requested) return false;

  const list = getOwned();
  const i = list.findIndex(x => x.id === id);
  if (i < 0) return false;

  const before = Number(list[i].amount || 0);
  if (before <= 0) {
    showToast(`${list[i].color || "Filament"} is already out.`);
    return false;
  }

  const used = Math.min(before, requested);
  const after = Math.max(0, before - used);

  list[i].amount = after;
  setOwned(list);

  addActivity("owned:use", {
    id,
    color: list[i].color,
    material: list[i].material,
    hex: list[i].hex,
    deltaGrams: -used,
    before,
    after
  });

  _undoStack.unshift({ id, previousAmount: before, afterAmount: after, color: list[i].color, material: list[i].material });
  if (_undoStack.length > MAX_UNDO) _undoStack.pop();

  const clampNote = used < requested ? " Reached 0g." : "";
  showToast(`${used}g subtracted from ${list[i].color}.${clampNote}`);
  updateUndoControls();
  return true;
}

function undoLastUse() {
  const last = _undoStack.shift();
  if (!last) return false;

  const list = getOwned();
  const i = list.findIndex(x => x.id === last.id);
  if (i < 0) {
    showToast("Could not undo because that filament is no longer in inventory.");
    updateUndoControls();
    return false;
  }

  const before = Number(list[i].amount || 0);
  list[i].amount = last.previousAmount;
  setOwned(list);

  addActivity("undo", {
    id: last.id,
    color: list[i].color,
    material: list[i].material,
    before,
    after: last.previousAmount,
    note: `restored ${list[i].color || "filament"}`
  });

  showToast(`${list[i].color || "Filament"} restored to ${Number(last.previousAmount).toLocaleString()}g.`);
  updateUndoControls();
  return true;
}

function setSelectByValueOrText(sel, value, fallback) {
  const el = typeof sel === "string" ? $(sel) : sel;
  if (!el) return;

  const norm = (s) => String(s || "").trim().toLowerCase();
  const v = norm(value);
  const opts = Array.from(el?.options || []);

  let found = opts.find(o => norm(o.value) === v) || opts.find(o => norm(o.textContent) === v);

  if (!found && v) {
    const map = {
      "pla basic": "pla",
      "petg cf": "petg",
      "pa-cf": "nylon cf",
      "pa cf": "nylon cf",
    };
    const mapped = map[v];
    if (mapped) found = opts.find(o => norm(o.value) === norm(mapped)) || opts.find(o => norm(o.textContent) === norm(mapped));
  }

  if (found) {
    el.value = found.value;
    return;
  }

  const fb = fallback || "";
  if (!fb) { el.selectedIndex = 0; return; }

  let fbOpt = opts.find(o => norm(o.value) === norm(fb)) || opts.find(o => norm(o.textContent) === norm(fb));
  if (!fbOpt) {
    fbOpt = document.createElement("option");
    fbOpt.value = fb;
    fbOpt.textContent = fb;
    el.appendChild(fbOpt);
  }
  el.value = fbOpt.value;
}

function openFilamentModal(item = null) {
  const modalEl = $("#filamentModal");
  if (!modalEl) return;
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  const picker = $("#filamentPicker");
  const hexInp = $("#filamentHex");

  $("#filamentForm")?.reset();
  $("#filamentId").value = item?.id || "";
  $("#filamentModalLabel").textContent = item ? "Edit Filament" : "Add Filament";
  $("#filamentSubmit").textContent = item ? "Save Changes" : "Add Filament";

  if (item) {
    $("#filamentColor").value = item.color || "";
    $("#filamentHex").value = item.hex || "#000000";
    if (picker) picker.value = item.hex || "#000000";
    $("#filamentBrand").value = item.brand || "";
    setSelectByValueOrText("#filamentMaterial", item.material || item.category || "PLA", "PLA");
    $("#filamentRolls").value = Number(item.rolls || 0);
    $("#filamentWeight").value = Number(item.amount || 0);
  } else if (picker && hexInp) {
    picker.value = "#000000";
    hexInp.value = "#000000";
  }

  modal.show();
}

/* ---------- global click handlers ---------- */
document.addEventListener("click", (e) => {
  const favBtn = e.target.closest(".fav-toggle");
  if (favBtn) {
    const item = {
      id: favBtn.dataset.id,
      color: favBtn.dataset.color,
      hex: favBtn.dataset.hex,
      category: favBtn.dataset.category,
      rolls: Number(favBtn.dataset.rolls || 0),
      amount: Number(favBtn.dataset.amount || 0),
    };
    const favs = getFavorites();
    const idx = favs.findIndex(f => f.id === item.id);
    const nowPressed = idx < 0;
    if (nowPressed) favs.push(item); else favs.splice(idx, 1);
    setFavorites(favs);

    addActivity(nowPressed ? "favorite:add" : "favorite:remove", {
      id: item.id, color: item.color, category: item.category, hex: item.hex
    });

    renderHeaderStats(favs);
    renderFavorites($("#favSearch")?.value || "", $("#favSort")?.value || "name");
    showToast(nowPressed ? `${item.color} added to favorites.` : `${item.color} removed from favorites.`);
    return;
  }

  if (e.target.closest("#emptyClearSearch") || e.target.closest("#ownedClear")) {
    const input = $("#ownedSearch");
    if (input) input.value = "";
    rerenderOwned();
    return;
  }

  if (e.target.closest("#undoUse")) {
    if (undoLastUse()) rerenderOwned();
    return;
  }

  const expandBtn = e.target.closest(".row-expand");
  if (expandBtn) {
    const id = expandBtn.dataset.id;
    if (expandedRows.has(id)) expandedRows.delete(id); else expandedRows.add(id);
    rerenderOwned();
    return;
  }

  const targetWithId = e.target.closest("[data-id]");
  const id = targetWithId?.dataset.id;
  if (!id) return;

  const { list, item } = findOwned(id);
  if (!item) return;

  if (e.target.closest(".owned-edit")) {
    openFilamentModal(item);
    return;
  }

  if (e.target.closest(".owned-del")) {
    const label = `${item.color || "this filament"}${item.material ? ` ${item.material}` : ""}`;
    if (!confirm(`Delete ${label} from inventory? Activity history will remain.`)) return;
    setOwned(list.filter(x => x.id !== id));
    expandedRows.delete(id);
    addActivity("owned:delete", {
      id,
      color: item.color,
      brand: item.brand,
      material: item.material,
      hex: item.hex
    });
    rerenderOwned();
    showToast(`${item.color || "Filament"} deleted.`);
    return;
  }

  if (e.target.closest(".owned-inc")) {
    const before = Number(item.rolls || 0);
    item.rolls = before + 1;
    setOwned(list);
    addActivity("rolls:inc", { id: item.id, color: item.color, material: item.material, before, after: item.rolls });
    rerenderOwned();
    showToast(`${item.color} roll count increased.`);
    return;
  }

  if (e.target.closest(".owned-dec")) {
    const before = Number(item.rolls || 0);
    if (before <= 0) {
      showToast(`${item.color} already has 0 rolls.`);
      return;
    }
    item.rolls = Math.max(0, before - 1);
    setOwned(list);
    addActivity("rolls:dec", { id: item.id, color: item.color, material: item.material, before, after: item.rolls });
    rerenderOwned();
    showToast(`${item.color} roll count decreased.`);
    return;
  }

  const chip = e.target.closest(".use-chip");
  if (chip) {
    const grams = Math.abs(Number(chip.dataset.use || 0));
    if (grams && useFilament(id, grams)) rerenderOwned();
    return;
  }

  if (e.target.closest(".use-custom")) {
    const val = prompt("Subtract how many grams?", "15");
    const grams = Number(val);
    if (Number.isFinite(grams) && grams > 0 && useFilament(id, grams)) rerenderOwned();
  }
});

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  function hydrateMaterialSelectFromStorage() {
    const sel = document.getElementById("filamentMaterial");
    if (!sel) return;
    const raw = localStorage.getItem("filament-material-options");
    const titles = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(titles) || titles.length === 0) return;

    sel.innerHTML = "";
    for (const t of titles) {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      sel.appendChild(opt);
    }
  }

  hydrateMaterialSelectFromStorage();

  renderHeaderStats(getFavorites());
  renderActivity();
  renderFavorites();

  $("#favSearch")?.addEventListener("input", (e) =>
    renderFavorites(e.target.value, $("#favSort")?.value || "name")
  );
  $("#favSort")?.addEventListener("change", (e) =>
    renderFavorites($("#favSearch")?.value || "", e.target.value)
  );

  document.getElementById("clearActivity")?.addEventListener("click", () => {
    if (confirm("Clear all activity? This cannot be undone.")) clearActivity();
  });

  if ($("#ownedTableBody")) {
    renderOwned();
    $("#ownedSearch")?.addEventListener("input", (e) => {
      renderOwned(e.target.value, $("#ownedSort")?.value || "color");
    });

    $("#ownedSort")?.addEventListener("change", (e) => {
      renderOwned($("#ownedSearch")?.value || "", e.target.value);
    });

    const picker = $("#filamentPicker");
    const hexInp = $("#filamentHex");

    picker?.addEventListener("input", () => { if (hexInp) hexInp.value = picker.value; });
    hexInp?.addEventListener("input", () => {
      if (/^#[0-9a-fA-F]{6}$/.test(hexInp.value) && picker) picker.value = hexInp.value;
    });

    $$('[data-bs-target="#filamentModal"]').forEach((button) => {
      button.addEventListener("click", () => openFilamentModal());
    });

    $("#filamentForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const color = ($("#filamentColor").value || "").trim();
      if (!color) {
        showToast("Color is required.");
        return;
      }

      const rolls = Math.max(0, Number($("#filamentRolls").value || 0));
      const amount = Math.max(0, Number($("#filamentWeight").value || 0));
      const id = $("#filamentId").value || `${slugify($("#filamentBrand").value || "brand")}-${slugify($("#filamentMaterial").value || "mat")}-${slugify(color || uid())}-${uid()}`;
      const item = {
        id,
        color,
        hex: ($("#filamentHex").value || "").trim(),
        brand: ($("#filamentBrand").value || "").trim(),
        material: ($("#filamentMaterial").value || "").trim(),
        rolls,
        amount,
      };
      const list = getOwned();
      const idx = list.findIndex(x => x.id === item.id);
      if (idx >= 0) list[idx] = item; else list.push(item);
      setOwned(list);

      addActivity(idx >= 0 ? "owned:edit" : "owned:add", {
        id: item.id,
        color: item.color,
        brand: item.brand,
        material: item.material,
        hex: item.hex
      });

      rerenderOwned();
      showToast(idx >= 0 ? `${item.color} updated.` : `${item.color} added to Inventory.`);
      bootstrap.Modal.getOrCreateInstance($("#filamentModal")).hide();
    });
  }

  updateUndoControls();

  const tabByHash = {
    "#filaments": "#filament-tab",
    "#activity": "#activity-tab",
    "#favorites": "#favorites-tab",
  };
  const tabSelector = tabByHash[window.location.hash];
  if (tabSelector && window.bootstrap) {
    const tab = document.querySelector(tabSelector);
    if (tab) bootstrap.Tab.getOrCreateInstance(tab).show();
  }
});