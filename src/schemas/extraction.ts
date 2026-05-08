import { z } from 'zod';
import { CATEGORIES } from '../types';

export const LineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  total: z.number(),
});

export const ExtractionSchema = z.object({
  merchant: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO 8601 date'),
  currency: z.string().length(3, 'Must be ISO 4217 currency code'),
  line_items: z.array(LineItemSchema),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
  payment_method: z.string().nullable(),
  // Receipt or invoice number where present; null on most till receipts.
  invoice_number: z.string().nullable().optional(),
  suggested_category: z.enum(CATEGORIES as [string, ...string[]]),
});

export type ExtractionResult = z.infer<typeof ExtractionSchema>;
