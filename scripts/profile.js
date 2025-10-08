/* Profile page: Activity + Favorites (filament-focused) */

const KEY_THEME = "profile-theme";
const KEY_FAVS = "filament-favorites";
const KEY_OWNED = "filament-owned"; // ← shared store for My Filaments

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

// safe setter: only assigns if the element exists
const setText = (sel, value) => {
    const el = $(sel);
    if (el) el.textContent = value;
};




/* ---------- favorites store ---------- */
const getFavorites = () => {
    try { return JSON.parse(localStorage.getItem(KEY_FAVS) || "[]"); }
    catch { return []; }
};
const setFavorites = (arr) => localStorage.setItem(KEY_FAVS, JSON.stringify(arr));

/* ---------- owned store ---------- */
const getOwned = () => {
    try { return JSON.parse(localStorage.getItem(KEY_OWNED) || "[]"); }
    catch { return []; }
};
const setOwned = (arr) => localStorage.setItem(KEY_OWNED, JSON.stringify(arr));

const uid = () => Math.random().toString(36).slice(2, 10);
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/* ---------- header stats (favorites) ---------- */
const totals = (items) => items.reduce(
    (acc, it) => {
        acc.count += 1;
        acc.rolls += Number(it.rolls || 0);
        acc.weight += Number(it.amount || 0);
        return acc;
    },
    { count: 0, rolls: 0, weight: 0 }
);

/* ---------- Activity --------------- */
const KEY_ACT = "profile-activity";
/* event shape:
{
  id: "evt_xxx",          // uid
  ts: Date.now(),         // timestamp
  type: "owned:add",      // string
  payload: {              // minimal snapshot for rendering
    id, color, category, brand, material, hex,
    deltaRolls, deltaGrams, before, after
  }
}
*/
const getActivity = () => {
    try { return JSON.parse(localStorage.getItem(KEY_ACT) || "[]"); }
    catch { return []; }
};
const setActivity = (arr) => localStorage.setItem(KEY_ACT, JSON.stringify(arr));

const actUid = () => Math.random().toString(36).slice(2, 10);
const timeAgo = (t) => {
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24); return `${d}d ago`;
};

window.addEventListener("storage", (e) => {
    if (e.key === "profile-activity") renderActivity();
});


function addActivity(type, payload) {
    const max = 200; // cap so it never explodes
    const next = [{ id: `evt_${actUid()}`, ts: Date.now(), type, payload }, ...getActivity()].slice(0, max);
    setActivity(next);
    // if the Activity tab is visible, you can re-render just that list:
    renderActivity(); // safe no-op if your function checks for element
}



function renderOwnedTotals(items) {
    const rolls = items.reduce((s, it) => s + Number(it.rolls || 0), 0);
    const weight = items.reduce((s, it) => s + Number(it.amount || 0), 0);
    setText("#ownedRolls", rolls);
    setText("#ownedWeight", `${weight.toLocaleString()} g`);
}


/* ---------- activity ---------- */
function labelFor(evt) {
    const p = evt.payload || {};
    const color = p.color ? `<strong>${p.color}</strong>` : "item";
    const cat = p.category || p.material || p.brand || "";
    const badge = cat ? ` <span class="text-secondary">(${cat})</span>` : "";

    switch (evt.type) {
        case "favorite:add": return `★ Favorited ${color}${badge}`;
        case "favorite:remove": return `☆ Unfavorited ${color}${badge}`;

        case "owned:add": return `Added ${color}${badge} to My Filaments`;
        case "owned:edit": return `Edited ${color}${badge}`;
        case "owned:delete": return `Deleted ${color}${badge}`;

        case "owned:use": {
            const g = Math.abs(p.deltaGrams || 0);
            return `Used <strong>${g}g</strong> from ${color}${badge}`;
        }

        case "rolls:inc": return `Increased rolls for ${color}${badge}`;
        case "rolls:dec": return `Decreased rolls for ${color}${badge}`;

        case "undo": return `Undo: ${p.note || "last change"}`;
        default: return evt.type;
    }
}

function clearActivity() {
    localStorage.setItem(KEY_ACT, "[]");   // or: localStorage.removeItem(KEY_ACT);
    renderActivity();                      // refresh the list
    updateActivityControls();              // optional: disable the button if empty
}

function updateActivityControls() {
    const btn = document.getElementById("clearActivity");
    if (!btn) return;
    const count = (getActivity() || []).length;
    btn.disabled = count === 0;
    btn.setAttribute("aria-disabled", count === 0 ? "true" : "false");
}


function renderActivity() {
    const list = $("#activityList");
    if (!list) return;
    const items = getActivity();
    list.innerHTML = items.slice(0, 30).map(evt => `
    <li class="list-group-item d-flex justify-content-between">
      <span>${labelFor(evt)}</span>
      <span class="text-secondary small">${timeAgo(evt.ts)}</span>
    </li>`).join("") || `
    <li class="list-group-item text-secondary">No activity yet.</li>`;
}


/* ---------- favorites grid (cards built by JS) ---------- */
function cardHTML(it) {
    return `
    <div class="col-sm-6 col-lg-4">
      <div class="card h-100">
        <div class="card-body d-flex gap-3 align-items-start">
          <div class="swatch" style="background:${it.hex || "#eee"}"></div>
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="fw-semibold">${it.color || "Unnamed"}</div>
                <div class="text-secondary small">${it.category || "Uncategorized"}</div>
              </div>
              <div class="d-flex align-items-center gap-2">
                <button
                  class="btn btn-link p-0 fav-toggle"
                  data-id="${it.id}"
                  data-color="${it.color || ""}"
                  data-hex="${it.hex || ""}"
                  data-category="${it.category || ""}"
                  data-rolls="${Number(it.rolls || 0)}"
                  data-amount="${Number(it.amount || 0)}"
                  title="Remove from favorites" aria-label="Remove from favorites" aria-pressed="true">
                  <i class="fa-solid fa-star text-warning"></i>
                </button>

                <!-- include details for activity logging -->
                <button
                  class="btn btn-sm btn-outline-danger"
                  data-remove="${it.id}"
                  data-remove-color="${it.color || ""}"
                  data-remove-category="${it.category || ""}"
                  data-remove-hex="${it.hex || ""}"
                >Remove</button>
              </div>
            </div>
            <div class="text-secondary small mt-2">
              ${Number(it.rolls || 0)} roll(s) • ${Number(it.amount || 0)} g
            </div>
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

    grid.innerHTML = view.map(cardHTML).join("") ||
        `<p class="text-secondary">No favorites yet. Add some filaments and they’ll land here.</p>`;

    setText("#statFavorites", view.length);
}

/* ---------- global click handlers (delegation) ---------- */
document.addEventListener("click", (e) => {
    /* star toggle */
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

        const icon = favBtn.querySelector("i");
        icon.classList.toggle("fa-solid", nowPressed);
        icon.classList.toggle("fa-regular", !nowPressed);
        icon.classList.toggle("text-warning", nowPressed);
        icon.classList.toggle("text-secondary", !nowPressed);
        favBtn.setAttribute("aria-pressed", nowPressed ? "true" : "false");
        favBtn.title = nowPressed ? "Remove from favorites" : "Add to favorites";

        renderHeaderStats(favs);
        renderFavorites($("#favSearch")?.value || "", $("#favSort")?.value || "name");
        return;
    }

    /* remove favorite */
    const removeBtn = e.target.closest("[data-remove]");
    if (removeBtn) {
        const id = removeBtn.getAttribute("data-remove");

        // read details from data-*
        const color = removeBtn.dataset.removeColor || "";
        const category = removeBtn.dataset.removeCategory || "";
        const hex = removeBtn.dataset.removeHex || "";

        const next = getFavorites().filter(x => x.id !== id);
        setFavorites(next);

        // log activity with real details
        addActivity("favorite:remove", { id, color, category, hex });

        renderHeaderStats(next);
        renderFavorites($("#favSearch")?.value || "", $("#favSort")?.value || "name");
        return;
    }

});

/* ---------- OWNED: table + usage ---------- */

function ownedRowHTML(it) {
    return `
    <tr data-id="${it.id}">
      <td><div class="swatch-sm" style="background:${it.hex || "#eee"}"></div></td>
      <td class="fw-medium">${it.color || ""}</td>
      <td>${it.brand || "-"}</td>
      <td>${it.material || "-"}</td>
      <td class="text-nowrap">
        <div class="btn-group btn-group-sm" role="group" aria-label="rolls">
          <button class="btn btn-outline-secondary owned-dec" title="Decrease">−</button>
          <span class="btn btn-outline-secondary disabled" style="pointer-events:none;min-width:3rem">${Number(it.rolls || 0)}</span>
          <button class="btn btn-outline-secondary owned-inc" title="Increase">+</button>
        </div>
      </td>
      <td class="text-nowrap">
        <div>${Number(it.amount || 0)}</div>
        <div class="mt-2 d-flex gap-1 flex-wrap">
          <button class="btn btn-outline-secondary btn-sm use-chip" data-use="-5">−5g</button>
          <button class="btn btn-outline-secondary btn-sm use-chip" data-use="-10">−10g</button>
          <button class="btn btn-outline-secondary btn-sm use-chip" data-use="-25">−25g</button>
          <button class="btn btn-outline-secondary btn-sm use-custom">Custom…</button>
        </div>
      </td>
      <td class="text-end">
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-primary owned-edit">Edit</button>
          <button class="btn btn-outline-danger owned-del">Delete</button>
        </div>
      </td>
    </tr>`;
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

    body.innerHTML = view.map(ownedRowHTML).join("") ||
        `<tr><td colspan="7" class="text-secondary">No filaments yet. Add your first spool!</td></tr>`;

    // totals from full list (not the filtered view)
    renderOwnedTotals(getOwned());
}

/* usage + undo */
const _undoStack = []; // [{ id, delta, previousAmount }]
const MAX_UNDO = 10;

function useFilament(id, grams) {
    if (!grams || grams <= 0) return;
    const list = getOwned();
    const i = list.findIndex(x => x.id === id);
    if (i < 0) return;

    const before = Number(list[i].amount || 0);
    const used = Math.min(before, Math.abs(grams)); // clamp so we don't go negative
    const after = Math.max(0, before - used);

    list[i].amount = after;
    setOwned(list);

    // log the usage event with context
    addActivity("owned:use", {
        id,
        color: list[i].color,
        material: list[i].material,
        hex: list[i].hex,
        deltaGrams: -used,  // negative = subtracted
        before,
        after
    });

    _undoStack.unshift({ id, delta: -used, previousAmount: before });
    if (_undoStack.length > MAX_UNDO) _undoStack.pop();
}
function undoLastUse() {
    const last = _undoStack.shift();
    if (!last) return false;
    const list = getOwned();
    const i = list.findIndex(x => x.id === last.id);
    if (i < 0) return false;
    list[i].amount = last.previousAmount;
    setOwned(list);
    return true;
}

function setSelectByValueOrText(sel, value, fallback) {
    const el = typeof sel === "string" ? $(sel) : sel;
    if (!el) return;

    const norm = (s) => String(s || "").trim().toLowerCase();
    const v = norm(value);
    const opts = Array.from(el?.options || []);

    // try: value, then visible text
    let found =
        opts.find(o => norm(o.value) === v) ||
        opts.find(o => norm(o.textContent) === v);

    // optional simple mapping for common aliases
    if (!found && v) {
        const map = {
            "pla basic": "pla",
            "petg cf": "petg",
            "pa-cf": "nylon cf",
            "pa cf": "nylon cf",
        };
        const mapped = map[v];
        if (mapped) {
            found =
                opts.find(o => norm(o.value) === norm(mapped)) ||
                opts.find(o => norm(o.textContent) === norm(mapped));
        }
    }

    if (found) {
        el.value = found.value;
        return;
    }

    // ensure fallback exists and select it
    const fb = fallback || "";
    if (!fb) { el.selectedIndex = 0; return; }

    let fbOpt =
        opts.find(o => norm(o.value) === norm(fb)) ||
        opts.find(o => norm(o.textContent) === norm(fb));

    if (!fbOpt) {
        fbOpt = document.createElement("option");
        fbOpt.value = fb;
        fbOpt.textContent = fb;
        el.appendChild(fbOpt);
    }
    el.value = fbOpt.value;
}


/* owned table events */
document.addEventListener("click", (e) => {
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

        $("#filamentModalLabel").textContent = "Edit filament";
        $("#filamentId").value = item.id;
        $("#filamentColor").value = item.color || "";
        $("#filamentHex").value = item.hex || "#000000";
        $("#filamentPicker").value = item.hex || "#000000";
        $("#filamentBrand").value = item.brand || "";
        const materialGuess = (item.material || item.category || "PLA");
        setSelectByValueOrText("#filamentMaterial", materialGuess, "PLA");
        $("#filamentRolls").value = Number(item.rolls || 0);
        $("#filamentWeight").value = Number(item.amount || 0);
        modal.show();
        return;
    }



    if (e.target.closest(".owned-del")) {
        setOwned(list.filter(x => x.id !== id));
        addActivity("owned:delete", {
            id,
            color: item.color,
            brand: item.brand,
            material: item.material,
            hex: item.hex
        });
        renderOwned($("#ownedSearch")?.value || "", $("#ownedSort")?.value || "color");
        return;
    }

    if (e.target.closest(".owned-inc")) {
        item.rolls = Number(item.rolls || 0) + 1;
        setOwned(list);
        addActivity("rolls:inc", {
            id: item.id,
            color: item.color,
            material: item.material
        });
        renderOwned($("#ownedSearch")?.value || "", $("#ownedSort")?.value || "color");
        return;
    }
    if (e.target.closest(".owned-dec")) {
        item.rolls = Math.max(0, Number(item.rolls || 0) - 1);
        setOwned(list);
        addActivity("rolls:dec", {
            id: item.id,
            color: item.color,
            material: item.material
        });
        renderOwned($("#ownedSearch")?.value || "", $("#ownedSort")?.value || "color");
        return;
    }

    const chip = e.target.closest(".use-chip");
    if (chip) {
        const grams = Math.abs(Number(chip.dataset.use || 0));
        if (grams) {
            useFilament(id, grams);
            renderOwned($("#ownedSearch")?.value || "", $("#ownedSort")?.value || "color");
        }
        return;
    }
    if (e.target.closest(".use-custom")) {
        const val = prompt("Subtract how many grams?", "15");
        const grams = Number(val);
        if (Number.isFinite(grams) && grams > 0) {
            useFilament(id, grams);
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
    opt.value = t;            // exact category title
    opt.textContent = t;      // show exact title
    sel.appendChild(opt);
  }
}
// call this early in DOMContentLoaded (before using the modal)
hydrateMaterialSelectFromStorage();



    // seed favorites demo (optional)
    if (getFavorites().length === 0) {
        setFavorites([
            { id: "pla-black", color: "Black", hex: "#111111", category: "PLA Basic", rolls: 1, amount: 1000 },
            { id: "pla-gold", color: "Gold", hex: "#C9A227", category: "PLA Basic", rolls: 2, amount: 2000 },
            { id: "petg-blue", color: "Blue", hex: "#1F6FEB", category: "PETG", rolls: 1, amount: 750 }
        ]);
    }

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
        if (confirm("Clear all activity? This cannot be undone.")) {
            clearActivity();
        }
    });

    // keep the button state in sync
    updateActivityControls();


    // owned pane only if present
    if ($("#ownedTableBody")) {
        renderOwned();
        $("#ownedSearch")?.addEventListener("input", (e) => {
            renderOwned(e.target.value, $("#ownedSort")?.value || "color");
        });

        $("#ownedSort")?.addEventListener("change", (e) => {
            renderOwned($("#ownedSearch")?.value || "", e.target.value);
        });
        // modal safe-bind
        const modalEl = $("#filamentModal");
        if (modalEl) {
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            const picker = $("#filamentPicker");
            const hexInp = $("#filamentHex");

            picker?.addEventListener("input", () => { if (hexInp) hexInp.value = picker.value; });
            hexInp?.addEventListener("input", () => {
                if (/^#[0-9a-fA-F]{6}$/.test(hexInp.value) && picker) picker.value = hexInp.value;
            });

            $('[data-bs-target="#filamentModal"]')?.addEventListener("click", () => {
                $("#filamentModalLabel").textContent = "Add filament";
                $("#filamentForm").reset();
                $("#filamentId").value = "";
                if (picker && hexInp) { picker.value = "#000000"; hexInp.value = "#000000"; }
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
                modal.hide();
            });
        }
    }
});
