import { describe, expect, it } from 'vitest';
import { extractInvoiceUuid, parseInvoiceQr } from '../invoicePdfScanner';

describe('extractInvoiceUuid', () => {
    const uuid = '123E4567-E89B-12D3-A456-426614174000';

    it('reconoce un UUID cuyos caracteres y guiones vienen separados en el texto del PDF', () => {
        const splitUuid = uuid.split('').join(' ');

        expect(extractInvoiceUuid(`Folio Fiscal: ${splitUuid}`)).toBe(uuid);
    });

    it('normaliza un UUID sin guiones extraído del PDF', () => {
        expect(extractInvoiceUuid('UUID: 123e4567e89b12d3a456426614174000')).toBe(uuid);
    });
});

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