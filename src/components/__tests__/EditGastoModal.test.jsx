/* globals global */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EditGastoModal from '../EditGastoModal';

// Mock de dependencias externas
vi.mock('../AuthContext', () => ({
    useAuth: () => ({
        user: { uid: 'test-user-id', email: 'test@test.com' }
    }),
}));

// Datos de prueba
const mockGastoTransporte = {
    id: 'gasto1',
    concepto: 'Viaje a Querétaro',
    monto: 1500,
    fecha: '2026-04-20',
    categoria: 'Transporte',
    url_factura: 'http://factura.url/viaje.pdf',
    deleteToken: 'token-viaje',
    userId: 'test-user-id',
};

const mockCasetas = [
    { id: 'caseta1', idPadre: 'gasto1', concepto: 'Caseta', monto: 180, fecha: '2026-04-20', categoria: 'Transporte', url_factura: '', deleteToken: '' },
];

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getDocs: vi.fn(),
        addDoc: vi.fn(),
        deleteDoc: vi.fn(),
        updateDoc: vi.fn(),
        collection: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        doc: vi.fn(),
        Timestamp: { now: () => new Date() },
    };
});

// Mock de la API fetch para simular Cloudinary
global.fetch = vi.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
            secure_url: 'http://new.fake.url/factura.pdf',
            delete_token: 'new-fake-delete-token',
        }),
    })
);

describe('EditGastoModal Component', () => {
    const mockOnClose = vi.fn();
    const mockOnSave = vi.fn();
    let mockGetDocs, mockDeleteDoc;

    beforeEach(async () => {
        vi.clearAllMocks();
        window.alert = vi.fn();
        window.confirm = vi.fn(() => true);

        // Importar dinámicamente para obtener las funciones mockeadas
        const firestore = await import('firebase/firestore');
        mockGetDocs = firestore.getDocs;
        mockDeleteDoc = firestore.deleteDoc;

        // Simular que getDocs devuelve las casetas
        mockGetDocs.mockResolvedValue({
            docs: mockCasetas.map(c => ({ id: c.id, data: () => c }))
        });
    });

    it('debería renderizar los datos del gasto y sus casetas vinculadas', async () => {
        render(<EditGastoModal gasto={mockGastoTransporte} onClose={mockOnClose} onSave={mockOnSave} />);

        // Verificar datos del gasto principal
        expect(screen.getByDisplayValue('Viaje a Querétaro')).toBeInTheDocument();
        expect(screen.getByDisplayValue('1500')).toBeInTheDocument();

        // Verificar que las casetas se cargan y se muestran
        expect(await screen.findByText('Casetas Vinculadas')).toBeInTheDocument();
        expect(await screen.findByDisplayValue('180')).toBeInTheDocument();
    });

    it('debería permitir agregar una nueva caseta', async () => {
        render(<EditGastoModal gasto={mockGastoTransporte} onClose={mockOnClose} onSave={mockOnSave} />);

        const botonAgregar = await screen.findByRole('button', { name: /Agregar/i });
        fireEvent.click(botonAgregar);

        // Buscar el nuevo input de monto (puede haber varios, tomamos el último)
        const nuevosInputs = await screen.findAllByPlaceholderText('Monto');
        const nuevoInputCaseta = nuevosInputs[nuevosInputs.length - 1];
        expect(nuevoInputCaseta).toBeInTheDocument();
        expect(nuevoInputCaseta).toHaveValue(null); // Es un input de tipo number
    });

    it('debería permitir eliminar una caseta existente', async () => {
        render(<EditGastoModal gasto={mockGastoTransporte} onClose={mockOnClose} onSave={mockOnSave} />);

        const inputCaseta = await screen.findByDisplayValue('180');
        const botonEliminar = inputCaseta.closest('.flex.items-center.gap-3').querySelector('button[type="button"]');
        fireEvent.click(botonEliminar);

        // El input de la caseta ya no debería estar en el DOM
        await waitFor(() => {
            expect(screen.queryByDisplayValue('180')).not.toBeInTheDocument();
        });
    });

    it('debería llamar a onSave y a las funciones de Firestore al guardar los cambios', async () => {
        render(<EditGastoModal gasto={mockGastoTransporte} onClose={mockOnClose} onSave={mockOnSave} />);

        // 1. Eliminar la caseta existente
        const inputCaseta = await screen.findByDisplayValue('180');
        const botonEliminar = inputCaseta.closest('.flex.items-center.gap-3').querySelector('button[type="button"]');
        fireEvent.click(botonEliminar);

        // 2. Guardar los cambios
        const botonGuardar = screen.getByRole('button', { name: /Guardar Cambios/i });
        fireEvent.click(botonGuardar);

        // 3. Verificar las llamadas
        await waitFor(() => {
            // Se debe llamar a deleteDoc para la caseta eliminada
            expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
            // Se debe llamar a onSave para el gasto principal
            expect(mockOnSave).toHaveBeenCalledTimes(1);
            expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'gasto1' }), false);
        });
    });
});