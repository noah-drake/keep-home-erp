# Rollout Guide — Split `materials` → `catalog_items` + `org_materials` (Phase 1, expand-only)

Migration file: [`supabase/migrations/20260629130000_split_materials_catalog.sql`](../../supabase/migrations/20260629130000_split_materials_catalog.sql)

## What this migration does (and does NOT do)
- **Adds** `catalog_items` (shared identity) and `org_materials` (per-org policy).
- **Backfills** both from the existing `materials` table.
- **Preserves the ledger key**: `org_materials.id = materials.id` for **every**
  row with `organization_id IS NOT NULL` (regardless of `is_global`), so
  `inventory_movements.material_id` keeps resolving with **no repoint**.
- **Enables RLS** on both new tables (after verification).
- **Does NOT** drop `materials`, alter the existing views, or repoint
  `inventory_movements`. The app keeps working unchanged. Those are **Phase 2**.

## Canonical classification rule (important)
- **PER-ORG** = `organization_id IS NOT NULL`. These rows own a real ledger key
  and ALWAYS get an `org_materials` row with `id = materials.id`. `is_global` is
  treated only as a hint that the row may *reuse* a global catalog identity — it
  never demotes a row out of the per-org/ledger bucket.
- **GLOBAL** = `organization_id IS NULL`. Shared catalog identity only; no
  `org_materials` row, no ledger key.

This is a strict partition (no overlap, no gap), which closes the original
ledger-loss gap for org-scoped `is_global=true` rows.

## How to apply
1. **Back up first.** `pg_dump` or take a Supabase PITR checkpoint / branch.
   Prefer testing on a Supabase **branch** (`supabase branches create`) or a
   `db dump`-restored staging project.
2. The SQL is already saved as a timestamped migration under `supabase/migrations/`.
3. Apply:
   - Local/CI: `supabase db push` (or `supabase migration up`).
   - Direct: `psql "$DATABASE_URL" -f supabase/migrations/20260629130000_split_materials_catalog.sql`.
   The file is wrapped in `BEGIN/COMMIT`; any pre-flight or verification
   `RAISE EXCEPTION` rolls the whole thing back. It is **re-runnable** (idempotent
   guards + deterministic `source_material_id` mapping).
4. Watch the output:
   - Pre-flight `NOTICE`/`WARNING` lines (duplicate barcodes, divergent global
     identities) — review and sign off if any appear.
   - The parity `NOTICE` (4c) and the diagnostic table (4g).
   - Confirm the COMMIT.

## Verification
Run these **as a BYPASSRLS role** (e.g. `postgres`/service connection). Under a
normal authenticated session with `FORCE ROW LEVEL SECURITY`, `auth.uid()` is
NULL so `org_materials` returns nothing and these checks would falsely pass.

```sql
-- 1. LEDGER COVERAGE (authoritative): every per-org material has an org_materials row
SELECT count(*) AS bad_rows
FROM materials m
WHERE m.organization_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM org_materials om WHERE om.id = m.id);
-- EXPECT: 0

-- 2. LEDGER INTEGRITY: every ledger row resolves to an org_materials id
SELECT count(*) AS bad_rows
FROM inventory_movements im
WHERE NOT EXISTS (SELECT 1 FROM org_materials om WHERE om.id = im.material_id);
-- EXPECT: 0  (the migration hard-fails if this is > 0)

-- 3. PARITY: per-org materials (org_id NOT NULL) == org_materials  (must be EQUAL)
SELECT
  (SELECT count(*) FROM materials WHERE organization_id IS NOT NULL) AS per_org_materials,
  (SELECT count(*) FROM org_materials) AS org_materials;
-- EXPECT: the two numbers are identical.

-- 4. No global-barcode duplicates in the catalog
SELECT count(*) AS bad_rows FROM (
  SELECT barcode FROM catalog_items
  WHERE visibility='global' AND barcode IS NOT NULL
  GROUP BY barcode HAVING count(*) > 1) d;
-- EXPECT: 0

-- 5. No private catalog row used by a foreign org
SELECT count(*) AS bad_rows
FROM org_materials om JOIN catalog_items c ON c.id = om.catalog_item_id
WHERE c.visibility='private' AND c.owner_org_id <> om.organization_id;
-- EXPECT: 0
```

### RLS smoke test
As a normal authenticated user (via the Supabase client, **not** service_role):
```sql
-- Should return ONLY global rows + this user's org private rows:
SELECT visibility, count(*) FROM catalog_items GROUP BY visibility;
-- Forbidden (should all FAIL):
INSERT INTO catalog_items(name, visibility) VALUES ('hack', 'global');
INSERT INTO catalog_items(name, visibility, owner_org_id)
  VALUES ('x','private','<some-other-org-uuid>');
INSERT INTO org_materials(organization_id, catalog_item_id)
  VALUES ('<your-org-uuid>', '<a-foreign-org-private-catalog-id>');
UPDATE catalog_items SET owner_org_id='<your-other-org-uuid>'
  WHERE id='<a-private-row-you-own>';
```

## Security notes (must verify against your data)
- **`specs` was intentionally NOT carried onto `catalog_items`.** Global rows are
  world-readable to every authenticated tenant, so cost/supplier/pricing data must
  not live there. If your legacy `materials.specs` held only public attributes you
  may add a `specs` column back to `catalog_items`; if it held any commercial data,
  keep it per-org (add it to `org_materials` or a dedicated `org_catalog_pricing`
  table scoped by `organization_id` with org-membership RLS). **Decide this before
  Phase 2.**
- **`get_user_org_ids()`** must be `SECURITY DEFINER`, `STABLE`, scoped over
  `organization_members`, and return an empty `uuid[]` (never NULL). The migration
  asserts existence (step 0b); confirm definition out-of-band.

## Regenerate TypeScript types
After the schema change, regenerate types so the new tables are typed:
```bash
supabase gen types typescript --linked > types/database.types.ts
# or: supabase gen types typescript --project-id <PROJECT_REF> --schema public > types/database.types.ts
```
`org_materials.default_location_id` will be nullable (correct). Enforce
"required-on-adopt" in app code, not via the type.

## Enforcing "adopting a catalog item requires default_location_id + reorder policy"
`default_location_id` is nullable at the DB level to admit legacy rows. The rule
is enforced in two layers:

1. **App form (primary):** the "Add to my inventory" form requires
   `default_location_id` (and reorder policy) before submit.
2. **Optional DB trigger (defense in depth):**
```sql
CREATE OR REPLACE FUNCTION public.org_materials_require_location()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_active AND NEW.default_location_id IS NULL THEN
    RAISE EXCEPTION
      'Adopting a catalog item requires a default_location_id (org_materials.id=%).',
      NEW.id;
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER trg_org_materials_require_location
  BEFORE INSERT ON public.org_materials
  FOR EACH ROW EXECUTE FUNCTION public.org_materials_require_location();
```
Add `OR NEW.reorder_point IS NULL` to the condition if reorder policy is also
mandatory on adopt.

## Ordered PHASE 2 plan (separate, breaking — do NOT run with Phase 1)
1. **Refactor the app** to read identity from `catalog_items` and policy from
   `org_materials`; write new per-org items as `(catalog_items?, org_materials)`
   instead of `materials`. Both code paths coexist because Phase 1 kept
   `materials` populated and ids aligned. Touch points: `types/database.types.ts`
   (regen), `app/hooks/useMaterials.ts`, `app/materials/**`, `app/onboarding/**`,
   `app/components/StarterKits.tsx`, `app/page.tsx` (dashboard), `app/history`,
   the deletion-guard counts in `app/categories` / `app/units`.
2. **Dual-read validation:** diff `view_current_stock` / `view_stock_by_location`
   between legacy and the Phase-2 rewrites (commented at the bottom of the
   migration). Confirm identical rows per org; confirm no private field leaks.
3. **Swap the views** (`CREATE OR REPLACE VIEW` from the Phase-2 block). Column
   contract is preserved exactly, so the app needs no view-related change.
4. **Repoint the ledger FK** to `org_materials(id)` (no data moves; ids identical).
5. **Stop writing to `materials`**; bake for one release.
6. **Drop `materials`** once nothing depends on it. Back up immediately before.
7. Regenerate TS types again; remove legacy `materials` usages.

### Rollback posture
- **Phase 1** rolls back trivially (additive): `DROP TABLE public.org_materials;`
  then `DROP TABLE public.catalog_items;` (also drop the two trigger functions),
  or restore the pre-migration backup. The app never depended on the new tables.
- **Phase 2** is breaking; rely on the step-6 backup and the ability to re-create
  the old views/`materials`. Do Phase 2 in a maintenance window or on a branch.

## Residual risks to verify against your live DB
1. **`specs` contents** — public-only attributes may be re-added to
   `catalog_items`; commercial data must stay per-org.
2. **`get_user_org_ids()` definition** — confirm `SECURITY DEFINER`, returns empty
   `uuid[]` (not NULL), scoped over `organization_members`.
3. **Exact legacy view column contracts** — diff against `pg_get_viewdef` before
   swapping in Phase 2 (the live view DDL is not in version control).
4. **0e WARNING / 0d INFO reports** — review on first apply to confirm dedupe /
   per-material-identity behavior matches intent.
