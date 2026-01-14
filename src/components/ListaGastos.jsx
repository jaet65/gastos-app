import { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { FileText, Trash2, Calendar, Filter } from 'lucide-react';

const ListaGastos = () => {
  const [gastos, setGastos] = useState([]);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

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

  // Colores de fondo planos, SIN BORDES
  const getBadgeColor = (cat) => {
    switch(cat) {
      case 'Transporte': return 'bg-slate-200 text-slate-700';
      case 'Comida': return 'bg-blue-100 text-blue-700';
      default: return 'bg-white text-gray-600';
    }
  };

  const gastosProcesados = useMemo(() => {
    const filtrados = gastos.filter(g => {
      if (fechaInicio && g.fecha < fechaInicio) return false;
      if (fechaFin && g.fecha > fechaFin) return false;
      return true;
    });

    return filtrados.reduce((acc, gasto) => {
      const cat = gasto.categoria || 'Otros';
      if (!acc[cat]) acc[cat] = { items: [], total: 0 };
      acc[cat].items.push(gasto);
      acc[cat].total += parseFloat(gasto.monto);
      return acc;
    }, {});
  }, [gastos, fechaInicio, fechaFin]);

  const totalGeneral = Object.values(gastosProcesados).reduce((sum, grupo) => sum + grupo.total, 0);
  const hayDatos = Object.keys(gastosProcesados).length > 0;

  return (
    <div className="space-y-16">
      
      {/* FILTROS: Bloque plano */}
      <div className="bg-white/50 backdrop-blur-xl p-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-4 bg-white"><Filter size={24} className="text-slate-400" /></div>
          <h3 className="font-bold text-2xl text-slate-700">Filtrar por fecha</h3>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex-1 bg-white/60 px-6 py-5 flex items-center hover:bg-white transition-colors">
            <Calendar size={20} className="text-slate-400 mr-4"/>
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
              className="bg-transparent w-full text-base font-bold text-slate-700 outline-none" />
          </div>
          <div className="flex-1 bg-white/60 px-6 py-5 flex items-center hover:bg-white transition-colors">
            <Calendar size={20} className="text-slate-400 mr-4"/>
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
              className="bg-transparent w-full text-base font-bold text-slate-700 outline-none" />
          </div>
          {(fechaInicio || fechaFin) && (
            <button onClick={() => {setFechaInicio(''); setFechaFin('');}}
              className="px-10 py-5 bg-slate-800 text-white text-sm font-black uppercase tracking-wider hover:bg-slate-900 transition-colors">
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* RESULTADOS */}
      <div className="flex items-end justify-between px-2">
        <h2 className="text-4xl font-black text-slate-800 tracking-tight">Resultados</h2>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Total</p>
          <p className="text-4xl font-black text-slate-900">${totalGeneral.toFixed(2)}</p>
        </div>
      </div>

      {!hayDatos ? (
        <div className="py-32 text-center opacity-50">
          <p className="text-slate-500 font-bold text-2xl">No hay movimientos.</p>
        </div>
      ) : (
        <div>
          {Object.entries(gastosProcesados).map(([categoria, datos]) => (
            // Bloque de Categoría con gran margen inferior (mb-20) para separar
            <div key={categoria} className="mb-20">
              
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  {/* Badge plano sin borde */}
                  <div className={`px-6 py-3 text-sm font-black uppercase tracking-wider ${getBadgeColor(categoria)}`}>
                    {categoria}
                  </div>
                  <span className="font-bold text-slate-500 text-lg">
                    ${datos.total.toFixed(2)}
                  </span>
                </div>

                <div className="grid gap-6">
                  {datos.items.map((gasto) => (
                    // Tarjeta de gasto plana
                    <div key={gasto.id} className="group bg-white/60 backdrop-blur-md p-8 hover:bg-white transition-all flex justify-between items-center">
                      <div className="flex flex-col gap-2">
                        <span className="font-black text-slate-900 text-xl">{gasto.concepto}</span>
                        <span className="text-sm font-bold text-slate-400">{gasto.fecha}</span>
                      </div>
                      <div className="flex items-center gap-8">
                        <span className="font-black text-2xl text-slate-900">${parseFloat(gasto.monto).toFixed(2)}</span>
                        <div className="flex items-center gap-6 pl-8">
                          {gasto.url_factura ? (
                             <a href={gasto.url_factura} target="_blank" className="text-slate-300 hover:text-slate-800 transition-colors" title="Ver PDF">
                               <FileText size={24} strokeWidth={2.5} />
                             </a>
                          ) : <div className="w-6"></div>}
                          <button onClick={() => eliminarGasto(gasto.id)} className="bg-transparent border-none p-0 cursor-pointer hover:text-red-500 transition-colors" title="Eliminar">
                             <Trash2 size={24} color="#ef4444" strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ListaGastos;