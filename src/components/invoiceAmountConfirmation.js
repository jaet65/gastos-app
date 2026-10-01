import Swal from 'sweetalert2';

export const confirmInvoiceAmount = async (detectedAmount, currentAmount) => {
    const detected = Number(detectedAmount).toFixed(2);
    const entered = String(currentAmount ?? '').trim();
    const enteredNumber = Number(entered);
    const amountsDiffer = entered !== ''
        && Number.isFinite(enteredNumber)
        && Math.round(enteredNumber * 100) !== Math.round(detectedAmount * 100);

    if (!amountsDiffer) {
        return { amount: detected, source: 'detected' };
    }

    const enteredFormatted = enteredNumber.toFixed(2);
    const result = await Swal.fire({
        title: 'Los montos no coinciden',
        text: `Ingresaste $${enteredFormatted} y la factura indica $${detected}. ¿Cuál deseas usar?`,
        icon: 'warning',
        showDenyButton: true,
        confirmButtonText: `Usar detectado ($${detected})`,
        denyButtonText: `Usar ingresado ($${enteredFormatted})`,
        confirmButtonColor: '#3b82f6',
        denyButtonColor: '#64748b',
        didOpen: () => {
            const container = Swal.getContainer();
            if (container) container.style.zIndex = '100000';
        },
        customClass: {
            popup: 'rounded-2xl',
            confirmButton: 'px-4 py-2 text-sm font-medium rounded-lg',
            denyButton: 'px-4 py-2 text-sm font-medium rounded-lg'
        }
    });

    return result.isConfirmed
        ? { amount: detected, source: 'detected' }
        : { amount: entered, source: 'entered' };
};
