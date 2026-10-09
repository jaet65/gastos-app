import { describe, expect, it } from 'vitest';
import { parseUberInvoiceText } from '../uber-invoice-assistant/clipboard-data.js';

describe('parseUberInvoiceText', () => {
  it('parsea de uno a cinco bloques en orden', () => {
    const clipboard = [`RFC: CCI190920376`, ...Array.from({ length: 5 }, (_, index) =>
      `Factura ${index + 1}:\nFecha: 2026-04-${String(index + 1).padStart(2, '0')}\nMonto: ${(100 + index).toFixed(2)}`
    )].join('\n\n');

    expect(parseUberInvoiceText(clipboard)).toEqual({
      rfc: 'CCI190920376',
      invoices: [
        { invoiceNumber: 1, date: '2026-04-01', amount: '100.00' },
        { invoiceNumber: 2, date: '2026-04-02', amount: '101.00' },
        { invoiceNumber: 3, date: '2026-04-03', amount: '102.00' },
        { invoiceNumber: 4, date: '2026-04-04', amount: '103.00' },
        { invoiceNumber: 5, date: '2026-04-05', amount: '104.00' },
      ],
    });
  });

  it('rechaza texto que no coincide con el formato de la app', () => {
    expect(() => parseUberInvoiceText('RFC: CCI190920376\n\nFactura 1:\nFecha: no-valida\nMonto: 25.00')).toThrow(/formato/i);
  });

  it('rechaza fechas inexistentes', () => {
    expect(() => parseUberInvoiceText('RFC: CCI190920376\n\nFactura 1:\nFecha: 2026-02-30\nMonto: 25.00')).toThrow(/fecha/i);
  });

  it('rechaza bloques sin RFC', () => {
    expect(() => parseUberInvoiceText('Factura 1:\nFecha: 2026-04-01\nMonto: 25.00')).toThrow(/formato/i);
  });
});