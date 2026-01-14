import FormularioGasto from './components/FormularioGasto';
import ListaGastos from './components/ListaGastos';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 py-10">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-extrabold text-center text-blue-900 mb-2">
          Rendición de Gastos
        </h1>
        <p className="text-center text-gray-600 mb-8">Gestión simple y gratuita</p>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Columna Izquierda: Formulario (ocupa 1 columna) */}
          <div className="lg:col-span-1">
            <FormularioGasto />
          </div>

          {/* Columna Derecha: Tabla (ocupa 2 columnas) */}
          <div className="lg:col-span-2">
            <ListaGastos />
          </div>
        </div>
        
      </div>
    </div>
  );
}

export default App;