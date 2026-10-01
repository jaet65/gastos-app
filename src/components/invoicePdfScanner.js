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

export const extractInvoiceAmount = async (file) => {
    let loadingTask;
    let text = '';

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
                const amount = qr ? getAmountFromQr(qr.data) : null;
                if (amount !== null) {
                    console.log(`[invoicePdfScanner] Total detectado por QR en página ${pageNumber}: $${amount.toFixed(2)}`);
                    return amount;
                }
                if (qr) {
                    console.log(`[invoicePdfScanner] Se encontró un QR en página ${pageNumber}, pero no contiene un total válido.`);
                }
            } catch (error) {
                console.warn(`[invoicePdfScanner] No se pudo escanear el QR de la página ${pageNumber}; se intentará extraer el texto.`, error);
            }
        }

        const amount = getAmountFromText(text);
        if (amount !== null) {
            console.log(`[invoicePdfScanner] Total detectado por texto: $${amount.toFixed(2)}`);
            return amount;
        }

        console.warn('[invoicePdfScanner] No se detectó un total ni por QR ni por texto.');
        return null;
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