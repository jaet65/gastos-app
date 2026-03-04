import FormularioGasto from './components/FormularioGasto';
import ListaGastos from './components/ListaGastos';
import ListaSolicitudes from './components/ListaSolicitudes';
import Login from './components/Login';
import { LayoutDashboard, Menu, X, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { useAuth } from './components/AuthContext';

function App() {
  const { user, logout, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('gastos');

  // Handlers para abrir el sidebar (swipe a la derecha en el contenido principal)
  const openHandlers = useSwipeable({
    onSwipedRight: () => setIsSidebarOpen(true), // Abre el sidebar
  });

  // Handlers para cerrar el sidebar (swipe a la izquierda sobre el sidebar)
  const closeHandlers = useSwipeable({
    onSwipedLeft: () => setIsSidebarOpen(false), // Cierra el sidebar
  });

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    // CONTENEDOR MAESTRO
    // - Móvil/Tablet: flex-col, h-auto (scroll global)
    // - Desktop (lg+): flex-row, h-screen (pantalla fija sin scroll global)
    <>
    <div className="w-full min-h-screen lg:h-screen bg-slate-50 flex flex-col lg:flex-row font-sans selection:bg-blue-200 selection:text-blue-900 overflow-x-hidden">
      
      {/* ------------------------------------------------------------
          COLUMNA IZQUIERDA (Formulario)
          ------------------------------------------------------------ 
          - Móvil: h-[100dvh] (Pantalla completa real)
          - Desktop (lg): Ancho fijo 450px, Altura 100%
      */}
      <div {...openHandlers} className="w-full lg:w-112.5 xl:w-125 shrink-0 h-dvh lg:h-full bg-white relative z-20 flex flex-col border-r border-slate-100">
        
        {/* Navbar */}
        <nav className="w-full pt-4 px-4 pb-0 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2"> {/* Ajusta el padding si es necesario */}
              <img src="/MAF.png" alt="Logo MAF" className="h-26 w-auto" /> {/* Ajusta h-8 y w-auto según el tamaño deseado */}
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-slate-800">
              Gastos <span className="text-orange-500">MAF</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 hidden lg:block">
              {user.displayName || user.email}
            </span>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:text-red-600"
              aria-label="Cerrar sesión"
            >
              <LogOut size={20} />
            </button>
            {/* Botón de menú hamburguesa (solo móvil) */}
            <button 
              className="lg:hidden p-2 text-slate-500 hover:text-blue-600"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Abrir lista de gastos"
            >
              <Menu size={24} />
            </button>
          </div>
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
        {...closeHandlers}
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

          {/* Pestañas */}
          <div className="flex border-b border-slate-200 mb-4">
            <TabButton 
              label="Gastos" 
              isActive={activeTab === 'gastos'} 
              onClick={() => setActiveTab('gastos')} 
            />
            <TabButton 
              label="Solicitudes" 
              isActive={activeTab === 'solicitudes'} 
              onClick={() => setActiveTab('solicitudes')} 
            />
          </div>

          {/* Contenido de la pestaña activa */}
          <div>
            {activeTab === 'gastos' && (
              <ListaGastos />
            )}
            {activeTab === 'solicitudes' && (
              <ListaSolicitudes />
            )}
          </div>
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
    </>
  );
}

const TabButton = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`
      px-4 py-2 text-sm font-bold transition-colors
      ${isActive 
        ? 'border-b-2 border-blue-600 text-blue-600' 
        : 'text-slate-500 hover:text-slate-800'
      }
    `}
  >
    {label}
  </button>
);


export default App;