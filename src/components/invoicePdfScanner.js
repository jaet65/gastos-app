import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import jsQR from 'jsqr';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const parseAmount = (value) => {
    const normalized = value.replace(/\s/g, '');
    const decimalValue = normalized.includes('.') && normalized.includes(',')
        ? normalized.replace(/,/g, '')
        : normalized.includes(',') && /,\d{2}$/.test(normalized)
            ? normalized.replace(',', '.')
            : normalized.replace(/,/g, '');
    const amount = Number(decimalValue);
    return Number.isFinite(amount) ? amount : null;
};

const getAmountFromQr = (value) => {
    const match = value.match(/[?&]tt=([\d.,]+)/i);
    return match ? parseAmount(match[1]) : null;
};

const normalizeUuid = (value) => {
    const uuid = value?.trim();
    return uuid && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(uuid)
        ? uuid.toUpperCase()
        : null;
};

const getUuidFromText = (value) => normalizeUuid(
    value.match(/\b[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\b/i)?.[0]
);

export const parseInvoiceQr = (value) => {
    const query = value.includes('?') ? value.slice(value.indexOf('?') + 1) : value;
    const params = new URLSearchParams(query);
    const receiverRfc = params.get('rr');
    return {
        amount: getAmountFromQr(value),
        receiverRfc: receiverRfc?.trim().toUpperCase() || null,
        uuid: normalizeUuid(params.get('id'))
    };
};

const getAmountFromText = (value) => {
    const totalLabels = /\btotal\b(?!\s+(?:de\s+impuestos|impuestos|trasladados|retenidos|descuento))/gi;
    let label;

    while ((label = totalLabels.exec(value)) !== null) {
        const followingText = value.slice(label.index + label[0].length, label.index + label[0].length + 80);
        const amountMatch = followingText.match(/(?:MXN\s*)?\$?\s*(\d[\d,.]*\d|\d)/i);
        if (amountMatch) return parseAmount(amountMatch[1]);
    }

    return null;
};

export const extractInvoiceDetails = async (file) => {
    let loadingTask;
    let text = '';
    let qrDetails = null;
    let qrAmount = null;

    try {
        loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
        const pdf = await loadingTask.promise;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const textContent = await page.getTextContent();
            text += `${textContent.items.map((item) => item.str).join(' ')} `;

            try {
                const viewport = page.getViewport({ scale: 2.5 });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const context = canvas.getContext('2d', { willReadFrequently: true });
                if (!context) continue;

                await page.render({ canvasContext: context, viewport }).promise;
                const image = context.getImageData(0, 0, canvas.width, canvas.height);
                const qr = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
                const details = qr ? parseInvoiceQr(qr.data) : null;
                if (details?.receiverRfc && !qrDetails?.receiverRfc) {
                    qrDetails = { ...qrDetails, receiverRfc: details.receiverRfc };
                }
                if (details?.uuid && !qrDetails?.uuid) {
                    qrDetails = { ...qrDetails, uuid: details.uuid };
                }
                if (details?.amount !== null && details?.amount !== undefined && qrAmount === null) {
                    qrAmount = details.amount;
                }
                if (qr) {
                    if (details?.amount === null || details?.amount === undefined) {
                        console.log(`[invoicePdfScanner] Se encontró un QR en página ${pageNumber}, pero no contiene un total válido.`);
                    }
                }
            } catch (error) {
                console.warn(`[invoicePdfScanner] No se pudo escanear el QR de la página ${pageNumber}; se intentará extraer el texto.`, error);
            }
        }

        const uuid = getUuidFromText(text) || qrDetails?.uuid || null;
        if (qrAmount !== null) {
            console.log(`[invoicePdfScanner] Total detectado por QR: $${qrAmount.toFixed(2)}`);
            return { ...(qrDetails || {}), amount: qrAmount, uuid };
        }

        const amount = getAmountFromText(text);
        if (amount !== null) {
            console.log(`[invoicePdfScanner] Total detectado por texto: $${amount.toFixed(2)}`);
            return { ...(qrDetails || {}), amount, uuid };
        }

        console.warn('[invoicePdfScanner] No se detectó un total ni por QR ni por texto.');
        return { ...(qrDetails || {}), amount: null, receiverRfc: qrDetails?.receiverRfc || null, uuid };
    } catch (error) {
        console.error('[invoicePdfScanner] Falló el escaneo de la factura.', error);
        throw error;
    } finally {
        if (loadingTask) {
            try {
                await loadingTask.destroy();
            } catch (error) {
                console.error('[invoicePdfScanner] No se pudo liberar el documento PDF.', error);
            }
        }
    }
};

export const extractInvoiceAmount = async (file) => {
    const details = await extractInvoiceDetails(file);
    return details.amount;
};