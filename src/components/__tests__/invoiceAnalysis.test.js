import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeInvoice, appendInvoiceRfcStatus } from '../invoiceAnalysis';
import { extractInvoiceDetails } from '../invoicePdfScanner';
import { validateInvoiceReceiverRfc } from '../cfdiCatalog';
import Swal from 'sweetalert2';

vi.mock('../invoicePdfScanner', () => ({
    extractInvoiceDetails: vi.fn()
}));

vi.mock('../cfdiCatalog', () => ({
    validateInvoiceReceiverRfc: vi.fn()
}));

vi.mock('sweetalert2', () => ({
    default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) }
}));

describe('invoiceAnalysis', () => {
    beforeEach(() => vi.clearAllMocks());

    it('valida el RFC receptor y añade el resultado junto al monto detectado', async () => {
        extractInvoiceDetails.mockResolvedValue({ amount: 80, receiverRfc: 'CCI190920376' });
        validateInvoiceReceiverRfc.mockResolvedValue({
            receiverRfc: 'CCI190920376',
            isValid: true,
            razon: 'Centro de Capacitación'
        });

        const result = await analyzeInvoice(new File(['pdf'], 'factura.pdf'));

        expect(validateInvoiceReceiverRfc).toHaveBeenCalledWith('CCI190920376');
        expect(appendInvoiceRfcStatus('Total detectado: $80.00', result))
            .toBe('Total detectado: $80.00 RFC: CCI190920376 (Centro de Capacitación).');
    });

    it('marca como no registrado un RFC que no coincide con el catálogo', async () => {
        extractInvoiceDetails.mockResolvedValue({ amount: null, receiverRfc: 'NOEXISTE010101AAA' });
        validateInvoiceReceiverRfc.mockResolvedValue({
            receiverRfc: 'NOEXISTE010101AAA',
            isValid: false,
            razon: null
        });

        const result = await analyzeInvoice(new File(['pdf'], 'factura.pdf'));

        expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
            title: 'RFC no registrado',
            text: expect.stringContaining('NOEXISTE010101AAA'),
            icon: 'warning'
        }));
        expect(appendInvoiceRfcStatus('', result)).toBe('RFC no registrado: NOEXISTE010101AAA.');
    });
});