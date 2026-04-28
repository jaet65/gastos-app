import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Card, Text, Title, Flex, Badge } from "@tremor/react";
import { User, Mail, Calendar, ChevronRight } from 'lucide-react';

const ListaUsuarios = ({ onSelectUser }) => {
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "users"), orderBy("creado_en", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsuarios(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <Text className="text-center mt-8">Cargando lista de usuarios...</Text>;

    return (
        <div className="space-y-4">
            <div className="mb-6">
                <Title className="text-slate-800">Administración de Usuarios</Title>
                <Text className="text-slate-500 text-sm">Selecciona un usuario para ver sus registros en modo lectura.</Text>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {usuarios.map((u) => (
                    <Card
                        key={u.uid}
                        className="p-4 hover:bg-blue-50 cursor-pointer transition-all border border-slate-200 group"
                        onClick={() => onSelectUser(u)}
                    >
                        <Flex alignItems="center" justifyContent="between">
                            <Flex className="gap-4">
                                <div className="bg-blue-100 p-3 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <User size={20} />
                                </div>
                                <div>
                                    <Title className="text-sm font-bold text-slate-800">{u.displayName}</Title>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Mail size={12} className="text-slate-400" />
                                        <Text className="text-xs text-slate-500">{u.email}</Text>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <Calendar size={12} className="text-slate-400" />
                                        <Text className="text-[10px] text-slate-400">Registrado: {new Date(u.creado_en).toLocaleDateString()}</Text>
                                    </div>
                                </div>
                            </Flex>
                            <Flex className="w-auto gap-3">
                                {u.role === 'admin' && (
                                    <span className="text-amber-600 text-[10px] font-black uppercase">Admin</span>
                                )}
                                <ChevronRight className="text-slate-300 group-hover:text-blue-500" size={20} />
                            </Flex>
                        </Flex>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default ListaUsuarios;
