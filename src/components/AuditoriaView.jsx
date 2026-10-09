import { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { Card, Title, Text, Flex, Button, Subtitle } from "@tremor/react";
import { PlusCircle, Trash2, MapPin, Edit, XCircle, Calendar, Upload } from 'lucide-react';
import Swal from 'sweetalert2';
import PanelAuditoria from './PanelAuditoria';

const InputGroup = ({ icon: Icon, children }) => ( // eslint-disable-line no-unused-vars
    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden h-12 hover:bg-white focus-within:bg-white focus-within:border-blue-300 transition-all">
        <div className="pl-4 text-slate-400">
            <Icon size={16} strokeWidth={2.5} />
        </div>
        <div className="flex-1 h-full flex items-center pr-4">
            {children}
        </div>
    </div>
);

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
    const [_showDefinedPeriods, _setShowDefinedPeriods] = useState(false);
    const [showForm, setShowForm] = useState(false); // New state to control form visibility

    const [newCity, setNewCity] = useState('');
    const [newStartDate, setNewStartDate] = useState(null);
    const [newEndDate, setNewEndDate] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [isImporting, setIsImporting] = useState(false); // New state for import loading
    const fileInputRef = useRef(null);

    const dateToInputValue = (date) => {
        if (!date) return '';
        return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    };

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

    const resetForm = () => {
        setNewCity('');
        setNewStartDate(null);
        setNewEndDate(null);
        setEditingId(null);
    };
    
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!newCity || !newStartDate || !newEndDate) {
            alert("Por favor, completa todos los campos.");
            return;
        }
        
        const formattedStartDate = dateToInputValue(newStartDate);
        const formattedEndDate = dateToInputValue(newEndDate);
        
        const auditData = {
            city: newCity,
            startDate: formattedStartDate,
            endDate: formattedEndDate,
        };

        try {
            if (editingId) {
                const docRef = doc(db, "auditorias", editingId);
                await updateDoc(docRef, auditData);
            } else {
                await addDoc(collection(db, "auditorias"), { ...auditData, creado_en: Timestamp.now() });
            }
            resetForm();
            setTimeout(() => {
                setShowForm(false); // Hide form after successful submission
            }, 0);
        } catch (error) {
            console.error("Error saving audit:", error);
            alert("Error al guardar la auditoría: " + error.message);
        }
    };

    const _handleEdit = (audit) => {
        setEditingId(audit.id);
        setNewCity(audit.city);
        setNewStartDate(new Date(audit.startDate + 'T00:00:00'));
        setNewEndDate(new Date(audit.endDate + 'T00:00:00'));
        setShowForm(true); // Show form when editing
    };

    const _handleRemoveAudit = async (id) => {
        if (confirm("¿Estás seguro de que quieres eliminar este periodo de auditoría?")) {
            try {
                await deleteDoc(doc(db, "auditorias", id));
            } catch (error) {
                console.error("Error removing audit:", error);
                alert("Error al eliminar la auditoría: " + error.message);
            }
        }
    };

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
                <Title className="text-slate-800">Auditoría General de Gastos</Title>
                <Text className="text-slate-500 text-sm mt-1">Auditar los gastos correspondientes por periodo o ciudad.</Text>
            </header>

            <Flex justifyContent="end" className="gap-2">
                {!showForm && (
                    <Button
                        icon={PlusCircle}
                        size="sm"
                        color="blue"
                        onClick={() => { setShowForm(true); resetForm(); }} // Show form and reset fields
                        className="rounded-2xl px-2 py-1 text-sm font-semibold"
                    >
                        Añadir Periodo
                    </Button>
                )}
                <Button
                    type="button"
                    onClick={handleImportClick}
                    icon={Upload}
                    size="sm"
                    color="blue"
                    variant="light"
                    loading={isImporting} // Add loading prop
                    disabled={isImporting} // Disable button while importing
                    className="rounded-2xl px-2 py-1 text-sm font-semibold"
                >
                    {isImporting ? 'Importando...' : 'Importar'}
                </Button>
            </Flex>

            {showForm && (
                <Card className="rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm ring-1 ring-slate-200/80">
                    <form onSubmit={handleFormSubmit}>
                        <Subtitle className="mb-4">{editingId ? 'Editando Periodo' : 'Añadir Nuevo Periodo'}</Subtitle>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <InputGroup icon={MapPin}>
                                <input
                                    type="text"
                                    placeholder="Ej. Guadalajara"
                                    value={newCity}
                                    onChange={(e) => setNewCity(e.target.value)}
                                    className="w-full h-full pl-2 bg-transparent border-none outline-none text-slate-900 font-bold text-base placeholder-slate-400"
                                />
                            </InputGroup>
                            <InputGroup icon={Calendar}>
                                <input
                                    type="date"
                                    value={dateToInputValue(newStartDate)}
                                    onChange={(e) => setNewStartDate(e.target.value ? new Date(e.target.value + 'T00:00:00') : null)}
                                    className="w-full h-full pl-2 bg-transparent border-none outline-none text-slate-700 font-bold text-base"
                                />
                            </InputGroup>
                            <InputGroup icon={Calendar}>
                                 <input
                                    type="date"
                                    value={dateToInputValue(newEndDate)}
                                    onChange={(e) => setNewEndDate(e.target.value ? new Date(e.target.value + 'T00:00:00') : null)}
                                    className="w-full h-full pl-2 bg-transparent border-none outline-none text-slate-700 font-bold text-base"
                                />
                            </InputGroup>
                        </div>
                        <Flex justifyContent="end" className="gap-2 mt-6 pt-4 border-t border-slate-200">

                             {(editingId || !editingId) && ( // Show Cancel button for both edit and add new
                                <Button onClick={() => { resetForm(); setShowForm(false); }} icon={XCircle} size="sm" color="gray" variant="light">Cancelar</Button>
                            )}
                            <Button
                                type="submit"
                                icon={editingId ? Edit : PlusCircle}
                                size="sm"
                                color="blue"
                                className="rounded-2xl px-2 py-1 text-sm font-semibold"
                            >
                                {editingId ? 'Guardar Cambios' : 'Guardar'}
                            </Button>
                        </Flex>
                    </form>
                </Card>
            )}

            <PanelAuditoria allGastos={allGastos} audits={audits} />

        </div>
    );
};

export default AuditoriaView;
