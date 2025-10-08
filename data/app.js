// ---- config ----
const DATA_URL = "data/colors.json"; // adjust path if your file lives elsewhere

// ---- utilities ----
const slugify = (str) =>
  String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// ---- OWNED (Profile → My Filaments) ----
const KEY_OWNED = "filament-owned";
// item shape: { id, color, hex, brand, material, rolls, amount }

const getOwned = () => {
  try { return JSON.parse(localStorage.getItem(KEY_OWNED) || "[]"); }
  catch { return []; }
};
const setOwned = (arr) => localStorage.setItem(KEY_OWNED, JSON.stringify(arr));

// add-or-merge convenience: if same (color+category) exists, bump rolls/amount
function addOwned(item) {
  const list = getOwned();
  const idx = list.findIndex(x => x.id === item.id);
  if (idx >= 0) {
    // simple merge strategy: add one roll + amount
    list[idx].rolls = Number(list[idx].rolls || 0) + Number(item.rolls || 1);
    list[idx].amount = Number(list[idx].amount || 0) + Number(item.amount || 0);
  } else {
    list.push(item);
  }
  setOwned(list);
  return list;
}

// ---- favorites (shared with profile) ----
const KEY_FAVS = "filament-favorites";

const getFavorites = () => {
  try { return JSON.parse(localStorage.getItem(KEY_FAVS) || "[]"); }
  catch { return []; }
};
const setFavorites = (arr) => localStorage.setItem(KEY_FAVS, JSON.stringify(arr));

const buildFavId = (category, color) => slugify(`${category}-${color}`);
const isFavorite = (id) => getFavorites().some(f => f.id === id);

// ---- activity (shared with profile) ----
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

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".fav-btn");
  if (!btn) return;

  const item = {
    id: btn.dataset.favId,
    color: btn.dataset.favColor,
    hex: btn.dataset.favHex,
    category: btn.dataset.favCategory,
    rolls: Number(btn.dataset.favRolls || 0),
    amount: Number(btn.dataset.favAmount || 0),
  };

  const nowFav = toggleFavorite(item);

  addActivity(nowFav ? "favorite:add" : "favorite:remove", {
    id: item.id,
    color: item.color,
    category: item.category,
    hex: item.hex
  });

  // update the star icon, not the button text
  const icon = btn.querySelector("i");
  if (icon) {
    icon.classList.toggle("fa-solid", nowFav);
    icon.classList.toggle("fa-regular", !nowFav);
    icon.classList.toggle("text-warning", nowFav);
    icon.classList.toggle("text-secondary", !nowFav);
  } else {
    // fallback if no <i>
    btn.textContent = nowFav ? "★" : "☆";
  }

  btn.setAttribute("aria-pressed", nowFav ? "true" : "false");
  btn.title = nowFav ? "Remove from favorites" : "Add to favorites";
});

// Renders a simple grid for a category's items (tweak to taste)
function renderCategoryItems(items = [], categoryName = "") {
  if (!items.length) return '<p class="text-secondary mb-0">No items yet.</p>';

  return `
    <div class="row g-3">
      ${items.map((it) => {
    const id = slugify(`${categoryName}-${it.color}`);
    const active = isFavorite(id);
    return `
          <div class="col-sm-6 col-lg-4">
            <div class="card h-100">
              <div class="card-body d-flex gap-3 align-items-start">
                <div class="rounded border" style="width:36px;height:36px;background:${it.hex};"></div>
                <div class="flex-grow-1">
                  <div class="d-flex justify-content-between align-items-start">
                    <div>
                      <div class="fw-medium">${it.color}</div>
                      <div class="text-secondary small">${categoryName}</div>
                      <div class="text-secondary small">${it.rolls ?? 0} roll(s) • ${it.amount ?? 0}g</div>
                    </div>

                    <!-- Star toggle -->
                    <button
                      class="btn btn-link p-0 fav-btn"
                      data-fav-id="${id}"
                      data-fav-color="${it.color}"
                      data-fav-hex="${it.hex || ""}"
                      data-fav-category="${categoryName}"
                      data-fav-rolls="${it.rolls ?? 0}"
                      data-fav-amount="${it.amount ?? 0}"
                      aria-pressed="${active ? "true" : "false"}"
                      aria-label="${active ? "Remove from favorites" : "Add to favorites"}"
                      title="${active ? "Remove from favorites" : "Add to favorites"}"
                    >
                      <i class="${active ? "fa-solid" : "fa-regular"} fa-star ${active ? "text-warning" : "text-secondary"}"></i>
                    </button>
                  </div>

                  <div class="d-flex flex-wrap gap-2 mt-2">
                    <button
                      class="btn btn-sm btn-success owned-add"
                      data-owned-id="${id}"
                      data-owned-color="${it.color}"
                      data-owned-hex="${it.hex || ""}"
                      data-owned-category="${categoryName}"
                      data-owned-rolls="${it.rolls ?? 1}"
                      data-owned-amount="${it.amount ?? 0}"
                    >+ Add to My Filaments</button>
                  </div>
                </div>
              </div>
            </div>
          </div>`;
  }).join("")}
    </div>
  `;
}

// Build tabs + panes from category names
function buildTabsFromCategories(categoriesObj) {
  const tabsUl = document.getElementById("mainTabs");
  const panesDiv = document.getElementById("mainTabsContent");
  tabsUl.innerHTML = "";
  panesDiv.innerHTML = "";

  const categoryNames = Object.keys(categoriesObj);
  categoryNames.forEach((name, idx) => {
    const id = slugify(name);
    // nav button
    const li = document.createElement("li");
    li.className = "nav-item";
    li.role = "presentation";
    li.innerHTML = `
      <button
        class="nav-link ${idx === 0 ? "active" : ""}"
        id="${id}-tab"
        data-bs-toggle="tab"
        data-bs-target="#${id}-pane"
        type="button"
        role="tab"
        aria-controls="${id}-pane"
        aria-selected="${idx === 0 ? "true" : "false"}"
      >${name}</button>
    `;
    tabsUl.appendChild(li);

    // pane
    const pane = document.createElement("div");
    pane.className = `tab-pane fade ${idx === 0 ? "show active" : ""}`;
    pane.id = `${id}-pane`;
    pane.setAttribute("role", "tabpanel");
    pane.setAttribute("aria-labelledby", `${id}-tab`);
    pane.setAttribute("tabindex", "0");

    // optional: render items in each category
    const items = categoriesObj[name] || [];
    pane.innerHTML = renderCategoryItems(items, name);

    panesDiv.appendChild(pane);

  });
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".owned-add");
  if (!btn) return;

  const item = {
    id: btn.dataset.ownedId,
    color: btn.dataset.ownedColor,
    hex: btn.dataset.ownedHex,
    brand: "",                                // you can fill this later
    material: btn.dataset.ownedCategory || "",// use category as material-ish
    rolls: Number(btn.dataset.ownedRolls || 1),
    amount: Number(btn.dataset.ownedAmount || 0),
  };

  addOwned(item);

  addActivity("owned:add", {
    id: item.id,
    color: item.color,
    brand: item.brand || "",
    material: item.material || item.category || "",
    hex: item.hex
  });

  // quick user feedback
  btn.disabled = true;
  btn.textContent = "Added ✓";
  setTimeout(() => { btn.disabled = false; btn.textContent = "+ Add to My Filaments"; }, 900);
});

// ---- boot ----
(async () => {
  try {
    const res = await fetch(DATA_URL);
    const data = await res.json();
    const titles = Object.keys(data?.categories ?? {});
    localStorage.setItem("filament-material-options", JSON.stringify(titles));
    buildTabsFromCategories(data.categories || {});
  } catch (err) {
    console.error("Failed loading data:", err);
    document.getElementById("mainTabsContent").innerHTML =
      `<div class="alert alert-danger">Couldn’t load categories.</div>`;
  }
})();
