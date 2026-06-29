import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { Card, Title, Text, Flex, Button, Subtitle } from "@tremor/react";
import { PlusCircle, Trash2, MapPin, Edit, XCircle, Calendar } from 'lucide-react';
import PanelAuditoria from './PanelAuditoria';

const InputGroup = ({ icon: Icon, children }) => (
    <div className="flex items-center bg-white/50 transition-all overflow-hidden h-14 hover:bg-white/80 focus-within:bg-white backdrop-blur-md border border-slate-200 rounded-full shadow-sm">
        <div className="pl-5 text-slate-400">
            <Icon size={16} strokeWidth={2.5} />
        </div>
        <div className="flex-1 h-full flex items-center pr-5">{children}</div>
    </div>
);

const AuditoriaView = () => {
    const [allGastos, setAllGastos] = useState([]);
    const [audits, setAudits] = useState([]);
    const [loading, setLoading] = useState(true);

    const [newCity, setNewCity] = useState('');
    const [newStartDate, setNewStartDate] = useState(null);
    const [newEndDate, setNewEndDate] = useState(null);
    const [editingId, setEditingId] = useState(null);

    const dateToInputValue = (date) => {
        if (!date) return '';
        return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    };

    useEffect(() => {
        const q = query(collection(db, "gastos"), orderBy("fecha", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllGastos(data);
            if(loading) setLoading(false);
        }, (error) => {
            console.error("Error fetching gastos:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [loading]);

    useEffect(() => {
        const q = query(collection(db, "auditorias"), orderBy("creado_en", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAudits(data);
            if(loading) setLoading(false);
        }, (error) => {
            console.error("Error fetching auditorias:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [loading]);

    const resetForm = () => {
        setNewCity('');
        setNewStartDate(null);
        setNewEndDate(null);
        setEditingId(null);
    };
    
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!newCity || !newStartDate || !newEndDate) {
            alert("Por favor, completa todos los campos.");
            return;
        }
        
        const formattedStartDate = dateToInputValue(newStartDate);
        const formattedEndDate = dateToInputValue(newEndDate);
        
        const auditData = {
            city: newCity,
            startDate: formattedStartDate,
            endDate: formattedEndDate,
        };

        try {
            if (editingId) {
                const docRef = doc(db, "auditorias", editingId);
                await updateDoc(docRef, auditData);
            } else {
                await addDoc(collection(db, "auditorias"), { ...auditData, creado_en: Timestamp.now() });
            }
            resetForm();
        } catch (error) {
            console.error("Error saving audit:", error);
            alert("Error al guardar la auditoría: " + error.message);
        }
    };

    const handleEdit = (audit) => {
        setEditingId(audit.id);
        setNewCity(audit.city);
        setNewStartDate(new Date(audit.startDate + 'T00:00:00'));
        setNewEndDate(new Date(audit.endDate + 'T00:00:00'));
    };

    const handleRemoveAudit = async (id) => {
        if (confirm("¿Estás seguro de que quieres eliminar este periodo de auditoría?")) {
            try {
                await deleteDoc(doc(db, "auditorias", id));
            } catch (error) {
                console.error("Error removing audit:", error);
                alert("Error al eliminar la auditoría: " + error.message);
            }
        }
    };

    if (loading) return <Text className="text-center mt-8">Cargando datos de auditoría...</Text>;

    return (
        <div className="space-y-6">
            <header>
                <Title className="text-slate-800">Auditoría General de Gastos</Title>
                <Text className="text-slate-500 text-sm mt-1">Define periodos de estancia en ciudades para auditar los gastos correspondientes.</Text>
            </header>

            <Card>
                <form onSubmit={handleFormSubmit}>
                    <Subtitle className="mb-4">{editingId ? 'Editando Periodo' : 'Añadir Nuevo Periodo'}</Subtitle>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <InputGroup icon={MapPin}>
                            <input
                                type="text"
                                placeholder="Ej. Guadalajara"
                                value={newCity}
                                onChange={(e) => setNewCity(e.target.value)}
                                className="w-full h-full pl-2 bg-transparent border-none outline-none text-slate-900 font-bold text-base placeholder-slate-400"
                            />
                        </InputGroup>
                        <InputGroup icon={Calendar}>
                            <input
                                type="date"
                                value={dateToInputValue(newStartDate)}
                                onChange={(e) => setNewStartDate(e.target.value ? new Date(e.target.value + 'T00:00:00') : null)}
                                className="w-full h-full pl-2 bg-transparent border-none outline-none text-slate-700 font-bold text-base"
                            />
                        </InputGroup>
                        <InputGroup icon={Calendar}>
                             <input
                                type="date"
                                value={dateToInputValue(newEndDate)}
                                onChange={(e) => setNewEndDate(e.target.value ? new Date(e.target.value + 'T00:00:00') : null)}
                                className="w-full h-full pl-2 bg-transparent border-none outline-none text-slate-700 font-bold text-base"
                            />
                        </InputGroup>
                    </div>
                    <Flex justifyContent="end" className="gap-2 mt-6 pt-4 border-t border-slate-200">
                         {editingId && (
                            <Button onClick={resetForm} icon={XCircle} size="sm" color="gray" variant="light">Cancelar</Button>
                        )}
                        <Button type="submit" icon={editingId ? Edit : PlusCircle} size="sm" color="blue">
                            {editingId ? 'Guardar Cambios' : 'Añadir Periodo'}
                        </Button>
                    </Flex>
                </form>
            </Card>

            {audits.length > 0 && (
                <div>
                    <Title className="mb-3 text-left">Periodos definidos</Title>
                    <div className="space-y-3">
                        {audits.map(audit => (
                            <Card key={audit.id} className="p-3 group">
                                <Flex alignItems="center" justifyContent="between">
                                    <div className="flex items-center gap-4 truncate">
                                        <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                                            <MapPin size={16} />
                                        </div>
                                        <div>
                                            <Text className="font-bold text-slate-800 truncate">{audit.city}</Text>
                                            <div className="flex items-center gap-1.5">
                                                <Calendar size={12} className="text-slate-400" />
                                                <Text className="text-xs text-slate-500">{audit.startDate} al {audit.endDate}</Text>
                                            </div>
                                        </div>
                                    </div>
                                    <Flex justifyContent="end" className="gap-1 w-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        <Button onClick={() => handleEdit(audit)} icon={Edit} size="xs" variant="light" color="blue" />
                                        <Button onClick={() => handleRemoveAudit(audit.id)} icon={Trash2} size="xs" variant="light" color="red" />
                                    </Flex>
                                </Flex>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
            
            <PanelAuditoria allGastos={allGastos} audits={audits} />

        </div>
    );
};

export default AuditoriaView;
