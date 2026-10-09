export function parseUberInvoiceText(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('El portapapeles está vacío. Selecciona los gastos y vuelve a copiarlos desde Gastos App.');
  }

  const rfcMatch = text.match(/^RFC\s*:\s*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\s*$/im);
  const invoiceLabels = [...text.matchAll(/Factura\s+(\d+)\s*:/gi)];
  const matches = [...text.matchAll(/Factura\s+(\d+)\s*:\s*Fecha\s*:\s*(\d{4}-\d{2}-\d{2})\s*Monto\s*:\s*(-?\d+(?:\.\d{1,2})?)/gi)];

  if (!rfcMatch || invoiceLabels.length < 1 || invoiceLabels.length > 5 || matches.length !== invoiceLabels.length) {
    throw new Error('No reconocí el formato de Uber Invoice. Vuelve a copiar los registros desde Gastos App.');
  }

  const invoices = matches.map((match, index) => {
    const invoiceNumber = Number(match[1]);
    const date = match[2];
    const amount = Number(match[3]);
    const [year, month, day] = date.split('-').map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    if (invoiceNumber !== index + 1) {
      throw new Error('Los bloques deben estar numerados consecutivamente desde Factura 1.');
    }
    if (parsedDate.getUTCFullYear() !== year || parsedDate.getUTCMonth() !== month - 1 || parsedDate.getUTCDate() !== day) {
      throw new Error(`La fecha de Factura ${invoiceNumber} no es válida.`);
    }
    if (!Number.isFinite(amount)) {
      throw new Error(`El monto de Factura ${invoiceNumber} no es válido.`);
    }

    return { invoiceNumber, date, amount: amount.toFixed(2) };
  });

  return { rfc: rfcMatch[1].toUpperCase(), invoices };
}