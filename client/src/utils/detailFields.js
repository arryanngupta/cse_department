export function formatDate(value, options = {}) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
  }).format(date);
}

export function formatDateTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return "";
}

export function prettifyKey(key) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function formatPrimitiveValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return formatDateTime(value);
  return String(value);
}

export function getPrimitiveDetails(item, excludedKeys = []) {
  if (!item || typeof item !== "object") return [];

  const exclude = new Set([
    "id",
    "title",
    "name",
    "description",
    "summary",
    "body",
    "link",
    "image_path",
    "photo_path",
    "banner_path",
    "content_json",
    "createdAt",
    "updatedAt",
    ...excludedKeys,
  ]);

  return Object.entries(item)
    .filter(([key, value]) => {
      if (exclude.has(key)) return false;
      if (value === null || value === undefined || value === "") return false;
      return (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      );
    })
    .map(([key, value]) => ({
      label: prettifyKey(key),
      value: formatPrimitiveValue(value),
    }));
}