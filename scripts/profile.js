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
    case "owned:use": return `Used <strong>${Math.abs(p.deltaGrams || 0)}g</strong> from ${color}${badge}`;
    case "rolls:inc": return `Increased rolls for ${color}${badge}`;
    case "rolls:dec": return `Decreased rolls for ${color}${badge}`;
    case "undo": return `Undo: ${escapeHTML(p.note || "last change")}`;
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

/* ---------- totals ---------- */
function renderOwnedTotals(items) {
  const rolls = items.reduce((s, it) => s + Number(it.rolls || 0), 0);
  const weight = items.reduce((s, it) => s + Number(it.amount || 0), 0);
  setText("#ownedRolls", rolls);
  setText("#ownedWeight", `${weight.toLocaleString()} g`);
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
          <div class="text-secondary small">Use the star on catalog cards to keep colors close.</div>
        </div>
      </div>`;
  } else {
    grid.innerHTML = view.map(favoriteCardHTML).join("");
  }

  setText("#statFavorites", view.length);
}

/* ---------- owned inventory ---------- */
function ownedRowHTML(it) {
  const color = escapeHTML(it.color || "");
  const brand = escapeHTML(it.brand || "-");
  const material = escapeHTML(it.material || "-");
  const hex = escapeHTML(it.hex || "#eeeeee");
  const rolls = Number(it.rolls || 0);
  const amount = Number(it.amount || 0);

  return `
    <tr data-id="${escapeHTML(it.id)}">
      <td><div class="swatch-sm" style="background:${hex}" aria-hidden="true"></div></td>
      <td class="fw-medium">${color}</td>
      <td>${brand}</td>
      <td>${material}</td>
      <td class="text-nowrap">
        <div class="roll-stepper" role="group" aria-label="Roll count for ${color}">
          <button class="btn btn-outline-secondary btn-sm owned-dec" title="Decrease rolls" aria-label="Decrease rolls" type="button">-</button>
          <span class="roll-count" aria-live="polite">${rolls}</span>
          <button class="btn btn-outline-secondary btn-sm owned-inc" title="Increase rolls" aria-label="Increase rolls" type="button">+</button>
        </div>
      </td>
      <td class="text-nowrap">
        <div class="fw-medium">${amount.toLocaleString()}</div>
        <div class="mt-2 d-flex gap-1 flex-wrap weight-actions" role="group" aria-label="Adjust weight for ${color}">
          <button class="btn btn-outline-secondary btn-sm use-chip" data-use="-5" type="button">-5g</button>
          <button class="btn btn-outline-secondary btn-sm use-chip" data-use="-10" type="button">-10g</button>
          <button class="btn btn-outline-secondary btn-sm use-chip" data-use="-25" type="button">-25g</button>
          <button class="btn btn-outline-secondary btn-sm use-custom" type="button">Custom</button>
        </div>
      </td>
      <td class="text-end">
        <div class="btn-group btn-group-sm action-group">
          <button class="btn btn-outline-primary owned-edit" type="button">
            <i class="fa-solid fa-pen me-1" aria-hidden="true"></i>Edit
          </button>
          <button class="btn btn-outline-danger owned-del" type="button">
            <i class="fa-solid fa-trash me-1" aria-hidden="true"></i>Delete
          </button>
        </div>
      </td>
    </tr>`;
}

function renderOwned(filter = "", sort = "color") {
  const body = $("#ownedTableBody");
  if (!body) return;

  const q = filter.trim().toLowerCase();
  let view = getOwned().filter(it =>
    (it.color || "").toLowerCase().includes(q) ||
    (it.brand || "").toLowerCase().includes(q) ||
    (it.material || "").toLowerCase().includes(q)
  );

  view.sort((a, b) => {
    if (sort === "rolls") return (b.rolls || 0) - (a.rolls || 0);
    if (sort === "weight") return (b.amount || 0) - (a.amount || 0);
    if (sort === "brand") return String(a.brand || "").localeCompare(String(b.brand || ""));
    if (sort === "material") return String(a.material || "").localeCompare(String(b.material || ""));
    return String(a.color || "").localeCompare(String(b.color || ""));
  });

  body.innerHTML = view.map(ownedRowHTML).join("") || `
    <tr>
      <td colspan="7">
        <div class="empty-state text-center">
          <div class="fw-semibold">${q ? "No filaments match your search." : "No filaments yet."}</div>
          <div class="text-secondary small">${q ? "Try another color, brand, or material." : "Add your first spool from the catalog or the Add Filament button."}</div>
        </div>
      </td>
    </tr>`;

  renderOwnedTotals(getOwned());
}

/* ---------- usage + undo ---------- */
const _undoStack = [];
const MAX_UNDO = 10;

function useFilament(id, grams) {
  if (!grams || grams <= 0) return false;
  const list = getOwned();
  const i = list.findIndex(x => x.id === id);
  if (i < 0) return false;

  const before = Number(list[i].amount || 0);
  const used = Math.min(before, Math.abs(grams));
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

  _undoStack.unshift({ id, delta: -used, previousAmount: before });
  if (_undoStack.length > MAX_UNDO) _undoStack.pop();
  showToast(`${used}g subtracted from ${list[i].color}.`);
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

  const row = e.target.closest("#ownedTableBody tr[data-id]");
  if (!row) return;
  const id = row.getAttribute("data-id");
  const list = getOwned();
  const item = list.find(x => x.id === id);
  if (!item) return;

  if (e.target.closest(".owned-edit")) {
    const modalEl = $("#filamentModal");
    if (!modalEl) return;
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    $("#filamentModalLabel").textContent = "Edit Filament";
    $("#filamentId").value = item.id;
    $("#filamentColor").value = item.color || "";
    $("#filamentHex").value = item.hex || "#000000";
    $("#filamentPicker").value = item.hex || "#000000";
    $("#filamentBrand").value = item.brand || "";
    setSelectByValueOrText("#filamentMaterial", item.material || item.category || "PLA", "PLA");
    $("#filamentRolls").value = Number(item.rolls || 0);
    $("#filamentWeight").value = Number(item.amount || 0);
    modal.show();
    return;
  }

  if (e.target.closest(".owned-del")) {
    if (!confirm(`Delete ${item.color || "this filament"} from inventory?`)) return;
    setOwned(list.filter(x => x.id !== id));
    addActivity("owned:delete", {
      id,
      color: item.color,
      brand: item.brand,
      material: item.material,
      hex: item.hex
    });
    renderOwned($("#ownedSearch")?.value || "", $("#ownedSort")?.value || "color");
    showToast(`${item.color || "Filament"} deleted.`);
    return;
  }

  if (e.target.closest(".owned-inc")) {
    item.rolls = Number(item.rolls || 0) + 1;
    setOwned(list);
    addActivity("rolls:inc", { id: item.id, color: item.color, material: item.material });
    renderOwned($("#ownedSearch")?.value || "", $("#ownedSort")?.value || "color");
    showToast(`${item.color} roll count increased.`);
    return;
  }

  if (e.target.closest(".owned-dec")) {
    item.rolls = Math.max(0, Number(item.rolls || 0) - 1);
    setOwned(list);
    addActivity("rolls:dec", { id: item.id, color: item.color, material: item.material });
    renderOwned($("#ownedSearch")?.value || "", $("#ownedSort")?.value || "color");
    showToast(`${item.color} roll count decreased.`);
    return;
  }

  const chip = e.target.closest(".use-chip");
  if (chip) {
    const grams = Math.abs(Number(chip.dataset.use || 0));
    if (grams && useFilament(id, grams)) {
      renderOwned($("#ownedSearch")?.value || "", $("#ownedSort")?.value || "color");
    }
    return;
  }

  if (e.target.closest(".use-custom")) {
    const val = prompt("Subtract how many grams?", "15");
    const grams = Number(val);
    if (Number.isFinite(grams) && grams > 0 && useFilament(id, grams)) {
      renderOwned($("#ownedSearch")?.value || "", $("#ownedSort")?.value || "color");
    }
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

    const modalEl = $("#filamentModal");
    if (modalEl) {
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      const picker = $("#filamentPicker");
      const hexInp = $("#filamentHex");

      picker?.addEventListener("input", () => { if (hexInp) hexInp.value = picker.value; });
      hexInp?.addEventListener("input", () => {
        if (/^#[0-9a-fA-F]{6}$/.test(hexInp.value) && picker) picker.value = hexInp.value;
      });

      $$('[data-bs-target="#filamentModal"]').forEach((button) => {
        button.addEventListener("click", () => {
          $("#filamentModalLabel").textContent = "Add Filament";
          $("#filamentForm").reset();
          $("#filamentId").value = "";
          if (picker && hexInp) { picker.value = "#000000"; hexInp.value = "#000000"; }
        });
      });

      $("#filamentForm")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const id = $("#filamentId").value || `${slugify($("#filamentBrand").value || "brand")}-${slugify($("#filamentMaterial").value || "mat")}-${slugify($("#filamentColor").value || uid())}-${uid()}`;
        const item = {
          id,
          color: ($("#filamentColor").value || "").trim(),
          hex: ($("#filamentHex").value || "").trim(),
          brand: ($("#filamentBrand").value || "").trim(),
          material: ($("#filamentMaterial").value || "").trim(),
          rolls: Number($("#filamentRolls").value || 0),
          amount: Number($("#filamentWeight").value || 0),
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

        renderOwned($("#ownedSearch")?.value || "", $("#ownedSort")?.value || "color");
        showToast(idx >= 0 ? `${item.color} updated.` : `${item.color} added to Inventory.`);
        modal.hide();
      });
    }
  }

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
