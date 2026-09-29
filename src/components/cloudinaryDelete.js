import { CLOUD_NAME } from './config';

export const eliminarCloudinaryConToken = async (token, descripcionArchivo) => {
    if (!token) {
        return window.confirm(
            `Cloud token not given (${descripcionArchivo}). El archivo no se eliminara de la nube. ¿Deseas continuar?`
        );
    }

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/delete_by_token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: new URLSearchParams({ token }).toString(),
    });
    const result = await response.json().catch(() => null);

    if (response.ok) return true;

    const errorMessage = result?.error?.message || `HTTP ${response.status}`;
    const tokenCaducado = /stale request|token.{0,40}(?:expired|invalid)|(?:expired|invalid).{0,40}token/i.test(errorMessage);
    if (tokenCaducado) {
    return window.confirm(
        `Cloud token expired.\n` +
        `${descripcionArchivo} no se eliminara de la nube.\n` +
        `¿Deseas continuar?`
    );
}

    throw new Error(`Cloudinary no pudo eliminar ${descripcionArchivo}: ${errorMessage}`);
};