import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ListaGastos from '../ListaGastos';

// Mock de dependencias externas
vi.mock('../AuthContext', () => ({
    useAuth: () => ({
        user: { uid: 'test-user-id', email: 'test@test.com', displayName: 'Test User' }
    }),
}));

const mockGastos = [
    { id: 'g1', concepto: 'Comida de mediodía', monto: 250, fecha: '2026-04-15', categoria: 'Comida', url_factura: 'http://factura.url/1', archivado: false, creado_en: { toDate: () => new Date() } },
    { id: 'g2', concepto: 'Gasolina para viaje', monto: 800, fecha: '2026-04-16', categoria: 'Transporte', url_factura: '', archivado: false, creado_en: { toDate: () => new Date() } },
    { id: 'g3', concepto: 'Gasto especial MAF', monto: 1200, fecha: '2026-04-17', categoria: 'MAF', url_factura: 'http://factura.url/3', archivado: false, creado_en: { toDate: () => new Date() } },
    { id: 'g4', concepto: 'Gasto archivado', monto: 100, fecha: '2026-04-10', categoria: 'Otros', url_factura: '', archivado: true, creado_en: { toDate: () => new Date() } },
];

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        onSnapshot: vi.fn((_query, callback) => {
            const snapshot = {
                docs: mockGastos.map(doc => ({
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
        deleteDoc: vi.fn(),
        updateDoc: vi.fn(),
        getDoc: vi.fn(),
    };
});

// Mock del modal de opciones de reporte
vi.mock('../ReporteOpcionesModal', () => ({
    __esModule: true,
    default: ({ onClose }) => (
        <div data-testid="reporte-opciones-modal">
            <h2>Mock Reporte Opciones</h2>
            <button onClick={onClose}>Cerrar</button>
        </div>
    ),
}));

describe('ListaGastos Component', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        window.confirm = vi.fn(() => true); // Mockear confirm para que no bloquee
    });

    it('debería renderizar los gastos agrupados correctamente', async () => {
        render(<ListaGastos />);

        // Esperar a que los datos se carguen
        expect(await screen.findByText('Comida de mediodía')).toBeInTheDocument();

        // Verificar agrupaciones
        expect(screen.getByText('Con Factura')).toBeInTheDocument();
        expect(screen.getByText('Sin Factura')).toBeInTheDocument();
        expect(screen.getByText('Gastos MAF')).toBeInTheDocument();

        // Verificar totales de forma más específica para evitar duplicados
        const totalPeriodoCard = screen.getByText('Total Periodo').closest('div.tremor-Card-root');
        const totalMAFCard = screen.getByText('Total MAF').closest('div.tremor-Card-root');

        expect(within(totalPeriodoCard).getByText('$1,050.00')).toBeInTheDocument(); // Total Periodo (250 + 800)
        expect(within(totalMAFCard).getByText('$1,200.00')).toBeInTheDocument(); // Total MAF
    });

    it('debería filtrar gastos por término de búsqueda', async () => {
        render(<ListaGastos />);
        
        const searchInput = screen.getByPlaceholderText('Buscar por concepto...');
        fireEvent.change(searchInput, { target: { value: 'Gasolina' } });

        // Esperar a que el DOM se actualice
        await waitFor(() => {
            expect(screen.queryByText('Comida de mediodía')).not.toBeInTheDocument();
            expect(screen.getByText('Gasolina para viaje')).toBeInTheDocument();
        });
    });

    it('debería mostrar gastos archivados al activar el toggle', async () => {
        render(<ListaGastos />);

        // Inicialmente el gasto archivado no debe estar visible
        expect(screen.queryByText('Gasto archivado')).not.toBeInTheDocument();

        const toggleArchivados = screen.getByTitle('Mostrar archivados');
        fireEvent.click(toggleArchivados);

        // Ahora debería estar visible
        expect(await screen.findByText('Gasto archivado')).toBeInTheDocument();
    });

    it('debería abrir el modal de opciones de reporte al hacer clic en el botón', async () => {
        render(<ListaGastos />);

        const botonReporte = screen.getByRole('button', { name: /Generar Reporte/i });
        fireEvent.click(botonReporte);

        expect(await screen.findByTestId('reporte-opciones-modal')).toBeInTheDocument();
    });
});