import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface FolioReceiptData {
  // Guest info
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  // Room info
  roomNumber: string | number;
  roomType?: string;
  // Dates
  checkIn?: string;
  checkOut?: string;
  // Folio
  folioId: string;
  charges: Array<{ description: string; amount: number; type: string; date: string }>;
  payments: Array<{ method: string; amount: number; reference?: string; date: string }>;
  // Hotel info
  hotelName?: string;
  hotelAddress?: string;
  hotelPhone?: string;
  hotelEmail?: string;
  // Meta
  receiptNumber?: string;
  printedAt?: Date;
}

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
}

export function generateFolioReceipt(data: FolioReceiptData): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = margin;

  // ── Header: Hotel Name ──
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(data.hotelName || 'Keyman Hotel', pageWidth / 2, y, { align: 'center' });
  y += 8;

  if (data.hotelAddress) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(data.hotelAddress, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }
  if (data.hotelPhone || data.hotelEmail) {
    const contactLine = [data.hotelPhone, data.hotelEmail].filter(Boolean).join(' · ');
    doc.text(contactLine, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }

  // Divider
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Receipt Title ──
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('FOLIO RECEIPT', margin, y);
  y += 8;

  // ── Receipt Info ──
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const leftCol = margin;
  const rightCol = pageWidth / 2 + 10;

  // Left column
  doc.setFont('helvetica', 'bold');
  doc.text('Guest:', leftCol, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.guestName, leftCol + 25, y);
  y += 6;

  if (data.guestEmail) {
    doc.setFont('helvetica', 'bold');
    doc.text('Email:', leftCol, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.guestEmail, leftCol + 25, y);
    y += 6;
  }
  if (data.guestPhone) {
    doc.setFont('helvetica', 'bold');
    doc.text('Phone:', leftCol, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.guestPhone, leftCol + 25, y);
    y += 6;
  }

  // Right column
  let ry = y - (data.guestPhone ? 18 : data.guestEmail ? 12 : 6);
  doc.setFont('helvetica', 'bold');
  doc.text('Folio:', rightCol, ry);
  doc.setFont('helvetica', 'normal');
  doc.text(data.folioId.substring(0, 8).toUpperCase(), rightCol + 18, ry);
  ry += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Room:', rightCol, ry);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.roomNumber}${data.roomType ? ' (' + data.roomType + ')' : ''}`, rightCol + 18, ry);
  ry += 6;

  if (data.checkIn && data.checkOut) {
    doc.setFont('helvetica', 'bold');
    doc.text('Stay:', rightCol, ry);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${format(new Date(data.checkIn), 'MMM d')} — ${format(new Date(data.checkOut), 'MMM d, yyyy')}`,
      rightCol + 18, ry
    );
    ry += 6;
  }

  y = Math.max(y, ry) + 4;

  // Divider
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // ── Charges Table ──
  if (data.charges.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('CHARGES', margin, y);
    y += 4;

    const chargeRows = data.charges.map((c) => [
      format(new Date(c.date), 'MMM d, h:mm a'),
      c.description,
      c.type.replace('_', ' '),
      formatKES(c.amount),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Description', 'Type', 'Amount']],
      body: chargeRows,
      theme: 'striped',
      headStyles: { fillColor: [45, 45, 45], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 70 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30, halign: 'right' },
      },
      margin: { left: margin, right: margin },
      didDrawPage: (hookData) => { y = hookData.cursor?.y || y; },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable?.finalY + 6 || y + 4;
  }

  // ── Payments Table ──
  if (data.payments.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENTS', margin, y);
    y += 4;

    const paymentRows = data.payments.map((p) => [
      format(new Date(p.date), 'MMM d, h:mm a'),
      p.method.charAt(0).toUpperCase() + p.method.slice(1),
      p.reference || '—',
      formatKES(p.amount),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Method', 'Reference', 'Amount']],
      body: paymentRows,
      theme: 'striped',
      headStyles: { fillColor: [34, 120, 60], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 30 },
        2: { cellWidth: 55 },
        3: { cellWidth: 30, halign: 'right' },
      },
      margin: { left: margin, right: margin },
      didDrawPage: (hookData) => { y = hookData.cursor?.y || y; },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable?.finalY + 6 || y + 4;
  }

  // ── Totals ──
  const totalCharges = data.charges.reduce((sum, c) => sum + c.amount, 0);
  const totalPayments = data.payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = totalCharges - totalPayments;

  y += 2;
  doc.setDrawColor(45);
  doc.setLineWidth(0.3);
  doc.line(margin + 80, y, pageWidth - margin, y);
  y += 7;

  doc.setFontSize(11);

  doc.setFont('helvetica', 'normal');
  doc.text('Total Charges:', pageWidth - margin - 55, y);
  doc.setFont('helvetica', 'bold');
  doc.text(formatKES(totalCharges), pageWidth - margin, y, { align: 'right' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.text('Total Payments:', pageWidth - margin - 55, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 120, 60);
  doc.text(formatKES(totalPayments), pageWidth - margin, y, { align: 'right' });
  y += 7;

  // Balance
  doc.setDrawColor(45);
  doc.setLineWidth(0.5);
  doc.line(pageWidth - margin - 65, y, pageWidth - margin, y);
  y += 7;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  if (balance > 0) {
    doc.setTextColor(200, 30, 30);
    doc.text('Balance Due:', pageWidth - margin - 55, y);
  } else if (balance < 0) {
    doc.setTextColor(34, 120, 60);
    doc.text('Overpayment:', pageWidth - margin - 55, y);
  } else {
    doc.setTextColor(34, 120, 60);
    doc.text('SETTLED', pageWidth - margin - 55, y);
  }
  doc.text(formatKES(Math.abs(balance)), pageWidth - margin, y, { align: 'right' });

  // ── Footer ──
  y += 16;
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(130);
  doc.text(
    `Receipt #${data.receiptNumber || data.folioId.substring(0, 8).toUpperCase()} · Printed ${format(data.printedAt || new Date(), 'MMM d, yyyy h:mm a')}`,
    pageWidth / 2, y, { align: 'center' }
  );
  y += 5;
  doc.text(
    `${data.hotelName || 'Keyman Hotel'} · Thank you for staying with us`,
    pageWidth / 2, y, { align: 'center' }
  );

  // ── Save ──
  const filename = `receipt-${data.guestName.replace(/\s+/g, '-')}-${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(filename);
}
