/* globals global */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SolicitudRecursosModal from '../SolicitudRecursosModal';

// Mock de dependencias externas
vi.mock('../AuthContext', () => ({
    useAuth: () => ({
        user: { uid: 'test-user-id', email: 'test@test.com', displayName: 'Usuario de Prueba' }
    }),
}));

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        addDoc: vi.fn().mockResolvedValue({ id: 'new-sol-id' }),
        collection: vi.fn(() => ({})), // Devolver un objeto dummy para simular la referencia
        Timestamp: { now: () => new Date() },
    };
});

vi.mock('pdf-lib', () => ({
    PDFDocument: {
        create: vi.fn().mockResolvedValue({
            addPage: vi.fn(() => ({
                getSize: () => ({ width: 500, height: 800 }),
                drawText: vi.fn(),
                drawImage: vi.fn(),
                drawLine: vi.fn(),
            })),
            embedFont: vi.fn().mockResolvedValue({ widthOfTextAtSize: () => 100 }),
            embedPng: vi.fn().mockResolvedValue({ scale: () => ({ width: 50, height: 50 }) }),
            save: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
        }),
    },
    StandardFonts: { Helvetica: 'Helvetica', HelveticaBold: 'Helvetica-Bold' },
    rgb: vi.fn(),
}));

vi.mock('file-saver', () => ({
    saveAs: vi.fn(),
}));

// Mock de la API fetch para Cloudinary y el logo
global.fetch = vi.fn((url) => {
    if (url.includes('cloudinary')) {
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                secure_url: 'http://fake.cloudinary.url/solicitud.pdf',
                delete_token: 'fake-delete-token',
                nombreArchivo: 'solicitud.pdf',
            }),
        });
    }
    // Mock para el logo
    return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
});

describe('SolicitudRecursosModal Component', () => {
    const mockOnClose = vi.fn();
    const mockOnSolicitudCreada = vi.fn();
    let mockAddDoc;

    beforeEach(async () => {
        vi.clearAllMocks();
        window.alert = vi.fn();
        const firestore = await import('firebase/firestore');
        mockAddDoc = firestore.addDoc;
    });

    it('debería renderizar el modal y calcular los montos al cambiar las fechas', async () => {
        render(<SolicitudRecursosModal onClose={mockOnClose} />);

        expect(screen.getByText('Solicitud de Recursos')).toBeInTheDocument();

        const fechaInicioInput = screen.getByLabelText('Fecha de Inicio');
        const fechaFinInput = screen.getByLabelText('Fecha de Finalización');

        fireEvent.change(fechaInicioInput, { target: { value: '2026-05-10' } });
        fireEvent.change(fechaFinInput, { target: { value: '2026-05-11' } });

        // Esperar a que el resumen aparezca
        expect(await screen.findByText('Resumen de Solicitud (2 días)')).toBeInTheDocument();
        expect(screen.getByText('$1,400.00')).toBeInTheDocument(); // Transporte
        expect(screen.getByText('$1,200.00')).toBeInTheDocument(); // Comida
        expect(screen.getByText('$2,600.00')).toBeInTheDocument(); // Total
    });

    it('debería mostrar un error si la fecha de fin es anterior a la de inicio', async () => {
        render(<SolicitudRecursosModal onClose={mockOnClose} />);

        fireEvent.change(screen.getByLabelText('Fecha de Inicio'), { target: { value: '2026-05-12' } });
        fireEvent.change(screen.getByLabelText('Fecha de Finalización'), { target: { value: '2026-05-11' } });

        expect(await screen.findByText('La fecha de finalización no puede ser anterior a la fecha de inicio.')).toBeInTheDocument();
    });

    it('debería llamar a addDoc y a las funciones de subida al generar la solicitud', async () => {
        render(<SolicitudRecursosModal onClose={mockOnClose} onSolicitudCreada={mockOnSolicitudCreada} />);

        fireEvent.change(screen.getByLabelText('Fecha de Inicio'), { target: { value: '2026-05-10' } });
        fireEvent.change(screen.getByLabelText('Fecha de Finalización'), { target: { value: '2026-05-10' } });

        const botonGenerar = await screen.findByRole('button', { name: /Generar y Guardar Solicitud/i });
        fireEvent.click(botonGenerar);

        await waitFor(() => {
            expect(mockAddDoc).toHaveBeenCalledTimes(1);
            expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
                totalSolicitado: 1300,
                userId: 'test-user-id',
            }));
            expect(mockOnSolicitudCreada).toHaveBeenCalledTimes(1);
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });
    });
});