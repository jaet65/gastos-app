import Swal from 'sweetalert2';

const mostrarToastConVistaPrevia = (titulo, archivoPdf) => {
    Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'success',
        title: titulo,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.style.cursor = 'pointer';
            toast.title = 'Haz clic para previsualizar el PDF';
            toast.addEventListener('click', () => {
                const archivoUrl = URL.createObjectURL(archivoPdf);
                window.open(archivoUrl, '_blank', 'noopener,noreferrer');
                window.setTimeout(() => URL.revokeObjectURL(archivoUrl), 60_000);
            }, { once: true });
        },
    });
};

export default mostrarToastConVistaPrevia;
