const MAX_FILENAME_LENGTH = 40;

const removeControlCharacters = (value) => [...String(value)].filter((character) => {
    const code = character.charCodeAt(0);
    return code > 31 && code !== 127;
}).join('');

export const getCloudinaryFilename = (email, originalName) => {
    const safeEmail = removeControlCharacters(email || 'usuario').trim();
    const safeName = removeControlCharacters(originalName || 'archivo.pdf').trim();
    const extensionIndex = safeName.lastIndexOf('.');
    const extension = extensionIndex > 0 ? safeName.slice(extensionIndex) : '';
    const baseName = extensionIndex > 0 ? safeName.slice(0, extensionIndex) : safeName;
    const prefix = `[${safeEmail}] `;
    const extensionToUse = extension.slice(-(MAX_FILENAME_LENGTH - 1));
    const prefixToUse = prefix.slice(0, MAX_FILENAME_LENGTH - extensionToUse.length);
    const availableLength = Math.max(0, MAX_FILENAME_LENGTH - prefixToUse.length - extensionToUse.length);

    return `${prefixToUse}${baseName.slice(0, availableLength)}${extensionToUse}`;
};