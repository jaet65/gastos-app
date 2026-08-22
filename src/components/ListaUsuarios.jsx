import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Text } from '@tremor/react';
import { Mail, Calendar, ChevronRight, Search, Users, Shield } from 'lucide-react';

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

const UserCardSkeleton = () => (
  <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 animate-pulse">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-slate-200" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-1/3" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
        <div className="h-3 bg-slate-100 rounded w-1/4" />
      </div>
    </div>
  </div>
);

const ListaUsuarios = ({ onSelectUser }) => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('creado_en', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setUsuarios(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredUsuarios = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return usuarios;
    return usuarios.filter(
      (u) =>
        u.displayName?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term)
    );
  }, [usuarios, search]);

  const adminCount = usuarios.filter((u) => u.role === 'admin').length;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="mb-6">
          <div className="h-8 bg-slate-200 rounded-lg w-64 animate-pulse mb-2" />
          <div className="h-4 bg-slate-100 rounded w-80 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3].map((i) => (
            <UserCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="mb-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-2">
          Panel de administración
        </p>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">
          Usuarios
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Selecciona un consultor para revisar sus gastos y solicitudes.
        </p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nombre o correo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-sm text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
        />
      </div>

      <div className="grid grid-cols-1 gap-3">
        {filteredUsuarios.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/50 p-10 text-center">
            <Text className="text-slate-500">No se encontraron usuarios con ese criterio.</Text>
          </div>
        ) : (
          filteredUsuarios.map((u) => {
            const gradient = getAvatarGradient(u.email || u.displayName);
            const initials = getInitials(u.displayName);

            return (
              <button
                key={u.uid}
                type="button"
                onClick={() => onSelectUser(u)}
                className="user-card w-full text-left rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm p-4 cursor-pointer transition-all duration-200 hover:border-blue-300 hover:shadow-md hover:shadow-blue-100/50 hover:-translate-y-0.5 group focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center text-sm font-black shadow-md group-hover:scale-105 transition-transform shrink-0`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black text-slate-800 truncate">
                          {u.displayName}
                        </p>
                        {u.role === 'admin' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[9px] font-black uppercase tracking-wider border border-amber-200">
                            <Shield size={10} />
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Mail size={12} className="text-slate-400 shrink-0" />
                        <span className="text-xs text-slate-500 truncate">{u.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Calendar size={12} className="text-slate-400 shrink-0" />
                        <span className="text-[10px] text-slate-400">
                          Registrado: {new Date(u.creado_en).toLocaleDateString('es-MX')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0"
                    size={20}
                  />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ListaUsuarios;
