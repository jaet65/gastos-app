import { Mail, Calendar, Shield, Eye, Pencil, ArrowLeft, User } from 'lucide-react';
import Footer from './Footer';

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';

const getAvatarGradient = (seed = '') => {
  const palettes = [
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-amber-600',
    'from-purple-500 to-violet-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-blue-600',
  ];
  const index = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % palettes.length;
  return palettes[index];
};

const PanelUsuarioAdmin = ({ user, adminEditMode, onClearView }) => {
  const initials = getInitials(user.displayName);
  const gradient = getAvatarGradient(user.email || user.displayName);
  const registeredAt = user.creado_en
    ? new Date(user.creado_en).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Fecha no disponible';

  return (
    <div className="w-full">
      <div className="bg-white/40 backdrop-blur-xl p-0">
        <Footer />

        <div className="mb-6">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 mb-2">
            Vista de administrador
          </p>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight leading-tight">
            Usuario activo
          </h2>
          <p className="text-slate-500 font-medium text-base mt-2">
            Consulta los registros de este consultor
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm shadow-sm overflow-hidden">
          <div className={`bg-gradient-to-br ${gradient} px-4 py-2 text-white relative`}>
            <div className="absolute inset-0 bg-black/5" />
            <div className="relative flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-2xl font-black shadow-lg">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-black truncate">{user.displayName || 'Sin nombre'}</h3>
                <p className="text-white/80 text-sm truncate">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="p-2 rounded-xl bg-slate-100 text-slate-500">
                <Calendar size={16} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registro</p>
                <p className="font-semibold text-slate-700">{registeredAt}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <div className="p-2 rounded-xl bg-slate-100 text-slate-500">
                <User size={16} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rol</p>
                <p className="font-semibold text-slate-700 capitalize">{user.role === 'admin' ? 'Administrador' : 'Consultor'}</p>
              </div>
            </div>

            {user.role === 'admin' && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider border border-amber-200">
                <Shield size={12} />
                Cuenta administradora
              </div>
            )}
          </div>
        </div>

        <div
          className={`mt-5 rounded-2xl border p-4 ${
            adminEditMode
              ? 'border-red-200 bg-red-50/80'
              : 'border-amber-200 bg-amber-50/80'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                adminEditMode ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
              }`}
            >
              {adminEditMode ? <Pencil size={18} /> : <Eye size={18} />}
            </div>
            <div>
              <p
                className={`text-sm font-black ${
                  adminEditMode ? 'text-red-700' : 'text-amber-800'
                }`}
              >
                {adminEditMode ? 'Modo edición activo' : 'Modo lectura activo'}
              </p>
              <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                {adminEditMode
                  ? 'Puedes modificar y eliminar los registros existentes de este usuario.'
                  : 'Solo puedes consultar sus gastos y solicitudes. No puedes crear ni modificar registros en su nombre.'}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClearView}
          className="mt-6 w-full flex items-center justify-center gap-2 rounded-full bg-slate-800 text-white py-3 px-6 text-sm font-black uppercase tracking-widest hover:bg-slate-900 active:scale-[0.98] transition-all shadow-lg"
        >
          <ArrowLeft size={16} />
          Volver a mis gastos
        </button>
      </div>
    </div>
  );
};

export default PanelUsuarioAdmin;
