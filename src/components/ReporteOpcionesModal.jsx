import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { X, Calendar, Link as LinkIcon, ChevronRight } from 'lucide-react';

const ReporteOpcionesModal = ({ onClose, onGenerarConFechasPersonalizadas, onGenerarConSolicitud }) => {
    const [view, setView] = useState('initial'); // 'initial' | 'seleccionarSolicitud'
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (view === 'seleccionarSolicitud') {
            setLoading(true);
            const q = query(
                collection(db, "solicitudes"), 
                where("estado", "!=", "Finalizada"), // No mostrar las finalizadas
                orderBy("fechaInicio", "desc")       // ¡Segundo ordenado en otro campo!
            );
            const unsubscribe = onSnapshot(q, (snapshot) => {
                setSolicitudes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setLoading(false);
            });
            return () => unsubscribe();
        }
    }, [view]);

    const handleSelectSolicitud = (solicitud) => {
        onGenerarConSolicitud(solicitud);
        onClose();
    };

    const handleSelectFechasPersonalizadas = () => {
        onGenerarConFechasPersonalizadas();
        onClose();
    }

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative border border-slate-200">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                    <h3 className="text-xl font-black text-slate-800">Generar Reporte de Gastos</h3>
                    <button onClick={onClose} className="bg-transparent text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={22} />
                    </button>
                </div>

                {view === 'initial' && (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">Elige cómo quieres filtrar los gastos para tu reporte:</p>
                        <button onClick={() => setView('seleccionarSolicitud')} className="w-full flex items-center justify-between text-left p-4 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors">
                            <div>
                                <p className="font-bold text-slate-800 flex items-center gap-2"><LinkIcon size={16} /> Vincular a Solicitud</p>
                                <p className="text-xs text-slate-500">Usa las fechas de una solicitud de recursos existente.</p>
                            </div>
                            <ChevronRight size={20} className="text-slate-400" />
                        </button>
                        <button onClick={handleSelectFechasPersonalizadas} className="w-full flex items-center justify-between text-left p-4 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors">
                            <div>
                                <p className="font-bold text-slate-800 flex items-center gap-2"><Calendar size={16} /> Usar Fechas de Filtros</p>
                                <p className="text-xs text-slate-500">Usa las fechas que seleccionaste en los filtros.</p>
                            </div>
                            <ChevronRight size={20} className="text-slate-400" />
                        </button>
                    </div>
                )}

                {view === 'seleccionarSolicitud' && (
                    <div>
                        <button onClick={() => setView('initial')} className="text-xs font-bold text-blue-600 mb-4">← Volver</button>
                        <h4 className="font-bold text-slate-800 mb-2">Selecciona una solicitud</h4>
                        {loading ? (
                            <p>Cargando solicitudes...</p>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                                {solicitudes.map(solicitud => (
                                    <div key={solicitud.id} onClick={() => handleSelectSolicitud(solicitud)} className="p-3 rounded-md border border-slate-200 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors">
                                        <p className="font-bold text-sm text-slate-700">{solicitud.proyecto}</p>
                                        <p className="text-xs text-slate-500">{solicitud.consultor}</p>
                                        <p className="text-xs text-slate-500 mt-1">{solicitud.fechaInicio} al {solicitud.fechaFin}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default ReporteOpcionesModal;