(function (global) {
  "use strict";

  const KEY_FAVS = "filament-favorites";
  const KEY_OWNED = "filament-owned";
  const KEY_ACT = "profile-activity";
  const PRESETS = { "1000g": 1000, "750g": 750, "500g": 500, "250g": 250 };

  const uid = () => Math.random().toString(36).slice(2, 10);
  const today = () => new Date().toISOString().slice(0, 10);
  const slug = (value = "") => String(value).toLowerCase().replace(/\+/g, " plus ").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const safe = (value = "") => String(value).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
  const normalize = (value = "") => String(value).trim().toLowerCase();

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); }
    catch { return []; }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  const getFavorites = () => read(KEY_FAVS);
  const setFavorites = value => write(KEY_FAVS, value);
  const isFavorite = id => getFavorites().some(item => item.id === id);

  function toggleFavorite(item) {
    const favorites = getFavorites();
    const index = favorites.findIndex(row => row.id === item.id);
    if (index >= 0) favorites.splice(index, 1);
    else favorites.push(item);
    setFavorites(favorites);
    return isFavorite(item.id);
  }

  const getActivity = () => read(KEY_ACT);
  const setActivity = value => write(KEY_ACT, value);

  function recordActivity(type, payload) {
    setActivity([{ id: `evt_${uid()}`, ts: Date.now(), type, payload }, ...getActivity()].slice(0, 200));
  }

  function presetFor(weight) {
    const hit = Object.entries(PRESETS).find(([, grams]) => grams === Number(weight));
    return hit ? hit[0] : "custom";
  }

  function normUse(entry = {}) {
    const grams = Math.max(0, Number(entry.grams ?? Math.abs(entry.deltaGrams || 0)) || 0);
    const before = Number(entry.before ?? 0);
    return {
      id: String(entry.id || `use_${uid()}`),
      ts: Number(entry.ts || Date.parse(entry.date || "") || Date.now()),
      date: String(entry.date || today()),
      project: String(entry.project || "").trim(),
      notes: String(entry.notes || "").trim(),
      grams,
      before: Number.isFinite(before) ? before : 0,
      after: Number(entry.after ?? Math.max(0, before - grams)) || 0,
    };
  }

  function normItem(item = {}) {
    const amount = Math.max(0, Number(item.amount ?? item.weight ?? 0) || 0);
    let start = Math.max(0, Number(item.startingWeight ?? item.spoolWeight ?? item.spoolSize ?? amount ?? 1000) || 0);
    if (start < amount) start = amount;
    if (!start) start = amount || 1000;
    const material = item.material || item.category || "";
    const spoolSizeKey = item.spoolSizeKey || item.rollSizeKey;

    return {
      id: String(item.id || `${slug(item.brand || "brand")}-${slug(material || "mat")}-${slug(item.color || uid())}-${uid()}`),
      color: String(item.color || "Unnamed"),
      hex: /^#[0-9a-fA-F]{6}$/.test(item.hex || "") ? item.hex : "#eeeeee",
      brand: String(item.brand || ""),
      material: String(material),
      rolls: Math.max(0, Math.round(Number(item.rolls ?? 1) || 0)),
      amount,
      startingWeight: start,
      spoolSizeKey: PRESETS[spoolSizeKey] ? spoolSizeKey : presetFor(start),
      usage: Array.isArray(item.usage) ? item.usage.map(normUse).filter(use => use.grams > 0) : [],
    };
  }

  const getOwned = () => read(KEY_OWNED).map(normItem);
  const setOwned = value => write(KEY_OWNED, value.map(normItem));

  function migrateOwned() {
    const raw = read(KEY_OWNED);
    const next = raw.map(normItem);
    if (JSON.stringify(raw) !== JSON.stringify(next)) write(KEY_OWNED, next);
  }

  function addOwned(item) {
    const list = getOwned();
    const nextItem = normItem(item);
    const index = list.findIndex(row => row.id === nextItem.id);

    if (index >= 0) {
      const nextAmount = Number(list[index].amount || 0) + Number(nextItem.amount || 0);
      list[index] = normItem({
        ...list[index],
        rolls: Number(list[index].rolls || 0) + Number(nextItem.rolls || 1),
        amount: nextAmount,
        startingWeight: Math.max(Number(list[index].startingWeight || 0), nextAmount),
      });
    } else {
      list.push(nextItem);
    }

    setOwned(list);
    return list;
  }

  function flattenCatalog(categories = {}) {
    return Object.entries(categories).flatMap(([category, items]) =>
      (items || []).map(item => {
        const amount = Number(item.amount ?? 0);
        const spoolSizeKey = item.spoolSizeKey || item.rollSizeKey || "1000g";
        const startingWeight = Math.max(amount, PRESETS[spoolSizeKey] || 1000, Number(item.startingWeight || 0));

        return {
          id: slug(`${category}-${item.color}`),
          color: item.color || "Unnamed",
          hex: item.hex || "#eeeeee",
          brand: item.brand || "",
          material: category,
          rolls: Number(item.rolls ?? 1),
          amount,
          spoolSizeKey,
          startingWeight,
          usage: Array.isArray(item.usage) ? item.usage : [],
        };
      })
    );
  }

  global.FilamentShared = {
    KEY_ACT,
    KEY_FAVS,
    KEY_OWNED,
    PRESETS,
    addOwned,
    flattenCatalog,
    getActivity,
    getFavorites,
    getOwned,
    isFavorite,
    migrateOwned,
    normItem,
    normUse,
    normalize,
    plural,
    presetFor,
    read,
    recordActivity,
    safe,
    setActivity,
    setFavorites,
    setOwned,
    slug,
    today,
    toggleFavorite,
    uid,
    write,
  };
})(window);