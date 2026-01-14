import FormularioGasto from './components/FormularioGasto';
import ListaGastos from './components/ListaGastos';
import { LayoutDashboard } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      
      <nav className="w-full bg-white border-b border-gray-200 sticky top-0 z-50">
         {/* ... (tu navbar sigue igual) ... */}
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* USAMOS LA CLASE CUSTOM 'layout-container' */}
        <div className="layout-container flex gap-8 items-start">
          
          {/* LADO IZQUIERDO */}
          <div className="layout-left md:sticky md:top-24">
            <FormularioGasto />
          </div>

          {/* LADO DERECHO */}
          <div className="layout-right">
            <ListaGastos />
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;