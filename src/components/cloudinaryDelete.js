import Swal from 'sweetalert2';
import { CLOUD_NAME } from './config';

export const eliminarCloudinaryConToken = async (token, descripcionArchivo) => {
    // 1. Caso sin token de eliminación
    if (!token) {
        const result = await Swal.fire({
            title: 'Sin token de eliminación',
            html: `No se proporcionó un token para ${descripcionArchivo}.
            El archivo no se eliminará de la nube.
            ¿Deseas continuar de todos modos?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sí, continuar',
            cancelButtonText: 'Cancelar',
            customClass: {
                popup: 'rounded-2xl',
                confirmButton: 'px-4 py-2 text-sm font-medium rounded-lg',
                cancelButton: 'px-4 py-2 text-sm font-medium rounded-lg'
            }
        });
        console.log("LOG: Sin token de eliminación")

    return result.isConfirmed;
}

// 2. Intento de eliminación vía API de Cloudinary
const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/delete_by_token`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
    },
    body: new URLSearchParams({ token }).toString(),
});

const result = await response.json().catch(() => null);

// Si fue exitoso
if (response.ok) return true;

// 3. Evaluación de errores
const errorMessage = result?.error?.message || `HTTP ${response.status}`;
const tokenCaducado = /stale request|token.{0,40}(?:expired|invalid)|(?:expired|invalid).{0,40}token/i.test(errorMessage);

if (tokenCaducado) {
    const confirmResult = await Swal.fire({
        title: 'Token caducado',
        html: `El token de eliminación para ${descripcionArchivo} ha caducado.
        El archivo no se eliminará automáticamente de la nube.
        ¿Deseas continuar?`,
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, continuar',
        cancelButtonText: 'Cancelar',
        customClass: {
            popup: 'rounded-2xl',
            confirmButton: 'px-4 py-2 text-sm font-medium rounded-lg',
            cancelButton: 'px-4 py-2 text-sm font-medium rounded-lg'
        }
    });
    console.log("LOG: Token caducado")

    return confirmResult.isConfirmed;
}

// 4. Si ocurrió un error desconocido de Cloudinary, mostramos alerta modal
await Swal.fire({
    title: 'Error de Cloudinary',
    text: `No se pudo eliminar ({descripcionArchivo}:){errorMessage}`,
    icon: 'error',
    confirmButtonText: 'Entendido',
    confirmButtonColor: '#d33'
});
console.log("LOG: Error eliminando archivo en Cloudinary", errorMessage)

throw new Error(`Cloudinary no pudo eliminar ({descripcionArchivo}:){errorMessage}`);
};