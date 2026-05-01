import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ListaSolicitudes from '../ListaSolicitudes';
import { useAuth } from '../AuthContext';

// Mock de dependencias externas
vi.mock('../AuthContext', () => ({
    useAuth: () => ({
        user: { uid: 'test-user-id', email: 'test@test.com', displayName: 'Test User' }
    }),
}));

const mockSolicitudes = [
    { id: 'sol1', proyecto: 'Rally TrackSIM - CECAI', consultor: 'Usuario de Prueba', fechaInicio: '2026-04-20', fechaFin: '2026-04-25', dias: 6, totalSolicitado: 7800, estado: 'Solicitada', url_pdf_solicitud: 'http://solicitud.url/1' },
    { id: 'sol2', proyecto: 'Rally TrackSIM - MAF', consultor: 'Usuario de Prueba', fechaInicio: '2026-05-01', fechaFin: '2026-05-05', dias: 5, totalSolicitado: 6500, estado: 'Recibida', esMAF: true, url_pdf_solicitud: 'http://solicitud.url/2' },
];

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        onSnapshot: vi.fn((_query, callback) => { // Mantener onSnapshot mockeado
            const snapshot = {
                docs: mockSolicitudes.map(doc => ({
                    id: doc.id,
                    data: () => doc,
                })),
            };
            setTimeout(() => callback(snapshot), 0);
            return () => {};
        }),
        collection: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        orderBy: vi.fn(),
        doc: vi.fn(),
        updateDoc: vi.fn(), // Definir el mock aquí
        deleteDoc: vi.fn(), // Definir el mock aquí
        getDoc: vi.fn().mockResolvedValue({ data: () => ({}) }), // Mock para getDoc en eliminar
    };
});

describe('ListaSolicitudes Component', () => {
    let mockUpdateDoc;
    let mockDeleteDoc;

    beforeEach(() => {
        vi.clearAllMocks();
        window.confirm = vi.fn(() => true);
        // Importar dinámicamente para obtener las funciones mockeadas
        return import('firebase/firestore').then((firestore) => {
            mockUpdateDoc = firestore.updateDoc;
            mockDeleteDoc = firestore.deleteDoc;
        });
    });

    it('debería renderizar la lista de solicitudes', async () => {
        render(<ListaSolicitudes />);

        expect(await screen.findByText('Rally TrackSIM - CECAI')).toBeInTheDocument();
        expect(screen.getByText('Rally TrackSIM - MAF')).toBeInTheDocument();
        expect(screen.getByText('$7,800.00')).toBeInTheDocument();
        expect(screen.getByText('$6,500.00')).toBeInTheDocument();
    });

    it('debería permitir cambiar el estado de una solicitud', async () => {
        render(<ListaSolicitudes />);

        // Abrir el menú de la primera solicitud
        const menuButton = (await screen.findAllByRole('button', { name: /Solicitada/i }))[0];
        fireEvent.click(menuButton);

        // Hacer clic en la opción "Recibida"
        const opcionRecibida = await screen.findByRole('menuitem', { name: /Recibida/i });
        fireEvent.click(opcionRecibida);

        await waitFor(() => {
            expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
            expect(mockUpdateDoc).toHaveBeenCalledWith(undefined, { estado: 'Recibida' });
        });
    });

    it('debería llamar a deleteDoc al hacer clic en eliminar', async () => {
        render(<ListaSolicitudes />);
        const deleteButton = (await screen.findAllByTitle('Eliminar solicitud'))[0];
        fireEvent.click(deleteButton);

        expect(window.confirm).toHaveBeenCalled();
        await waitFor(() => {
            expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
        });
    });
});