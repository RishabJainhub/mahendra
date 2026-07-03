import { z } from 'zod';

/**
 * Inline (server-action body) ceiling. Vercel caps serverless request bodies
 * at 4.5 MB on every plan; staying under 2 MB leaves headroom for base64
 * expansion and the JSON envelope. Larger files go through Supabase Storage
 * and are referenced by `storagePath`.
 */
export const MAX_IMPORT_CONTENT_CHARS = 2_000_000;

/**
 * Tally import payload. Small files (≤ MAX_IMPORT_CONTENT_CHARS) are sent
 * inline as `fileContent`; larger files are uploaded to the `tally-imports`
 * Storage bucket and referenced by `storagePath`. Exactly one of the two is
 * required.
 */
export const TallyImportInputSchema = z
  .object({
    fileName: z.string().min(1).max(255),
    fileType: z.enum(['xml', 'xlsx', 'xls', 'pdf']),
    fileContent: z.string().min(1).max(MAX_IMPORT_CONTENT_CHARS).optional(),
    storagePath: z
      .string()
      .min(1)
      .max(500)
      .regex(/^[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+$/, 'Invalid storage path')
      .optional(),
    mappingId: z.string().uuid().optional(),
  })
  .refine((d) => Boolean(d.fileContent) !== Boolean(d.storagePath), {
    message: 'Provide exactly one of fileContent or storagePath',
    path: ['fileContent'],
  })
  .refine((d) => d.fileType === 'pdf' || d.fileType === 'xml' || d.mappingId, {
    message: 'Column mapping is required for Excel imports',
    path: ['mappingId'],
  });

export const BillItemInputSchema = z.object({
  item_id: z.string().uuid(),
  qty: z.number().positive(),
  rate: z.number().nonnegative(),
});

export const ManualBillItemSchema = z.object({
  description: z.string().min(1).max(255),
  hsn: z.string().max(16).optional().or(z.literal('')),
  qty: z.coerce.number().positive(),
  rate: z.coerce.number().nonnegative(),
});

export const ManualBillInputSchema = z.object({
  supplierId: z.string().uuid(),
  billNumber: z.string().min(1).max(255),
  billDate: z.string().min(1),
  items: z.array(ManualBillItemSchema).min(1, 'Add at least one line item'),
});

const optionalShortString = z
  .string()
  .max(16)
  .optional()
  .transform((v) => (v == null ? '' : v.trim()));

export const SupplierInviteInputSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  phone: z.string().optional(),
  code_prefix: optionalShortString,
  code_number: optionalShortString,
  ma_markup1_pct: z.coerce.number().min(0).max(1000).default(0),
  ma_markup2_pct: z.coerce.number().min(0).max(1000).default(0),
  dna_markup1_pct: z.coerce.number().min(0).max(1000).default(0),
  dna_markup2_pct: z.coerce.number().min(0).max(1000).default(0),
  gst_pct: z.coerce.number().min(0).max(100).default(5),
});

export const PricingRuleInputSchema = z.object({
  supplier_id: z.string().uuid(),
  ma_markup1_pct: z.coerce.number().min(0).max(1000).default(0),
  ma_markup2_pct: z.coerce.number().min(0).max(1000).default(0),
  dna_markup1_pct: z.coerce.number().min(0).max(1000).default(0),
  dna_markup2_pct: z.coerce.number().min(0).max(1000).default(0),
  gst_pct: z.coerce.number().min(0).max(100).default(5),
});

export const SupplierUpdateInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  code_prefix: optionalShortString,
  code_number: optionalShortString,
});

export const ResetPasswordSchema = z
  .object({
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword'],
  });

export type TallyImportInput = z.infer<typeof TallyImportInputSchema>;
export type BillItemInput = z.infer<typeof BillItemInputSchema>;
export type ManualBillInput = z.infer<typeof ManualBillInputSchema>;
export type ManualBillItem = z.infer<typeof ManualBillItemSchema>;
export type SupplierInviteInput = z.infer<typeof SupplierInviteInputSchema>;
export type PricingRuleInput = z.infer<typeof PricingRuleInputSchema>;
export type SupplierUpdateInput = z.infer<typeof SupplierUpdateInputSchema>;

export function parseFormData<T extends z.ZodTypeAny>(
  formData: FormData,
  schema: T
): z.infer<T> {
  const obj: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    obj[key] = value;
  });
  return schema.parse(obj);
}
