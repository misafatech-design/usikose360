/** URL-friendly slug: lowercase letters, numbers and single dashes. */
export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function readingMinutes(text: string) {
  return Math.max(1, Math.round((text.trim().split(/\s+/).length || 0) / 200));
}
