import { useEffect, useRef, useState, Fragment, Suspense, lazy } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase';
import { useAuth } from './AuthContext'; import { CLOUD_NAME } from './config';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, where, getDoc } from 'firebase/firestore';
import Footer from './Footer';
import { Card, Title, Text, Flex, Badge } from "@tremor/react";
import { Menu, Transition } from '@headlessui/react';
import { FileText, Calendar, User, Briefcase, Trash2, FileDown, Check, ChevronDown, Eye, X } from 'lucide-react';

const PdfCanvasViewer = lazy(() => import('./PdfCanvasViewer'));

const formatoMoneda = (cantidad) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(cantidad);
};

const statusColors = {
    'Solicitada': { badge: 'bg-yellow-500 text-white', dot: 'bg-yellow-500', tremor: 'warning' },
    'Recibida': { badge: 'bg-blue-500 text-white', dot: 'bg-blue-500', tremor: 'info' },
    'Esperando...': { badge: 'bg-green-500 text-white', dot: 'bg-green-500', tremor: 'success' },
    'Cerrada': { badge: 'bg-slate-500 text-white', dot: 'bg-slate-500', tremor: 'default' },
};

const OpcionesArchivoModal = ({ titulo, cancelLabel, onClose, onDownload, onPreview }) => createPortal(
    <div
        className="fixed inset-0 z-[99998] flex items-center justify-center bg-black/50 p-4"
        onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
        }}
    >
        <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="opciones-archivo-titulo"
            className="w-full max-w-xs rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
        >
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 id="opciones-archivo-titulo" className="text-base font-bold text-slate-800">{titulo}</h2>
                <button
                    onClick={onClose}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={cancelLabel}
                    title="Cancelar"
                >
                    <X size={18} />
                </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={onDownload}
                    className="flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                >
                    <FileDown size={16} /> Descargar
                </button>
                <button
                    onClick={onPreview}
                    className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                    <Eye size={16} /> Visualizar
                </button>
            </div>
        </section>
    </div>,
    document.body
);

const ListaSolicitudes = ({ adminViewUid = null, adminEditMode = false, onPreviewReport }) => {
    const { user } = useAuth();
    const esVistaAdmin = !!adminViewUid && !adminEditMode;
    const targetUid = adminViewUid || user?.uid;
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [estadoFiltro, setEstadoFiltro] = useState('Todos');
    const [preview, setPreview] = useState(null);
    const [previewBytes, setPreviewBytes] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState('');
    const [reporteOpciones, setReporteOpciones] = useState(null);
    const [solicitudOpciones, setSolicitudOpciones] = useState(null);
    const previewHistoryRef = useRef(false);

    const solicitudesFiltradas = estadoFiltro === 'Todos'
        ? solicitudes
        : solicitudes.filter(s => s.estado === estadoFiltro);

    const descargarPdf = async (url, nombreArchivo) => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = nombreArchivo || 'solicitud.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(objectUrl);
        } catch (error) {
            console.error('Error al descargar el PDF:', error);
            alert('No se pudo descargar el archivo.');
        }
    };

    const visualizarReporte = async (solicitud) => {
        setPreview({ ...solicitud, vistaTipo: 'reporte' });
        setPreviewBytes(null);
        setPreviewError('');
        setPreviewLoading(true);

        try {
            let pdfBytes;
            if (Array.isArray(solicitud.gastosReporteIds) && solicitud.gastosReporteIds.length > 0) {
                const pdfBlob = await onPreviewReport?.(solicitud);
                if (!pdfBlob) throw new Error('No se pudo generar la vista previa del reporte.');
                pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
            } else {
                const response = await fetch(solicitud.url_reporte_gastos);
                if (!response.ok) throw new Error(`No se pudo descargar el ZIP del reporte (HTTP ${response.status}).`);
                const { default: JSZip } = await import('jszip');
                const zip = await JSZip.loadAsync(await response.arrayBuffer());
                const pdfEntry = Object.values(zip.files).find(file => !file.dir && file.name.toLowerCase().endsWith('.pdf'));
                if (!pdfEntry) throw new Error('El ZIP guardado no contiene un PDF.');
                pdfBytes = await pdfEntry.async('uint8array');
            }
            setPreviewBytes(pdfBytes);
        } catch (error) {
            console.error('Error al preparar la vista previa del reporte:', error);
            setPreviewError(error.message || 'No se pudo abrir la vista previa.');
        } finally {
            setPreviewLoading(false);
        }
    };

    const visualizarSolicitud = async (solicitud) => {
        setPreview({ ...solicitud, vistaTipo: 'solicitud' });
        setPreviewBytes(null);
        setPreviewError('');
        setPreviewLoading(true);

        try {
            const response = await fetch(solicitud.url_pdf_solicitud);
            if (!response.ok) throw new Error(`No se pudo descargar el PDF de la solicitud (HTTP ${response.status}).`);
            setPreviewBytes(new Uint8Array(await response.arrayBuffer()));
        } catch (error) {
            console.error('Error al preparar la vista previa de la solicitud:', error);
            setPreviewError(error.message || 'No se pudo abrir la vista previa de la solicitud.');
        } finally {
            setPreviewLoading(false);
        }
    };

    const cerrarVistaPrevia = () => {
        if (previewHistoryRef.current) {
            previewHistoryRef.current = false;
            window.history.back();
        }
        setPreview(null);
        setPreviewBytes(null);
        setPreviewError('');
    };

    useEffect(() => {
        if (!preview) return undefined;

        const currentState = window.history.state;
        const nextState = currentState && typeof currentState === 'object' ? currentState : {};
        window.history.pushState({ ...nextState, gastosPreviewEntry: true }, '', window.location.href);
        previewHistoryRef.current = true;

        const handlePopState = () => {
            previewHistoryRef.current = false;
            setPreview(null);
            setPreviewBytes(null);
            setPreviewError('');
        };
        const handleKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            if (previewHistoryRef.current) {
                previewHistoryRef.current = false;
                window.history.back();
            }
            setPreview(null);
            setPreviewBytes(null);
            setPreviewError('');
        };

        window.addEventListener('popstate', handlePopState);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('popstate', handlePopState);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [preview]);

    const eliminarSolicitud = async (id) => {
        if (window.confirm("¿Estás seguro de que quieres eliminar esta solicitud? Esta acción no se puede deshacer.")) {
            try {
                const solicitudRef = doc(db, "solicitudes", id);
                const solicitudDoc = await getDoc(solicitudRef);
                const solicitudData = solicitudDoc.data();

                if (solicitudData.deleteToken) {
                    try {
                        // Delete the file from Cloudinary using the delete token
                        const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/delete_by_token`;
                        const response = await fetch(cloudinaryUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token: solicitudData.deleteToken })
                        });

                        if (!response.ok) console.error('Error deleting from Cloudinary:', response.statusText);
                    } catch (error) { console.error('Error deleting from Cloudinary:', error); }
                }
                await deleteDoc(doc(db, "solicitudes", id));
                // Opcional: mostrar una notificación de éxito.
            } catch (error) {
                console.error("Error al eliminar la solicitud: ", error);
                alert("Ocurrió un error al eliminar la solicitud.");
            }
        }
    };

    const handleStatusChange = async (id, nuevoEstado) => {
        const solicitudRef = doc(db, "solicitudes", id);
        try {
            await updateDoc(solicitudRef, {
                estado: nuevoEstado
            });
        } catch (error) {
            console.error("Error al actualizar el estado: ", error);
            alert("Ocurrió un error al cambiar el estado de la solicitud.");
        }
    };

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "solicitudes"),
            where("userId", "==", targetUid),
            orderBy("fechaInicio", "desc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSolicitudes(data);
            setLoading(false);

            // Migración automática de estados antiguos
            data.forEach(async (s) => {
                let nuevoEstado = null;
                if (s.estado === 'Enviada') nuevoEstado = 'Solicitada';
                if (s.estado === 'Finalizada') nuevoEstado = 'Esperando...';

                if (nuevoEstado) {
                    try {
                        await updateDoc(doc(db, "solicitudes", s.id), { estado: nuevoEstado });
                    } catch (e) {
                        console.error("Error migrando solicitud:", s.id, e);
                    }
                }
            });
        });
        return () => unsubscribe();
    }, [user, targetUid]);

    if (loading) {
        return <Text className="text-center mt-8">Cargando solicitudes...</Text>;
    }

    return (
        <div className="space-y-4">
            {solicitudes.length > 0 && (
                <div className="flex gap-2 pb-2 overflow-x-auto scrollbar-thin select-none">
                    <button
                        onClick={() => setEstadoFiltro('Todos')}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-sm border ${
                            estadoFiltro === 'Todos'
                                ? 'bg-slate-800 text-white border-slate-800'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        Todas ({solicitudes.length})
                    </button>
                    {Object.keys(statusColors).map((estado) => {
                        const count = solicitudes.filter(s => s.estado === estado).length;
                        if (count === 0) return null;
                        const activeClass = statusColors[estado].badge;
                        const isSelected = estadoFiltro === estado;
                        
                        return (
                            <button
                                key={estado}
                                onClick={() => setEstadoFiltro(estado)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-sm border flex items-center gap-1.5 ${
                                    isSelected
                                        ? `${activeClass} border-transparent`
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : statusColors[estado].dot}`}></span>
                                {estado} ({count})
                            </button>
                        );
                    })}
                </div>
            )}

            {solicitudes.length === 0 ? (
                <Text className="text-center mt-8">No hay solicitudes de recursos todavía.</Text>
            ) : solicitudesFiltradas.length === 0 ? (
                <Text className="text-center mt-8">No hay solicitudes en este estado.</Text>
            ) : (
                solicitudesFiltradas.map(solicitud => (
                    <Card key={solicitud.id} className="rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm ring-1 ring-slate-200/80">
                        <Flex alignItems="start" className="border-none">
                            <div className="truncate">
                                <Flex alignItems='center' className='gap-2 mb-2'>
                                    <Briefcase size={14} className='text-slate-500' />
                                    <Title>{`Rally TrackSIM - ${solicitud.esMAF ? 'MAF' : 'CECAI'}`}</Title>
                                </Flex>
                                <Flex alignItems='center' className='gap-2'>
                                    <User size={14} className='text-slate-500' />
                                    <Text>{solicitud.consultor}</Text>
                                </Flex>
                                <Flex alignItems='center' className='gap-2 mt-1'>
                                    <Calendar size={14} className='text-slate-500' />
                                    <Text>{solicitud.fechaInicio} al {solicitud.fechaFin} ({solicitud.dias} días)</Text>
                                </Flex>
                            </div>
                            <div className="flex flex-col items-end">
                                {solicitud.url_pdf_solicitud && (
                                    <button
                                        onClick={() => setSolicitudOpciones(solicitud)}
                                        className="flex items-center gap-1 p-2 text-slate-500 hover:text-blue-600 transition-colors"
                                        title="Opciones de la solicitud"
                                    >
                                        <FileText size={16} />
                                        <span className="text-xs font-bold">Solicitud</span>
                                    </button>
                                )}
                                {solicitud.url_reporte_gastos && (
                                    <button
                                        onClick={() => setReporteOpciones(solicitud)}
                                        className="flex items-center gap-1 p-2 text-slate-500 hover:text-emerald-600 transition-colors"
                                        title="Opciones del reporte"
                                    >
                                        <FileDown size={16} />
                                        <span className="text-xs font-bold">Reporte</span>
                                    </button>
                                )}
                                {!esVistaAdmin && (
                                    <button
                                        onClick={() => eliminarSolicitud(solicitud.id)}
                                        disabled={
                                            solicitud.estado === 'Recibida' ||
                                            solicitud.estado === 'Esperando...' ||
                                            solicitud.estado === 'Cerrada'
                                        }
                                        className={`flex items-center gap-1 p-2 transition-colors ${solicitud.estado === 'Recibida' ||
                                                solicitud.estado === 'Esperando...' ||
                                                solicitud.estado === 'Cerrada' ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-red-600'}`}
                                        title={
                                            solicitud.estado === 'Recibida' ||
                                                solicitud.estado === 'Esperando...' ||
                                                solicitud.estado === 'Cerrada' ? 'No se puede eliminar una solicitud que haya sido RECIBIDA' : 'Eliminar solicitud'}
                                    >
                                        <Trash2 size={16} />
                                        <span className="text-xs font-bold">Eliminar</span>
                                    </button>
                                )}
                            </div>
                        </Flex>
                        <Flex className="mt-4 pt-4 border-t border-slate-200">
                            <div className="w-1/2">
                                <Text className="font-bold text-xs text-slate-500 uppercase mb-2">Estado</Text>
                                {/* Selector de Estado Personalizado con Headless UI */}
                                <div className="relative w-fit">
                                    {esVistaAdmin ? (
                                        <div className={`inline-flex items-center justify-center w-full rounded-full border border-gray-300 px-4 py-1.5 text-sm font-black shadow-sm transition-colors ${statusColors[solicitud.estado]?.badge || 'bg-gray-100 text-gray-800'}`}>
                                            {solicitud.estado || 'Solicitada'}
                                        </div>
                                    ) : (
                                        <Menu as="div" className="relative inline-block text-left">
                                            <Menu.Button className={`inline-flex items-center justify-center w-full rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors ${statusColors[solicitud.estado]?.badge || 'bg-gray-100 text-gray-800'}`}>
                                                {solicitud.estado || 'Solicitada'}
                                                <ChevronDown className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
                                            </Menu.Button>

                                            <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                                                <Menu.Items className="absolute left-0 z-10 mt-2 w-56 origin-top-left rounded-md bg-white shadow-lg focus:outline-none">
                                                    <div className="py-1">
                                                        {Object.keys(statusColors).map((estado) => (
                                                            <Menu.Item key={estado}>
                                                                {({ active }) => (
                                                                    <button onClick={() => handleStatusChange(solicitud.id, estado)} className={`${active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                                                        <span className={`w-2 h-2 rounded-full mr-3 ${statusColors[estado].dot}`}></span>
                                                                        {estado}
                                                                        {solicitud.estado === estado && <Check className="ml-auto h-5 w-5 text-blue-600" />}
                                                                    </button>
                                                                )}
                                                            </Menu.Item>
                                                        ))}
                                                    </div>
                                                </Menu.Items>
                                            </Transition>
                                        </Menu>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <Text className="font-bold text-xs text-slate-500 uppercase mb-1">Total Solicitado</Text>
                                <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusColors[solicitud.estado]?.badge || 'bg-gray-100 text-gray-800'}`}>
                                    {formatoMoneda(solicitud.totalSolicitado)}
                                </span>
                            </div>
                        </Flex>

                        {solicitud.url_reporte_gastos && (
                            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                                {solicitud.resumen_sumaSinFactura > 0 && (
                                    <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                                        <span className="text-xs text-amber-700 font-medium">Sin factura:</span>
                                        <span className="text-xs font-black text-amber-800">{formatoMoneda(solicitud.resumen_sumaSinFactura)}</span>
                                    </div>
                                )}
                                {solicitud.resumen_porReembolsar > 0 && (
                                    <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                                        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0"></span>
                                        <span className="text-xs text-green-700 font-medium">Reembolso de {solicitud.esMAF ? 'MAF' : 'CECAI'}:</span>
                                        <span className="text-xs font-black text-green-800">{formatoMoneda(solicitud.resumen_porReembolsar)}</span>
                                    </div>
                                )}
                                {solicitud.resumen_porReintegrar > 0 && (
                                    <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-full px-3 py-1">
                                        <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
                                        <span className="text-xs text-orange-700 font-medium">Reintegro a {solicitud.esMAF ? 'MAF' : 'CECAI'}:</span>
                                        <span className="text-xs font-black text-orange-800">{formatoMoneda(solicitud.resumen_porReintegrar)}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                ))
            )}
            {reporteOpciones && (
                <OpcionesArchivoModal
                    titulo="Reporte"
                    cancelLabel="Cancelar opciones de reporte"
                    onClose={() => setReporteOpciones(null)}
                    onDownload={() => {
                        const solicitud = reporteOpciones;
                        setReporteOpciones(null);
                        descargarPdf(solicitud.url_reporte_gastos, solicitud.nombre_archivo_reporte);
                    }}
                    onPreview={() => {
                        const solicitud = reporteOpciones;
                        setReporteOpciones(null);
                        visualizarReporte(solicitud);
                    }}
                />
            )}
            {solicitudOpciones && (
                <OpcionesArchivoModal
                    titulo="Solicitud"
                    cancelLabel="Cancelar opciones de solicitud"
                    onClose={() => setSolicitudOpciones(null)}
                    onDownload={() => {
                        const solicitud = solicitudOpciones;
                        setSolicitudOpciones(null);
                        descargarPdf(solicitud.url_pdf_solicitud, solicitud.nombre_archivo);
                    }}
                    onPreview={() => {
                        const solicitud = solicitudOpciones;
                        setSolicitudOpciones(null);
                        visualizarSolicitud(solicitud);
                    }}
                />
            )}
            {preview && createPortal(
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={preview.vistaTipo === 'solicitud' ? 'Vista previa de la solicitud' : 'Vista previa del reporte'}
                    className="fixed inset-0 z-[99999] flex flex-col bg-slate-950 text-white"
                    style={{
                        paddingTop: 'env(safe-area-inset-top, 0px)',
                        paddingRight: 'env(safe-area-inset-right, 0px)',
                        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                        paddingLeft: 'env(safe-area-inset-left, 0px)',
                    }}
                >
                    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                        <div className="min-w-0">
                            <h2 className="truncate text-sm font-bold">{preview.vistaTipo === 'solicitud' ? 'Vista previa de la solicitud' : 'Vista previa del reporte'}</h2>
                            <p className="truncate text-xs text-slate-300">{preview.vistaTipo === 'solicitud' ? preview.nombre_archivo || preview.proyecto : preview.nombre_archivo_reporte || preview.proyecto}</p>
                        </div>
                        <button onClick={cerrarVistaPrevia} className="shrink-0 rounded-md p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Cerrar vista previa">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-neutral-700">
                        {previewLoading && <p className="p-6 text-center text-sm text-white">Preparando reporte...</p>}
                        {previewError && <p role="alert" className="p-6 text-center text-sm text-red-200">{previewError}</p>}
                        {previewBytes && (
                            <Suspense fallback={<p className="p-6 text-center text-sm text-white">Cargando visor...</p>}>
                                <PdfCanvasViewer data={previewBytes} />
                            </Suspense>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ListaSolicitudes;