import FormularioGasto from './components/FormularioGasto';
import ListaGastos from './components/ListaGastos';
import ListaSolicitudes from './components/ListaSolicitudes';
import ListaUsuarios from './components/ListaUsuarios';
import Login from './components/Login';
import { LayoutDashboard, Menu, X, LogOut, Bell } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSwipeable } from 'react-swipeable';
import { useAuth } from './components/AuthContext';
import { Badge } from "@tremor/react";
import { db } from './firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

function App() {
  const { user, userData, logout, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('gastos');
  const [adminSelectedUser, setAdminSelectedUser] = useState(null);
  const [pendingSolicitudes, setPendingSolicitudes] = useState(0);

  const isAdmin = userData?.role === 'admin';

  useEffect(() => {
    if (!user) return;
    const targetUid = adminSelectedUser?.uid || user.uid;
    const q = query(
      collection(db, "solicitudes"),
      where("userId", "==", targetUid),
      where("estado", "==", "Esperando...")
    );
    const unsub = onSnapshot(q, (snap) => setPendingSolicitudes(snap.size));
    return () => unsub();
  }, [user, adminSelectedUser]);

  // Handlers para abrir el sidebar (swipe a la derecha en el contenido principal)
  const openHandlers = useSwipeable({
    onSwipedRight: () => setIsSidebarOpen(true), // Abre el sidebar
  });

  // Handlers para cerrar el sidebar (swipe a la izquierda sobre el sidebar)
  const closeHandlers = useSwipeable({
    onSwipedLeft: () => setIsSidebarOpen(false), // Cierra el sidebar
  });

  const clearAdminView = () => {
    setAdminSelectedUser(null);
  };

  const handleLogout = async () => {
    try {
      clearAdminView(); // Limpiar vista admin al cerrar sesión
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const handleSelectUser = (u) => {
    setAdminSelectedUser(u);
    setActiveTab('gastos');
    setIsSidebarOpen(false);
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
    <>
    <div className="w-full min-h-screen lg:h-screen bg-slate-50 flex flex-col lg:flex-row font-sans selection:bg-blue-200 selection:text-blue-900 overflow-x-hidden">
      
      {/* Banner de Modo Administrador */}
      {adminSelectedUser && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white py-1 px-4 text-center text-xs font-black uppercase tracking-widest shadow-lg flex justify-center items-center gap-4">
          <span>Viendo datos de: {adminSelectedUser.displayName} ({adminSelectedUser.email})</span>
          <button onClick={clearAdminView} className="bg-white text-amber-600 px-2 py-0.5 rounded-full text-[10px] hover:bg-slate-100 transition-colors">
            Cerrar Vista Admin
          </button>
        </div>
      )}

      {/* COLUMNA IZQUIERDA */}
      <div {...openHandlers} className={`w-full lg:w-112.5 xl:w-125 shrink-0 h-dvh lg:h-full bg-white relative z-20 flex flex-col border-r border-slate-100 ${adminSelectedUser ? 'pt-6' : ''}`}>
        
        <nav className="w-full pt-4 px-4 pb-0 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2">
              <img src="/MAF.png" alt="Logo MAF" className="h-26 w-auto" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-slate-800">
              Gastos <span className="text-orange-500">MAF</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 hidden lg:block">
              {user.displayName || user.email}
              {isAdmin && <span className="ml-2 text-amber-600 text-[10px] font-black uppercase">Admin</span>}
            </span>
            <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-600">
              <LogOut size={20} />
            </button>
            <button className="lg:hidden p-2 text-slate-500 hover:text-blue-600" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={24} />
            </button>
          </div>
        </nav>

        <div className="flex-1 flex flex-col justify-center p-6 lg:p-2">
          {adminSelectedUser ? (
            <div className="text-center p-8 space-y-4">
              <div className="bg-amber-100 text-amber-600 p-6 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                <LayoutDashboard size={40} />
              </div>
              <h2 className="text-xl font-black text-slate-800">Modo Lectura Admin</h2>
              <p className="text-slate-500 text-sm">Estás visualizando los registros de <b>{adminSelectedUser.displayName}</b>. No puedes crear nuevos gastos en su nombre.</p>
              <button onClick={clearAdminView} className="bg-slate-800 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-slate-900 transition-all">
                Volver a mis gastos
              </button>
            </div>
          ) : (
            <FormularioGasto />
          )}
        </div>
      </div>

      {/* COLUMNA DERECHA */}
      <div {...closeHandlers} className={`fixed inset-0 w-full h-full bg-slate-100 z-30 transform transition-transform duration-300 ease-in-out lg:static lg:flex-1 lg:h-full lg:overflow-y-auto lg:translate-x-0 lg:z-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${adminSelectedUser ? 'pt-6' : ''}`}>
        <div className="h-full w-full overflow-y-auto px-4 lg:px-16 pb-32 pt-4">
          <div className="flex justify-end lg:hidden mb-4">
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-500 hover:text-red-600">
              <X size={24} />
            </button>
          </div>

          <div className="flex border-b border-slate-200 mb-4">
            <TabButton label="Gastos" isActive={activeTab === 'gastos'} onClick={() => setActiveTab('gastos')} />
            <TabButton label="Solicitudes" isActive={activeTab === 'solicitudes'} onClick={() => { setActiveTab('solicitudes'); }} badge={pendingSolicitudes} />
            {isAdmin && <TabButton label="Usuarios" isActive={activeTab === 'usuarios'} onClick={() => setActiveTab('usuarios')} />}
          </div>

          <div>
            {activeTab === 'gastos' && <ListaGastos adminViewUid={adminSelectedUser?.uid} />}
            {activeTab === 'solicitudes' && <ListaSolicitudes adminViewUid={adminSelectedUser?.uid} />}
            {isAdmin && activeTab === 'usuarios' && <ListaUsuarios onSelectUser={handleSelectUser} />}
          </div>
        </div>
      </div>

      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
    </div>
    </>
  );
}

const TabButton = ({ label, isActive, onClick, badge = 0 }) => (
  <button onClick={onClick} className={`relative px-4 py-2 text-sm font-bold transition-colors ${isActive ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
    {label}
    {badge > 0 && (
      <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 items-center justify-center">
          <span className="text-white text-[9px] font-black leading-none">{badge > 9 ? '9+' : badge}</span>
        </span>
      </span>
    )}
  </button>
);

export default App;