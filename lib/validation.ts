import { z } from 'zod';

export const MAX_IMPORT_CONTENT_CHARS = 15_000_000;

export const TallyImportInputSchema = z
  .object({
    fileName: z.string().min(1).max(255),
    fileType: z.enum(['xml', 'xlsx', 'xls', 'pdf']),
    fileContent: z.string().min(1).max(MAX_IMPORT_CONTENT_CHARS, 'File content too large'),
    mappingId: z.string().uuid().optional(),
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
