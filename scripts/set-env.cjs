import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

try {
    console.log('Generando variables de entorno para la compilación...');

    // 1. Obtener la fecha y hora actual en formato ISO UTC
    const buildTime = new Date().toISOString();

    // 2. Intentar obtener el hash corto del último commit de Git
    let commitSha = 'N/A';
    try {
        commitSha = execSync('git rev-parse --short HEAD').toString().trim();
    } catch (e) {
        console.warn('Advertencia: No se pudo obtener el hash del commit de Git. Asegúrate de que Git esté instalado y que este sea un repositorio de Git.');
    }

    // 3. Crear el contenido del archivo .env
    const envContent = `VITE_APP_BUILD_TIME=${buildTime}\nVITE_APP_COMMIT_SHA=${commitSha}\n`;

    // 4. Escribir el contenido en el archivo .env.production.local
    // Vite cargará automáticamente este archivo en builds de producción.
    // Usamos una ruta relativa para que funcione en cualquier entorno.
    const envFilePath = path.join(process.cwd(), '.env.production.local');
    fs.writeFileSync(envFilePath, envContent);

    console.log('Variables de entorno generadas exitosamente:');
    console.log(`- VITE_APP_BUILD_TIME: ${buildTime}`);
    console.log(`- VITE_APP_COMMIT_SHA: ${commitSha}`);

} catch (error) {
    console.error('Error al generar las variables de entorno:', error);
    process.exit(1); // Detiene el proceso de build si hay un error
}
