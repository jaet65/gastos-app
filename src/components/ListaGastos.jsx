import { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { 
  Card, 
  Title, 
  Text, 
  Metric, 
  List, 
  ListItem, 
  Badge, 
  Flex, 
  Icon,
  Divider,
} from "@tremor/react";
import { FileText, Trash2, Calendar, FileCheck, AlertTriangle, Car, Utensils, Layers, Pencil, X, Save, UploadCloud, RotateCcw, Coins, ArrowDownCircle } from 'lucide-react';

const ListaGastos = () => {
  const [gastos, setGastos] = useState([]);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  
  // Estado para edición
  const [gastoAEditar, setGastoAEditar] = useState(null);
  const [nuevoArchivo, setNuevoArchivo] = useState(null); 
  const [subiendo, setSubiendo] = useState(false);
  const [editarConPropina, setEditarConPropina] = useState(false);
  
  // Estado para Drag & Drop en Modal
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const dragCounterModal = useRef(0);
  const fileInputEditRef = useRef(null);

  const CLOUD_NAME = "didj7kuah"; 
  const UPLOAD_PRESET = "gastos_app"; 

  const formatoMoneda = (cantidad) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(cantidad);
  };

  useEffect(() => {
    const q = query(collection(db, "gastos"), orderBy("creado_en", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGastos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const eliminarGasto = async (id, idPropina) => {
    if (confirm("¿Borrar este registro?")) {
      await deleteDoc(doc(db, "gastos", id));
      if (idPropina) {
        try {
           await deleteDoc(doc(db, "gastos", idPropina));
        } catch (e) {
           console.log("La propina ya no existía o error al borrar", e);
        }
      }
    }
  };

  const subirACloudinary = async (file) => {
    if (!file) throw new Error("Archivo inválido.");
    if (file.size === 0) throw new Error("El archivo está vacío (0 bytes).");

    // Convertir a Base64 para asegurar lectura completa en Android/Drive
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
    
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
      { method: "POST", body: data }
    );
    
    const fileData = await response.json();
    
    if (!response.ok || !fileData.secure_url) {
      console.error("Error subiendo a Cloudinary (Edición):", fileData);
      throw new Error(fileData.error?.message || "Error al subir el archivo");
    }

    return fileData.secure_url;
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    if (!gastoAEditar) return;
    setSubiendo(true);

    try {
        let urlFinal = gastoAEditar.url_factura || ""; 
        
        if (nuevoArchivo) {
            try {
                urlFinal = await subirACloudinary(nuevoArchivo);
            } catch (error) {
                alert(`Error al subir la factura: ${error.message}`);
                setSubiendo(false);
                return;
            }
        }
        
        const montoPrincipal = parseFloat(gastoAEditar.monto);
        const refPrincipal = doc(db, "gastos", gastoAEditar.id);
        
        let updateData = {
            concepto: gastoAEditar.concepto,
            monto: montoPrincipal,
            fecha: gastoAEditar.fecha,
            categoria: gastoAEditar.categoria,
            url_factura: urlFinal || "" 
        };

        if (gastoAEditar.idPropina && !editarConPropina) {
            await deleteDoc(doc(db, "gastos", gastoAEditar.idPropina));
            updateData.idPropina = null;
        }
        else if (editarConPropina && gastoAEditar.categoria === 'Comida') {
            const montoPropina = montoPrincipal * 0.10;
            const datosPropina = {
                fecha: gastoAEditar.fecha,
                concepto: `Propina => ${gastoAEditar.concepto}  @ ${gastoAEditar.fecha}`,
                monto: montoPropina,
                categoria: 'Comida',
                url_factura: '' 
            };

            if (gastoAEditar.idPropina) {
                await updateDoc(doc(db, "gastos", gastoAEditar.idPropina), datosPropina);
            } else {
                const nuevaPropinaRef = await addDoc(collection(db, "gastos"), {
                    ...datosPropina,
                    creado_en: Timestamp.now()
                });
                updateData.idPropina = nuevaPropinaRef.id;
            }
        }
        else if (gastoAEditar.idPropina && gastoAEditar.categoria !== 'Comida') {
             await deleteDoc(doc(db, "gastos", gastoAEditar.idPropina));
             updateData.idPropina = null;
        }

        await updateDoc(refPrincipal, updateData);

        alert("Gasto actualizado correctamente");
        setGastoAEditar(null);
        setNuevoArchivo(null);
    } catch (error) {
        console.error("Error", error);
        alert("Error al guardar cambios: " + error.message);
    } finally {
        setSubiendo(false);
    }
  };

  const abrirEdicion = (gasto) => {
    const gastoPadre = gastos.find(g => g.idPropina === gasto.id);
    setNuevoArchivo(null);
    setIsDraggingModal(false);
    dragCounterModal.current = 0;

    if (gastoPadre) {
        setGastoAEditar(gastoPadre);
        setEditarConPropina(true);
    } else {
        setGastoAEditar(gasto);
        setEditarConPropina(!!gasto.idPropina);
    }
  };

  const quitarArchivoActual = () => {
    if(confirm("¿Quitar el PDF adjunto de este gasto? (Se aplicará al Guardar)")) {
      setGastoAEditar({ ...gastoAEditar, url_factura: "" });
    }
  };

  const handleDragEnterModal = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterModal.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingModal(true);
    }
  };

  const handleDragLeaveModal = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterModal.current -= 1;
    if (dragCounterModal.current === 0) {
      setIsDraggingModal(false);
    }
  };

  const handleDropModal = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingModal(false);
    dragCounterModal.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === "application/pdf") {
        setNuevoArchivo(file);
      } else {
        alert("Por favor, arrastra solo archivos PDF.");
      }
    }
  };

  const limpiarFiltros = () => {
    setFechaInicio('');
    setFechaFin('');
  };

  const getCategoryDetails = (cat) => {
    switch(cat) {
      case 'Transporte': return { color: 'slate', icon: Car };
      case 'Comida': return { color: 'slate', icon: Utensils };
      default: return { color: 'slate', icon: Layers };
    }
  };

  const dataAgrupada = useMemo(() => {
    const filtrados = gastos.filter(g => {
      if (fechaInicio && g.fecha < fechaInicio) return false;
      if (fechaFin && g.fecha > fechaFin) return false;
      return true;
    });

    const resultado = filtrados.reduce((acc, gasto) => {
      const estado = gasto.url_factura ? 'Con Factura' : 'Sin Factura';
      const categoria = gasto.categoria || 'Otros';
      const fecha = gasto.fecha;

      if (!acc[estado]) acc[estado] = { totalEstado: 0, categorias: {} };
      if (!acc[estado].categorias[categoria]) acc[estado].categorias[categoria] = { totalCategoria: 0, fechas: {} };
      if (!acc[estado].categorias[categoria].fechas[fecha]) acc[estado].categorias[categoria].fechas[fecha] = [];

      acc[estado].categorias[categoria].fechas[fecha].push(gasto);
      acc[estado].categorias[categoria].totalCategoria += parseFloat(gasto.monto);
      acc[estado].totalEstado += parseFloat(gasto.monto);
      
      return acc;
    }, {});

    return resultado;
  }, [gastos, fechaInicio, fechaFin]);

  const totalGeneral = Object.values(dataAgrupada).reduce((sum, e) => sum + e.totalEstado, 0);

  return (
    <div className="space-y-4 relative">
      {/* 2. FILTROS */}
      <div className="flex gap-2 items-center">
        <div className="bg-white p-2 rounded-full border border-gray-200 flex items-center gap-2 flex-1 shadow-sm">
            <Calendar size={14} className="text-gray-400 ml-1"/>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="rounded-full border-none bg-transparent w-full text-xs outline-none text-gray-600"/>
        </div>
        <div className="bg-white p-2 rounded-full border border-gray-200 flex items-center gap-2 flex-1 shadow-sm">
            <Calendar size={14} className="text-gray-400 ml-1"/>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="rounded-full border-none bg-transparent w-full text-xs outline-none text-gray-600"/>
        </div>
        {(fechaInicio || fechaFin) && (
          <button onClick={limpiarFiltros} className="bg-transparent p-2 rounded-full border border-gray-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all shadow-sm flex-shrink-0" title="Limpiar filtros">
            <RotateCcw size={16} />
          </button>
        )}
      </div>
      
      {/* 1. TOTAL GENERAL */}
      <Card decoration="top" decorationColor="blue" className="italic font-black text-xl py-1 px-0">
        <Flex justifyContent="between" alignItems="center">
            <Text>Total Periodo</Text>
            <Metric className="italic text-xl font-black text-slate-800">
                {formatoMoneda(totalGeneral)}
            </Metric>
        </Flex>
      </Card>

      {/* 3. LISTADO */}
      {Object.entries(dataAgrupada).map(([estado, datosEstado]) => {
        const isFactura = estado === 'Con Factura';
        const colorEstado = isFactura ? 'transparent' : 'transparent';
        const IconoEstado = isFactura ? FileCheck : AlertTriangle;

        return (
          <Card key={estado} className="p-0 overflow-hidden shadow-sm">
            <div className={`py-0 px-0 border-l-4 ${isFactura ? 'border-emerald-100 bg-emerald-100' : 'border-amber-100 bg-amber-100'}`}>
                <Flex justifyContent="between" alignItems="center">
                    <div className="flex items-center gap-2">
                        <Icon icon={IconoEstado} color={colorEstado} variant="light" size="sm" />
                        <Title className={`text-sm uppercase font-bold ${isFactura ? 'text-emerald-900' : 'text-amber-900'}`}>{estado}</Title>
                    </div>
                    <Text className={`font-bold ${isFactura ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {formatoMoneda(datosEstado.totalEstado)}
                    </Text>
                </Flex>
            </div>

            <div className="p-4 space-y-4">
                {Object.entries(datosEstado.categorias).map(([nombreCategoria, datosCategoria], indexCat) => {
                    const { color, icon: CatIcon } = getCategoryDetails(nombreCategoria);
                    const fechasOrdenadas = Object.keys(datosCategoria.fechas).sort((a, b) => new Date(a) - new Date(b));

                    return (
                        <div key={nombreCategoria}>
                            {indexCat > 0 && <Divider className="my-0 opacity-50" />}
                            <div className="pt-2 pb-0">
                                <div className="-mr-4 -ml-4 px-0 mb-2">
                                    <Flex justifyContent="between" alignItems="center">
                                        <div className="flex items-center gap-1.5 pl-1">
                                        <CatIcon size={20} className="text-slate-900" strokeWidth={2.5} />
                                        <span className="text-xs font-black uppercase text-slate-900 tracking-wide">
                                            {nombreCategoria}
                                        </span>
                                    </div>

                                    <Text className="text-sm font-bold text-blue-700">
                                        {formatoMoneda(datosCategoria.totalCategoria)}
                                    </Text>
                                </Flex>
                            </div>
                                <div className="space-y-0">
                                    {fechasOrdenadas.map((fecha) => {
                                        const items = datosCategoria.fechas[fecha];
                                        return (
                                            <div key={fecha} className="px-0">
                                                <div className="flex items-center gap-4 mb-0 ml-0">
                                                    <Text className="text-xs font-bold text-green-700 uppercase">{fecha}</Text>
                                                </div>
                                                <List className="mt-0 space-y-0">
                                                    {items.map((gasto) => (
                                                        <ListItem key={gasto.id} className="p-0 border-none">
                                                            <div className="grid grid-cols-12 w-full items-center py-2 px-2 bg-slate-50/50 rounded hover:bg-slate-100 transition-colors">
                                                                
                                                                <div className="col-span-6 pr-2 flex items-center gap-1.5 overflow-hidden">
                                                                    <Text className="font-bold text-slate-700 truncate text-xs sm:text-sm" title={gasto.concepto}>{gasto.concepto}</Text>
                                                                    {gasto.idPropina && (
                                                                        <div className="bg-transparent text-yellow-600 p-0.5 rounded flex-shrink-0" title="Tiene propina asignada">
                                                                            <Coins size={10} strokeWidth={2.5} />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                
                                                                <div className="col-span-3 text-right">
                                                                    <Text className="font-mono font-bold text-slate-900 text-sm">{formatoMoneda(parseFloat(gasto.monto))}</Text>
                                                                </div>
                                                                
                                                                <div className="col-span-3 flex justify-end items-center gap-0 pl-1 -mr-6">
                                                                    {gasto.url_factura && (
                                                                        <a href={gasto.url_factura} target="_blank" rel="noreferrer" className="p-1 text-slate-400 hover:text-slate-600">
                                                                            <FileText size={20} />
                                                                        </a>
                                                                    )}
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => abrirEdicion(gasto)} 
                                                                        className="bg-transparent border-none p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                    >
                                                                        <Pencil size={20} />
                                                                    </button>

                                                                    <button onClick={() => eliminarGasto(gasto.id, gasto.idPropina)} className="bg-transparent border-none p-0 cursor-pointer group-hover:scale-110 transition-transform" title="Eliminar">
                                                                        <Trash2 size={20} color="#ef4444" strokeWidth={2.5} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </ListItem>
                                                    ))}
                                                </List>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
          </Card>
        );
      })}

      {/* --- MODAL DE EDICIÓN ESTILO POPUP --- */}
      {gastoAEditar && createPortal(
        <div 
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
            style={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 
            }}
            // DRAG EVENTS DEL MODAL (Global al modal)
            onDragEnter={handleDragEnterModal}
            onDragLeave={handleDragLeaveModal}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropModal}
        >
            <div className="bg-white rounded-xl shadow-2xl w-90 max-w-md p-6 relative border-none border-slate-300 max-h-[90vh] overflow-y-auto">
                
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                    <h3 className="text-xl font-black text-slate-800">Editar Gasto</h3>
                    <button 
                        onClick={() => setGastoAEditar(null)} 
                        className="bg-transparent text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X size={22} />
                    </button>
                </div>

                <form onSubmit={guardarEdicion} className="space-y-5">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Concepto</label>
                        <input 
                            type="text" 
                            required
                            value={gastoAEditar.concepto} 
                            onChange={(e) => setGastoAEditar({...gastoAEditar, concepto: e.target.value})}
                            className="w-full p-3 bg-white border border-slate-300 rounded-full font-bold text-slate-800 outline focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Monto</label>
                            <input 
                                type="number" 
                                step="0.01"
                                required
                                value={gastoAEditar.monto} 
                                onChange={(e) => setGastoAEditar({...gastoAEditar, monto: e.target.value})}
                                className="w-full p-3 bg-white border border-slate-300 rounded-full font-bold text-slate-800 outline focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Fecha</label>
                            <input 
                                type="date" 
                                required
                                value={gastoAEditar.fecha} 
                                onChange={(e) => setGastoAEditar({...gastoAEditar, fecha: e.target.value})}
                                className="w-full p-3 bg-white border border-slate-300 rounded-full font-bold text-slate-800 outline focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Categoría</label>
                        <select 
                             value={gastoAEditar.categoria} 
                             onChange={(e) => {
                                 setGastoAEditar({...gastoAEditar, categoria: e.target.value});
                                 if (e.target.value !== 'Comida') setEditarConPropina(false);
                             }}
                             className="w-full p-3 bg-white border border-slate-300 rounded-full font-bold text-slate-800 outline focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all appearance-none"
                        >
                            <option value="Transporte">Transporte</option>
                            <option value="Comida">Comida</option>
                            <option value="Otros">Otros</option>
                        </select>
                    </div>

                    {gastoAEditar.categoria === 'Comida' && (
                      <div className="flex items-center gap-3 bg-blue-50/50 p-4 rounded-lg border-l-4 border-blue-500 mt-2">
                        <input 
                          type="checkbox" 
                          id="checkPropinaEdit"
                          checked={editarConPropina}
                          onChange={(e) => setEditarConPropina(e.target.checked)}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                        <label htmlFor="checkPropinaEdit" className="text-slate-700 font-bold text-sm cursor-pointer select-none">
                          ¿Agregar Propina (10%)?
                        </label>
                        {editarConPropina && (
                          <span className="ml-auto text-blue-600 font-black text-sm">
                            +{formatoMoneda(parseFloat(gastoAEditar.monto || 0) * 0.10)}
                          </span>
                        )}
                      </div>
                    )}

                    <br />

                    <div className="mt-4">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block flex items-center gap-2">
                             <FileText size={14}/> Factura PDF
                        </label>

                        {nuevoArchivo ? (
                            <div className="flex items-center justify-between w-full bg-emerald-100 p-2 rounded border border-emerald-200">
                                <div className="flex items-center gap-2 truncate">
                                    <UploadCloud size={16} className="text-emerald-600" />
                                    <span className="text-emerald-800 text-sm font-bold truncate">{nuevoArchivo.name}</span>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => setNuevoArchivo(null)}
                                    className="text-emerald-700 hover:text-emerald-900 bg-white/50 hover:bg-white rounded-full p-1"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (gastoAEditar.url_factura && gastoAEditar.url_factura !== "") ? (
                            <div className="flex items-center justify-between w-full bg-white p-2 rounded border border-blue-100">
                                <div className="flex items-center gap-2 text-blue-600">
                                    <FileCheck size={16}/> 
                                    <span className="text-sm font-medium">Factura actual guardada</span>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        type="button" 
                                        onClick={quitarArchivoActual}
                                        className="text-red-500 hover:text-red-700 bg-red-50 p-1 rounded hover:bg-red-100"
                                        title="Eliminar factura actual"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div 
                                onClick={() => fileInputEditRef.current.click()}
                                className={`
                                    py-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors
                                    ${isDraggingModal ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}
                                `}
                            >
                                {isDraggingModal ? (
                                    <ArrowDownCircle size={32} className="text-blue-600 animate-bounce mb-1" />
                                ) : (
                                    <UploadCloud size={24} className="text-slate-400 mb-1" />
                                )}
                                <span className={`text-xs font-bold uppercase ${isDraggingModal ? 'text-blue-600' : 'text-slate-400'}`}>
                                    {isDraggingModal ? '¡Suelta para adjuntar!' : 'Click o arrastra para adjuntar'}
                                </span>
                            </div>
                        )}
                        
                        <input 
                            type="file" 
                            accept="application/pdf"
                            ref={fileInputEditRef}
                            onChange={(e) => setNuevoArchivo(e.target.files[0])}
                            className="hidden"
                        />
                    </div>

                    <br />

                    <button 
                        type="submit" 
                        disabled={subiendo}
                        className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-full flex justify-center items-center gap-2 mt-4 shadow-lg shadow-blue-200 transition-all hover:scale-[1.02] ${subiendo ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        {subiendo ? (
                             <>Guardando...</>
                        ) : (
                             <><Save size={18} /> Guardar Cambios</>
                        )}
                    </button>
                </form>
            </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default ListaGastos;