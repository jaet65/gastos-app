import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRef } from 'react';
import { deleteDoc, getDoc } from 'firebase/firestore';
import ListaGastos from '../ListaGastos';
import { filtrarGastosParaReporte, resolverGastosPorIds } from '../reportFilters';

// Mock de dependencias externas
vi.mock('../AuthContext', () => ({
    useAuth: () => ({
        user: { uid: 'test-user-id', email: 'test@test.com', displayName: 'Test User' }
    }),
}));

const mockGastos = [
    { id: 'g1', concepto: 'Comida de mediodía', monto: 250, fecha: '2026-04-15', categoria: 'Comida', url_factura: 'http://factura.url/1', deleteToken: 'invoice-token', archivado: false, creado_en: { toDate: () => new Date() } },
    { id: 'g2', concepto: 'Gasolina para viaje', monto: 800, fecha: '2026-04-16', categoria: 'Transporte', url_factura: '', archivado: false, creado_en: { toDate: () => new Date() } },
    { id: 'g3', concepto: 'Gasto especial MAF', monto: 1200, fecha: '2026-04-17', categoria: 'MAF', url_factura: 'http://factura.url/3', archivado: false, creado_en: { toDate: () => new Date() } },
    { id: 'g4', concepto: 'Gasto archivado', monto: 100, fecha: '2026-04-10', categoria: 'Otros', url_factura: '', archivado: true, creado_en: { toDate: () => new Date() } },
];

const mockSolicitudes = [
    { id: 's1', totalSolicitado: 2000, estado: 'Recibida', userId: 'test-user-id' }
];

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        onSnapshot: vi.fn((queryObj, callback) => {
            const isSolicitudes = queryObj?._collection === 'solicitudes' || (queryObj?.type === 'solicitudes');
            const dataList = isSolicitudes ? mockSolicitudes : mockGastos;
            const snapshot = {
                docs: dataList.map(doc => ({
                    id: doc.id,
                    data: () => doc,
                })),
            };
            setTimeout(() => callback(snapshot), 0);
            return () => { };
        }),
        collection: vi.fn((_db, name) => ({ _collection: name })),
        query: vi.fn((colRef) => ({ _collection: colRef?._collection })),
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

vi.mock('../EditGastoModal', () => ({
    __esModule: true,
    default: ({ gasto, onSave }) => (
        <button
            data-testid="guardar-edicion-factura"
            onClick={() => onSave({
                ...gasto,
                url_factura: 'https://res.cloudinary.com/new-invoice.pdf',
                deleteToken: 'fresh-invoice-token',
            }, false)}
        >
            Guardar factura editada
        </button>
    ),
}));

describe('ListaGastos Component', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        window.confirm = vi.fn(() => true); // Mockear confirm para que no bloquee
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('usa los mismos filtros de fecha, tipo, búsqueda y archivados para el reporte', () => {
        const filtrados = filtrarGastosParaReporte(mockGastos, {
            fechaInicio: '2026-04-15',
            fechaFin: '2026-04-16',
            terminoBusqueda: 'viaje',
            mostrarArchivados: false,
            tipoReporte: 'normal',
        });

        expect(filtrados.map(gasto => gasto.id)).toEqual(['g2']);
        expect(filtrarGastosParaReporte(mockGastos, { tipoReporte: 'MAF' }).map(gasto => gasto.id)).toEqual(['g3']);
        expect(filtrarGastosParaReporte(mockGastos, { mostrarArchivados: true }).map(gasto => gasto.id)).toContain('g4');
    });

    it('reconstruye exactamente los gastos generados aunque después se archiven', () => {
        const gastosIncluidos = filtrarGastosParaReporte(mockGastos, {
            fechaInicio: '2026-04-15',
            fechaFin: '2026-04-16',
            terminoBusqueda: 'viaje',
        });
        const idsGuardados = gastosIncluidos.map(gasto => gasto.id);
        const gastosPosteriores = mockGastos.map(gasto =>
            idsGuardados.includes(gasto.id) ? { ...gasto, archivado: true } : gasto
        );

        expect(resolverGastosPorIds(gastosPosteriores, idsGuardados).map(gasto => gasto.id)).toEqual(idsGuardados);
    });

    it('previsualiza gastos archivados y omite el PDF de solicitud si no tiene URL', async () => {
        const listaRef = createRef();
        const fetchMock = vi.fn().mockRejectedValue(new Error('No debe descargarse una URL vacía'));
        vi.stubGlobal('fetch', fetchMock);
        render(<ListaGastos ref={listaRef} />);

        await screen.findByText('Comida de mediodía');
        const pdf = await listaRef.current.generarVistaPreviaSolicitud({
            gastosReporteIds: ['g4'],
            fechaInicio: '2026-04-10',
            fechaFin: '2026-04-10',
            proyecto: 'Rally TrackSIM - CECAI',
            consultor: 'Usuario de Prueba',
        });

        expect(pdf.type).toBe('application/pdf');
        expect(fetchMock).not.toHaveBeenCalledWith(undefined);
        vi.unstubAllGlobals();
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
        const totalPeriodoValue = screen.getByText('$1,050.00');
        const totalPeriodoCard = totalPeriodoValue.closest('.tremor-Card-root');
        expect(within(totalPeriodoCard).getByText('Total Periodo')).toBeInTheDocument();

        // Verificar tarjeta Restante cuando hay solicitud recibida ($2,000 - $1,050 = $950.00)
        expect(await screen.findByText('Restantes')).toBeInTheDocument();
        const restanteValue = screen.getByText('$950.00');
        const restanteCard = restanteValue.closest('.tremor-Card-root');
        expect(within(restanteCard).getByText('Restantes')).toBeInTheDocument();
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

    it('persiste el deleteToken nuevo al adjuntar factura desde la edición de la lista', async () => {
        render(<ListaGastos />);

        await screen.findByText('Comida de mediodía');
        fireEvent.click(screen.getByTitle('Editar gasto'));
        fireEvent.click(await screen.findByTestId('guardar-edicion-factura'));

        await waitFor(() => expect(updateDoc).toHaveBeenCalledWith(undefined, expect.objectContaining({
            url_factura: 'https://res.cloudinary.com/new-invoice.pdf',
            deleteToken: 'fresh-invoice-token',
        })));
    });

    it('continúa eliminando un gasto al aceptar la eliminación manual de su factura caducada', async () => {
        getDoc.mockResolvedValue({ data: () => mockGastos[0] });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ error: { message: 'Invalid or expired token' } }),
        }));
        window.confirm.mockReturnValueOnce(true).mockReturnValueOnce(true);
        render(<ListaGastos />);

        fireEvent.click((await screen.findAllByTitle('Eliminar'))[0]);

        await waitFor(() => expect(deleteDoc).toHaveBeenCalledTimes(1));
        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('eliminar la factura de Comida de mediodía manualmente'));
    });

    it('detiene la eliminación local del gasto si se rechaza el borrado manual', async () => {
        getDoc.mockResolvedValue({ data: () => mockGastos[0] });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ error: { message: 'Invalid or expired token' } }),
        }));
        window.confirm.mockReturnValueOnce(true).mockReturnValueOnce(false);
        render(<ListaGastos />);

        fireEvent.click((await screen.findAllByTitle('Eliminar'))[0]);

        await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(2));
        expect(deleteDoc).not.toHaveBeenCalled();
    });

    it('pregunta por eliminación manual si una factura guardada no tiene token', async () => {
        const gastoSinToken = { ...mockGastos[0], deleteToken: '' };
        getDoc.mockResolvedValue({ data: () => gastoSinToken });
        window.confirm.mockReturnValueOnce(true).mockReturnValueOnce(true);
        render(<ListaGastos />);

        fireEvent.click((await screen.findAllByTitle('Eliminar'))[0]);

        await waitFor(() => expect(deleteDoc).toHaveBeenCalledTimes(1));
        expect(window.confirm.mock.calls[1][0]).toContain('Cloudinary no proporcionó un token');
    });
});