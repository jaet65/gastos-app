import PanelUsuarioAdmin from './components/PanelUsuarioAdmin';
import Login from './components/Login';
import NovedadesBanner from './components/NovedadesBanner';
import { Menu, X, LogOut, Share2, ShieldCheck, CalendarDays } from 'lucide-react';
import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { useSwipeable } from 'react-swipeable';
import { useAuth } from './components/AuthContext';
import { Badge } from "@tremor/react";
import { db } from './firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';

const FormularioGasto = lazy(() => import('./components/FormularioGasto'));
const ListaGastos = lazy(() => import('./components/ListaGastos'));
const ListaSolicitudes = lazy(() => import('./components/ListaSolicitudes'));
const ListaUsuarios = lazy(() => import('./components/ListaUsuarios'));
const AuditoriaView = lazy(() => import('./components/AuditoriaView'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));

function App() {
  const { user, userData, logout, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('tab');
  });
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['dashboard', 'gastos', 'solicitudes', 'usuarios', 'auditoria'].includes(tabParam)) {
      // Limpiar el parámetro de la URL sin recargar la página
      window.history.replaceState({}, '', window.location.pathname);
      return tabParam;
    }
    return 'gastos';
  });
  const [adminSelectedUser, setAdminSelectedUser] = useState(null);
  const [adminEditMode, setAdminEditMode] = useState(false);
  const [adminGlobalView, setAdminGlobalView] = useState(false);
  const listaGastosRef = useRef(null);
  const [solicitudCounts, setSolicitudCounts] = useState({
    'Solicitada': 0,
    'Recibida': 0,
    'En revisión': 0
  });
  const notificacionEnviadaRef = useRef(false);

  const isAdmin = userData?.role === 'admin';

  useEffect(() => {
    if (!user) return;
    const targetUid = adminSelectedUser?.uid || user.uid;
    const q = query(
      collection(db, "solicitudes"),
      where("userId", "==", targetUid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const counts = { 'Solicitada': 0, 'Recibida': 0, 'En revisión': 0 };
      snap.docs.forEach(doc => {
        let estado = doc.data().estado;
        if (estado === 'Enviada') estado = 'Solicitada';
        if (estado === 'Finalizada' || estado === 'Esperando...') estado = 'En revisión';
        if (Object.prototype.hasOwnProperty.call(counts, estado)) {
          counts[estado]++;
        }
      });
      setSolicitudCounts(counts);
    });
    return () => unsub();
  }, [user, adminSelectedUser]);

  // Notificación de solicitudes pendientes — se dispara al cargar la app,
  // sin necesidad de navegar a la pestaña de Solicitudes.
  useEffect(() => {
    if (!user || adminSelectedUser) return; // solo para el usuario propio

    const totalPendientes =
      solicitudCounts['Solicitada'] +
      solicitudCounts['Recibida'] +
      solicitudCounts['En revisión'];

    if (totalPendientes === 0) return;
    if (notificacionEnviadaRef.current) return;

    const AHORA = Date.now();
    const HACE_24_HORAS = AHORA - 24 * 60 * 60 * 1000;
    const ultimaNotificacion = localStorage.getItem('ultimaNotificacionSolicitudesRecibidas');
    if (ultimaNotificacion && parseInt(ultimaNotificacion) > HACE_24_HORAS) return;

    if (!('Notification' in window)) return;

    const mostrarNotificacion = async () => {
      notificacionEnviadaRef.current = true;
      const partes = [];
      if (solicitudCounts['Solicitada'] > 0) partes.push(`${solicitudCounts['Solicitada']} solicitada(s)`);
      if (solicitudCounts['Recibida'] > 0) partes.push(`${solicitudCounts['Recibida']} recibida(s)`);
      if (solicitudCounts['En revisión'] > 0) partes.push(`${solicitudCounts['En revisión']} en revisión`);
      const cuerpo = `Tienes ${totalPendientes} solicitud(es) de recursos pendientes (${partes.join(', ')}). ¡No olvides revisarlas!`;
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('Recordatorio de Gastos MAF', {
          body: cuerpo,
          icon: '/MAF.png',
          data: { url: '/?tab=solicitudes' }
        });
        localStorage.setItem('ultimaNotificacionSolicitudesRecibidas', AHORA.toString());
      } catch (err) {
        console.error('Error al mostrar la notificación:', err);
      }
    };

    if (Notification.permission === 'granted') {
      mostrarNotificacion();
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') mostrarNotificacion();
      });
    }
  }, [solicitudCounts, user, adminSelectedUser]);

  const solicitudBadges = [
    { key: 'Solicitada', title: 'Solicitada', count: solicitudCounts['Solicitada'], colorClass: 'bg-yellow-500 text-white', pingClass: 'bg-yellow-400' },
    { key: 'Recibida', title: 'Recibida', count: solicitudCounts['Recibida'], colorClass: 'bg-blue-500 text-white', pingClass: 'bg-blue-400' },
    { key: 'En revisión', title: 'En revisión', count: solicitudCounts['En revisión'], colorClass: 'bg-green-500 text-white', pingClass: 'bg-green-400' },
  ].filter(b => b.count > 0);

  // Handlers para abrir el sidebar (swipe a la derecha en el contenido principal)
  const openHandlers = useSwipeable({
    onSwipedRight: () => setIsSidebarOpen(true), // Abre el sidebar
  });

  // Handlers para cerrar el sidebar (swipe a la izquierda sobre el sidebar)
  const closeHandlers = useSwipeable({
    onSwipedLeft: (e) => {
      if (e && e.event && e.event.target && typeof e.event.target.closest === 'function') {
        if (e.event.target.closest('.tabs-container')) return;
      }
      setIsSidebarOpen(false);
    }, // Cierra el sidebar
  });

  const changeTab = (tab, globalScope = false) => {
    if (globalScope || tab === 'auditoria' || tab === 'usuarios') {
      setAdminSelectedUser(null);
      setAdminEditMode(false);
    }
    setAdminGlobalView(globalScope || (adminGlobalView && ['gastos', 'solicitudes'].includes(tab)));
    setActiveTab(tab);
  }

  const handleDashboardNavigate = (tab) => {
    changeTab(tab, ['gastos', 'solicitudes'].includes(tab));
  };

  // Handlers para deslizar entre pestañas (swipe horizontal)
  const tabSwipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (activeTab === 'gastos') changeTab('solicitudes');
      else if (activeTab === 'solicitudes' && isAdmin) changeTab('usuarios');
    },
    onSwipedRight: () => {
      if (activeTab === 'usuarios') changeTab('solicitudes');
      else if (activeTab === 'solicitudes') changeTab('gastos');
    }
  });

  const clearAdminView = () => {
    setAdminSelectedUser(null);
    setAdminEditMode(false);
    setAdminGlobalView(false);
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
    setAdminEditMode(false);
    setAdminGlobalView(false);
    setActiveTab('gastos');
    setIsSidebarOpen(false);
  };

  const handleShare = async () => {
    const url = window.location.origin;
    const shareData = {
      title: 'Gastos MAF',
      text: 'Accede a la aplicación de Gastos MAF aquí:',
      url: url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error al compartir:', err);
        }
        return; // Si el usuario cancela, no intentamos copiar al portapapeles
      }
    }

    // Intento con API del portapapeles
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(url);
        alert('¡Enlace de la aplicación copiado al portapapeles!');
        return;
      } catch (err) {
        console.error('Error al copiar el enlace:', err);
      }
    }

    // Último recurso para entornos sin HTTPS (ej. http://192.168... en red local)
    try {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('¡Enlace copiado al portapapeles!');
    } catch {
      prompt('Copia el enlace manualmente:', url);
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
    <>
      <div className="w-full min-h-screen lg:h-screen bg-slate-50 flex flex-col lg:flex-row font-sans selection:bg-blue-200 selection:text-blue-900 overflow-x-hidden">

        {/* Banner de Modo Administrador */}
        {(adminSelectedUser || adminGlobalView) && (
          <div className="fixed top-0 left-0 right-0 z-100 bg-amber-500 text-white py-1 px-4 text-center text-xs font-black uppercase tracking-widest shadow-lg flex justify-center items-center gap-4 flex-wrap">
            <span>{adminSelectedUser
              ? `Viendo datos de: ${adminSelectedUser.displayName} (${adminSelectedUser.email})`
              : `Modo administrador: vista global de ${activeTab === 'gastos' ? 'gastos' : 'solicitudes'} (solo lectura)`}</span>
            <div className="flex gap-2">
              {adminSelectedUser && (
                <button onClick={() => setAdminEditMode(!adminEditMode)} className={`px-3 py-1 rounded-full text-[10px] transition-all shadow-sm ${adminEditMode ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white text-amber-600 hover:bg-amber-50'}`}>
                  {adminEditMode ? 'Deshabilitar Edición' : 'Habilitar Edición'}
                </button>
              )}
              <button onClick={clearAdminView} className="bg-white text-amber-600 px-3 py-1 rounded-full text-[10px] hover:bg-amber-50 transition-colors shadow-sm">
                Cerrar Vista
              </button>
            </div>
          </div>
        )}

        {/* COLUMNA IZQUIERDA */}
        <div {...openHandlers} className={`w-full lg:w-112.5 xl:w-125 shrink-0 h-dvh lg:h-full bg-white relative z-20 flex flex-col border-r border-slate-100 ${adminSelectedUser || adminGlobalView ? 'pt-6' : ''}`}>

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
              <a
                href="https://agendaservicios.web.app/index.html"
                aria-label="Abrir Agenda de Servicios"
                title="Agenda de Servicios"
                className="p-2 text-slate-400 transition-colors hover:text-blue-600"
              >
                <CalendarDays size={18} />
              </a>
              <span className="text-sm text-slate-600 hidden lg:block">
                {user.displayName || user.email}
                {isAdmin && <span className="ml-2 text-amber-600 text-[10px] font-black uppercase">Admin</span>}
              </span>
              <button onClick={handleShare} className="p-2 text-slate-500 hover:text-blue-600" title="Compartir Aplicación">
                <Share2 size={20} />
              </button>
              <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-600" title="Cerrar Sesión">
                <LogOut size={20} />
              </button>
              <button className="lg:hidden p-2 text-slate-500 hover:text-blue-600" onClick={() => setIsSidebarOpen(true)}>
                <Menu size={24} />
              </button>
            </div>
          </nav>

          <div className="flex-1 flex flex-col justify-center p-6 lg:p-2">
            {adminSelectedUser ? (
              <PanelUsuarioAdmin
                user={adminSelectedUser}
                adminEditMode={adminEditMode}
                onClearView={clearAdminView}
              />
            ) : adminGlobalView ? (
              <div className="border border-amber-200 bg-amber-50 p-5 text-slate-700 rounded-2xl">
                <ShieldCheck size={22} className="mb-3 text-amber-700" />
                <h2 className="text-lg font-black text-slate-800">Consulta global</h2>
                <p className="mt-2 text-sm leading-relaxed">
                  El formulario de gastos está bloqueado mientras revisas información de todos los usuarios.
                </p>
                <button
                  type="button"
                  onClick={clearAdminView}
                  className="mt-4 w-full bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900 rounded-2xl"
                >
                  Volver a mis gastos
                </button>
              </div>
            ) : (
              <>
                <NovedadesBanner />
                <Suspense fallback={<div className="p-4 text-center text-slate-500">Cargando formulario...</div>}>
                  <FormularioGasto />
                </Suspense>
              </>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA */}
        <div {...closeHandlers} className={`fixed inset-0 w-full h-full bg-slate-100 z-30 transform transition-transform duration-300 ease-in-out lg:static lg:flex-1 lg:h-full lg:overflow-hidden lg:translate-x-0 lg:z-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${adminSelectedUser || adminGlobalView ? 'pt-6' : ''}`}>
          <div className={`h-full w-full overflow-y-auto px-4 lg:px-16 pt-4 ${activeTab === 'dashboard' ? 'pb-4 lg:pb-6' : 'pb-32'}`}>
            <div {...tabSwipeHandlers} className="tabs-container pb-2 -mt-2 pt-2">
              <div className="flex justify-end lg:hidden mb-4">
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-500 hover:text-red-600">
                  <X size={24} />
                </button>
              </div>

              <div className="flex border-b border-slate-200 mb-4">
                {isAdmin && <TabButton label="Dashboard" isActive={activeTab === 'dashboard'} onClick={() => changeTab('dashboard')} />}
                <TabButton label="Gastos" isActive={activeTab === 'gastos'} onClick={() => changeTab('gastos')} />
                <TabButton label="Solicitudes" isActive={activeTab === 'solicitudes'} onClick={() => { changeTab('solicitudes'); }} badges={solicitudBadges} />
                {/*isAdmin && <TabButton label="Usuarios" isActive={activeTab === 'usuarios'} onClick={() => changeTab('usuarios')} />}
                {isAdmin && <TabButton label="Auditoría" isActive={activeTab === 'auditoria'} onClick={() => changeTab('auditoria')} />*/}
              </div>
            </div>

            <div className="relative">
              <div hidden={activeTab !== 'gastos'} aria-hidden={activeTab !== 'gastos'}>
                <Suspense fallback={<div className="p-4 text-center text-slate-500">Cargando gastos...</div>}>
                  <ListaGastos
                    ref={listaGastosRef}
                    adminViewUid={adminSelectedUser?.uid}
                    adminEditMode={adminEditMode}
                    adminSelectedUser={adminSelectedUser}
                    adminGlobalView={isAdmin && adminGlobalView}
                  />
                </Suspense>
              </div>
              <Suspense fallback={<div className="p-4 text-center text-slate-500">Cargando vista...</div>}>
              <AnimatePresence mode="wait">
                {isAdmin && activeTab === 'dashboard' && (
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <AdminDashboard onNavigate={handleDashboardNavigate} />
                  </motion.div>
                )}
                {activeTab === 'solicitudes' && (
                  <motion.div
                    key="solicitudes"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ListaSolicitudes
                      adminViewUid={adminSelectedUser?.uid}
                      adminEditMode={adminEditMode}
                      adminGlobalView={isAdmin && adminGlobalView}
                      onPreviewReport={(solicitud) => listaGastosRef.current?.generarVistaPreviaSolicitud(solicitud)}
                    />
                  </motion.div>
                )}
                {isAdmin && activeTab === 'usuarios' && (
                  <motion.div
                    key="usuarios"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ListaUsuarios onSelectUser={handleSelectUser} onSelectAudit={() => setActiveTab('auditoria')} />
                  </motion.div>
                )}
                {isAdmin && activeTab === 'auditoria' && (
                  <motion.div
                    key="auditoria"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <AuditoriaView />
                  </motion.div>
                )}
              </AnimatePresence>
              </Suspense>
            </div>
          </div>
        </div>

        {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      </div>
    </>
  );
}

const TabButton = ({ label, isActive, onClick, badge = 0, badges = null }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!badges || badges.length <= 1) {
      return;
    }
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % badges.length);
    }, 1500);
    return () => clearInterval(timer);
  }, [badges]);

  // Calcular el índice seguro sin necesidad de resetear con setState
  const safeIndex = badges && badges.length > 0 ? currentIndex % badges.length : 0;
  const activeBadge = badges && badges.length > 0 ? badges[safeIndex] : null;

  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2 text-sm font-bold transition-colors ${isActive ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'
        }`}
    >
      <span>{label}</span>
      <AnimatePresence mode="wait">
        {activeBadge ? (
          <motion.span
            key={activeBadge.key}
            initial={{ opacity: 0, scale: 0.8, filter: 'blur(3px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.8, filter: 'blur(3px)' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center"
          >
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${activeBadge.pingClass || 'bg-green-400'} opacity-75`}></span>
            <span
              className={`relative inline-flex rounded-full h-4 min-w-4 px-1 items-center justify-center ${activeBadge.colorClass} shadow-xs`}
              title={`${activeBadge.title}: ${activeBadge.count}`}
            >
              <span className="text-white text-[9px] font-black leading-none">
                {activeBadge.count > 9 ? '9+' : activeBadge.count}
              </span>
            </span>
          </motion.span>
        ) : badge > 0 ? (
          <motion.span
            key="single-badge"
            initial={{ opacity: 0, scale: 0.8, filter: 'blur(3px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.8, filter: 'blur(3px)' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center"
          >
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 items-center justify-center">
              <span className="text-white text-[9px] font-black leading-none">{badge > 9 ? '9+' : badge}</span>
            </span>
          </motion.span>
        ) : null}
      </AnimatePresence>
    </button>
  );
};

export default App;