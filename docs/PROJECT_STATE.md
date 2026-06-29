# Keep — Project State & Next Steps

Living handoff doc. Update it as milestones land so context survives across sessions.

## Where things stand (2026-06-29)

**Shared-catalog migration (MyFitnessPal-style) — in progress.**
The old `materials` table (which mixed *product identity* with *per-Keep policy*) is being split into:
- `catalog_items` — shared product identity (name, barcode, category, unit, nutrition). `visibility` = `private` (one org) or `global` (shared by all).
- `org_materials` — each Keep's policy for an item (default location, reorder point, lot qty, active). **This is the inventory key** the ledger points at. `org_materials.id == legacy materials.id` (1:1), so the append-only ledger never had to move.

### Done ✅
- **Phase 1 (expand)** migrations applied to the live DB: `20260629130000_split_materials_catalog.sql` + `20260629140000_catalog_nutrition.sql`. `materials` left intact alongside the new tables.
- **Service-role key** set in `.env.local` (rotate done; old leaked key revoked). Still must be set in **Vercel** for the eventual deploy.
- **Types regenerated** (`supabase gen types`) — `database.types.ts` now includes the new tables.
- **Global catalog auto-populate** live: scanning an unknown barcode looks it up (Open Food Facts → USDA) and caches it as a `global` catalog item via the server route `app/api/catalog/lookup`.
- **Phase 2 app refactor** committed on branch **`phase2-catalog-app`** (NOT merged/deployed). New `lib/catalog.ts` helper + `/materials/adopt` screen; all create/edit/read paths moved off `materials`. Verified green (tsc, build).
- **Promote-to-global** (on the branch): server route `app/api/catalog/promote/route.ts` (RLS-authorized, service-role write, dedupe-by-barcode, repoint org_materials, drop private row) + "Share to Global" button on the item detail page. This is the safe replacement for the removed client-side "share" checkbox.
- **Open-data casing** (on the branch): `lib/integrations/product-lookup/normalize.ts` Title-cases all-lower/ALL-CAPS OFF/USDA names while leaving mixed-case brands alone; applied in both adapters. 49 tests pass. NOTE: only affects items fetched GOING FORWARD — existing rows need a one-time `UPDATE catalog_items SET name = initcap(name) WHERE source IN ('openfoodfacts','usda') AND (name = lower(name) OR name = upper(name));`.

### Not done yet ⏳ — the cutover (do these together, lockstep)
1. Set the new service-role key in **Vercel** (Production).
2. Merge `phase2-catalog-app` → `main` and deploy **at the same time** as running the cutover SQL:
   `supabase/migrations/20260629150000_phase2_cutover.sql` (repoints the ledger FK, rewrites the two views + `get_dashboard_metrics` onto the new tables).
3. Run the **dual-read verification** checks (counts + dashboard parity) documented at the bottom of the cutover SQL and in `docs/migrations/shared-catalog-rollout.md`.
4. Bake for a bit, then **later** drop the legacy `materials` table (Phase 2, Step 3 — commented out in the split migration).

> Why lockstep: the app's write target (`org_materials`) and the views' read source must switch at the same moment, or newly-created items won't appear until both sides match.

## Open ideas / roadmap
- Receipt OCR → bulk receiving; MyFitnessPal consumption sync; recipe generator. See `docs/integrations/roadmap.md`.
- Pre-existing cleanups: PWA icon 404s; lint debt (`react-hooks/set-state-in-effect`, stray `any`); `units.abbreviation` is referenced in the UI but that column doesn't exist in the DB.

## Key files
- Migrations: `supabase/migrations/` (`*_split_materials_catalog`, `*_catalog_nutrition`, `*_phase2_cutover`)
- Shared write helper: `lib/catalog.ts`
- Adopt flow: `app/materials/adopt/page.tsx`
- Product lookup: `lib/integrations/product-lookup/*`, `app/api/catalog/lookup/route.ts`
- Docs: `docs/migrations/shared-catalog-rollout.md`, `docs/integrations/roadmap.md`
