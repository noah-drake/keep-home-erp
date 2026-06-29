# Keep — Integrations & Roadmap

How the scan → lookup → receive → consume → recipe vision is wired, and how each future
capability plugs into the same seams. Grounded in the current repo (Next.js 16 + Supabase,
pure logic in `lib/`, the shared-catalog schema from
[`20260629130000_split_materials_catalog.sql`](../../supabase/migrations/20260629130000_split_materials_catalog.sql)).

## Product data source

**Open Food Facts (primary) → USDA FoodData Central (fallback).** Both licenses explicitly
permit storing + redistributing data inside the app, and both carry nutrition (the bridge to
MyFitnessPal). **UPCitemdb and Barcode Lookup are deliberately excluded** — their terms forbid
retention/redistribution, so their data must never be written to `catalog_items`. Datakick is
dead (2020).

| Source | Endpoint | Auth | License | Notes |
|---|---|---|---|---|
| Open Food Facts | `GET world.openfoodfacts.org/api/v2/product/{barcode}.json` | none (descriptive `User-Agent` mandatory) | **ODbL** — store/redistribute **with attribution** | ~15 reads/min/IP. Images are separately CC-BY-SA. |
| USDA FDC Branded | `GET api.nal.usda.gov/fdc/v1/foods/search?dataType=Branded` | free `FDC_API_KEY` | **CC0** — public domain | No barcode endpoint — search, then verify `gtinUpc == barcode`. |

**Compliance:** show "Data from Open Food Facts (ODbL)" wherever OFF data appears (the new-good
form already does), and store a per-row `license` so redistribution rules stay auditable.

## Integration architecture (pluggable adapters behind one interface each)

Three capability interfaces, one env-keyed factory each. Pure adapters live in
`lib/integrations/` (input → Zod-validated normalized draft; no secrets, no Supabase, no DOM —
unit-tested like the rest of `lib/`). **Providers run only inside server route handlers**, so
keys and the service-role Supabase key never reach the client bundle.

```
lib/integrations/
  product-lookup/   types.ts  openfoodfacts.ts  usda.ts  chain.ts  index.ts   ← BUILT
  nutrition-sync/   types.ts  mfp-mcp.ts  ...                                  ← LATER (Phase 3)
  receipt/          types.ts  llm-vision.ts  ...                              ← LATER (Phase 2)

app/api/
  catalog/lookup/route.ts          ← BUILT (GET ?barcode= → CatalogDraft)
  receipts/parse/route.ts          ← LATER
  integrations/mfp/sync/route.ts   ← LATER (cron)

utils/
  supabase.ts          browser anon-key client (exists)
  supabase-server.ts   service-role client, route-handlers only  ← add in Phase 0
```

**Swap a source with one env var, zero call-site edits:**
`PRODUCT_LOOKUP_PROVIDER = openfoodfacts | usda | chain` (default `chain`). The same factory
shape (`getNutritionSync()`, `getReceiptParser()`) lets MFP-MCP → Terra or LLM-vision → cloud
OCR be swapped later without touching callers.

**Hard rules baked in:**
- Normalize at the adapter boundary — raw provider JSON never leaks upward.
- `ProductLookupProvider` only ever writes **global** `catalog_items` (`visibility='global'`),
  which per RLS must run as **`service_role`**.
- Inventory mutations (receiving, consumption) reuse the **existing ledger path**
  (`movementInsertSchema` → `inventory_movements` against `org_materials.id`) — never a parallel
  writer.
- MCP clients are server-side sidecars; a route talks to them via the MCP SDK over stdio/HTTP,
  never imported into a client component.

## Roadmap

### Phase 0 — Server foundation (prerequisite)
- Apply the two migrations (split + `nutrition`), regenerate `types/database.types.ts`.
- Add `utils/supabase-server.ts` with `SUPABASE_SERVICE_ROLE_KEY` (server-only).
- Complete the lookup route: after returning the draft, **upsert it as a global `catalog_items`
  row via service-role** so each barcode is fetched once across all orgs (the
  `catalog_items_global_barcode_uidx` handles dedupe).

### Phase 1 — Product lookup on unknown barcode ✅ (this iteration)
- `lib/integrations/product-lookup/*` behind `ProductLookupProvider` (OFF + USDA + chain).
- `GET /api/catalog/lookup?barcode=` returns a normalized `CatalogDraft`.
- Scanner miss → `/materials/new?barcode=` prefills name/description + ODbL attribution; the
  user confirms and sets their own per-Keep policy (location, reorder point). **Receive** = the
  existing `INBOUND` movement.

### Phase 2 — Receipt OCR → bulk receiving
- `ReceiptParser` adapter; recommended impl is **LLM vision** (one call does OCR + line-item
  extraction, beating Tesseract on photographed/thermal receipts) with a strict JSON schema.
- `POST /api/receipts/parse` (server-only key) → Zod-validated `ReceivedLine[]` → fuzzy-match to
  `catalog_items` → feed the **existing batch-entry grid** as a human-confirm draft (never a
  silent commit). Persist store-specific alias → `catalog_item_id` so repeat receipts auto-match.
  Confirmed lines become org-scoped `INBOUND` movements.

### Phase 3 — MyFitnessPal consumption → stock decrement
- **No official MFP API** (deprecated 2020). Realistic path: a community **MFP MCP server** run
  as a server-side sidecar (`mfp_get_diary`), auth via cached browser session — unofficial,
  brittle, poll (no webhooks). ToS-clean alternative: Terra/Spike aggregators behind the same
  `NutritionLogConsumer` interface.
- `app/api/integrations/mfp/sync` on a cron: pull today's diary → match each food to a
  `catalog_item` (barcode, else fuzzy name+brand over a confidence threshold) → convert
  `servings × servingSize` to stock units → write an org-scoped **`OUTBOUND`** movement via the
  existing ledger. **Idempotency:** persist processed diary `externalId`s. Unmatched → review
  queue, never silent failure.

### Phase 4 — Recipe generator
- Reads on-hand (`view_current_stock`) + `catalog_items.nutrition` to propose recipes from
  current stock and forecast post-cook decrements; confirmed cooks write `OUTBOUND` movements.
  The nutrition captured in Phases 1–3 is what makes "what can I cook, and what are the macros"
  answerable without re-fetching.
