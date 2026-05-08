import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Receipt } from '../types';

export type ReportTemplate = 'tax' | 'reimbursement' | 'detailed';

export interface ReportOptions {
  receipts: Receipt[];
  template: ReportTemplate;
  dateRange: string;
  currency: string;
  title?: string;
  notes?: string;
}

export const TEMPLATE_INFO: Record<ReportTemplate, { name: string; description: string; icon: string }> = {
  tax: {
    name: 'Tax submission',
    description: 'Grouped by category. Highlights deductibles. Best for self-assessment.',
    icon: 'cash-multiple',
  },
  reimbursement: {
    name: 'Reimbursement',
    description: 'Chronological list with totals only. Send to your employer or client.',
    icon: 'briefcase-outline',
  },
  detailed: {
    name: 'Detailed',
    description: 'Every line item from every receipt. Maximum detail.',
    icon: 'file-document-multiple-outline',
  },
};

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function escape(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── CSV ──────────────────────────────────────────────────────────────────

/**
 * Format line items as a single human-readable string for the CSV.
 * Format: "2x Coffee @ £3.50; 1x Croissant @ £2.50"
 */
function formatLineItemsForCSV(receipt: Receipt): string {
  if (!receipt.line_items?.length) return '';
  return receipt.line_items
    .map((li) => {
      const desc = li.description?.trim() || 'Item';
      const qty = li.quantity || 1;
      const unit = li.unit_price?.toFixed(2) ?? '0.00';
      return `${qty}x ${desc} @ ${receipt.currency} ${unit}`;
    })
    .join('; ');
}

export function generateCSV(receipts: Receipt[]): string {
  const headers = [
    'Date', 'Merchant', 'Category', 'Subtotal', 'Tax', 'Total',
    'Currency', 'Payment Method', 'Tax Deductible',
    'Line Items Count', 'Line Items', 'Notes',
  ];
  const rows = receipts.map((r) => [
    r.date,
    `"${r.merchant.replace(/"/g, '""')}"`,
    r.category,
    r.subtotal.toFixed(2),
    r.tax.toFixed(2),
    r.total.toFixed(2),
    r.currency,
    r.payment_method ?? '',
    r.is_tax_deductible ? 'Yes' : 'No',
    String(r.line_items?.length ?? 0),
    `"${formatLineItemsForCSV(r).replace(/"/g, '""')}"`,
    `"${r.notes.replace(/"/g, '""')}"`,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export async function shareCSV(receipts: Receipt[], filename: string): Promise<void> {
  const csv = generateCSV(receipts);
  const uri = `${FileSystem.documentDirectory}${filename}.csv`;
  await FileSystem.writeAsStringAsync(uri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
}

// ── PDF: shared header / styles ──────────────────────────────────────────

function pdfStyles(): string {
  return `
    body { font-family: -apple-system, Arial, sans-serif; font-size: 12px; color: #222; margin: 32px; }
    h1 { color: #1a73e8; margin: 0 0 4px 0; font-size: 22px; }
    h2 { font-size: 14px; margin-top: 24px; margin-bottom: 8px; color: #444; }
    .subtitle { color: #666; margin-bottom: 18px; font-size: 13px; }
    .notes { background: #fffbe5; border-left: 3px solid #ffc107; padding: 10px 14px; margin: 8px 0 16px; font-size: 12px; color: #5c4400; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th { background: #1a73e8; color: white; padding: 8px; text-align: left; font-size: 11px; }
    td { padding: 6px 8px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #fafafa; }
    .summary-grid { display: flex; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
    .summary-box { flex: 1; min-width: 140px; padding: 14px 18px; border-radius: 10px; }
    .summary-box .label { font-size: 10px; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-box .amount { font-size: 20px; font-weight: bold; margin-top: 4px; }
    .blue-box { background: #1a73e8; color: white; }
    .green-box { background: #2e7d32; color: white; }
    .grey-box { background: #f5f5f5; color: #333; border: 1px solid #e0e0e0; }
    .ded-dot { color: #2e7d32; font-size: 12px; font-weight: bold; }
    .legend { font-size: 10px; color: #888; margin-top: 4px; }
    .footer { margin-top: 28px; font-size: 10px; color: #999; text-align: center; }
  `;
}

function pdfHeader(title: string, dateRange: string, count: number, notes?: string): string {
  const notesHtml = notes
    ? `<div class="notes">${escape(notes).replace(/\n/g, '<br/>')}</div>`
    : '';
  return `
    <h1>${escape(title)}</h1>
    <p class="subtitle">${escape(dateRange)} · ${count} receipt${count !== 1 ? 's' : ''}</p>
    ${notesHtml}
  `;
}

function pdfFooter(): string {
  const generated = new Date().toLocaleString('en-GB');
  return `<div class="footer">Generated by TallyShot on ${escape(generated)}</div>`;
}

function summaryGrid(receipts: Receipt[], currency: string): string {
  const total = receipts.reduce((s, r) => s + r.total, 0);
  const deductible = receipts.filter((r) => r.is_tax_deductible).reduce((s, r) => s + r.total, 0);
  const deductibleCount = receipts.filter((r) => r.is_tax_deductible).length;

  return `
    <div class="summary-grid">
      <div class="summary-box blue-box">
        <div class="label">Total spent</div>
        <div class="amount">${formatCurrency(total, currency)}</div>
      </div>
      ${deductibleCount > 0 ? `
      <div class="summary-box green-box">
        <div class="label">Tax deductible (${deductibleCount})</div>
        <div class="amount">${formatCurrency(deductible, currency)}</div>
      </div>` : ''}
      <div class="summary-box grey-box">
        <div class="label">Period</div>
        <div class="amount" style="font-size: 14px; padding-top: 4px;">${escape(receipts.length > 0 ? receipts[receipts.length - 1].date + ' → ' + receipts[0].date : '—')}</div>
      </div>
    </div>
  `;
}

// ── Template: Tax submission (grouped by category, deductible focus) ─────

function templateTax(opts: ReportOptions): string {
  const { receipts, dateRange, currency, title, notes } = opts;
  const reportTitle = title || 'Tax Expense Report';

  // Group by category, sort by category total desc
  const groups = new Map<string, Receipt[]>();
  receipts.forEach((r) => {
    if (!groups.has(r.category)) groups.set(r.category, []);
    groups.get(r.category)!.push(r);
  });
  const sortedGroups = [...groups.entries()].sort(
    (a, b) => b[1].reduce((s, r) => s + r.total, 0) - a[1].reduce((s, r) => s + r.total, 0)
  );

  const groupSections = sortedGroups
    .map(([cat, items]) => {
      const catTotal = items.reduce((s, r) => s + r.total, 0);
      const catDeductible = items.filter((r) => r.is_tax_deductible).reduce((s, r) => s + r.total, 0);
      const rows = items
        .map(
          (r) => `
            <tr>
              <td>${r.date}</td>
              <td>${escape(r.merchant)}</td>
              <td style="text-align:right">${formatCurrency(r.total, r.currency)}</td>
              <td style="text-align:center">${r.is_tax_deductible ? '<span class="ded-dot">●</span>' : ''}</td>
            </tr>`
        )
        .join('');
      return `
        <h2>${escape(cat)} — ${formatCurrency(catTotal, currency)}${catDeductible > 0 ? ` <span style="color:#2e7d32; font-weight: 400; font-size: 12px;">(${formatCurrency(catDeductible, currency)} deductible)</span>` : ''}</h2>
        <table>
          <tr><th>Date</th><th>Merchant</th><th style="text-align:right">Total</th><th style="text-align:center">Ded.</th></tr>
          ${rows}
        </table>`;
    })
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${pdfStyles()}</style></head><body>
    ${pdfHeader(reportTitle, dateRange, receipts.length, notes)}
    ${summaryGrid(receipts, currency)}
    ${groupSections}
    <p class="legend">● = tax-deductible</p>
    ${pdfFooter()}
  </body></html>`;
}

// ── Template: Reimbursement (chronological, totals only) ─────────────────

function templateReimbursement(opts: ReportOptions): string {
  const { receipts, dateRange, currency, title, notes } = opts;
  const reportTitle = title || 'Expense Reimbursement';
  // chronological asc
  const sorted = [...receipts].sort((a, b) => a.date.localeCompare(b.date));

  const rows = sorted
    .map(
      (r) => `
      <tr>
        <td>${r.date}</td>
        <td>${escape(r.merchant)}</td>
        <td>${escape(r.category)}</td>
        <td>${escape(r.payment_method ?? '')}</td>
        <td style="text-align:right">${formatCurrency(r.total, r.currency)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${pdfStyles()}</style></head><body>
    ${pdfHeader(reportTitle, dateRange, receipts.length, notes)}
    ${summaryGrid(receipts, currency)}
    <h2>Expenses</h2>
    <table>
      <tr><th>Date</th><th>Merchant</th><th>Category</th><th>Payment</th><th style="text-align:right">Amount</th></tr>
      ${rows}
    </table>
    ${pdfFooter()}
  </body></html>`;
}

// ── Template: Detailed (every line item) ─────────────────────────────────

function templateDetailed(opts: ReportOptions): string {
  const { receipts, dateRange, currency, title, notes } = opts;
  const reportTitle = title || 'Detailed Expense Report';
  // chronological desc
  const sorted = [...receipts].sort((a, b) => b.date.localeCompare(a.date));

  const sections = sorted
    .map((r) => {
      const lineRows = r.line_items
        .map(
          (li) => `
            <tr>
              <td>${escape(li.description)}</td>
              <td style="text-align:right">${li.quantity}</td>
              <td style="text-align:right">${formatCurrency(li.unit_price, r.currency)}</td>
              <td style="text-align:right">${formatCurrency(li.total, r.currency)}</td>
            </tr>`
        )
        .join('');
      const lineSection = r.line_items.length > 0 ? `
        <table style="margin-top: 4px;">
          <tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Line</th></tr>
          ${lineRows}
        </table>` : '<p style="color:#999; font-size:11px; margin: 4px 0 12px;">(no line items recorded)</p>';
      return `
        <h2 style="margin-top: 22px;">${escape(r.merchant)} — ${formatCurrency(r.total, r.currency)} ${r.is_tax_deductible ? '<span class="ded-dot">●</span>' : ''}</h2>
        <p style="font-size: 11px; color: #666; margin: 0 0 8px;">${r.date} · ${escape(r.category)}${r.payment_method ? ' · ' + escape(r.payment_method) : ''}</p>
        ${lineSection}
        <p style="font-size: 11px; margin: 4px 0;">Subtotal: ${formatCurrency(r.subtotal, r.currency)} · Tax: ${formatCurrency(r.tax, r.currency)} · <strong>Total: ${formatCurrency(r.total, r.currency)}</strong></p>
        ${r.notes ? `<p style="font-size: 11px; color: #555; font-style: italic;">${escape(r.notes)}</p>` : ''}`;
    })
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${pdfStyles()}</style></head><body>
    ${pdfHeader(reportTitle, dateRange, receipts.length, notes)}
    ${summaryGrid(receipts, currency)}
    ${sections}
    <p class="legend">● = tax-deductible</p>
    ${pdfFooter()}
  </body></html>`;
}

// ── Public API ──────────────────────────────────────────────────────────

export function buildPdfHtml(opts: ReportOptions): string {
  switch (opts.template) {
    case 'tax': return templateTax(opts);
    case 'reimbursement': return templateReimbursement(opts);
    case 'detailed': return templateDetailed(opts);
  }
}

/**
 * Generate a PDF and return its file URI without sharing.
 * Use this when you want to preview before triggering share.
 */
export async function generatePDF(opts: ReportOptions): Promise<string> {
  const html = buildPdfHtml(opts);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

/**
 * Share an existing PDF file via the system share sheet.
 */
export async function sharePDFFile(uri: string): Promise<void> {
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}

/**
 * Backwards-compat: build + share in one call (used by Settings → Export shortcut).
 */
export async function sharePDF(receipts: Receipt[], dateRange: string, currency: string): Promise<void> {
  const uri = await generatePDF({
    receipts,
    template: 'tax',
    dateRange,
    currency,
  });
  await sharePDFFile(uri);
}
