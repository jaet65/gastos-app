import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDoc, mockGetDoc } = vi.hoisted(() => ({
    mockDoc: vi.fn((_db, collectionName, documentId) => ({ collectionName, documentId })),
    mockGetDoc: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
    doc: mockDoc,
    getDoc: mockGetDoc
}));

vi.mock('../../firebase', () => ({ db: { name: 'test-db' } }));

import { validateInvoiceReceiverRfc } from '../cfdiCatalog';

describe('validateInvoiceReceiverRfc', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('consulta cfdi usando el RFC normalizado como ID y devuelve la razón social', async () => {
        mockGetDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({ Razon: 'CENTRO DE CAPACITACION INSTITUCIONAL' })
        });

        const result = await validateInvoiceReceiverRfc('cci190920376');

        expect(mockDoc).toHaveBeenCalledWith({ name: 'test-db' }, 'cfdi', 'CCI190920376');
        expect(mockGetDoc).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            receiverRfc: 'CCI190920376',
            isValid: true,
            razon: 'CENTRO DE CAPACITACION INSTITUCIONAL'
        });
    });

    it('indica RFC no registrado cuando no existe el documento', async () => {
        mockGetDoc.mockResolvedValue({ exists: () => false });

        const result = await validateInvoiceReceiverRfc('NOEXISTE010101AAA');

        expect(mockDoc).toHaveBeenCalledWith({ name: 'test-db' }, 'cfdi', 'NOEXISTE010101AAA');
        expect(result).toEqual({ receiverRfc: 'NOEXISTE010101AAA', isValid: false, razon: null });
    });
});
