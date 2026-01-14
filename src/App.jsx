import FormularioGasto from './components/FormularioGasto';
import ListaGastos from './components/ListaGastos';
import { LayoutDashboard } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen font-sans selection:bg-blue-200 selection:text-blue-900">
      
      {/* NAVBAR: Sin sombras, sin bordes */}
      <nav className="w-full pt-8 pb-4 z-50">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex h-16 items-center gap-6">
            {/* Bloque de color puro para el icono */}
            <div className="bg-white text-blue-600 p-4">
              <LayoutDashboard size={24} strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-slate-800">
              Gastos<span className="text-blue-500">Maf</span>
            </h1>
          </div>
        </div>
      </nav>

      <main className="w-full py-8">
        <div className="layout-container flex gap-0">
          
          {/* COLUMNA IZQUIERDA */}
          <div className="layout-col md:sticky md:top-10">
            <div className="w-[90%] md:w-[85%]">
              <FormularioGasto />
            </div>
          </div>

          {/* COLUMNA DERECHA */}
          <div className="layout-col mt-16 md:mt-0">
            <div className="w-[90%] md:w-[85%]">
              <ListaGastos />
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;