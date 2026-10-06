import { useEffect, useRef, useState, Fragment, Suspense, lazy } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase';
import { useAuth } from './AuthContext'; import { CLOUD_NAME } from './config';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, where, getDoc, deleteField } from 'firebase/firestore';
import Footer from './Footer';
import { eliminarCloudinaryConToken } from './cloudinaryDelete';
import { Card, Title, Text, Flex, Badge } from "@tremor/react";
import { Menu, Transition } from '@headlessui/react';
import { FileText, Calendar, User, Briefcase, Trash2, FileDown, Check, ChevronDown, Eye, X, Send, CheckCircle2, XCircle } from 'lucide-react';
import Swal from 'sweetalert2';

const PdfCanvasViewer = lazy(() => import('./PdfCanvasViewer'));

const formatoMoneda = (cantidad) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(cantidad);
};

const statusColors = {
    'Solicitada': { badge: 'bg-yellow-500 text-white', icon: Send, tremor: 'warning' },
    'Recibida': { badge: 'bg-blue-500 text-white', icon: CheckCircle2, tremor: 'info' },
    'En revisión': { badge: 'bg-green-500 text-white', icon: Eye, tremor: 'success' },
    'Cerrada': { badge: 'bg-slate-500 text-white', icon: XCircle, tremor: 'default' },
};

const normalizarEstado = (estado) => {
    if (estado === 'Enviada') return 'Solicitada';
    if (estado === 'Esperando...' || estado === 'Finalizada') return 'En revisión';
    return estado || 'Solicitada';
};

const estadosNoEliminables = new Set(['Recibida', 'En revisión', 'Esperando...', 'Finalizada', 'Cerrada']);

const OpcionesArchivoModal = ({ titulo, cancelLabel, onClose, onDownload, onPreview }) => createPortal(
    <div
        className="fixed inset-0 z-99998 flex items-center justify-center bg-black/50 p-4"
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

const ListaSolicitudes = ({ adminViewUid = null, adminEditMode = false, adminGlobalView = false, onPreviewReport }) => {
    const { user } = useAuth();
    const esVistaAdmin = adminGlobalView || (!!adminViewUid && !adminEditMode);
    const targetUid = adminGlobalView ? null : (adminViewUid || user?.uid);
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
        try {
            // 1. Obtenemos el documento de Firestore para acceder a sus campos
            const solicitudRef = doc(db, "solicitudes", id);
            const solicitudDoc = await getDoc(solicitudRef);

            if (!solicitudDoc.exists()) {
                Swal.fire('Error', 'La solicitud no existe.', 'error');
                return;
            }

            const solicitudData = solicitudDoc.data();
            const valorTotal = solicitudData.totalSolicitado ?? 0;
            const estadoSolicitud = normalizarEstado(solicitudData.estado);
            const tieneReporte = Boolean(solicitudData.url_reporte_gastos || solicitudData.deleteTokenReporte);

            const totalFormateado = new Intl.NumberFormat('es-MX', {
                style: 'currency',
                currency: 'MXN'
            }).format(valorTotal);

            if (estadosNoEliminables.has(estadoSolicitud)) {
                await Swal.fire({
                    title: 'No se puede eliminar',
                    text: estadoSolicitud === 'Recibida'
                        ? 'Las solicitudes recibidas deben conservarse para mantener el historial de recursos.'
                        : `Las solicitudes en estado ${estadoSolicitud} no se pueden eliminar.`,
                    icon: 'warning',
                    confirmButtonText: 'Entendido'
                });
                return;
            }

            // 2. Mostrar la alerta de confirmación usando el campo correcto
            console.log("LOG: Eliminar solicitud?");
            const detalleConfirmacion = document.createElement('div');
            detalleConfirmacion.className = 'space-y-2 text-center';
            [
                { texto: `Estado: ${estadoSolicitud}.` },
                { texto: `Importe: ${totalFormateado}.` },
                ...(tieneReporte ? [{ texto: 'También se eliminará el reporte adjunto y se restaurarán sus gastos.' }] : []),
                { texto: 'Esta acción no se puede deshacer.', className: 'font-bold text-red-600' }
            ].forEach(({ texto, className = '' }) => {
                const parrafo = document.createElement('p');
                parrafo.className = className;
                parrafo.textContent = texto;
                detalleConfirmacion.appendChild(parrafo);
            });

            const result = await Swal.fire({
                title: '¿Eliminar solicitud?',
                html: detalleConfirmacion,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Continuar',
                cancelButtonText: 'Cancelar'
            });

            if (!result.isConfirmed) return;

            if (tieneReporte) {
                const confirmacionFinal = await Swal.fire({
                    title: 'Confirmación adicional',
                    text: `Escribe ELIMINAR para confirmar el borrado de la solicitud en estado ${estadoSolicitud}.`,
                    input: 'text',
                    inputPlaceholder: 'ELIMINAR',
                    inputValidator: (value) => value?.trim() === 'ELIMINAR'
                        ? undefined
                        : 'Debes escribir ELIMINAR para continuar.',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    confirmButtonText: 'Eliminar definitivamente',
                    cancelButtonText: 'Cancelar'
                });

                if (!confirmacionFinal.isConfirmed || confirmacionFinal.value?.trim() !== 'ELIMINAR') return;
            }

            const tienePdfSolicitud = Boolean(solicitudData.url_pdf_solicitud);
            const tokenPdfSolicitud = tienePdfSolicitud || !solicitudData.url_reporte_gastos
                ? solicitudData.deleteToken
                : '';
            const tokenReporte = solicitudData.deleteTokenReporte ||
                (!tienePdfSolicitud ? solicitudData.deleteToken : '');

            if ((solicitudData.url_pdf_solicitud || tokenPdfSolicitud) &&
                !await eliminarCloudinaryConToken(tokenPdfSolicitud, 'el PDF de la solicitud')) return;
            if ((solicitudData.url_reporte_gastos || tokenReporte) &&
                !await eliminarCloudinaryConToken(tokenReporte, 'el ZIP del reporte')) return;

            const gastosReporteIds = Array.isArray(solicitudData.gastosReporteIds)
                ? solicitudData.gastosReporteIds
                : [];
            await Promise.all(gastosReporteIds.map(gastoId =>
                updateDoc(doc(db, 'gastos', gastoId), { archivado: false })
            ));
            await deleteDoc(solicitudRef);

            console.log("LOG: Solicitud eliminada");
            Swal.fire({
                toast: true,
                position: 'bottom-end',
                icon: 'success',
                title: '¡Solicitud eliminada!',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
        } catch (error) {
            console.error("Error al eliminar la solicitud: ", error);
            Swal.fire(
                'Error',
                'Ocurrió un error al eliminar la solicitud.',
                'error'
            );
        }
    };

    const handleStatusChange = async (solicitud, nuevoEstado) => {
        const solicitudRef = doc(db, "solicitudes", solicitud.id);
        try {
            // 1. Verificamos si cumple con las condiciones para mostrar la advertencia del reporte
            const requiereConfirmacionReporte = 
                ['En revisión', 'Esperando...', 'Finalizada'].includes(solicitud.estado) &&
                solicitud.url_reporte_gastos &&
                ['Recibida', 'Solicitada'].includes(nuevoEstado);

            if (requiereConfirmacionReporte) {
                // Mostramos el SweetAlert y esperamos la respuesta del usuario
                const resultado = await Swal.fire({
                    title: '¿Estás seguro?',
                    text: 'Esta solicitud tiene un reporte adjunto. ¿Deseas cancelar el reporte y eliminar el ZIP de Cloudinary?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Sí, cancelar y eliminar',
                    cancelButtonText: 'No, mantener'
                });

                if (!resultado.isConfirmed) return;
            }

            // 2. Si el usuario confirmó la cancelación del reporte
            if (requiereConfirmacionReporte) {
                const deleteTokenReporte = solicitud.deleteTokenReporte ||
                    (!solicitud.url_pdf_solicitud ? solicitud.deleteToken : '');
                const continuarCancelacion = await eliminarCloudinaryConToken(deleteTokenReporte, 'el ZIP del reporte');
                if (!continuarCancelacion) return;

                const gastosReporteIds = Array.isArray(solicitud.gastosReporteIds) ? solicitud.gastosReporteIds : [];
                await Promise.all(gastosReporteIds.map(gastoId =>
                    updateDoc(doc(db, 'gastos', gastoId), { archivado: false })
                ));

                await updateDoc(solicitudRef, {
                    estado: nuevoEstado,
                    url_reporte_gastos: deleteField(),
                    nombre_archivo_reporte: deleteField(),
                    deleteTokenReporte: deleteField(),
                    ...(!solicitud.url_pdf_solicitud ? { deleteToken: deleteField() } : {}),
                    estadoAnteriorReporte: deleteField(),
                    gastosReporteIds: deleteField(),
                    resumen_sumaFacturado: deleteField(),
                    resumen_sumaSinFactura: deleteField(),
                    resumen_porReembolsar: deleteField(),
                    resumen_porReintegrar: deleteField(),
                });
                Swal.fire({
                    toast: true,
                    position: 'bottom-end',
                    icon: 'success',
                    title: 'Estado actualizado correctamente a ' + nuevoEstado + ' y reporte cancelado',
                    showConfirmButton: false,
                    timer: 3000,
                    timerProgressBar: true
                });
                return;
            }

            // 3. Comportamiento normal si no aplica el reporte o si el usuario decidió no cancelarlo
            await updateDoc(solicitudRef, {
                estado: nuevoEstado
            });
            Swal.fire({
                toast: true,
                position: 'bottom-end',
                icon: 'success',
                title: 'Estado actualizado correctamente a ' + nuevoEstado,
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });

        } catch (error) {
            console.error("Error al actualizar el estado: ", error);
            Swal.fire({
                title: 'Error',
                text: error.message || 'Ocurrió un error al cambiar el estado de la solicitud.',
                icon: 'error',
                confirmButtonText: 'Entendido'
            });
        }
    };

    useEffect(() => {
        if (!user) return;

        const constraints = [orderBy("fechaInicio", "desc")];
        if (targetUid) constraints.unshift(where("userId", "==", targetUid));
        const q = query(collection(db, "solicitudes"), ...constraints);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSolicitudes(data.map((solicitud) => ({
                ...solicitud,
                estado: normalizarEstado(solicitud.estado),
            })));
            setLoading(false);

            if (!adminGlobalView) {
                data.forEach(async (s) => {
                    const nuevoEstado = normalizarEstado(s.estado);

                    if (nuevoEstado !== s.estado) {
                        try {
                            await updateDoc(doc(db, "solicitudes", s.id), { estado: nuevoEstado });
                        } catch (e) {
                            console.error("Error migrando solicitud:", s.id, e);
                        }
                    }
                });
            }
        });
        return () => unsubscribe();
    }, [user, targetUid, adminGlobalView]);

    if (loading) {
        return <Text className="text-center mt-8">Cargando solicitudes...</Text>;
    }

    return (
        <div className="space-y-4">
            {adminGlobalView}
            {solicitudes.length > 0 && (() => {
                const estadosDisponibles = Object.keys(statusColors).filter(
                    (estado) => solicitudes.filter((s) => s.estado === estado).length > 0
                );
                const hayVariosFiltros = estadosDisponibles.length > 0;

                return (
                    <div className="flex flex-wrap sm:flex-nowrap gap-1.5 sm:gap-2 pb-2 sm:overflow-x-auto sm:scrollbar-thin select-none">
                        <button
                            onClick={() => setEstadoFiltro('Todos')}
                            className={`${
                                hayVariosFiltros ? 'w-full sm:w-auto sm:flex-initial' : 'flex-1 sm:flex-initial'
                            } justify-center px-2.5 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-sm border ${
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
                                className={`flex-1 sm:flex-initial justify-center px-2.5 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-sm border flex items-center gap-1 sm:gap-1.5 ${
                                    isSelected
                                        ? `${activeClass} border-transparent`
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {(() => {
                                    const StatusIcon = statusColors[estado].icon;
                                    return <StatusIcon size={13} strokeWidth={2.2} className={isSelected ? 'text-white' : 'text-slate-400'} aria-hidden="true" />;
                                })()}
                                <span>{estado} ({count})</span>
                            </button>
                        );
                    })}
                </div>
                );
            })()}

            {solicitudes.length === 0 ? (
                <Text className="text-center mt-8">No hay solicitudes de recursos todavía.</Text>
            ) : solicitudesFiltradas.length === 0 ? (
                <Text className="text-center mt-8">No hay solicitudes en este estado.</Text>
            ) : (
                solicitudesFiltradas.map(solicitud => (
                    <Card key={solicitud.id} className="relative rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm ring-1 ring-slate-200/80 focus-within:z-20">
                        <Flex alignItems="start" className="border-none">
                            <div className="w-full">
                                <Flex justifyContent='start' alignItems='center' className='gap-2 mb-2'>
                                    <Briefcase size={14} className='text-slate-500' />
                                    <Title>{`TrackSIM - ${solicitud.esMAF ? 'MAF' : 'CECAI'}`}</Title>
                                </Flex>
                                <Flex justifyContent='start' alignItems='center' className='gap-2'>
                                    <User size={14} className='text-slate-500' />
                                    <Text>{solicitud.consultor}</Text>
                                </Flex>
                                <Flex justifyContent='start' alignItems='center' className='gap-2 mt-1'>
                                    <Calendar size={14} className='text-slate-500' />
                                    <Text>{solicitud.fechaInicio} al {solicitud.fechaFin} ({solicitud.dias} días)</Text>
                                </Flex>
                            </div>
                            <div className="flex flex-col items-start w-auto shrink-0">
                                {solicitud.url_pdf_solicitud && (
                                    <button
                                        onClick={() => setSolicitudOpciones(solicitud)}
                                        className="flex items-center gap-1 p-2 text-slate-500 hover:text-blue-600 transition-colors"
                                        title="Opciones de la solicitud"
                                    >
                                        <FileText size={12} />
                                        <span className="text-xs font-bold">Solicitud</span>
                                    </button>
                                )}
                                {solicitud.url_reporte_gastos && (
                                    <button
                                        onClick={() => setReporteOpciones(solicitud)}
                                        className="flex items-center gap-1 p-2 text-slate-500 hover:text-emerald-600 transition-colors"
                                        title="Opciones del reporte"
                                    >
                                        <FileDown size={12} />
                                        <span className="text-xs font-bold">Reporte</span>
                                    </button>
                                )}
                                {!esVistaAdmin && (
                                    <button
                                        onClick={() => eliminarSolicitud(solicitud.id)}
                                            disabled={estadosNoEliminables.has(solicitud.estado)}
                                        className={`flex items-center gap-1 p-2 transition-colors ${
                                                estadosNoEliminables.has(solicitud.estado)
                                                ? 'text-slate-300 cursor-not-allowed'
                                                : 'text-slate-500 hover:text-red-600'
                                        }`}
                                        title={
                                                estadosNoEliminables.has(solicitud.estado)
                                                    ? `No se puede eliminar una solicitud ${solicitud.estado}`
                                                : 'Eliminar solicitud'
                                        }
                                    >
                                            <Trash2 size={12} />
                                            <span className="text-xs font-bold">{estadosNoEliminables.has(solicitud.estado) ? 'No disponible' : 'Eliminar'}
                                            </span>
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
                                            {statusColors[solicitud.estado]?.icon && (() => {
                                                const StatusIcon = statusColors[solicitud.estado].icon;
                                                return <StatusIcon size={14} strokeWidth={2.2} className="mr-1.5 opacity-80" aria-hidden="true" />;
                                            })()}
                                            {solicitud.estado || 'Solicitada'}
                                        </div>
                                    ) : (
                                        <Menu as="div" className="relative inline-block text-left">
                                            <Menu.Button className={`inline-flex items-center justify-center w-full rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors ${statusColors[solicitud.estado]?.badge || 'bg-gray-100 text-gray-800'}`}>
                                                {statusColors[solicitud.estado]?.icon && (() => {
                                                    const StatusIcon = statusColors[solicitud.estado].icon;
                                                    return <StatusIcon size={14} strokeWidth={2.2} className="mr-1.5 opacity-80" aria-hidden="true" />;
                                                })()}
                                                {solicitud.estado || 'Solicitada'}
                                                <ChevronDown className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
                                            </Menu.Button>

                                            <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                                                <Menu.Items className="absolute left-0 z-10 mt-2 w-56 origin-top-left rounded-md bg-white shadow-lg focus:outline-none">
                                                    <div className="py-1">
                                                        {Object.keys(statusColors).map((estado) => (
                                                            <Menu.Item key={estado}>
                                                                {({ active }) => (
                                                                        <button onClick={() => handleStatusChange(solicitud, estado)} className={`${active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}>
                                                                        {(() => {
                                                                            const StatusIcon = statusColors[estado].icon;
                                                                            return <StatusIcon size={14} strokeWidth={2} className="mr-3 text-slate-400" aria-hidden="true" />;
                                                                        })()}
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
                    className="fixed inset-0 z-99999 flex flex-col bg-slate-950 text-white"
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