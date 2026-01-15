import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
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
// Iconos
import { FileText, Trash2, Calendar, FileCheck, AlertTriangle, Car, Utensils, Layers, Pencil, X, Save, UploadCloud } from 'lucide-react';

const ListaGastos = () => {
  const [gastos, setGastos] = useState([]);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  
  // Estado para edición
  const [gastoAEditar, setGastoAEditar] = useState(null);
  const [nuevoArchivo, setNuevoArchivo] = useState(null); 
  const [subiendo, setSubiendo] = useState(false);

  // Constantes de Cloudinary (Iguales a las de FormularioGasto)
  const CLOUD_NAME = "didj7kuah"; 
  const UPLOAD_PRESET = "gastos_app"; 

  useEffect(() => {
    const q = query(collection(db, "gastos"), orderBy("creado_en", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGastos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const eliminarGasto = async (id) => {
    if (confirm("¿Borrar este registro?")) {
      await deleteDoc(doc(db, "gastos", id));
    }
  };

  // Función auxiliar para subir archivos (Reutilizada)
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
        // 1. Determinar la URL final
        let urlFinal = gastoAEditar.url_factura || ""; // Mantener la anterior por defecto

        // 2. Si hay un archivo NUEVO seleccionado, subirlo y reemplazar la URL
        if (nuevoArchivo) {
            urlFinal = await subirACloudinary(nuevoArchivo);
        }
        
        // 3. Actualizar en Firestore
        const ref = doc(db, "gastos", gastoAEditar.id);
        await updateDoc(ref, {
            concepto: gastoAEditar.concepto,
            monto: parseFloat(gastoAEditar.monto),
            fecha: gastoAEditar.fecha,
            categoria: gastoAEditar.categoria,
            url_factura: urlFinal 
        });

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

  const abrirEdicion = (gasto) => {
    setNuevoArchivo(null);
    setGastoAEditar(gasto);
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
      <div className="flex gap-2">
        <div className="bg-white p-2 rounded-lg border border-gray-200 flex items-center gap-2 flex-1 shadow-sm">
            <Calendar size={14} className="text-gray-400 ml-1"/>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="w-full text-xs outline-none text-gray-600"/>
        </div>
        <div className="bg-white p-2 rounded-lg border border-gray-200 flex items-center gap-2 flex-1 shadow-sm">
            <Calendar size={14} className="text-gray-400 ml-1"/>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="w-full text-xs outline-none text-gray-600"/>
        </div>
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
                    const fechasOrdenadas = Object.keys(datosCategoria.fechas).sort((a, b) => new Date(b) - new Date(a));

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
                                                                <div className="col-span-5 pr-2">
                                                                    <Text className="font-bold text-slate-700 truncate text-xs sm:text-sm" title={gasto.concepto}>{gasto.concepto}</Text>
                                                                </div>
                                                                <div className="col-span-3 text-right">
                                                                    <Text className="font-mono font-bold text-slate-900 text-sm">${parseFloat(gasto.monto).toFixed(2)}</Text>
                                                                </div>
                                                                <div className="col-span-3 flex justify-end items-center gap-2 pl-1">
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => abrirEdicion(gasto)} 
                                                                        className="bg-transparent border-none p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                    >
                                                                        <Pencil size={16} />
                                                                    </button>

                                                                    {gasto.url_factura && (
                                                                        <a href={gasto.url_factura} target="_blank" rel="noreferrer" className="p-1 text-slate-400 hover:text-slate-600">
                                                                            <FileText size={16} />
                                                                        </a>
                                                                    )}
                                                                    
                                                                    <button onClick={() => eliminarGasto(gasto.id)} className="bg-transparent border-none p-0 cursor-pointer group-hover:scale-110 transition-transform" title="Eliminar">
                                                                        <Trash2 size={16} color="#ef4444" strokeWidth={2.5} />
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
            <div className="bg-white rounded-xl shadow-2xl w-90 max-w-md p-6 relative border-none border-slate-300">
                
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
                             onChange={(e) => setGastoAEditar({...gastoAEditar, categoria: e.target.value})}
                             className="w-full p-3 bg-white border border-slate-300 rounded-full font-bold text-slate-800 outline focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-allappearance-none"
                        >
                            <option value="Transporte">Transporte</option>
                            <option value="Comida">Comida</option>
                            <option value="Otros">Otros</option>
                        </select>
                    </div>

                    <br />

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-300 border-none">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block flex items-center gap-2">
                             <FileText size={14}/> Factura PDF
                        </label>

                        <div className="mt-2 text-xs">
                            {nuevoArchivo ? (
                                <span className="text-emerald-600 font-bold">Archivo nuevo seleccionado</span>
                            ) : gastoAEditar.url_factura ? (
                                <span className="text-blue-600 font-medium truncate flex items-center gap-1">
                                    <FileCheck size={12}/> Factura actual cargada
                                </span>
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
                        className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-lg flex justify-center items-center gap-2 mt-4 shadow-lg shadow-blue-200 transition-all hover:scale-[1.02] ${subiendo ? 'opacity-70 cursor-wait' : ''}`}
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