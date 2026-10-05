import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { ArrowRight, Clock3, ReceiptText, Users, Wallet } from 'lucide-react';
import { db } from '../firebase';

const formatCurrency = (amount) => new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
}).format(amount);

const formatDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('es-MX', {
  day: 'numeric',
  month: 'short',
});

const normalizeStatus = (status) => {
  if (status === 'Enviada') return 'Solicitada';
  if (status === 'Finalizada') return 'Esperando...';
  return status;
};

const AdminDashboard = ({ onNavigate }) => {
  const [gastos, setGastos] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loaded, setLoaded] = useState({ gastos: false, solicitudes: false, usuarios: false });
  const [error, setError] = useState('');

  useEffect(() => {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
    const markLoaded = (source) => setLoaded((current) => ({ ...current, [source]: true }));
    const handleError = (source) => (snapshotError) => {
      console.error(`Error cargando ${source} del dashboard:`, snapshotError);
      setError('No se pudo cargar toda la información del dashboard.');
      markLoaded(source);
    };

    const unsubscribeGastos = onSnapshot(
      query(
        collection(db, 'gastos'),
        where('fecha', '>=', monthStart),
        where('fecha', '<=', monthEnd),
        orderBy('fecha', 'desc')
      ),
      (snapshot) => {
        setGastos(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        markLoaded('gastos');
      },
      handleError('gastos')
    );
    const unsubscribeSolicitudes = onSnapshot(
      collection(db, 'solicitudes'),
      (snapshot) => {
        setSolicitudes(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        markLoaded('solicitudes');
      },
      handleError('solicitudes')
    );
    const unsubscribeUsuarios = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setUsuarios(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        markLoaded('usuarios');
      },
      handleError('usuarios')
    );

    return () => {
      unsubscribeGastos();
      unsubscribeSolicitudes();
      unsubscribeUsuarios();
    };
  }, []);

  const gastosActivos = useMemo(() => gastos.filter((gasto) => !gasto.archivado), [gastos]);
  const totalMes = gastosActivos.reduce((total, gasto) => total + (Number(gasto.monto) || 0), 0);
  const solicitudesPorEstado = solicitudes.reduce((counts, solicitud) => {
    const status = normalizeStatus(solicitud.estado);
    if (['Solicitada', 'Recibida', 'Esperando...'].includes(status)) {
      counts[status] += 1;
    }
    return counts;
  }, { Solicitada: 0, Recibida: 0, 'Esperando...': 0 });
  const totalPendientes = Object.values(solicitudesPorEstado).reduce((total, count) => total + count, 0);
  const consultores = usuarios.filter((usuario) => usuario.role !== 'admin').length;
  const usuariosPorId = new Map(usuarios.map((usuario) => [usuario.uid || usuario.id, usuario]));
  const cargando = Object.values(loaded).some((sourceLoaded) => !sourceLoaded);

  const metricas = [
    { label: 'Gasto del mes', value: formatCurrency(totalMes), detail: 'Registros no archivados', icon: Wallet, tone: 'text-emerald-700 bg-emerald-50 rounded-full' },
    { label: 'Movimientos', value: gastosActivos.length, detail: 'En el mes actual', icon: ReceiptText, tone: 'text-blue-700 bg-blue-50 rounded-full' },
    { label: 'Solicitudes abiertas', value: totalPendientes, detail: `${solicitudesPorEstado.Solicitada} solicitadas · ${solicitudesPorEstado.Recibida} recibidas`, icon: Clock3, tone: 'text-amber-700 bg-amber-50 rounded-full' },
    { label: 'Consultores', value: consultores, detail: 'Cuentas registradas', icon: Users, tone: 'text-rose-700 bg-rose-50 rounded-full' },
  ];

  return (
    <main data-testid="admin-dashboard" className="mx-auto w-full max-w-6xl space-y-7 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-5">
        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-widest text-emerald-700">Panel de administración</p>
          <h2 className="text-3xl font-black text-slate-900">Resumen general</h2>
          <p className="mt-1 text-sm text-slate-500">Indicadores y actividad reciente de la operación.</p>
        </div>
        <p className="text-sm font-semibold text-slate-500">
          {new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
        </p>
      </header>

      {error && <p role="alert" className="border-l-4 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

      <section aria-label="Indicadores principales" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricas.map(({ label, value, detail, icon: Icon, tone }) => ( // eslint-disable-line no-unused-vars
          <article key={label} className="min-w-0 border border-slate-200 bg-white p-4 shadow-sm rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-2 wrap-break-word text-2xl font-black text-slate-900">{cargando ? '...' : value}</p>
              </div>
              <span className={`shrink-0 p-2 ${tone}`}><Icon size={18} /></span>
            </div>
            <p className="mt-3 text-xs text-slate-500">{detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-7 xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.8fr)]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-slate-800">Gastos recientes</h3>
            <button type="button" onClick={() => onNavigate('gastos')} className="inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:text-blue-900">
              Ver gastos <ArrowRight size={15} />
            </button>
          </div>
          <div className="overflow-hidden border border-slate-200 bg-white rounded-2xl">
            {cargando ? (
              <p className="p-5 text-sm text-slate-500">Cargando actividad...</p>
            ) : gastosActivos.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No hay gastos registrados este mes.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {gastosActivos.slice(0, 6).map((gasto) => {
                  const usuario = usuariosPorId.get(gasto.userId);
                  return (
                    <li key={gasto.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800">{gasto.concepto || 'Sin concepto'}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {usuario?.displayName || usuario?.email || 'Usuario'} · {gasto.fecha ? formatDate(gasto.fecha) : 'Sin fecha'}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-black text-slate-800">{formatCurrency(Number(gasto.monto) || 0)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <aside>
          <h3 className="mb-3 text-lg font-black text-slate-800">Solicitudes pendientes</h3>
          <div className="border border-slate-200 bg-white rounded-2xl overflow-hidden">
            {[
              ['Solicitada', 'bg-amber-500'],
              ['Recibida', 'bg-blue-500'],
              ['Esperando...', 'bg-emerald-600'],
            ].map(([status, color]) => (
              <div key={status} className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <span className={`h-2 w-2 ${color}`} />{status}
                </span>
                <span className="text-sm font-black text-slate-900">{cargando ? '...' : solicitudesPorEstado[status]}</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => onNavigate('solicitudes')} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:text-blue-900">
            Revisar solicitudes <ArrowRight size={15} />
          </button>
        </aside>
      </section>

      <nav aria-label="Accesos de administración" className="flex flex-wrap gap-2 border-t border-slate-200 pt-5">
        <button type="button" onClick={() => onNavigate('usuarios')} className="border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-slate-500 rounded-2xl">Administrar usuarios</button>
        <button type="button" onClick={() => onNavigate('auditoria')} className="border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-slate-500 rounded-2xl">Abrir auditoría</button>
      </nav>
    </main>
  );
};

export default AdminDashboard;