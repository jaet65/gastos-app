import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ListaUsuarios from '../ListaUsuarios';
import { AuthProvider } from '../AuthContext'; // Import the real AuthProvider
import * as FirebaseAuth from 'firebase/auth'; // Import Firebase Auth module

// Mock del módulo de Firestore para controlar los datos que recibe el componente
vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal();
    const mockUsuarios = [
        { uid: 'test-user-id-1', displayName: 'Admin User', email: 'admin@test.com', creado_en: new Date().toISOString(), role: 'admin' },
        { uid: 'test-user-id-2', displayName: 'Normal User', email: 'user@test.com', creado_en: new Date().toISOString(), role: 'user' },
    ];

    const mockUserSnap = {
        exists: () => true,
        data: () => ({
            uid: 'test-user-id',
            email: 'test@corporativomaf.com',
            displayName: 'Test User',
            role: 'admin', // Make the test user an admin for full access
            creado_en: new Date().toISOString()
        })
    };

    return {
        ...actual,
        getFirestore: vi.fn(),
        onSnapshot: vi.fn((_query, callback) => {
            const snapshot = {
                docs: mockUsuarios.map(doc => ({
                    id: doc.uid,
                    data: () => doc,
                })),
            };
            // Simula la llamada asíncrona de onSnapshot
            setTimeout(() => callback(snapshot), 0);
            return () => { }; // Devuelve una función `unsubscribe` vacía
        }),
        collection: vi.fn(() => ({})), // Return a dummy object
        query: vi.fn(() => ({})), // Return a dummy object
        orderBy: vi.fn(() => ({})), // Return a dummy object
        doc: vi.fn(() => ({})), // Return a dummy object for the doc ref
        getDoc: vi.fn(async () => mockUserSnap), // Return the mock snapshot
        setDoc: vi.fn(async () => {}), // Mock setDoc
    };
});

// Mock firebase/auth functions
vi.mock('firebase/auth', () => ({
  ...vi.importActual('firebase/auth'), // Import and retain default exports
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn((auth, callback) => {
    // Immediately call callback with a mock user
    callback({ uid: 'test-user-id', email: 'test@corporativomaf.com', displayName: 'Test User' });
    return vi.fn(); // Return an unsubscribe function
  }),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(() => ({})),
}));

describe('ListaUsuarios Component', () => {
    const mockOnSelectUser = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('debería mostrar el estado de carga inicialmente', async () => {
        render(
            <AuthProvider>
                <ListaUsuarios onSelectUser={mockOnSelectUser} />
            </AuthProvider>
        );
        expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByText('Admin User')).toBeInTheDocument());
    });

    it('debería renderizar la lista de usuarios después de cargarlos', async () => {
        render(
            <AuthProvider>
                <ListaUsuarios onSelectUser={mockOnSelectUser} />
            </AuthProvider>
        );

        // Esperamos a que los usuarios aparezcan en el DOM, asegurando que el AuthProvider ha resuelto el usuario
        await waitFor(() => {
            expect(screen.getByText('Admin User')).toBeInTheDocument();
            expect(screen.getByText('admin@test.com')).toBeInTheDocument();
            expect(screen.getByText('Normal User')).toBeInTheDocument();
            expect(screen.getByText('user@test.com')).toBeInTheDocument();
        });
    });

    it('debería llamar a onSelectUser con los datos correctos al hacer clic en un usuario', async () => {
        render(
            <AuthProvider>
                <ListaUsuarios onSelectUser={mockOnSelectUser} />
            </AuthProvider>
        );

        // Esperamos y luego hacemos clic en el primer usuario
        const userCard = await screen.findByText('Admin User');
        fireEvent.click(userCard.closest('.user-card'));

        expect(mockOnSelectUser).toHaveBeenCalledTimes(1);
        expect(mockOnSelectUser).toHaveBeenCalledWith(expect.objectContaining({ uid: 'test-user-id-1', displayName: 'Admin User' }));
    });
});