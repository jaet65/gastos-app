import { validateInvoiceReceiverRfc } from './cfdiCatalog';
import Swal from 'sweetalert2';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export const analyzeInvoice = async (file) => {
    const scanner = await import('./invoicePdfScanner');
    const details = typeof scanner.extractInvoiceDetails === 'function'
        ? await scanner.extractInvoiceDetails(file)
        : { amount: await scanner.extractInvoiceAmount(file), receiverRfc: null };

    let duplicateFound = false;
    if (details.uuid) {
        let registeredInvoices;
        try {
            registeredInvoices = await getDocs(query(
                collection(db, 'gastos'),
                where('uuid_factura', '==', details.uuid),
                limit(1)
            ));
        } catch (error) {
            console.error('No se pudo verificar si la factura ya está registrada:', error);
            await Swal.fire({
                title: 'No se pudo verificar la factura',
                text: 'No fue posible consultar el UUID en la base de datos. La factura no se adjuntará para evitar duplicados.',
                icon: 'error',
                confirmButtonText: 'Entendido'
            });
            return { ...details, duplicateCheckError: true };
        }

        if (!registeredInvoices.empty) {
            const result = await Swal.fire({
                title: 'Factura ya registrada',
                text: `La factura con UUID ${details.uuid} ya está registrada. ¿Deseas continuar de todos modos?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, continuar',
                cancelButtonText: 'No, cancelar',
                confirmButtonColor: '#3b82f6',
                cancelButtonColor: '#64748b',
                didOpen: () => {
                    const container = Swal.getContainer();
                    if (container) container.style.zIndex = '100000';
                }
            });

            if (!result.isConfirmed) return { ...details, duplicateCancelled: true };
            duplicateFound = true;
        }
    }

    const duplicateStatus = duplicateFound ? { duplicateFound: true } : {};
    if (!details.receiverRfc) return { ...details, ...duplicateStatus, rfcValidation: null };

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
        return { ...details, ...duplicateStatus, rfcValidation };
    } catch (error) {
        console.error('No se pudo validar el RFC receptor de la factura:', error);
        return { ...details, ...duplicateStatus, rfcValidation: null, rfcValidationError: true };
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