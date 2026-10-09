// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import '../uber-invoice-assistant/form-filler.js';

const addField = (type, label) => {
  const field = document.createElement('input');
  field.type = type;
  field.setAttribute('aria-label', label);
  field.getBoundingClientRect = () => ({ width: 120, height: 24 });
  document.body.append(field);
  return field;
};

describe('fillUberForm', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('completa campos reconocidos y no envía el formulario', () => {
    const rfc = addField('text', 'RFC');
    const secondRfc = addField('text', 'RFC del contribuyente');
    const firstDate = addField('date', 'Fecha del viaje 1');
    const secondDate = addField('date', 'Fecha del viaje 2');
    const firstAmount = addField('text', 'Monto del viaje 1');
    const secondAmount = addField('text', 'Monto del viaje 2');
    const submit = document.createElement('button');
    submit.type = 'submit';
    document.body.append(submit);
    const records = [
      { date: '2026-04-01', amount: '100.00' },
      { date: '2026-04-02', amount: '120.50' },
    ];

    const result = globalThis.UberInvoiceFormFiller.fillUberForm('CCI190920376', records);

    expect(result.ok).toBe(true);
    expect([rfc.value, secondRfc.value]).toEqual(['CCI190920376', 'CCI190920376']);
    expect([firstDate.value, secondDate.value]).toEqual(['2026-04-01', '2026-04-02']);
    expect([firstAmount.value, secondAmount.value]).toEqual(['100.00', '120.50']);
    expect(submit.type).toBe('submit');
  });

  it('no modifica campos si faltan fechas o montos suficientes', () => {
    const date = addField('date', 'Fecha del viaje');
    const amount = addField('text', 'Monto del viaje');

    const result = globalThis.UberInvoiceFormFiller.fillUberForm('CCI190920376', [
      { date: '2026-04-01', amount: '100.00' },
      { date: '2026-04-02', amount: '120.50' },
    ]);

    expect(result.ok).toBe(false);
    expect(date.value).toBe('');
    expect(amount.value).toBe('');
  });

  it('no modifica fechas ni montos si no encuentra campo para RFC', () => {
    const date = addField('date', 'Fecha del viaje');
    const amount = addField('text', 'Monto del viaje');

    const result = globalThis.UberInvoiceFormFiller.fillUberForm('CCI190920376', [
      { date: '2026-04-01', amount: '100.00' },
    ]);

    expect(result.ok).toBe(false);
    expect(date.value).toBe('');
    expect(amount.value).toBe('');
  });
});