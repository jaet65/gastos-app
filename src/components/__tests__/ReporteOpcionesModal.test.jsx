import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReporteOpcionesModal from '../ReporteOpcionesModal';
import { useAuth } from '../AuthContext';

// Mock del módulo de Firestore
vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal();
    const mockSolicitudes = [
        { id: 'sol1', proyecto: 'Proyecto Alpha', consultor: 'Juan Perez', totalSolicitado: 1500, fechaInicio: '2026-04-01', fechaFin: '2026-04-10' },
        { id: 'sol2', proyecto: 'Proyecto Beta', consultor: 'Maria Lopez', totalSolicitado: 2500, fechaInicio: '2026-03-15', fechaFin: '2026-03-20' },
    ];

    return {
        ...actual,
        onSnapshot: vi.fn((_query, callback) => {
            const snapshot = {
                docs: mockSolicitudes.map(doc => ({
                    id: doc.id,
                    data: () => doc,
                })),
            };
            // Simula la llamada asíncrona de onSnapshot
            setTimeout(() => callback(snapshot), 0);
            // Devuelve una función `unsubscribe` para simular el comportamiento real
            return () => {};
        }),
        collection: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        orderBy: vi.fn(),
    };
});

// Mock del hook de autenticación
vi.mock('../AuthContext', () => ({
    useAuth: vi.fn(),
}));

describe('ReporteOpcionesModal Component', () => {
    const mockOnClose = vi.fn();
    const mockOnGenerarConFechas = vi.fn();
    const mockOnGenerarConSolicitud = vi.fn();
    const mockOnGenerarReporteMAF = vi.fn();

    beforeEach(() => {
        // Limpiamos todos los mocks antes de cada prueba
        vi.clearAllMocks();

        // Configuramos el mock de useAuth para que devuelva un usuario
        useAuth.mockReturnValue({
            user: { uid: 'test-user-id' },
        });
    });

    // Portal necesita un elemento en el body para renderizar
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('debería renderizar la vista inicial con las opciones de reporte', () => {
        render(<ReporteOpcionesModal onClose={mockOnClose} />);

        expect(screen.getByText('Generar Reporte de Gastos')).toBeInTheDocument();
        expect(screen.getByText('Vincular a Solicitud')).toBeInTheDocument();
        expect(screen.getByText('Usar Fechas de Filtros')).toBeInTheDocument();
        expect(screen.getByText('Reporte MAF')).toBeInTheDocument();
    });

    it('debería llamar a onGenerarConFechasPersonalizadas al hacer clic en la opción de filtros', () => {
        render(
            <ReporteOpcionesModal
                onClose={mockOnClose}
                onGenerarConFechasPersonalizadas={mockOnGenerarConFechas}
            />
        );

        const botonFechas = screen.getByText('Usar Fechas de Filtros').closest('button');
        fireEvent.click(botonFechas);

        expect(mockOnGenerarConFechas).toHaveBeenCalledTimes(1);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('debería cambiar a la vista de seleccionar solicitud y mostrar las solicitudes', async () => {
        render(<ReporteOpcionesModal onClose={mockOnClose} />);

        const botonVincular = screen.getByText('Vincular a Solicitud').closest('button');
        fireEvent.click(botonVincular);

        // Esperamos a que aparezca el título de la nueva vista
        expect(await screen.findByText('Selecciona una solicitud')).toBeInTheDocument();

        // Verificamos que las solicitudes mockeadas se rendericen
        expect(await screen.findByText('Proyecto Alpha')).toBeInTheDocument();
        expect(screen.getByText('Monto: $1,500.00')).toBeInTheDocument();
        expect(await screen.findByText('Proyecto Beta')).toBeInTheDocument();
        expect(screen.getByText('Monto: $2,500.00')).toBeInTheDocument();
    });

    it('debería llamar a onGenerarConSolicitud al seleccionar una solicitud', async () => {
        render(
            <ReporteOpcionesModal
                onClose={mockOnClose}
                onGenerarConSolicitud={mockOnGenerarConSolicitud}
            />
        );

        // Navegamos a la vista de selección
        fireEvent.click(screen.getByText('Vincular a Solicitud').closest('button'));

        // Esperamos que se cargue y seleccionamos la primera solicitud
        const solicitudElement = await screen.findByText('Proyecto Alpha');
        fireEvent.click(solicitudElement.closest('div'));

        // Verificamos que las funciones correctas fueron llamadas con los datos esperados
        expect(mockOnGenerarConSolicitud).toHaveBeenCalledTimes(1);
        expect(mockOnGenerarConSolicitud).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'sol1', proyecto: 'Proyecto Alpha' })
        );
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('debería generar un reporte MAF con el monto ingresado', async () => {
        render(
            <ReporteOpcionesModal
                onClose={mockOnClose}
                onGenerarReporteMAF={mockOnGenerarReporteMAF}
            />
        );

        // Navegamos a la vista de reporte MAF
        fireEvent.click(screen.getByText('Reporte MAF').closest('button'));

        // Esperamos a que aparezca el input
        const inputMonto = await screen.findByLabelText('Importe Recibido');
        const botonGenerar = screen.getByText('Generar Reporte MAF');

        // Simulamos la entrada del usuario
        fireEvent.change(inputMonto, { target: { value: '550.75' } });

        // Enviamos el formulario
        fireEvent.click(botonGenerar);

        // Verificamos que las funciones correctas fueron llamadas
        expect(mockOnGenerarReporteMAF).toHaveBeenCalledTimes(1);
        expect(mockOnGenerarReporteMAF).toHaveBeenCalledWith(550.75);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
});