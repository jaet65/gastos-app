import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const validateInvoiceReceiverRfc = async (receiverRfc) => {
    const normalizedRfc = String(receiverRfc || '').trim().toUpperCase();
    if (!normalizedRfc) return null;

    const snapshot = await getDoc(doc(db, 'cfdi', normalizedRfc));
    const data = snapshot.exists() ? snapshot.data() : null;
    const razon = data?.Razon || data?.RazonSocial || data?.['Razón'] || data?.razon || null;
    return {
        receiverRfc: normalizedRfc,
        isValid: Boolean(data),
        razon
    };
};