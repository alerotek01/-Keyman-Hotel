/**
 * Export utilities for shift reconciliation records.
 * CSV generation + browser-print PDF.
 */

// ─── CSV Export ───────────────────────────────────────────────────────

function escapeCsv(val: any): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(fields: any[]): string {
  return fields.map(escapeCsv).join(',');
}

export function generateShiftCSV(recon: any, payments: any[], orders: any[]): string {
  const staff = recon.staff_shifts?.users?.full_name || 'Unknown';
  const role = recon.staff_shifts?.users?.role || '';
  const dept = recon.staff_shifts?.departments?.name || '';
  const shiftName = recon.staff_shifts?.shift_name || '';
  const shiftDate = recon.staff_shifts?.shift_date || '';
  const startTime = recon.staff_shifts?.start_time || '';
  const endTime = recon.staff_shifts?.end_time || '';
  const status = recon.status || '';
  const variance = recon.variance || 0;
  const varianceExplanation = recon.variance_explanation || '';

  const lines: string[] = [];

  // Header
  lines.push('Keyman Hotel — Shift Reconciliation Report');
  lines.push('');

  // Shift Summary
  lines.push('Shift Summary');
  lines.push(csvRow(['Staff', 'Role', 'Department', 'Shift', 'Date', 'Start', 'End', 'Status']));
  lines.push(csvRow([staff, role, dept, shiftName, shiftDate, startTime, endTime, status]));
  lines.push('');

  // Sales Summary
  lines.push('Sales Summary');
  lines.push(csvRow(['Total Sales', 'Cash', 'M-Pesa', 'Card', 'Variance']));
  lines.push(csvRow([
    recon.total_sales || 0,
    recon.cash_total || 0,
    recon.mpesa_total || 0,
    recon.card_total || 0,
    variance,
  ]));
  lines.push('');

  if (varianceExplanation) {
    lines.push(`Variance Explanation: ${varianceExplanation}`);
    lines.push('');
  }

  // Transactions
  if (payments && payments.length > 0) {
    lines.push(`Transactions (${payments.length})`);
    lines.push(csvRow(['#', 'Time', 'Amount', 'Method', 'M-Pesa Code', 'Receipt', 'Status']));
    payments.forEach((p: any, i: number) => {
      lines.push(csvRow([
        i + 1,
        p.created_at ? new Date(p.created_at).toLocaleTimeString() : '',
        p.amount,
        p.method || p.payment_method || '',
        p.mpesa_code || p.mpesa_transaction_id || '',
        p.receipt_image_url ? 'Yes' : 'No',
        p.status || '',
      ]));
    });
    lines.push('');
  }

  // Orders
  if (orders && orders.length > 0) {
    lines.push(`Orders (${orders.length})`);
    lines.push(csvRow(['#', 'Order #', 'Guest', 'Type', 'Status', 'Amount', 'Time']));
    orders.forEach((o: any, i: number) => {
      lines.push(csvRow([
        i + 1,
        o.order_number || '',
        o.guest_name || '',
        o.delivery_type || o.order_type || '',
        o.status || '',
        o.total_amount || o.total || 0,
        o.created_at ? new Date(o.created_at).toLocaleTimeString() : '',
      ]));
    });
    lines.push('');
  }

  // Footer
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push('Keyman Hotel — Confidential');

  return lines.join('\n');
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── PDF Export (Browser Print) ───────────────────────────────────────

export function generateShiftPDFReport(
  recon: any,
  payments: any[],
  orders: any[]
): void {
  const staff = recon.staff_shifts?.users?.full_name || 'Unknown';
  const role = recon.staff_shifts?.users?.role || '';
  const dept = recon.staff_shifts?.departments?.name || '';
  const shiftName = recon.staff_shifts?.shift_name || '';
  const shiftDate = recon.staff_shifts?.shift_date || '';
  const status = recon.status || '';
  const variance = recon.variance || 0;
  const varianceExplanation = recon.variance_explanation || '';
  const managerName = recon.users_manager?.full_name || recon.users_submitted?.full_name || '';

  const varianceColor = variance < 0 ? '#dc2626' : variance > 0 ? '#ea580c' : '#16a34a';
  const varianceLabel = variance < 0 ? 'short' : variance > 0 ? 'over' : 'none';

  const paymentRows = (payments || []).map((p: any, i: number) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${i + 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${p.created_at ? new Date(p.created_at).toLocaleTimeString() : '-'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">KES ${(p.amount || 0).toLocaleString()}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${p.method || p.payment_method || '-'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-family:monospace;">${p.mpesa_code || p.mpesa_transaction_id || '-'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${p.receipt_image_url ? '✅' : '-'}</td>
    </tr>
  `).join('');

  const orderRows = (orders || []).map((o: any, i: number) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${i + 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">#${o.order_number || ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${o.guest_name || '-'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${o.delivery_type || '-'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${o.status || '-'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">KES ${(o.total_amount || o.total || 0).toLocaleString()}</td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Shift Report — ${staff} — ${shiftDate}</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1f2937;
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 { font-size: 20px; margin: 0 0 4px 0; color: #92702D; }
    h2 { font-size: 14px; font-weight: 600; margin: 20px 0 8px 0; border-bottom: 2px solid #92702D; padding-bottom: 4px; color: #374151; }
    .subtitle { font-size: 12px; color: #6b7280; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
    .stat { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
    .stat-value { font-size: 20px; font-weight: 700; }
    .stat-label { font-size: 11px; color: #6b7280; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f3f4f6; padding: 6px 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #d1d5db; }
    .footer { margin-top: 24px; font-size: 10px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 8px; }
    .print-btn { position: fixed; top: 16px; right: 16px; padding: 8px 16px; background: #92702D; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .print-btn:hover { background: #7a5e24; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print();window.close();">🖨️ Print / Save as PDF</button>

  <h1>🏨 Keyman Hotel</h1>
  <div class="subtitle">Shift Reconciliation Report — Generated ${new Date().toLocaleString()}</div>

  <div class="grid">
    <div class="stat">
      <div class="stat-value">${staff}</div>
      <div class="stat-label">${role} · ${dept}</div>
    </div>
    <div class="stat">
      <div class="stat-value">${shiftName} Shift</div>
      <div class="stat-label">${shiftDate}</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color:${varianceColor}">${variance >= 0 ? '+' : ''}KES ${Math.abs(variance).toLocaleString()}</div>
      <div class="stat-label">Variance (${varianceLabel})</div>
    </div>
  </div>

  <h2>Sales Summary</h2>
  <div class="grid">
    <div class="stat">
      <div class="stat-value">KES ${(recon.total_sales || 0).toLocaleString()}</div>
      <div class="stat-label">Total Sales</div>
    </div>
    <div class="stat">
      <div class="stat-value">KES ${(recon.cash_total || 0).toLocaleString()}</div>
      <div class="stat-label">Cash</div>
    </div>
    <div class="stat">
      <div class="stat-value">KES ${(recon.mpesa_total || 0).toLocaleString()}</div>
      <div class="stat-label">M-Pesa</div>
    </div>
  </div>

  ${varianceExplanation ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:16px;"><strong style="color:#dc2626;">⚠️ Variance Note:</strong> ${varianceExplanation}</div>` : ''}

  ${payments && payments.length > 0 ? `
  <h2>Transactions (${payments.length})</h2>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Time</th><th style="text-align:right">Amount</th><th>Method</th><th>M-Pesa Code</th><th>Proof</th>
      </tr>
    </thead>
    <tbody>${paymentRows}</tbody>
  </table>
  ` : ''}

  ${orders && orders.length > 0 ? `
  <h2>Orders (${orders.length})</h2>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Order</th><th>Guest</th><th>Type</th><th>Status</th><th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${orderRows}</tbody>
  </table>
  ` : ''}

  <div class="footer">
    <p>Status: <strong>${status}</strong> ${managerName ? `· Reviewed by: ${managerName}` : ''}</p>
    <p>Keyman Hotel — Confidential Financial Report</p>
  </div>
</body>
</html>`;

  // Open in new window for printing
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    // Auto-trigger print dialog after content loads
    printWindow.onload = () => {
      printWindow.focus();
      // Don't auto-print — let user review first, they click the button
    };
  }
}
