import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Trash2, FileCheck, Pencil, X, Save, UploadCloud, ArrowDownCircle, Plus } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, Timestamp, updateDoc } from 'firebase/firestore';

const CLOUD_NAME = "didj7kuah";
const UPLOAD_PRESET = "Gastos_Facturas";

const formatoMoneda = (cantidad) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(cantidad);
};

const EditGastoModal = ({ gasto, onClose, onSave }) => {
    const [gastoEditado, setGastoEditado] = useState(gasto);
    const [nuevoArchivo, setNuevoArchivo] = useState(null);
    const [subiendo, setSubiendo] = useState(false);
    const [editarConPropina, setEditarConPropina] = useState(!!gasto.idPropina);

    // Estado para casetas vinculadas
    const [misCasetas, setMisCasetas] = useState([]);
    const [casetasBorradas, setCasetasBorradas] = useState([]);
    const [cargandoCasetas, setCargandoCasetas] = useState(false);

    const [isDraggingModal, setIsDraggingModal] = useState(false);
    const dragCounterModal = useRef(0);
    const fileInputEditRef = useRef(null);

    useEffect(() => {
        // Si la categoría cambia a algo que no es 'Comida', desactiva la propina.
        if (gastoEditado.categoria !== 'Comida') {
            setEditarConPropina(false);
        }
    }, [gastoEditado.categoria]);

    // Fetch casetas al cargar
    useEffect(() => {
        const fetchCasetas = async () => {
            if (gasto.id && gasto.categoria === 'Transporte') {
                setCargandoCasetas(true);
                try {
                    const q = query(collection(db, "gastos"), where("idPadre", "==", gasto.id));
                    const querySnapshot = await getDocs(q);
                    const fetchedCasetas = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setMisCasetas(fetchedCasetas);
                } catch (error) {
                    console.error("Error fetching casetas:", error);
                } finally {
                    setCargandoCasetas(false);
                }
            }
        };
        fetchCasetas();
    }, [gasto.id, gasto.categoria]);

    const subirACloudinary = async (file) => {
        if (!file) throw new Error("Archivo inválido.");
        if (file.size === 0) throw new Error("El archivo está vacío (0 bytes).");

        const toBase64 = (file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });

        let fileDataUrl;
        try {
            fileDataUrl = await toBase64(file);
        } catch (readError) {
            console.error("Error lectura:", readError);
            throw new Error("Error leyendo el archivo. Prueba descargándolo al dispositivo.");
        }

        const data = new FormData();
        data.append("file", fileDataUrl);
        data.append("upload_preset", UPLOAD_PRESET);
        data.append("cloud_name", CLOUD_NAME);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: "POST", body: data });
        const fileData = await response.json();

        if (!response.ok || !fileData.secure_url) {
            console.error("Error subiendo a Cloudinary (Edición):", fileData);
            throw new Error(fileData.error?.message || "Error al subir el archivo");
        }
        return fileData;
    };

    const handleGuardar = async (e) => {
        e.preventDefault();
        setSubiendo(true);

        const tokenABorrar = gasto.deleteToken;
        const urlOriginal = gasto.url_factura;

        const seQuitoFactura = gastoEditado.url_factura === "" && nuevoArchivo === null;
        const tieneNuevoArchivo = nuevoArchivo !== null;

        try {
            let fileData = null;

            // 1. Manejar factura del gasto principal
            if (tieneNuevoArchivo) {
                fileData = await subirACloudinary(nuevoArchivo);
                if (urlOriginal && tokenABorrar) {
                    eliminarArchivoCloudinary(tokenABorrar).catch(() =>
                        console.log("El token expiró o falló el borrado del archivo viejo."));
                }
            }
            else if (seQuitoFactura && urlOriginal && tokenABorrar) {
                try { await eliminarArchivoCloudinary(tokenABorrar); } catch { /* ignore */ }
            }

            // 2. Manejar casetas (Altas y Bajas)
            // a) Borrar casetas eliminadas
            for (const idCaseta of casetasBorradas) {
                const casetaObj = misCasetas.find(c => c.id === idCaseta) || {}; // Intentamos buscar si ya estaba cargada
                if (casetaObj.deleteToken) {
                    await eliminarArchivoCloudinary(casetaObj.deleteToken).catch(() => { });
                }
                await deleteDoc(doc(db, "gastos", idCaseta));
            }

            // b) Guardar casetas nuevas
            for (const caseta of misCasetas) {
                if (!caseta.id) { // Es una caseta nueva (sin ID de Firestore)
                    if (!caseta.monto) continue;

                    let fileDataCaseta = { secure_url: '', delete_token: '' };
                    if (caseta.archivo) {
                        fileDataCaseta = await subirACloudinary(caseta.archivo);
                    }
                    await addDoc(collection(db, "gastos"), {
                        fecha: gastoEditado.fecha,
                        concepto: `Caseta`,
                        monto: parseFloat(caseta.monto),
                        categoria: 'Transporte',
                        url_factura: fileDataCaseta.secure_url,
                        deleteToken: fileDataCaseta.delete_token,
                        creado_en: Timestamp.now(),
                        userId: gasto.userId,
                        idPadre: gasto.id // Vinculamos al gasto principal
                    });
                } else {
                    // c) Actualizar casetas existentes (si cambiaron)
                    const casetaRef = doc(db, "gastos", caseta.id);
                    let url_factura = caseta.url_factura || "";
                    let deleteToken = caseta.deleteToken || "";

                    if (caseta.archivo) { // Se subió una factura para una caseta que no tenía o se cambió
                        const fileData = await subirACloudinary(caseta.archivo);
                        url_factura = fileData.secure_url;
                        deleteToken = fileData.delete_token;
                    }

                    await updateDoc(casetaRef, {
                        monto: parseFloat(caseta.monto),
                        fecha: gastoEditado.fecha, // Sincronizar fecha con el gasto principal
                        url_factura,
                        deleteToken
                    });
                }
            }

            // 3. Objeto final del gasto principal
            let conceptoFinal = gastoEditado.concepto;
            if (gastoEditado.categoria === 'MAF' && !conceptoFinal.startsWith('MAF - ')) {
                conceptoFinal = `MAF - ${conceptoFinal}`;
            }

            const gastoParaGuardar = {
                ...gastoEditado,
                concepto: conceptoFinal,
                url_factura: fileData ? fileData.secure_url : gastoEditado.url_factura,
                deleteToken: fileData ? fileData.delete_token : (seQuitoFactura ? "" : gasto.deleteToken)
            };

            await onSave(gastoParaGuardar, editarConPropina);
            onClose();
        } catch (error) {
            console.error("Error crítico en handleGuardar:", error);
            alert(`Error: ${error.message}`);
        } finally {
            setSubiendo(false);
        }
    };

    const eliminarArchivoCloudinary = async (deleteToken) => {
        try {
            const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/delete_by_token`;
            const formData = new FormData();
            formData.append("token", deleteToken);
            const response = await fetch(cloudinaryUrl, { method: 'POST', body: formData });
            if (!response.ok) {
                const data = await response.json();
                console.error('Error de Cloudinary:', data.error?.message || 'Error desconocido');
            }
        } catch (error) { console.error('Error en Cloudinary delete:', error); }
    };

    const quitarArchivoActual = () => {
        if (confirm("¿Quitar el PDF adjunto de este gasto?")) {
            setGastoEditado({ ...gastoEditado, url_factura: "" });
        }
    };

    const addSubCaseta = () => {
        setMisCasetas([...misCasetas, { monto: '', archivo: null }]);
    };

    const removeSubCaseta = (index, id) => {
        if (id) {
            setCasetasBorradas([...casetasBorradas, id]);
        }
        const newCasetas = [...misCasetas];
        newCasetas.splice(index, 1);
        setMisCasetas(newCasetas);
    };

    const handleCasetaChange = (index, field, value) => {
        const newCasetas = [...misCasetas];
        newCasetas[index][field] = value;
        setMisCasetas(newCasetas);
    };

    // --- Drag & Drop ---
    const handleDragEnterModal = (e) => { e.preventDefault(); e.stopPropagation(); dragCounterModal.current++; if (e.dataTransfer.items.length > 0) setIsDraggingModal(true); };
    const handleDragLeaveModal = (e) => { e.preventDefault(); e.stopPropagation(); dragCounterModal.current--; if (dragCounterModal.current === 0) setIsDraggingModal(false); };
    const handleDropModal = (e) => {
        e.preventDefault(); e.stopPropagation(); setIsDraggingModal(false); dragCounterModal.current = 0;
        const file = e.dataTransfer.files[0];
        if (file && file.type === "application/pdf") setNuevoArchivo(file);
        else alert("Por favor, arrastra solo archivos PDF.");
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-white/90"
            onDragEnter={handleDragEnterModal}
            onDragLeave={handleDragLeaveModal}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropModal}
        >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative border border-slate-200 max-h-[95vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                    <h3 className="text-xl font-black text-slate-800">Editar Gasto</h3>
                    <button onClick={onClose} className="bg-transparent text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={22} />
                    </button>
                </div>

                <form onSubmit={handleGuardar} className="space-y-5">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Concepto</label>
                        <input type="text" required value={gastoEditado.concepto} onChange={(e) => setGastoEditado({ ...gastoEditado, concepto: e.target.value })} className="w-full p-3 bg-white border border-slate-300 rounded-full font-bold text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Monto</label>
                            <input type="number" step="0.01" required value={gastoEditado.monto} onChange={(e) => setGastoEditado({ ...gastoEditado, monto: e.target.value })} className="w-full p-3 bg-white border border-slate-300 rounded-full font-bold text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Fecha</label>
                            <input type="date" required value={gastoEditado.fecha} onChange={(e) => setGastoEditado({ ...gastoEditado, fecha: e.target.value })} className="w-full p-3 bg-white border border-slate-300 rounded-full font-bold text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all" />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Categoría</label>
                        <select value={gastoEditado.categoria} onChange={(e) => setGastoEditado({ ...gastoEditado, categoria: e.target.value })} className="w-full p-3 bg-white border border-slate-300 rounded-full font-bold text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all appearance-none">
                            <option value="Transporte">Transporte</option>
                            <option value="Comida">Comida</option>
                            <option value="MAF">MAF</option>
                            <option value="Otros">Otros</option>
                        </select>
                    </div>

                    {/* GESTIÓN DE CASETAS (Si es Transporte) */}
                    {gastoEditado.categoria === 'Transporte' && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Casetas Vinculadas</label>
                                <button type="button" onClick={addSubCaseta} className="flex items-center gap-1 text-[10px] font-black bg-blue-600 text-white px-2 py-1 rounded-full hover:bg-blue-700 transition-colors uppercase">
                                    <Plus size={12} /> Agregar
                                </button>
                            </div>
                            {cargandoCasetas ? (
                                <p className="text-center text-xs text-slate-400 py-2">Cargando...</p>
                            ) : (
                                <div className="space-y-3">
                                    {misCasetas.map((caseta, idx) => (
                                        <div key={caseta.id || `new-${idx}`} className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                                            <div className="flex-1">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={caseta.monto}
                                                    onChange={(e) => handleCasetaChange(idx, 'monto', e.target.value)}
                                                    placeholder="Monto"
                                                    className="w-24 bg-transparent border-none outline-none font-bold text-slate-800 focus:bg-slate-100 rounded px-1 transition-all"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {(caseta.id && caseta.url_factura) ? (
                                                    <a href={caseta.url_factura} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700"><FileText size={18} /></a>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="file"
                                                            accept=".pdf"
                                                            onChange={(e) => handleCasetaChange(idx, 'archivo', e.target.files[0])}
                                                            className="w-40 text-[10px] text-slate-400"
                                                        />
                                                        {caseta.archivo && <FileCheck size={14} className="text-green-500" />}
                                                    </div>
                                                )}
                                                <button type="button" onClick={() => removeSubCaseta(idx, caseta.id)} className="text-red-400 hover:text-red-600 transition-colors">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {misCasetas.length === 0 && <p className="text-center text-xs text-slate-400 py-2">No hay casetas vinculadas.</p>}
                                </div>
                            )}
                        </div>
                    )}

                    {gastoEditado.categoria === 'Comida' && (
                        <div className="flex items-center gap-3 bg-blue-50/50 p-4 rounded-lg border-l-4 border-blue-500 mt-2">
                            <input type="checkbox" id="checkPropinaEdit" checked={editarConPropina} onChange={(e) => setEditarConPropina(e.target.checked)} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer accent-blue-600" />
                            <label htmlFor="checkPropinaEdit" className="text-slate-700 font-bold text-sm cursor-pointer select-none">¿Agregar Propina (10%)?</label>
                            {editarConPropina && <span className="ml-auto text-blue-600 font-black text-sm">+{formatoMoneda(parseFloat(gastoEditado.monto || 0) * 0.10)}</span>}
                        </div>
                    )}

                    <div className="mt-4">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block flex items-center gap-2"><FileText size={14} /> Factura Principal PDF</label>
                        {nuevoArchivo ? (
                            <div className="flex items-center justify-between w-full bg-emerald-100 p-2 rounded border border-emerald-200">
                                <div className="flex items-center gap-2 truncate">
                                    <UploadCloud size={16} className="text-emerald-600" />
                                    <span className="text-emerald-800 text-sm font-bold truncate">{nuevoArchivo.name}</span>
                                </div>
                                <button type="button" onClick={() => setNuevoArchivo(null)} className="text-emerald-700 hover:text-emerald-900 bg-white/50 hover:bg-white rounded-full p-1"><X size={14} /></button>
                            </div>
                        ) : (gastoEditado.url_factura) ? (
                            <div className="flex items-center justify-between w-full bg-white p-2 rounded border border-blue-100">
                                <div className="flex items-center gap-2 text-blue-600">
                                    <FileCheck size={16} />
                                    <span className="text-sm font-medium">Factura actual guardada</span>
                                </div>
                                <button type="button" onClick={quitarArchivoActual} className="text-red-500 hover:text-red-700 bg-red-50 p-1 rounded hover:bg-red-100" title="Eliminar factura actual"><Trash2 size={14} /></button>
                            </div>
                        ) : (
                            <div onClick={() => fileInputEditRef.current.click()} className={`py-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${isDraggingModal ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                                {isDraggingModal ? <ArrowDownCircle size={32} className="text-blue-600 animate-bounce mb-1" /> : <UploadCloud size={24} className="text-slate-400 mb-1" />}
                                <span className={`text-xs font-bold uppercase ${isDraggingModal ? 'text-blue-600' : 'text-slate-400'}`}>{isDraggingModal ? '¡Suelta para adjuntar!' : 'Click o arrastra para adjuntar'}</span>
                            </div>
                        )}
                        <input type="file" accept="application/pdf" ref={fileInputEditRef} onChange={(e) => setNuevoArchivo(e.target.files[0])} className="hidden" />
                    </div>

                    <button type="submit" disabled={subiendo} className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-full flex justify-center items-center gap-2 mt-6 shadow-lg shadow-blue-200 transition-all hover:scale-[1.02] ${subiendo ? 'opacity-70 cursor-wait' : ''}`}>
                        {subiendo ? 'Guardando...' : <><Save size={18} /> Guardar Cambios</>}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default EditGastoModal;