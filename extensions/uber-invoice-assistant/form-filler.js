globalThis.UberInvoiceFormFiller = (() => {
  const fieldMetadata = (field) => {
    const labels = field.labels ? [...field.labels].map(label => label.textContent) : [];
    const nestedLabel = field.closest('label')?.textContent || '';
    return [
      field.getAttribute('aria-label'),
      field.getAttribute('placeholder'),
      field.getAttribute('name'),
      field.getAttribute('id'),
      ...labels,
      nestedLabel,
    ].filter(Boolean).join(' ').toLowerCase();
  };

  const isVisibleAndEditable = (field) => {
    if (field.disabled || field.readOnly || field.hidden || field.type === 'hidden') return false;
    const style = field.ownerDocument.defaultView.getComputedStyle(field);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = field.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0 || field.getClientRects().length > 0;
  };

  const setFieldValue = (field, value) => {
    const view = field.ownerDocument.defaultView;
    const prototype = field instanceof view.HTMLTextAreaElement
      ? view.HTMLTextAreaElement.prototype
      : view.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(field, value);
    else field.value = value;
    field.dispatchEvent(new view.Event('input', { bubbles: true }));
    field.dispatchEvent(new view.Event('change', { bubbles: true }));
  };

  function fillUberForm(rfc, records, documentRef = globalThis.document) {
    const fields = [...documentRef.querySelectorAll('input, textarea')]
      .filter(isVisibleAndEditable)
      .map(field => ({ field, metadata: fieldMetadata(field) }));
    const dates = fields.filter(({ field, metadata }) =>
      field.type === 'date' || /fecha|date|travel day/.test(metadata)
    );
    const amounts = fields.filter(({ metadata }) => /monto|importe|amount|fare|cost/.test(metadata));
    const rfcFields = fields.filter(({ metadata }) => /\brfc\b|registro federal de contribuyentes|tax id|taxpayer id/.test(metadata));

    if (!rfcFields.length || dates.length < records.length || amounts.length < records.length) {
      return {
        ok: false,
        dateFields: dates.length,
        amountFields: amounts.length,
        rfcFields: rfcFields.length,
        message: `Encontré ${rfcFields.length} campo(s) de RFC, ${dates.length} de fecha y ${amounts.length} de monto para ${records.length} registro(s). No cambié ningún campo.`,
      };
    }

    rfcFields.forEach(({ field }) => setFieldValue(field, rfc));
    records.forEach((record, index) => {
      setFieldValue(dates[index].field, record.date);
      setFieldValue(amounts[index].field, record.amount);
    });

    return {
      ok: true,
      rfcFields: rfcFields.length,
      dateFields: records.length,
      amountFields: records.length,
      message: `Completé el RFC en ${rfcFields.length} campo(s), ${records.length} fecha(s) y ${records.length} monto(s). Revisa todo; el reclamo no se envió.`,
    };
  }

  return { fillUberForm };
})();