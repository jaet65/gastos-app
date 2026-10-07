import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeInvoice, appendInvoiceRfcStatus } from '../invoiceAnalysis';
import { extractInvoiceDetails } from '../invoicePdfScanner';
import { validateInvoiceReceiverRfc } from '../cfdiCatalog';
import { getDocs } from 'firebase/firestore';
import Swal from 'sweetalert2';

vi.mock('../invoicePdfScanner', () => ({
    extractInvoiceDetails: vi.fn()
}));

vi.mock('../firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({})),
    getFirestore: vi.fn(() => ({})),
    getDocs: vi.fn(),
    limit: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    where: vi.fn(() => ({}))
}));

vi.mock('../cfdiCatalog', () => ({
    validateInvoiceReceiverRfc: vi.fn()
}));

vi.mock('sweetalert2', () => ({
    default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) }
}));

describe('invoiceAnalysis', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDocs.mockResolvedValue({ empty: true });
    });

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

    it('pregunta si continuar y devuelve el UUID cuando la factura ya existe', async () => {
        const uuid = '123E4567-E89B-12D3-A456-426614174000';
        extractInvoiceDetails.mockResolvedValue({ amount: 80, receiverRfc: null, uuid });
        getDocs.mockResolvedValue({ empty: false });

        const result = await analyzeInvoice(new File(['pdf'], 'factura.pdf'));

        expect(getDocs).toHaveBeenCalled();
        expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Factura ya registrada',
            text: expect.stringContaining(uuid),
            showCancelButton: true,
            confirmButtonText: 'Sí, continuar',
            cancelButtonText: 'No, cancelar'
        }));
        expect(result).toMatchObject({ uuid, duplicateFound: true });
    });

    it('cancela el análisis si el usuario no desea adjuntar una factura duplicada', async () => {
        extractInvoiceDetails.mockResolvedValue({
            amount: 80,
            receiverRfc: null,
            uuid: '123E4567-E89B-12D3-A456-426614174000'
        });
        getDocs.mockResolvedValue({ empty: false });
        Swal.fire.mockResolvedValue({ isConfirmed: false });

        const result = await analyzeInvoice(new File(['pdf'], 'factura.pdf'));

        expect(result.duplicateCancelled).toBe(true);
        expect(validateInvoiceReceiverRfc).not.toHaveBeenCalled();
    });

    it('bloquea el adjunto y avisa si Firestore no puede verificar el UUID', async () => {
        extractInvoiceDetails.mockResolvedValue({
            amount: 80,
            receiverRfc: null,
            uuid: '123E4567-E89B-12D3-A456-426614174000'
        });
        getDocs.mockRejectedValue(new Error('Firestore no disponible'));

        const result = await analyzeInvoice(new File(['pdf'], 'factura.pdf'));

        expect(result.duplicateCheckError).toBe(true);
        expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
            title: 'No se pudo verificar la factura',
            icon: 'error'
        }));
    });
});