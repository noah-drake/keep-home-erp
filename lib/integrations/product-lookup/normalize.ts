/**
 * Open product data (Open Food Facts, USDA) has inconsistent casing — many names arrive all
 * lowercase ("creamy peanut butter") or ALL CAPS ("PEANUT BUTTER, CREAMY"). Normalize those to
 * readable Title Case. Strings that are ALREADY mixed-case (e.g. brand names like "Nutella",
 * "Coca-Cola", "iPhone") are left untouched, since their casing is almost certainly intentional.
 */
export function normalizeProductCasing(input: string | null | undefined): string {
  const s = (input ?? '').trim()
  if (!s) return s

  const hasLower = /[a-z]/.test(s)
  const hasUpper = /[A-Z]/.test(s)
  // Mixed case already -> assume it's intentional (brand/product styling); leave it.
  if (hasLower && hasUpper) return s

  // All-lower or all-upper -> Title Case the first letter of each word (after start, whitespace,
  // hyphen, slash, or opening paren).
  return s
    .toLowerCase()
    .replace(/(^|[\s\-/(])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
}
