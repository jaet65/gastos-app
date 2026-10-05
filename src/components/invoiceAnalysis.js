import { validateInvoiceReceiverRfc } from './cfdiCatalog';
import Swal from 'sweetalert2';

export const analyzeInvoice = async (file) => {
    const scanner = await import('./invoicePdfScanner');
    const details = typeof scanner.extractInvoiceDetails === 'function'
        ? await scanner.extractInvoiceDetails(file)
        : { amount: await scanner.extractInvoiceAmount(file), receiverRfc: null };

    if (!details.receiverRfc) return { ...details, rfcValidation: null };

    try {
        const rfcValidation = await validateInvoiceReceiverRfc(details.receiverRfc);
        if (!rfcValidation.isValid) {
            await Swal.fire({
                title: 'RFC no registrado',
                text: `La RFC receptora ${rfcValidation.receiverRfc} no se encuentra en el catálogo de Firestore.`,
                icon: 'warning',
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#f59e0b'
            });
        }
        return { ...details, rfcValidation };
    } catch (error) {
        console.error('No se pudo validar el RFC receptor de la factura:', error);
        return { ...details, rfcValidation: null, rfcValidationError: true };
    }
};

export const appendInvoiceRfcStatus = (message, analysis) => {
    if (analysis.rfcValidation) {
        const { receiverRfc, isValid, razon } = analysis.rfcValidation;
        const status = isValid
            ? `RFC: ${receiverRfc} (${razon}).`
            : `RFC no registrado: ${receiverRfc}.`;
        return message ? `${message} ${status}` : status;
    }

    if (analysis.rfcValidationError) {
        const status = 'No se pudo consultar el catálogo de RFC en Firestore.';
        return message ? `${message} ${status}` : status;
    }

    return message;
};