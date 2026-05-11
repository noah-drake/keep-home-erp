# Home ERP Architecture Audit Report

**Date:** May 11, 2026  
**Auditor:** Principal Software Architect  
**Scope:** Comprehensive codebase and database audit prior to Barcode Scanning engine development

---

## Executive Summary

The Home ERP codebase demonstrates a solid foundation with well-structured Next.js routing, proper Supabase integration, and consistent use of TypeScript. However, several architectural concerns require attention before implementing the hardware-level Barcode Scanning feature. The audit identified **4 critical pillars** with specific findings and prioritized remediation tasks.

---

## 1. Database & State Alignment

### ✅ Strengths
- **Clean is_global Implementation**: The `is_global` boolean is properly implemented throughout the codebase
  - Used correctly in `app/onboarding/page.tsx` (lines 121, 170, 329, 355, 643)
  - Properly handled in database views and RPC functions
  - Clear separation between global catalog materials and organization-specific items

- **No Deprecated Architecture Remnants**: 
  - ✅ No traces of deleted `global_goods` table found
  - ✅ Clean migration from legacy CSV importer (still present but properly contained)

### ⚠️ Areas of Concern
- **CSV Importer Legacy**: The `app/materials/import/page.tsx` contains 13 CSV-related matches. While functional, this represents legacy architecture that should be evaluated for deprecation in favor of the global catalog system.

- **Database Type Safety**: The `database.types.ts` file contains comprehensive Supabase-generated types, but some client-side code uses `any[]` types instead of proper typing.

### 🔍 Specific Findings
```typescript
// Found in app/inventory/page.tsx - Should use proper typing
const [materials, setMaterials] = useState<any[]>([])
const [locations, setLocations] = useState<any[]>([])
```

---

## 2. Component Modularity

### 🚨 Critical Issues Identified

#### **Fat Components Requiring Decomposition**

1. **`app/page.tsx` (461 lines)** - **PRIORITY 1**
   - Contains dashboard logic, data fetching, state management, and complex UI rendering
   - Should be split into:
     - `DashboardHeader` component (lines 200-253)
     - `LocationGrid` component (lines 258-358) 
     - `LedgerFeed` component (lines 360-395)
     - `StockRow` is already properly extracted (lines 403-459)

2. **`app/onboarding/page.tsx` (786 lines)** - **PRIORITY 2**
   - Multi-step wizard with complex state management
   - Should be decomposed into:
     - `StoreSelectionStep` component
     - `GoodsMappingStep` component  
     - `AuditCommitStep` component
     - `CustomGoodsForm` component

3. **`app/inventory/page.tsx` (415 lines)** - **PRIORITY 3**
   - Transaction engine with complex business logic
   - Should split into:
     - `TransactionForm` component
     - `TransactionLine` component
     - `BulkActions` component

### ✅ Well-Structured Components
- `StockRow` component is properly modularized
- `StarterKits` component is cleanly separated
- Context-based organization management is well-implemented

---

## 3. Type Safety Analysis

### ✅ TypeScript Implementation
- **Supabase Integration**: Excellent use of generated types from `database.types.ts`
- **Component Props**: Proper typing in most components
- **RPC Functions**: Well-typed database function calls

### ⚠️ Type Safety Gaps

#### **Critical TypeScript Violations**
1. **`any[]` Usage in State Management**
   ```typescript
   // app/inventory/page.tsx lines 18-25
   const [materials, setMaterials] = useState<any[]>([])
   const [locations, setLocations] = useState<any[]>([])
   const [stockByLoc, setStockByLoc] = useState<any[]>([])
   ```

2. **Missing Type Guards**
   - `app/page.tsx` line 88: Unsafe type assertion `as unknown as DashboardRpcPayload`
   - Should implement proper runtime validation

3. **Loose Event Handler Typing**
   ```typescript
   // app/inventory/page.tsx line 86
   const updateLine = (id: number, field: string, value: any) => {
   ```

### 📊 Type Safety Score: 7/10
- Good foundation with room for improvement
- Critical for barcode scanning feature reliability

---

## 4. Palantir FDE Grade: Client-Side Logic Analysis

### 🚨 Heavy Client-Side Processing Identified

#### **Complex Logic That Should Move to Backend**

1. **Dashboard Data Processing** - `app/page.tsx` (lines 105-152)
   ```typescript
   // 47 lines of client-side data transformation
   materialsList.forEach(mat => {
     const unit = unitsList.find(u => String(u.id) === String(mat.unit_id)) || unitsList.find(u => u.name === mat.unit_id)
     const stocksForMat = stockList.filter(s => String(s.material_id) === String(mat.id))
     // ... complex processing logic
   })
   ```
   **Recommendation**: Move to `get_dashboard_metrics` RPC function

2. **Inventory Transaction Logic** - `app/inventory/page.tsx` (lines 50-51, 106-107, 139-140)
   ```typescript
   const totalStock = itemStock.reduce((sum, s) => sum + (s.quantity ?? 0), 0)
   const itemStock = stockByLoc.filter(s => String(s.material_id) === newMaterialId && s.quantity > 0)
   ```
   **Recommendation**: Create `calculate_stock_movements` RPC function

3. **Shopping List Filtering** - `app/shopping-list/page.tsx` (lines 33-36)
   ```typescript
   const procurementList = data.filter(i => {
     const stock = i.current_stock ?? 0;
     const reorder = i.reorder_point ?? 0;
     return stock <= reorder && reorder > 0;
   })
   ```
   **Recommendation**: Create `get_procurement_list` RPC function

### ✅ Proper Backend Usage
- `get_dashboard_metrics` RPC function is well-implemented
- Database views (`view_stock_by_location`, `view_current_stock`) are properly utilized
- Organization-scoped queries are correctly implemented

### 📊 FDE Grade: 6/10
- Significant client-side processing that should be backend-optimized
- Critical for barcode scanning performance requirements

---

## Next.js Routing Structure Analysis

### ✅ Excellent Routing Architecture
- Clean App Router implementation with proper route groups
- Well-organized route hierarchy:
  ```
  /                    - Dashboard
  /onboarding          - Setup wizard
  /materials/*         - Material management
  /locations/*         - Location management  
  /inventory/*         - Transaction processing
  /shopping-list       - Procurement interface
  ```

### 🔄 Dynamic Routes Properly Implemented
- `[id]` routes for materials and locations
- Proper use of `useSearchParams` for query parameters
- Clean navigation patterns with `useRouter`

---

## Prioritized Refactoring Tasks

### **MUST COMPLETE Before Barcode Feature Development**

#### **Priority 1: Critical Foundation (Week 1)**
1. **Decompose Dashboard Component** (`app/page.tsx`)
   - Extract `DashboardHeader`, `LocationGrid`, `LedgerFeed` components
   - Move data processing logic to backend RPC functions
   - Implement proper TypeScript types for all state

2. **Fix TypeScript Safety Issues**
   - Replace all `any[]` types with proper `Tables<>` types
   - Add runtime validation for RPC responses
   - Implement strict typing for event handlers

#### **Priority 2: Performance Optimization (Week 2)**
3. **Backend Migration of Complex Logic**
   - Create `calculate_stock_movements` RPC function
   - Create `get_procurement_list` RPC function  
   - Enhance `get_dashboard_metrics` with client-side processing logic

4. **Component Modularization** (`app/onboarding/page.tsx`)
   - Split 786-line component into step-specific components
   - Extract form logic into reusable hooks

#### **Priority 3: Code Quality (Week 3)**
5. **Legacy Code Evaluation**
   - Assess CSV importer relevance vs global catalog
   - Deprecate or modernize based on business requirements
   - Consolidate duplicate logic patterns

---

## Barcode Scanning Feature Readiness Assessment

### ✅ Ready Areas
- Database schema supports barcode fields
- Organization context is properly implemented
- Routing structure can accommodate new barcode endpoints

### ⚠️ Requires Attention
- Type safety must be improved for hardware integration reliability
- Performance optimization needed for real-time barcode processing
- Component modularity required for maintainable barcode UI components

### 🚫 Blockers Until Fixed
- Heavy client-side processing will impact barcode scanning performance
- Type safety gaps could cause runtime errors with hardware APIs
- Fat components will make barcode feature integration difficult

---

## Recommendations Summary

1. **Immediate**: Fix TypeScript violations and decompose fat components
2. **Short-term**: Migrate complex client-side logic to backend RPC functions  
3. **Medium-term**: Evaluate and modernize legacy CSV import functionality
4. **Long-term**: Establish component library for consistent UI patterns

**Estimated Timeline**: 3 weeks to complete critical refactoring before barcode feature development.

---

**Audit Status**: ✅ COMPLETE  
**Next Review**: After Priority 1 refactoring completion  
**Barcode Feature Gate**: Blocked until critical items resolved
