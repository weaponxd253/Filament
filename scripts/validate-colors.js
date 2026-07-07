const fs = require("node:fs");
const path = require("node:path");

const catalogPath = path.resolve(__dirname, "..", "data", "colors.json");
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function slug(value = "") {
  return String(value).toLowerCase().replace(/\+/g, " plus ").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function readCatalog(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read valid JSON from ${filePath}: ${error.message}`);
  }
}

function validateCatalog(data) {
  const errors = [];
  const ids = new Map();
  const sizeKeyNames = new Set();
  let colorCount = 0;

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    errors.push("Catalog root must be an object.");
    return { errors, materialCount: 0, colorCount, sizeKeyNames };
  }

  if (!data.categories || typeof data.categories !== "object" || Array.isArray(data.categories)) {
    errors.push("Catalog must contain a categories object.");
    return { errors, materialCount: 0, colorCount, sizeKeyNames };
  }

  Object.entries(data.categories).forEach(([material, items]) => {
    if (!material.trim()) errors.push("Material names cannot be blank.");
    if (!Array.isArray(items)) {
      errors.push(`${material}: expected an array of color entries.`);
      return;
    }

    const colorsInMaterial = new Map();

    items.forEach((item, index) => {
      const label = `${material}[${index}]`;
      colorCount += 1;

      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`${label}: entry must be an object.`);
        return;
      }

      const color = String(item.color || "").trim();
      if (!color) errors.push(`${label}: color is required.`);

      const id = slug(`${material}-${color}`);
      if (id) {
        if (ids.has(id)) errors.push(`${label}: duplicate generated id "${id}" also used by ${ids.get(id)}.`);
        else ids.set(id, `${material} / ${color}`);
      }

      const colorKey = color.toLowerCase();
      if (colorKey) {
        if (colorsInMaterial.has(colorKey)) errors.push(`${label}: duplicate color "${color}" also appears at ${colorsInMaterial.get(colorKey)}.`);
        else colorsInMaterial.set(colorKey, `${material} / ${color}`);
      }

      if (!HEX_RE.test(String(item.hex || ""))) errors.push(`${label}: hex must be #RRGGBB.`);

      const rolls = Number(item.rolls);
      if (!Number.isFinite(rolls) || rolls < 0) errors.push(`${label}: rolls must be a non-negative number.`);

      const amount = Number(item.amount);
      if (!Number.isFinite(amount) || amount < 0) errors.push(`${label}: amount must be a non-negative number.`);

      const hasRollSizeKey = Object.prototype.hasOwnProperty.call(item, "rollSizeKey");
      const hasSpoolSizeKey = Object.prototype.hasOwnProperty.call(item, "spoolSizeKey");
      if (hasRollSizeKey && hasSpoolSizeKey) errors.push(`${label}: use either rollSizeKey or spoolSizeKey, not both.`);
      if (!hasRollSizeKey && !hasSpoolSizeKey) errors.push(`${label}: expected rollSizeKey or spoolSizeKey.`);
      if (hasRollSizeKey) sizeKeyNames.add("rollSizeKey");
      if (hasSpoolSizeKey) sizeKeyNames.add("spoolSizeKey");

      if (!Array.isArray(item.usage)) errors.push(`${label}: usage must be an array.`);
    });
  });

  if (sizeKeyNames.size > 1) {
    errors.push(`Catalog mixes size-key names: ${Array.from(sizeKeyNames).sort().join(", ")}. Use one consistently.`);
  }

  return {
    errors,
    materialCount: Object.keys(data.categories).length,
    colorCount,
    sizeKeyNames,
  };
}

const result = validateCatalog(readCatalog(catalogPath));

if (result.errors.length) {
  console.error(`Catalog validation failed with ${result.errors.length} error(s):`);
  result.errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

const sizeKey = Array.from(result.sizeKeyNames)[0] || "none";
console.log(`Validated data/colors.json: ${result.colorCount} colors across ${result.materialCount} materials (${sizeKey}).`);