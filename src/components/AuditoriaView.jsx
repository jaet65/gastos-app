import { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, Timestamp } from 'firebase/firestore';
import { Title, Text } from "@tremor/react";
import Swal from 'sweetalert2';
import PanelAuditoria from './PanelAuditoria';

// Helper function to format date from Excel import
const formatImportedDate = (dateStr) => {
    if (typeof dateStr !== 'string' || !dateStr.trim()) {
        return null;
    }
    dateStr = dateStr.trim();

    // If format is already correct, return it
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
    }

    // Handle slash-separated dates in the app's import format: dd/mm/yyyy
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        let [day, month, year] = parts;
        if (year.length === 2) {
            year = `20${year}`;
        }

        day = String(Number(day)).padStart(2, '0');
        month = String(Number(month)).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    console.warn(`Could not parse date: "${dateStr}"`);
    return null; // Return null if format is not recognized
};

const parseImportedAmount = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value !== 'string' || !value.trim()) {
        return null;
    }

    const amount = value.trim().replace(/[^\d,.\-()]/g, '');
    const isNegative = amount.startsWith('(') && amount.endsWith(')');
    let normalized = amount.replace(/[()]/g, '');
    const lastComma = normalized.lastIndexOf(',');
    const lastPeriod = normalized.lastIndexOf('.');

    if (lastComma !== -1 && lastPeriod !== -1) {
        const decimalSeparator = lastComma > lastPeriod ? ',' : '.';
        const groupingSeparator = decimalSeparator === ',' ? '.' : ',';
        normalized = normalized.split(groupingSeparator).join('');
        if (decimalSeparator === ',') {
            normalized = normalized.replace(',', '.');
        }
    } else if (lastComma !== -1) {
        const decimalDigits = normalized.length - lastComma - 1;
        normalized = decimalDigits === 3
            ? normalized.replace(/,/g, '')
            : normalized.replace(',', '.');
    }

    const parsedAmount = Number(normalized);
    if (!Number.isFinite(parsedAmount)) {
        return null;
    }
    return isNegative ? -Math.abs(parsedAmount) : parsedAmount;
};


const AuditoriaView = () => {
    const [allGastos, setAllGastos] = useState([]);
    const [audits, setAudits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef(null);

    const handleImportClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) {
            return;
        }

        setIsImporting(true);
        Swal.fire({
            title: 'Importando auditorías',
            html: '<p>Leyendo archivo...</p>',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading(),
        });

        const reader = new FileReader();
        try {
            const XLSX = await import('xlsx');
            const data = await new Promise((resolve, reject) => {
                reader.onload = (event) => resolve(event.target.result);
                reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
                reader.onabort = () => reject(new Error('La lectura del archivo fue cancelada.'));
                reader.readAsArrayBuffer(file);
            });
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
            const totalRows = Math.max(json.length - 1, 0);
            let processedRows = 0;
            let importedRows = 0;

            const updateProgress = () => {
                const percentage = totalRows === 0 ? 100 : Math.round((processedRows / totalRows) * 100);
                Swal.update({
                    html: `<p>Procesando filas: ${processedRows} de ${totalRows}</p>
                        <progress value="${processedRows}" max="${Math.max(totalRows, 1)}" style="width:100%"></progress>
                        <p>${percentage}% · ${importedRows} periodos importados</p>`,
                });
            };
            updateProgress();

            for (let i = 1; i < json.length; i++) {
                const row = json[i];
                const startDate = formatImportedDate(row[0]);
                const endDate = formatImportedDate(row[1]);
                const city = row[3];
                const costo = parseImportedAmount(row[8]);
                const hasCosto = row[8] !== null && row[8] !== undefined && String(row[8]).trim() !== '';

                if (!startDate || !endDate || !city) {
                    console.warn("Skipping incomplete or invalid data in row:", row);
                } else if (hasCosto && costo === null) {
                    console.warn("Skipping row with invalid Costo in column I:", row);
                } else {
                    const auditData = {
                        city: city,
                        startDate: startDate,
                        endDate: endDate,
                        costo,
                    };

                    await addDoc(collection(db, "auditorias"), { ...auditData, creado_en: Timestamp.now() });
                    importedRows += 1;
                }

                processedRows += 1;
                updateProgress();
            }

            await Swal.fire({
                icon: 'success',
                title: 'Importación completada',
                text: `Se importaron ${importedRows} de ${totalRows} filas.`,
                timer: 1800,
                timerProgressBar: true,
                showConfirmButton: false,
            });
        } catch (error) {
            console.error("Error processing file:", error);
            await Swal.fire({
                icon: 'error',
                title: 'Error al importar auditorías',
                text: error.message,
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: false,
            });
        } finally {
            e.target.value = '';
            setIsImporting(false);
        }
    };


    useEffect(() => {
        const q = query(collection(db, "gastos"), orderBy("fecha", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllGastos(data);
            if(loading) setLoading(false);
        }, (error) => {
            console.error("Error fetching gastos:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [loading]);

    useEffect(() => {
        const q = query(collection(db, "auditorias")); // No Firestore orderBy, will sort client-side
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Custom sort function
            const sortedData = data.sort((a, b) => {
                const cityA = (a.city || '').trim(); // Handle potential undefined/null cities and trim whitespace
                const cityB = (b.city || '').trim();

                const isSinCiudadA = cityA.toLowerCase() === "sin ciudad";
                const isSinCiudadB = cityB.toLowerCase() === "sin ciudad";

                if (isSinCiudadA && !isSinCiudadB) {
                    return 1; // "Sin Ciudad" comes after other cities
                }
                if (isSinCiudadB && !isSinCiudadA) {
                    return -1; // Other cities come before "Sin Ciudad"
                }
                // For all other cases, sort alphabetically
                return cityA.localeCompare(cityB);
            });


            setAudits(sortedData);
            if(loading) setLoading(false);
        }, (error) => {
            console.error("Error fetching auditorias:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [loading]);

    if (loading) return <Text className="text-center mt-8">Cargando datos de auditoría...</Text>;

    return (
        <div className="space-y-6">
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange}
                className="hidden" 
                accept=".xlsx, .xls"
            />
            <header>
                <Title className="text-slate-800">Auditoría General</Title>
            </header>

            <PanelAuditoria
                allGastos={allGastos}
                audits={audits}
                onImport={handleImportClick}
                isImporting={isImporting}
            />

        </div>
    );
};

export default AuditoriaView;
