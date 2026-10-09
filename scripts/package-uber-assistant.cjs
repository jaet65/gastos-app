const fs = require('node:fs');
const path = require('node:path');
const JSZip = require('jszip');

const extensionPath = path.join(process.cwd(), 'extensions', 'uber-invoice-assistant');
const downloadPath = path.join(process.cwd(), 'public', 'downloads', 'uber-invoice-assistant.zip');
const zip = new JSZip();

for (const fileName of fs.readdirSync(extensionPath)) {
    const filePath = path.join(extensionPath, fileName);
    if (fs.statSync(filePath).isFile()) {
        zip.file(fileName, fs.readFileSync(filePath));
    }
}

fs.mkdirSync(path.dirname(downloadPath), { recursive: true });
zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    .then((archive) => {
        fs.writeFileSync(downloadPath, archive);
        console.log(`Uber Assistant ZIP generado en ${path.relative(process.cwd(), downloadPath)}`);
    })
    .catch((error) => {
        console.error('No se pudo empaquetar Uber Assistant:', error);
        process.exitCode = 1;
    });