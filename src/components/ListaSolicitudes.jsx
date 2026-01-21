import { useEffect, useState, Fragment } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Card, Title, Text, Flex, Badge } from "@tremor/react";
import { Menu, Transition } from '@headlessui/react';
import { FileText, Calendar, User, Briefcase, Trash2, FileDown, Check, ChevronDown } from 'lucide-react';

const formatoMoneda = (cantidad) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(cantidad);
};

const statusColors = {
    'Enviada': { badge: 'bg-yellow-500 text-white', dot: 'bg-yellow-500', tremor: 'warning' },
    'Recibida': { badge: 'bg-blue-500 text-white', dot: 'bg-blue-500', tremor: 'info' },
    'Finalizada': { badge: 'bg-green-500 text-white', dot: 'bg-green-500', tremor: 'success' },
};

const ListaSolicitudes = () => {
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(true);

    const eliminarSolicitud = async (id) => {
        if (window.confirm("¿Estás seguro de que quieres eliminar esta solicitud? Esta acción no se puede deshacer.")) {
            try {
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
        const q = query(collection(db, "solicitudes"), orderBy("fechaInicio", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setSolicitudes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) {
        return <Text className="text-center mt-8">Cargando solicitudes...</Text>;
    }

    return (
        <div className="space-y-4">
            {solicitudes.length === 0 ? (
                <Text className="text-center mt-8">No hay solicitudes de recursos todavía.</Text>
            ) : (
                solicitudes.map(solicitud => (
                    <Card key={solicitud.id}>
                        <Flex alignItems="start" className="border-none">
                            <div className="truncate">
                                <Flex alignItems='center' className='gap-2 mb-2'>
                                    <Briefcase size={14} className='text-slate-500'/>
                                    <Title>{solicitud.proyecto}</Title>
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
                                <a href={solicitud.url_pdf_solicitud} target="_blank" rel="noreferrer" className="flex items-center gap-1 p-2 text-slate-500 hover:text-blue-600 transition-colors" title="Ver PDF de la solicitud">
                                    <FileText size={16} />
                                    <span className="text-xs font-bold">Solicitud</span>
                                </a>
                                {solicitud.url_reporte_gastos && (
                                    <a href={solicitud.url_reporte_gastos} target="_blank" rel="noreferrer" className="flex items-center gap-1 p-2 text-slate-500 hover:text-emerald-600 transition-colors" title="Ver Reporte de Gastos Final">
                                        <FileDown size={16} />
                                        <span className="text-xs font-bold">Reporte</span>
                                    </a>
                                )}
                                <button onClick={() => eliminarSolicitud(solicitud.id)} className="flex items-center gap-1 p-2 text-slate-500 hover:text-red-600 transition-colors" title="Eliminar solicitud">
                                    <Trash2 size={16} />
                                    <span className="text-xs font-bold">Eliminar</span>
                                </button>
                            </div>
                        </Flex>
                        <Flex className="mt-4 pt-4 border-t border-slate-200">
                            <div className="w-1/2">
                                <Text className="font-bold text-xs text-slate-500 uppercase mb-2">Estado</Text>
                                {/* Selector de Estado Personalizado con Headless UI */}
                                <div className="relative w-fit">
                                    <Menu as="div" className="relative inline-block text-left">
                                        <Menu.Button className={`inline-flex items-center justify-center w-full rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors ${statusColors[solicitud.estado]?.badge || 'bg-gray-100 text-gray-800'}`}>
                                            {solicitud.estado || 'Enviada'}
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
                                </div>
                            </div>
                            <div className="text-right">
                                <Text className="font-bold text-xs text-slate-500 uppercase mb-1">Total Solicitado</Text>
                                <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusColors[solicitud.estado]?.badge || 'bg-gray-100 text-gray-800'}`}>
                                    {formatoMoneda(solicitud.totalSolicitado)}
                                </span>
                            </div>
                        </Flex>
                    </Card>
                ))
            )}
        </div>
    );
};

export default ListaSolicitudes;