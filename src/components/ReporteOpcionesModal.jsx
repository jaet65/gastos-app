import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { X, Calendar, Link as LinkIcon, ChevronRight } from 'lucide-react';

const ReporteOpcionesModal = ({ onClose, onGenerarConFechasPersonalizadas, onGenerarConSolicitud, onGenerarReporteMAF }) => {
    const [view, setView] = useState('initial'); // 'initial' | 'seleccionarSolicitud' | 'pedirMontoMAF'
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [montoMAF, setMontoMAF] = useState('');

    useEffect(() => {
        if (view === 'seleccionarSolicitud') {
            let isMounted = true;
            const q = query(
                collection(db, "solicitudes"), 
                where("estado", "not-in", ["Esperando...", "Cerrada", "Finalizada"]),
                orderBy("fechaInicio", "desc")
            );
            const unsubscribe = onSnapshot(q, (snapshot) => {
                if (isMounted) {
                    setSolicitudes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                    setLoading(false);
                }
            });
            return () => {
                isMounted = false;
                unsubscribe();
            };
        }
    }, [view]);

    const handleSetView = (newView) => {
        if (newView === 'seleccionarSolicitud') {
            setLoading(true);
        }
        setView(newView);
    };

    const handleSelectSolicitud = (solicitud) => {
        onGenerarConSolicitud(solicitud);
        onClose();
    };

    const handleSelectFechasPersonalizadas = () => {
        onGenerarConFechasPersonalizadas();
        onClose();
    }

    const handleGenerarMAF = (e) => {
        e.preventDefault();
        onGenerarReporteMAF(parseFloat(montoMAF) || 0);
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
                        <button onClick={() => handleSetView('seleccionarSolicitud')} className="w-full flex items-center justify-between text-left p-4 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors">
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

                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="w-full border-t border-slate-200"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white px-2 text-slate-400 font-bold">Reporte Especial</span>
                            </div>
                        </div>

                        <button onClick={() => handleSetView('pedirMontoMAF')} className="w-full flex items-center justify-between text-left p-4 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-colors">
                            <div>
                                <p className="font-bold text-orange-800 flex items-center gap-2">Reporte MAF</p>
                                <p className="text-xs text-orange-600">Genera reporte con branding de MAF y solo gastos MAF.</p>
                            </div>
                            <ChevronRight size={20} className="text-orange-400" />
                        </button>
                    </div>
                )}

                {view === 'seleccionarSolicitud' && (
                    <div>
                        <button onClick={() => handleSetView('initial')} className="text-xs font-bold text-blue-600 mb-4">← Volver</button>
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

                {view === 'pedirMontoMAF' && (
                    <form onSubmit={handleGenerarMAF}>
                        <button type="button" onClick={() => handleSetView('initial')} className="text-xs font-bold text-blue-600 mb-4">← Volver</button>
                        <h4 className="font-bold text-slate-800 mb-4">Monto Recibido para MAF</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Importe Recibido</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    min="0"
                                    autoFocus
                                    value={montoMAF} 
                                    onChange={(e) => setMontoMAF(e.target.value)} 
                                    placeholder="0.00"
                                    className="w-full p-3 bg-white border border-slate-300 rounded-full font-bold text-slate-800 focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-all outline-none" 
                                />
                            </div>
                            <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-full transition-all shadow-lg shadow-orange-100">
                                Generar Reporte MAF
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>,
        document.body
    );
};

export default ReporteOpcionesModal;