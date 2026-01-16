import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
// Componentes Tremor
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
// Iconos: Agregamos 'Coins' para el indicador
import { FileText, Trash2, Calendar, FileCheck, AlertTriangle, Car, Utensils, Layers, Pencil, X, Save, UploadCloud, RotateCcw, Coins } from 'lucide-react';

const ListaGastos = () => {
  const [gastos, setGastos] = useState([]);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  
  // Estado para edición
  const [gastoAEditar, setGastoAEditar] = useState(null);
  const [nuevoArchivo, setNuevoArchivo] = useState(null); 
  const [subiendo, setSubiendo] = useState(false);
  // Estado para el checkbox de propina en edición
  const [editarConPropina, setEditarConPropina] = useState(false);

  const CLOUD_NAME = "didj7kuah"; 
  const UPLOAD_PRESET = "gastos_app"; 

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
      // Si tiene propina asociada, la borramos también
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
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", UPLOAD_PRESET);
    data.append("cloud_name", CLOUD_NAME);
    
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
      { method: "POST", body: data }
    );
    const fileData = await response.json();
    return fileData.secure_url;
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    if (!gastoAEditar) return;
    setSubiendo(true);

    try {
        let urlFinal = gastoAEditar.url_factura || ""; 
        if (nuevoArchivo) {
            urlFinal = await subirACloudinary(nuevoArchivo);
        }
        
        const montoPrincipal = parseFloat(gastoAEditar.monto);
        const refPrincipal = doc(db, "gastos", gastoAEditar.id);
        
        // Objeto de actualización base
        let updateData = {
            concepto: gastoAEditar.concepto,
            monto: montoPrincipal,
            fecha: gastoAEditar.fecha,
            categoria: gastoAEditar.categoria,
            url_factura: urlFinal 
        };

        // LÓGICA DE PROPINA EN EDICIÓN
        
        // Caso A: Tenía propina y se desactivó el checkbox -> BORRAR PROPINA
        if (gastoAEditar.idPropina && !editarConPropina) {
            await deleteDoc(doc(db, "gastos", gastoAEditar.idPropina));
            updateData.idPropina = null; // Quitar referencia
        }

        // Caso B: Se activó el checkbox (sea nueva o actualización)
        else if (editarConPropina && gastoAEditar.categoria === 'Comida') {
            const montoPropina = montoPrincipal * 0.10;
            const datosPropina = {
                fecha: gastoAEditar.fecha,
                concepto: `Propina => ${gastoAEditar.concepto}  @ ${gastoAEditar.fecha}`,
                monto: montoPropina,
                categoria: 'Comida',
                url_factura: '' // Sin factura siempre
            };

            if (gastoAEditar.idPropina) {
                // Actualizar propina existente
                await updateDoc(doc(db, "gastos", gastoAEditar.idPropina), datosPropina);
            } else {
                // Crear nueva propina
                const nuevaPropinaRef = await addDoc(collection(db, "gastos"), {
                    ...datosPropina,
                    creado_en: Timestamp.now()
                });
                updateData.idPropina = nuevaPropinaRef.id; // Guardar referencia
            }
        }

        // Caso C: Cambió de categoría y tenía propina -> BORRAR PROPINA
        else if (gastoAEditar.idPropina && gastoAEditar.categoria !== 'Comida') {
             await deleteDoc(doc(db, "gastos", gastoAEditar.idPropina));
             updateData.idPropina = null;
        }

        // Aplicar cambios al registro principal
        await updateDoc(refPrincipal, updateData);

        alert("Gasto actualizado correctamente");
        setGastoAEditar(null);
        setNuevoArchivo(null);
    } catch (error) {
        console.error("Error", error);
        alert("Error al actualizar: " + error.message);
    } finally {
        setSubiendo(false);
    }
  };

  // --- MODIFICACIÓN CLAVE: LÓGICA DE REDIRECCIÓN ---
  const abrirEdicion = (gasto) => {
    // 1. Buscar si este gasto es "hijo" (propina) de alguien más
    const gastoPadre = gastos.find(g => g.idPropina === gasto.id);

    setNuevoArchivo(null);

    if (gastoPadre) {
        // ¡Es una propina! Abrimos al padre en su lugar
        setGastoAEditar(gastoPadre);
        setEditarConPropina(true); // Marcamos el check porque el padre tiene propina
        // Opcional: alert("Editando el gasto principal vinculado.");
    } else {
        // Es un gasto normal
        setGastoAEditar(gasto);
        setEditarConPropina(!!gasto.idPropina);
    }
  };

  const quitarArchivoActual = () => {
    if(confirm("¿Quitar el PDF adjunto de este gasto? (Se aplicará al Guardar)")) {
      setGastoAEditar({ ...gastoAEditar, url_factura: "" });
    }
  };

  const limpiarFiltros = () => {
    setFechaInicio('');
    setFechaFin('');
  };

  const getCategoryDetails = (cat) => {
    switch(cat) {
      case 'Transporte': return { color: 'slate', icon: Car };
      case 'Comida': return { color: 'blue', icon: Utensils };
      default: return { color: 'gray', icon: Layers };
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
      <Card decoration="top" decorationColor="blue" className="py-3 px-4 shadow-sm">
        <Flex justifyContent="between" alignItems="center">
            <Text>Total Periodo</Text>
            <Metric>${totalGeneral.toFixed(2)}</Metric>
        </Flex>
      </Card>

      {/* 3. LISTADO */}
      {Object.entries(dataAgrupada).map(([estado, datosEstado]) => {
        const isFactura = estado === 'Con Factura';
        const colorEstado = isFactura ? 'emerald' : 'amber';
        const IconoEstado = isFactura ? FileCheck : AlertTriangle;

        return (
          <Card key={estado} className="p-0 overflow-hidden shadow-sm">
            <div className={`py-0 px-0 border-l-4 ${isFactura ? 'border-emerald-500 bg-emerald-500' : 'border-amber-500 bg-amber-500'}`}>
                <Flex justifyContent="between" alignItems="center">
                    <div className="flex items-center gap-2">
                        <Icon icon={IconoEstado} color={colorEstado} variant="light" size="sm" />
                        <Title className={`text-sm uppercase font-bold ${isFactura ? 'text-emerald-900' : 'text-amber-900'}`}>{estado}</Title>
                    </div>
                    <Text className={`font-bold ${isFactura ? 'text-emerald-700' : 'text-amber-700'}`}>
                        ${datosEstado.totalEstado.toFixed(2)}
                    </Text>
                </Flex>
            </div>

            <div className="p-0">
                {Object.entries(datosEstado.categorias).map(([nombreCategoria, datosCategoria], indexCat) => {
                    const { color, icon: CatIcon } = getCategoryDetails(nombreCategoria);
                    const fechasOrdenadas = Object.keys(datosCategoria.fechas).sort((a, b) => new Date(a) - new Date(b));

                    return (
                        <div key={nombreCategoria}>
                            {indexCat > 0 && <Divider className="my-0 opacity-50" />}
                            <div className="pt-0 pb-0">
                                <div className="px-4 mb-0">
                                    <Flex justifyContent="between" alignItems="center">
                                        <Badge icon={CatIcon} color={color} size="xs">{nombreCategoria}</Badge>
                                        <Text className="text-xs font-bold text-slate-400">${datosCategoria.totalCategoria.toFixed(2)}</Text>
                                    </Flex>
                                </div>
                                <div className="space-y-0">
                                    {fechasOrdenadas.map((fecha) => {
                                        const items = datosCategoria.fechas[fecha];
                                        return (
                                            <div key={fecha} className="px-0">
                                                <div className="flex items-center gap-2 mb-0 ml-0">
                                                    <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                                    <Text className="text-[17px] font-bold text-slate-400 uppercase">{fecha}</Text>
                                                </div>
                                                <List className="mt-0 space-y-0">
                                                    {items.map((gasto) => (
                                                        <ListItem key={gasto.id} className="p-0 border-none">
                                                            <div className="grid grid-cols-12 w-full items-center py-2 px-2 bg-slate-50/50 rounded hover:bg-slate-100 transition-colors">
                                                                
                                                                {/* --- MODIFICACIÓN: INDICADOR VISUAL SUTIL --- */}
                                                                <div className="col-span-5 pr-2 flex items-center gap-1.5 overflow-hidden">
                                                                    <Text className="font-bold text-slate-700 truncate text-xs sm:text-sm" title={gasto.concepto}>{gasto.concepto}</Text>
                                                                    {/* Si tiene idPropina, mostramos la monedita */}
                                                                    {gasto.idPropina && (
                                                                        <div className="bg-yellow-100 text-yellow-600 p-0.5 rounded flex-shrink-0" title="Tiene propina asignada">
                                                                            <Coins size={15} strokeWidth={2.5} />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                
                                                                <div className="col-span-3 text-right">
                                                                    <Text className="font-mono font-bold text-slate-900 text-sm">${parseFloat(gasto.monto).toFixed(2)}</Text>
                                                                </div>
                                                                
                                                                <div className="col-span-3 flex justify-end items-center gap-2 pl-1">
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

                    {/* CHECKBOX PROPINA EDICIÓN */}
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
                            +${(parseFloat(gastoAEditar.monto || 0) * 0.10).toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}

                    <br />

                    <div className="bg-slate-50 p-4 rounded-lg border-none border-slate-300 border-dashed">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block flex items-center gap-2">
                             <FileText size={14}/> Factura PDF
                        </label>
                        
                        <div className="mt-2 text-xs flex items-center justify-between">
                            {nuevoArchivo ? (
                                <div className="flex items-center gap-2 bg-emerald-100 px-2 py-1 rounded">
                                    <span className="text-emerald-700 font-bold">Archivo nuevo seleccionado</span>
                                    <button 
                                        type="button" 
                                        onClick={() => setNuevoArchivo(null)} 
                                        className="text-emerald-700 hover:text-emerald-900 bg-emerald-200 hover:bg-emerald-300 rounded-full p-0.5 transition-colors"
                                        title="Cancelar subida"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ) : (gastoAEditar.url_factura && gastoAEditar.url_factura !== "") ? (
                                <div className="flex items-center gap-2 bg-blue-50 px-2 py-1 rounded w-full justify-between">
                                    <span className="text-blue-600 font-medium truncate flex items-center gap-1">
                                        <FileCheck size={12}/> Factura actual cargada
                                    </span>
                                    <button 
                                        type="button" 
                                        onClick={quitarArchivoActual}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-100 p-1 rounded transition-colors"
                                        title="Quitar archivo adjunto"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ) : (
                                <span className="text-slate-400 italic">Sin factura actualmente</span>
                            )}
                        </div>
                    </div>

                    <br />

                    <input 
                      type="file" 
                      accept="application/pdf"
                      onChange={(e) => setNuevoArchivo(e.target.files[0])}
                      className="bg-transparent w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                    />

                    <br />
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