// ── Legacy text category (kept for backwards compat) ─────────────────────────
export type CategoryName =
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

// Keep the old alias so existing code doesn't break
export type Category = CategoryName;

export const CATEGORIES: CategoryName[] = [
  'Food & Drink', 'Travel', 'Transport', 'Accommodation',
  'Office & Tech', 'Utilities', 'Healthcare', 'Entertainment',
  'Shopping', 'Other',
];

export const CATEGORY_DEDUCTIBLE_DEFAULTS: Record<CategoryName, boolean> = {
  'Food & Drink':  false,
  'Travel':        true,
  'Transport':     true,
  'Accommodation': true,
  'Office & Tech': true,
  'Utilities':     false,
  'Healthcare':    false,
  'Entertainment': false,
  'Shopping':      false,
  'Other':         false,
};

// ── DB category entity (from categories table) ────────────────────────────────
export interface DbCategory {
  id: number;
  name: string;
  icon: string;
  color: string;
  tax_deductible: boolean;
  is_default: boolean;
  sort_order: number;
  archived_at: string | null;
}

// ── Report ────────────────────────────────────────────────────────────────────
export interface Report {
  id: number;
  name: string;
  description: string;
  advance_amount: number;
  created_at: string;
  archived_at: string | null;
}

export interface ReportDraft {
  name: string;
  description: string;
  advance_amount: number;
}

// ── App settings (mirrors settings table row) ─────────────────────────────────
export interface AppSettings {
  biometric_enabled: boolean;
  mileage_rate: number;
  home_currency: string;
  distance_unit: 'mi' | 'km';
  auto_track_drives: boolean;
  updated_at: string;
}

// ── Receipt ───────────────────────────────────────────────────────────────────
export type ReceiptStatus =
  | 'complete'
  | 'needs_review'
  | 'pending'
  | 'extracting'
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected';

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
  other: { name: 'Other',          flag: '🌍',  taxMode: 'inclusive', currency: 'GBP', taxLabel: 'Tax' },
};

export const REGION_ORDER: Region[] = ['GB', 'EU', 'US', 'AU', 'NZ', 'CA', 'other'];

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Receipt {
  id: number;
  merchant: string;
  date: string;
  currency: string;
  line_items: LineItem[];
  subtotal: number;
  /** VAT / sales tax amount */
  tax: number;
  total: number;
  payment_method: string | null;
  invoice_number: string | null;
  /** Legacy text category — use category_id for new code */
  category: CategoryName;
  /** FK to categories table — preferred for new code */
  category_id: number | null;
  notes: string;
  image_uri: string;
  /** JSON-encoded string[] of extra image URIs for multi-page receipts */
  additional_images: string[];
  status: ReceiptStatus;
  is_tax_deductible: boolean;
  is_reimbursable: boolean;
  /** True if this is a refund / credit note */
  refund: boolean;
  /** Assigned report — null if unassigned */
  report_id: number | null;
  /** Archive timestamp — hidden from main list but not in trash */
  archived_at: string | null;
  /** Soft-delete timestamp — in trash, auto-purged after 30 days */
  deleted_at: string | null;
  updated_at: string;
  created_at: string;
}

export interface ReceiptDraft
  extends Omit<Receipt, 'id' | 'created_at' | 'updated_at' | 'status' | 'archived_at' | 'deleted_at'> {
  status?: ReceiptStatus;
}
