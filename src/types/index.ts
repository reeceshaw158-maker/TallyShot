export type Category =
  | 'Food & Drink'
  | 'Travel'
  | 'Transport'
  | 'Accommodation'
  | 'Office & Tech'
  | 'Utilities'
  | 'Healthcare'
  | 'Entertainment'
  | 'Shopping'
  | 'Other';

export const CATEGORIES: Category[] = [
  'Food & Drink',
  'Travel',
  'Transport',
  'Accommodation',
  'Office & Tech',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Other',
];

/**
 * Default tax-deductible status per category.
 * Used for new receipts and for backfilling existing rows during migration.
 * User can always override per-receipt.
 */
export const CATEGORY_DEDUCTIBLE_DEFAULTS: Record<Category, boolean> = {
  'Food & Drink': false,
  'Travel': true,
  'Transport': true,
  'Accommodation': true,
  'Office & Tech': true,
  'Utilities': false,
  'Healthcare': false,
  'Entertainment': false,
  'Shopping': false,
  'Other': false,
};

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

/**
 * Receipt lifecycle. v1 only ever stores `complete` or `needs_review`; the
 * other values are pre-baked so the UI status-pill component can extend
 * cleanly when:
 *   - v1.1 adds offline AI queueing → `pending` and `extracting` get used
 *   - v2 adds the submit workflow → `draft / submitted / approved / rejected`
 *     get used (Dext-style; receipts sent on to a manager or accountant)
 *
 * Designing the storage column + pill component for the full set now means
 * later releases don't require a migration or a component rewrite. The DB
 * schema column is plain TEXT so adding new values is type-only.
 */
export type ReceiptStatus =
  | 'complete'
  | 'needs_review'
  | 'pending'
  | 'extracting'
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected';

/**
 * Tax mode for receipt totals.
 *
 * - `inclusive`: total already contains tax (UK VAT, AU/NZ GST, most EU VAT).
 *   The Saldo Apps bug — adding tax on top of an already-inclusive total —
 *   is the most-cited 1★ complaint in the receipt-scanner category. We don't
 *   make that mistake.
 * - `exclusive`: total is pre-tax; tax is added on top (US sales tax,
 *   Canadian GST/PST in some provinces).
 */
export type TaxMode = 'inclusive' | 'exclusive';

export type Region = 'GB' | 'EU' | 'US' | 'AU' | 'NZ' | 'CA' | 'other';

export interface RegionPreset {
  name: string;
  flag: string;
  taxMode: TaxMode;
  currency: string;
  taxLabel: string;
}

export const REGION_PRESETS: Record<Region, RegionPreset> = {
  GB:    { name: 'United Kingdom', flag: '🇬🇧', taxMode: 'inclusive', currency: 'GBP', taxLabel: 'VAT' },
  EU:    { name: 'European Union', flag: '🇪🇺', taxMode: 'inclusive', currency: 'EUR', taxLabel: 'VAT' },
  AU:    { name: 'Australia',      flag: '🇦🇺', taxMode: 'inclusive', currency: 'AUD', taxLabel: 'GST' },
  NZ:    { name: 'New Zealand',    flag: '🇳🇿', taxMode: 'inclusive', currency: 'NZD', taxLabel: 'GST' },
  US:    { name: 'United States',  flag: '🇺🇸', taxMode: 'exclusive', currency: 'USD', taxLabel: 'Sales tax' },
  CA:    { name: 'Canada',         flag: '🇨🇦', taxMode: 'exclusive', currency: 'CAD', taxLabel: 'Sales tax' },
  other: { name: 'Other',          flag: '🌍', taxMode: 'inclusive', currency: 'GBP', taxLabel: 'Tax' },
};

export const REGION_ORDER: Region[] = ['GB', 'EU', 'US', 'AU', 'NZ', 'CA', 'other'];

export interface Receipt {
  id: number;
  merchant: string;
  date: string;
  currency: string;
  line_items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  payment_method: string | null;
  /**
   * Receipt or invoice number. Editable on every receipt — Dext shipped
   * without this and got dragged in reviews ("can't fix typos in invoice
   * number, have to delete and re-upload"). TallyShot makes everything
   * tap-to-edit.
   */
  invoice_number: string | null;
  category: Category;
  notes: string;
  image_uri: string;
  status: ReceiptStatus;
  is_tax_deductible: boolean;
  /**
   * Soft-delete timestamp. NULL = active receipt (visible in lists).
   * Non-null = archived (hidden from default lists, viewable in Settings →
   * Archived Receipts, restorable). Counters Dext's "no way to access
   * archived receipts" review pattern. Permanent deletion is a separate
   * step from the Archived screen.
   */
  archived_at: string | null;
  created_at: string;
}

export interface ReceiptDraft extends Omit<Receipt, 'id' | 'created_at' | 'status' | 'archived_at'> {
  status?: ReceiptStatus;
}
