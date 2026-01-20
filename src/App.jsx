import FormularioGasto from './components/FormularioGasto';
import ListaGastos from './components/ListaGastos';
import { LayoutDashboard, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useSwipeable } from 'react-swipeable';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handlers = useSwipeable({
    onSwipedLeft: () => setIsSidebarOpen(false), // Cierra el sidebar
    onSwipedRight: () => setIsSidebarOpen(true), // Abre el sidebar
  });

  return (
    // CONTENEDOR MAESTRO
    // - Móvil/Tablet: flex-col, h-auto (scroll global)
    // - Desktop (lg+): flex-row, h-screen (pantalla fija sin scroll global)
    <div className="w-full min-h-screen lg:h-screen bg-slate-50 flex flex-col lg:flex-row font-sans selection:bg-blue-200 selection:text-blue-900 overflow-x-hidden">
      
      {/* ------------------------------------------------------------
          COLUMNA IZQUIERDA (Formulario)
          ------------------------------------------------------------ 
          - Móvil: h-[100dvh] (Pantalla completa real)
          - Desktop (lg): Ancho fijo 450px, Altura 100%
      */}
      <div {...handlers} className="w-full lg:w-[450px] xl:w-[500px] shrink-0 h-[100dvh] lg:h-full bg-white relative z-20 flex flex-col border-r border-slate-100">
        
        {/* Navbar */}
        <nav className="w-full pt-4 px-4 pb-0 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-4">
              <LayoutDashboard size={16} strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-slate-800">
              Gastos <span className="text-blue-500">MAF</span>
            </h1>
          </div>
          {/* Botón de menú hamburguesa (solo móvil) */}
          <button 
            className="lg:hidden p-2 text-slate-500 hover:text-blue-600"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Abrir lista de gastos"
          >
            <Menu size={24} />
          </button>
        </nav>

        {/* Formulario Centrado */}
        <div className="flex-1 flex flex-col justify-center p-6 lg:p-2">
          <FormularioGasto />
        </div>
      </div>

      {/* ------------------------------------------------------------
          COLUMNA DERECHA (Sidebar en móvil, Contenido en Desktop)
          ------------------------------------------------------------ 
          - Móvil: Sidebar fijo que se desliza desde la izquierda.
          - Desktop (lg): Ocupa el espacio restante (flex-1), tiene su propio scroll.
      */}
      <div 
        {...handlers}
        className={`
          fixed inset-0 w-full h-full bg-slate-100 z-30 transform transition-transform duration-300 ease-in-out
          lg:static lg:flex-1 lg:h-full lg:overflow-y-auto lg:translate-x-0 lg:z-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-full w-full overflow-y-auto px-4 lg:px-16 pb-32 pt-4">
          {/* Botón para cerrar el sidebar (solo móvil) */}
          <div className="flex justify-end lg:hidden mb-4">
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 text-slate-500 hover:text-red-600"
              aria-label="Cerrar lista de gastos"
            >
              <X size={24} />
            </button>
          </div>
          <ListaGastos />
        </div>
      </div>

      {/* Overlay para cerrar el sidebar en móvil */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

    </div>
  );
}

export default App;