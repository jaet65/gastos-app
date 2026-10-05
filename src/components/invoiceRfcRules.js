export const MAF_RFC = 'MCE170119JC0';

export const isMafRfc = (receiverRfc) => (
    String(receiverRfc || '').trim().toUpperCase() === MAF_RFC
);

export const hasMafRfcMismatch = (category, receiverRfc, hasInvoice = Boolean(receiverRfc)) => (
    category === 'MAF'
    && hasInvoice
    && !isMafRfc(receiverRfc)
);