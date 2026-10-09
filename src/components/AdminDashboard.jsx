import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
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

const getMonthKey = (date) => date.slice(0, 7);

const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonth = (month) => new Date(`${month}-01T00:00:00`).toLocaleDateString('es-MX', {
  month: 'long',
  year: 'numeric',
});

const getMonthLabel = (month) => new Date(`${month}-01T00:00:00`).toLocaleDateString('es-MX', {
  month: 'short',
});

const normalizeStatus = (status) => {
  if (status === 'Enviada') return 'Solicitada';
  if (status === 'Finalizada' || status === 'Esperando...') return 'En revisión';
  return status;
};

const AdminDashboard = ({ onNavigate }) => {
  const [gastos, setGastos] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loaded, setLoaded] = useState({ gastos: false, solicitudes: false, usuarios: false });
  const [error, setError] = useState('');
  const [mesSeleccionado, setMesSeleccionado] = useState(getCurrentMonthKey);

  useEffect(() => {
    const markLoaded = (source) => setLoaded((current) => ({ ...current, [source]: true }));
    const handleError = (source) => (snapshotError) => {
      console.error(`Error cargando ${source} del dashboard:`, snapshotError);
      setError('No se pudo cargar toda la información del dashboard.');
      markLoaded(source);
    };

    const unsubscribeGastos = onSnapshot(
      query(collection(db, 'gastos'), orderBy('fecha', 'desc')),
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
  const mesActual = getCurrentMonthKey();
  const mesesDisponibles = useMemo(() => (
    [...new Set([mesActual, ...gastos
      .filter((gasto) => typeof gasto.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(gasto.fecha))
      .map((gasto) => getMonthKey(gasto.fecha))])]
      .sort((a, b) => b.localeCompare(a))
  ), [gastos, mesActual]);
  const gastosMesActual = useMemo(
    () => gastosActivos.filter((gasto) => typeof gasto.fecha === 'string' && getMonthKey(gasto.fecha) === mesActual),
    [gastosActivos, mesActual]
  );
  const gastosMesSeleccionado = useMemo(
    () => gastos.filter((gasto) => typeof gasto.fecha === 'string' && getMonthKey(gasto.fecha) === mesSeleccionado),
    [gastos, mesSeleccionado]
  );
  const anioActual = Number(mesActual.slice(0, 4));
  const gastosPorMesDelAnio = Array.from({ length: 12 }, (_, index) => {
    const mes = `${anioActual}-${String(index + 1).padStart(2, '0')}`;
    const gastosMes = gastos.filter(
      (gasto) => typeof gasto.fecha === 'string' && getMonthKey(gasto.fecha) === mes
    );
    const total = gastosMes.reduce((suma, gasto) => suma + (Number(gasto.monto) || 0), 0);
    return { mes, total, indice: index, tieneRegistros: gastosMes.length > 0 };
  });
  const maximoMensual = Math.max(...gastosPorMesDelAnio.map(({ total }) => total), 1);
  const puntosGrafica = gastosPorMesDelAnio.filter(({ tieneRegistros }) => tieneRegistros).map(({ mes, total, indice }) => ({
    mes,
    total,
    x: 40 + indice * 58,
    y: 110 - (total / maximoMensual) * 78,
    seleccionado: mes.slice(-2) === mesSeleccionado.slice(-2),
  }));
  const lineaGrafica = puntosGrafica.map(({ x, y }) => `${x},${y}`).join(' ');
  const gastosActivosMesSeleccionado = gastosMesSeleccionado.filter((gasto) => !gasto.archivado);
  const totalMes = gastosMesSeleccionado.reduce((total, gasto) => total + (Number(gasto.monto) || 0), 0);
  const totalNoArchivadoMes = gastosActivosMesSeleccionado.reduce((total, gasto) => total + (Number(gasto.monto) || 0), 0);
  const [anioMesSeleccionado, numeroMesSeleccionado] = mesSeleccionado.split('-').map(Number);
  const diasMesSeleccionado = new Date(anioMesSeleccionado, numeroMesSeleccionado, 0).getDate();
  const solicitudesPorEstado = solicitudes.reduce((counts, solicitud) => {
    const status = normalizeStatus(solicitud.estado);
    if (['Solicitada', 'Recibida', 'En revisión'].includes(status)) {
      counts[status] += 1;
    }
    return counts;
  }, { Solicitada: 0, Recibida: 0, 'En revisión': 0 });
  const totalPendientes = Object.values(solicitudesPorEstado).reduce((total, count) => total + count, 0);
  const consultores = usuarios.filter((usuario) => usuario.role !== 'admin').length;
  const usuariosPorId = new Map(usuarios.map((usuario) => [usuario.uid || usuario.id, usuario]));
  const cargando = Object.values(loaded).some((sourceLoaded) => !sourceLoaded);
  const resumenPorCategoria = Object.values(gastosMesSeleccionado.reduce((resumen, gasto) => {
    const categoria = gasto.categoria || 'Sin categoría';
    resumen[categoria] = resumen[categoria] || { nombre: categoria, total: 0, movimientos: 0 };
    resumen[categoria].total += Number(gasto.monto) || 0;
    resumen[categoria].movimientos += 1;
    return resumen;
  }, {})).map((categoria) => ({
    ...categoria,
    promedioDiario: categoria.total / diasMesSeleccionado,
  })).sort((a, b) => b.total - a.total);
  const resumenPorUsuario = Object.values(gastosMesSeleccionado.reduce((resumen, gasto) => {
    const usuario = usuariosPorId.get(gasto.userId);
    const nombre = usuario?.displayName || usuario?.email || 'Usuario desconocido';
    const key = gasto.userId || nombre;
    resumen[key] = resumen[key] || { nombre, total: 0, movimientos: 0 };
    resumen[key].total += Number(gasto.monto) || 0;
    resumen[key].movimientos += 1;
    return resumen;
  }, {})).sort((a, b) => b.total - a.total);

  const metricas = [
    { label: 'Gasto del mes', value: formatCurrency(totalMes), detail: `Gastos no archivados: ${formatCurrency(totalNoArchivadoMes)} · ${formatMonth(mesSeleccionado)}`, icon: Wallet, tone: 'text-emerald-700 bg-emerald-50 rounded-full' },
    { label: 'Movimientos', value: gastosMesActual.length, detail: 'En el mes actual', icon: ReceiptText, tone: 'text-blue-700 bg-blue-50 rounded-full' },
    { label: 'Solicitudes abiertas', value: totalPendientes, detail: `${solicitudesPorEstado.Solicitada} Sol. · ${solicitudesPorEstado.Recibida} Rec. · ${solicitudesPorEstado['En revisión']} Rev.`, icon: Clock3, tone: 'text-amber-700 bg-amber-50 rounded-full' },
    { label: 'Consultores', value: consultores, detail: 'Cuentas registradas', icon: Users, tone: 'text-rose-700 bg-rose-50 rounded-full' },
  ];

  return (
    <main data-testid="admin-dashboard" className="mx-auto w-full max-w-6xl space-y-5 lg:space-y-6 pb-0">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4 lg:pb-5">
        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-widest text-emerald-700">Panel de administración</p>
          
          <nav aria-label="Accesos de administración" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 lg:pb-4">
            <button type="button" onClick={() => onNavigate('usuarios')} className="border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-slate-500 rounded-2xl">Usuarios</button>
            <button type="button" onClick={() => onNavigate('auditoria')} className="border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-slate-500 rounded-2xl">Auditoría</button>
          </nav>
          
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

      <section aria-labelledby="desglose-mensual" className="border border-slate-200 bg-white p-4 shadow-sm rounded-2xl">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="desglose-mensual" className="text-lg font-black text-slate-800">Desglose mensual</h3>
            <p className="mt-1 text-sm text-slate-500">Gastos por categoría y usuario.</p>
          </div>
          <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
            Mes del resumen
            <select
              aria-label="Mes del resumen"
              value={mesSeleccionado}
              onChange={(event) => setMesSeleccionado(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
            >
              {mesesDisponibles.map((mes) => <option key={mes} value={mes}>{formatMonth(mes)}</option>)}
            </select>
          </label>
        </div>
        {cargando ? (
          <p className="py-4 text-sm text-slate-500">Cargando desglose...</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2" aria-label={`Gastos mensuales de ${anioActual}`}>
              <h4 className="mb-2 text-sm font-black text-slate-700">Gastos por mes · {anioActual}</h4>
              <div className="rounded-xl border border-slate-100 px-4 py-3">
                <svg
                  role="img"
                  aria-label={`Gráfica de línea de gastos por mes en ${anioActual}`}
                  viewBox="0 0 720 160"
                  className="h-36 w-full"
                  preserveAspectRatio="none"
                >
                  {[20, 65, 110].map((y) => {
                    return <line key={y} x1="40" y1={y} x2="678" y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />;
                  })}
                  <polyline
                    points={lineaGrafica}
                    fill="none"
                    stroke="#059669"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {puntosGrafica.map(({ mes, total, x, y, seleccionado }) => (
                    <g
                      key={mes}
                      role="button"
                      tabIndex={0}
                      aria-label={`Seleccionar ${formatMonth(mes)} (${formatCurrency(total)})`}
                      aria-pressed={seleccionado}
                      onClick={() => setMesSeleccionado(mes)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setMesSeleccionado(mes);
                        }
                      }}
                      className="cursor-pointer outline-none focus:outline-none focus-visible:drop-shadow-[0_0_3px_rgba(15,23,42,0.65)]"
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r={seleccionado ? 7 : 4}
                        fill={seleccionado ? '#f59e0b' : '#059669'}
                        stroke="white"
                        strokeWidth="2"
                        data-selected={seleccionado ? 'true' : 'false'}
                      >
                        <title>{`${formatMonth(mes)}: ${formatCurrency(total)}`}</title>
                      </circle>
                      <text
                        x={x}
                        y="140"
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight={seleccionado ? '700' : '400'}
                        fill={seleccionado ? '#b45309' : '#64748b'}
                      >
                        {getMonthLabel(mes)}
                      </text>
                    </g>
                  ))}
                </svg>
                <p className="mt-1 text-right text-xs text-slate-500">El punto ámbar señala el mes seleccionado.</p>
              </div>
            </div>
            {[
              { title: 'Gastos por categoría', rows: resumenPorCategoria, empty: 'No hay gastos por categoría en este mes.', showDailyAverage: true },
              { title: 'Gastos por usuario', rows: resumenPorUsuario, empty: 'No hay gastos por usuario en este mes.', showDailyAverage: false },
            ].map(({ title, rows, empty, showDailyAverage }) => (
              <div key={title} aria-label={title}>
                <h4 className="mb-2 text-sm font-black text-slate-700">{title}</h4>
                {rows.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">{empty}</p>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                    {rows.map(({ nombre, total, movimientos, promedioDiario }) => (
                      <li key={nombre} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{nombre}</p>
                          <p className="text-xs text-slate-500">{movimientos} {movimientos === 1 ? 'movimiento' : 'movimientos'}</p>
                          {showDailyAverage && <p className="text-xs text-slate-500">Promedio diario: {formatCurrency(promedioDiario)}</p>}
                        </div>
                        <span className="shrink-0 text-sm font-black text-slate-800">{formatCurrency(total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.8fr)]">
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
            ) : gastosMesActual.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No hay gastos registrados este mes.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {gastosMesActual.slice(0, 3).map((gasto) => {
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
              ['En revisión', 'bg-emerald-600'],
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
      
    </main>
  );
};

export default AdminDashboard;