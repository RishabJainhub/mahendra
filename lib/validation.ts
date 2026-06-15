import { z } from 'zod';

export const TallyImportInputSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.enum(['xml', 'xlsx', 'xls']),
  fileContent: z.string().min(1),
  mappingId: z.string().uuid(),
});

export const BillItemInputSchema = z.object({
  item_id: z.string().uuid(),
  qty: z.number().positive(),
  rate: z.number().nonnegative(),
});

export const SupplierInviteInputSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  phone: z.string().optional(),
  pricing_rule_id: z.string().uuid().optional(),
});

export const PricingRuleInputSchema = z.object({
  supplier_id: z.string().uuid(),
  model: z.enum(['standard', 'company151']),
  margin_pct: z.number().min(0).max(100).default(0),
  markup_pct: z.number().min(0).max(100).default(0),
  gst_pct: z.number().min(0).max(100).default(5),
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
