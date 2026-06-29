import { z } from 'zod'

/**
 * Zod schemas for the data the app writes back to Supabase. These validate at the
 * client/server boundary (form submits, batch commits) so a malformed row never reaches the
 * ledger, and they double as the single source of truth for the corresponding TS types via
 * `z.infer`. Keep these aligned with `types/database.types.ts`.
 */

export const movementKindSchema = z.enum(['INBOUND', 'OUTBOUND', 'TRANSFER'])

/**
 * One row in the batch-entry grid, validated at commit time. Quantity arrives as a string
 * from the <input>, so we coerce and require it to be strictly positive; a TRANSFER must also
 * name a distinct arrival location.
 */
export const transactionLineSchema = z
  .object({
    material_id: z.string().min(1, 'Select a good'),
    location_id: z.string().min(1, 'Select a location'),
    to_location_id: z.string(),
    quantity: z.coerce
      .number({ message: 'Enter a quantity' })
      .positive('Quantity must be greater than zero'),
    type: movementKindSchema,
  })
  .refine(
    (line) =>
      line.type !== 'TRANSFER' ||
      (line.to_location_id.length > 0 && line.to_location_id !== line.location_id),
    { message: 'A transfer needs a different arrival location', path: ['to_location_id'] }
  )

export type TransactionLineInput = z.infer<typeof transactionLineSchema>

/**
 * Validate every commit-ready line in a batch, returning a per-line message for the first
 * problem on each line. An empty array means the batch is safe to build into movements.
 */
export function collectLineErrors(
  lines: { id: number }[]
): { id: number; message: string }[] {
  const errors: { id: number; message: string }[] = []
  for (const line of lines) {
    const result = transactionLineSchema.safeParse(line)
    if (!result.success) {
      errors.push({ id: line.id, message: result.error.issues[0].message })
    }
  }
  return errors
}

/** Shape of a row destined for the `inventory_movements` ledger. */
export const movementInsertSchema = z.object({
  organization_id: z.string().min(1),
  material_id: z.string().min(1),
  location_id: z.string().min(1),
  quantity: z.number().refine((q) => q !== 0, 'A ledger movement cannot be zero'),
  movement_type: z.enum([
    'INBOUND',
    'OUTBOUND',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
  ]),
  notes: z.string().nullable().optional(),
})

export type MovementInsert = z.infer<typeof movementInsertSchema>

/**
 * Master-data form for creating/editing a good. Optional numeric fields are coerced from
 * their string inputs and clamped to non-negative; blank strings become null rather than 0
 * so "unset" stays distinct from "zero".
 */
const optionalNonNegative = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? null : v),
  z.coerce.number().min(0, 'Cannot be negative').nullable()
)

export const materialFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().optional(),
  reorder_point: optionalNonNegative,
  lot_quantity: optionalNonNegative,
})

export type MaterialFormInput = z.infer<typeof materialFormSchema>
