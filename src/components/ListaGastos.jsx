import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';

const ListaGastos = () => {
  const [gastos, setGastos] = useState([]);

  useEffect(() => {
    // Creamos una consulta para ordenar por fecha (más reciente primero)
    // Nota: Si la fecha da error de ordenamiento, puedes quitar orderBy temporalmente
    const q = query(collection(db, "gastos"), orderBy("fecha", "desc"));

    // Escuchamos cambios en tiempo real
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gastosArray = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setGastos(gastosArray);
    });

    return () => unsubscribe();
  }, []);

  // Función para borrar un gasto
  const eliminarGasto = async (id) => {
    if (confirm("¿Estás seguro de borrar este gasto?")) {
      await deleteDoc(doc(db, "gastos", id));
    }
  };

  // Función para asignar colores según categoría
  const colorCategoria = (cat) => {
    switch(cat) {
      case 'Transporte': return 'bg-blue-100 text-blue-800';
      case 'Comida': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 p-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Historial de Gastos</h2>
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {/* Vista móvil (Tarjetas) */}
        <div className="block md:hidden">
            {gastos.map(gasto => (
                <div key={gasto.id} className="p-4 border-b border-gray-200">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-bold text-gray-800">{gasto.concepto}</p>
                            <span className={`text-xs px-2 py-1 rounded-full ${colorCategoria(gasto.categoria)}`}>
                                {gasto.categoria}
                            </span>
                        </div>
                        <p className="font-bold text-lg">${parseFloat(gasto.monto).toFixed(2)}</p>
                    </div>
                    <div className="mt-2 flex justify-between items-center text-sm text-gray-500">
                        <span>{gasto.fecha}</span>
                        <div className="space-x-2">
                             {gasto.url_factura && (
                                <a href={gasto.url_factura} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                    Ver PDF
                                </a>
                            )}
                            <button onClick={() => eliminarGasto(gasto.id)} className="text-red-500 hover:text-red-700">
                                Borrar
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {/* Vista Escritorio (Tabla) */}
        <table className="min-w-full hidden md:table">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Concepto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Factura</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {gastos.map((gasto) => (
              <tr key={gasto.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{gasto.fecha}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{gasto.concepto}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colorCategoria(gasto.categoria)}`}>
                    {gasto.categoria}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-bold">
                  ${parseFloat(gasto.monto).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                  {gasto.url_factura ? (
                    <a href={gasto.url_factura} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center">
                      📄 Ver PDF
                    </a>
                  ) : (
                    <span className="text-gray-400">Sin archivo</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button 
                        onClick={() => eliminarGasto(gasto.id)}
                        className="text-red-600 hover:text-red-900 font-medium"
                    >
                        Eliminar
                    </button>
                </td>
              </tr>
            ))}
            {gastos.length === 0 && (
                <tr>
                    <td colSpan="6" className="px-6 py-10 text-center text-gray-500">
                        No hay gastos registrados aún.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ListaGastos;