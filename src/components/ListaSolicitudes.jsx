import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Card, Title, Text, Flex, Badge } from "@tremor/react";
import { FileText, Calendar, User, Briefcase, Trash2 } from 'lucide-react';

const formatoMoneda = (cantidad) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(cantidad);
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
                        <Flex alignItems="start">
                            <div className="truncate">
                                <Flex alignItems='center' className='gap-2 mb-2'>
                                    <Briefcase size={14} className='text-slate-500'/>
                                    <Title>{solicitud.proyecto}</Title>
                                </Flex>
                                <Flex alignItems='center' className='gap-2'>
                                    <User size={14} className='text-slate-500'/>
                                    <Text>{solicitud.consultor}</Text>
                                </Flex>
                                <Flex alignItems='center' className='gap-2 mt-1'>
                                    <Calendar size={14} className='text-slate-500'/>
                                    <Text>{solicitud.fechaInicio} al {solicitud.fechaFin} ({solicitud.dias} días)</Text>
                                </Flex>
                            </div>
                            <div className="flex flex-col items-end">
                                <a href={solicitud.url_pdf_solicitud} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-blue-600" title="Ver PDF de la solicitud">
                                    <FileText size={20} />
                                </a>
                                <button onClick={() => eliminarSolicitud(solicitud.id)} className="p-2 text-slate-400 hover:text-red-600" title="Eliminar solicitud">
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </Flex>
                        <Flex className="mt-4 pt-4 border-t border-slate-200">
                            <Text className="font-bold">Total Solicitado</Text>
                            <Badge color="blue" size="lg">{formatoMoneda(solicitud.totalSolicitado)}</Badge>
                        </Flex>
                    </Card>
                ))
            )}
        </div>
    );
};

export default ListaSolicitudes;