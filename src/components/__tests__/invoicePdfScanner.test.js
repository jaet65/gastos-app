import { describe, expect, it } from 'vitest';
import { parseInvoiceQr } from '../invoicePdfScanner';

describe('parseInvoiceQr', () => {
    it('extrae RFC receptor y total aunque los parámetros cambien de orden', () => {
        expect(parseInvoiceQr('https://verificacfdi.facturaelectronica.sat.gob.mx/?tt=1234.56&id=uuid&rr=cci190920376&re=emisor'))
            .toEqual({ amount: 1234.56, receiverRfc: 'CCI190920376' });
    });

    it('conserva el total cuando el QR no contiene RFC receptor', () => {
        expect(parseInvoiceQr('https://verificacfdi.facturaelectronica.sat.gob.mx/?tt=99.50&id=uuid'))
            .toEqual({ amount: 99.5, receiverRfc: null });
    });
});