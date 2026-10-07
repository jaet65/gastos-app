import { describe, expect, it } from 'vitest';
import { parseInvoiceQr } from '../invoicePdfScanner';

describe('parseInvoiceQr', () => {
    const uuid = '123E4567-E89B-12D3-A456-426614174000';

    it('extrae RFC receptor y total aunque los parámetros cambien de orden', () => {
        expect(parseInvoiceQr(`https://verificacfdi.facturaelectronica.sat.gob.mx/?tt=1234.56&id=${uuid.toLowerCase()}&rr=cci190920376&re=emisor`))
            .toEqual({ amount: 1234.56, receiverRfc: 'CCI190920376', uuid });
    });

    it('conserva el total cuando el QR no contiene RFC receptor', () => {
        expect(parseInvoiceQr('https://verificacfdi.facturaelectronica.sat.gob.mx/?tt=99.50&id=uuid'))
            .toEqual({ amount: 99.5, receiverRfc: null, uuid: null });
    });
});