import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ListaUsuarios from '../ListaUsuarios';

// Mock del módulo de Firestore para controlar los datos que recibe el componente
vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal();
    const mockUsuarios = [
        { uid: 'user1', displayName: 'Admin User', email: 'admin@test.com', creado_en: new Date().toISOString(), role: 'admin' },
        { uid: 'user2', displayName: 'Normal User', email: 'user@test.com', creado_en: new Date().toISOString(), role: 'user' },
    ];

    return {
        ...actual,
        onSnapshot: vi.fn((_query, callback) => {
            const snapshot = {
                docs: mockUsuarios.map(doc => ({
                    id: doc.uid,
                    data: () => doc,
                })),
            };
            // Simula la llamada asíncrona de onSnapshot
            setTimeout(() => callback(snapshot), 0);
            return () => {}; // Devuelve una función `unsubscribe` vacía
        }),
        collection: vi.fn(),
        query: vi.fn(),
        orderBy: vi.fn(),
    };
});

describe('ListaUsuarios Component', () => {
    const mockOnSelectUser = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('debería mostrar el estado de carga inicialmente', () => {
        render(<ListaUsuarios onSelectUser={mockOnSelectUser} />);
        expect(screen.getByText('Cargando lista de usuarios...')).toBeInTheDocument();
    });

    it('debería renderizar la lista de usuarios después de cargarlos', async () => {
        render(<ListaUsuarios onSelectUser={mockOnSelectUser} />);

        // Esperamos a que los usuarios aparezcan en el DOM
        expect(await screen.findByText('Admin User')).toBeInTheDocument();
        expect(screen.getByText('admin@test.com')).toBeInTheDocument();
        expect(screen.getByText('Normal User')).toBeInTheDocument();
        expect(screen.getByText('user@test.com')).toBeInTheDocument();
    });

    it('debería llamar a onSelectUser con los datos correctos al hacer clic en un usuario', async () => {
        render(<ListaUsuarios onSelectUser={mockOnSelectUser} />);

        // Esperamos y luego hacemos clic en el primer usuario
        const userCard = await screen.findByText('Admin User');
        fireEvent.click(userCard.closest('.p-4'));

        expect(mockOnSelectUser).toHaveBeenCalledTimes(1);
        expect(mockOnSelectUser).toHaveBeenCalledWith(expect.objectContaining({ uid: 'user1', displayName: 'Admin User' }));
    });
});