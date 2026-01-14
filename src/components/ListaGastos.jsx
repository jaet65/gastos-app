import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { FileText, Trash2, Calendar, Tag } from 'lucide-react';

const ListaGastos = () => {
  const [gastos, setGastos] = useState([]);

  useEffect(() => {
    // Ordenamos por fecha descendente (lo más nuevo arriba)
    const q = query(collection(db, "gastos"), orderBy("creado_en", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gastosArray = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setGastos(gastosArray);
    });
    return () => unsubscribe();
  }, []);

  const eliminarGasto = async (id) => {
    if (confirm("¿Borrar este registro permanentemente?")) {
      await deleteDoc(doc(db, "gastos", id));
    }
  };

  const getBadgeColor = (cat) => {
    switch(cat) {
      case 'Transporte': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Comida': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (gastos.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-10 text-center border border-gray-200 shadow-sm">
        <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="text-gray-400" size={30} />
        </div>
        <h3 className="text-lg font-medium text-gray-900">No hay movimientos</h3>
        <p className="text-gray-500 mt-1">Registra tu primer gasto en el formulario.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado de la sección */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Movimientos Recientes</h2>
        <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium border border-gray-200">
          {gastos.length} registros
        </span>
      </div>

      <div className="bg-white border-2 border-gray-100 rounded-2xl shadow-xl overflow-hidden">
        
        {/* VISTA ESCRITORIO (Tabla) - Oculta en móvil (hidden md:table) */}
        <table className="w-full hidden md:table">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Concepto</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoría</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Monto</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {gastos.map((gasto) => (
              <tr key={gasto.id} className="hover:bg-gray-50/80 transition-colors group">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">{gasto.fecha}</td>
                <td className="px-6 py-4 text-sm text-gray-900 font-medium">{gasto.concepto}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getBadgeColor(gasto.categoria)}`}>
                    {gasto.categoria}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                  ${parseFloat(gasto.monto).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-3">
                  {gasto.url_factura && (
                    <a 
                      href={gasto.url_factura} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 transition"
                    >
                      <FileText size={14} /> PDF
                    </a>
                  )}
                  <button onClick={() => eliminarGasto(gasto.id)} className="text-gray-400 hover:text-red-600 transition">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* VISTA MÓVIL (Cards) - Visible solo en móvil (md:hidden) */}
        <div className="md:hidden divide-y divide-gray-100">
          {gastos.map((gasto) => (
            <div key={gasto.id} className="p-5 flex flex-col gap-3 active:bg-gray-50">
              <div className="flex justify-between items-start">
                <div className="flex gap-3">
                  <div className={`p-2 rounded-xl h-fit ${gasto.categoria === 'Comida' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                    {gasto.categoria === 'Comida' ? <Tag size={20}/> : <Tag size={20}/>}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{gasto.concepto}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <Calendar size={12} />
                      {gasto.fecha}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-gray-900">${parseFloat(gasto.monto).toFixed(2)}</p>
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-2 pt-3 border-t border-gray-50">
                <span className={`text-xs font-semibold px-2 py-1 rounded-md ${getBadgeColor(gasto.categoria)}`}>
                  {gasto.categoria}
                </span>
                
                <div className="flex gap-3">
                  {gasto.url_factura && (
                    <a href={gasto.url_factura} target="_blank" className="text-xs font-bold text-blue-600 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg">
                      <FileText size={14} /> Ver Factura
                    </a>
                  )}
                  <button onClick={() => eliminarGasto(gasto.id)} className="text-gray-400 hover:text-red-500 p-1">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default ListaGastos;