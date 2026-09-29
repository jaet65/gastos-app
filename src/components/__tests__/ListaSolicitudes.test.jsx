import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ListaSolicitudes from '../ListaSolicitudes';
import JSZip from 'jszip';

const mockPdfViewer = vi.hoisted(() => vi.fn(() => null));
vi.mock('../PdfCanvasViewer', () => ({ default: mockPdfViewer }));

// Mock de dependencias externas
vi.mock('../AuthContext', () => ({
    useAuth: () => ({
        user: { uid: 'test-user-id', email: 'test@test.com', displayName: 'Test User' }
    }),
}));

const mockSolicitudes = [
    { id: 'sol1', proyecto: 'Rally TrackSIM - CECAI', consultor: 'Usuario de Prueba', fechaInicio: '2026-04-20', fechaFin: '2026-04-25', dias: 6, totalSolicitado: 7800, estado: 'Solicitada', url_pdf_solicitud: 'http://solicitud.url/1', url_reporte_gastos: 'http://reporte.url/1.zip', nombre_archivo_reporte: 'reporte-nuevo.zip', gastosReporteIds: ['g1'] },
    { id: 'sol2', proyecto: 'Rally TrackSIM - MAF', consultor: 'Usuario de Prueba', fechaInicio: '2026-05-01', fechaFin: '2026-05-05', dias: 5, totalSolicitado: 6500, estado: 'Recibida', esMAF: true, url_pdf_solicitud: 'http://solicitud.url/2', url_reporte_gastos: 'http://reporte.url/2.zip', nombre_archivo_reporte: 'reporte-historico.zip' },
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
        vi.stubGlobal('fetch', vi.fn());
        vi.stubGlobal('alert', vi.fn());
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        URL.createObjectURL = vi.fn(() => 'blob:download');
        URL.revokeObjectURL = vi.fn();
        // Importar dinámicamente para obtener las funciones mockeadas
        return import('firebase/firestore').then((firestore) => {
            mockUpdateDoc = firestore.updateDoc;
            mockDeleteDoc = firestore.deleteDoc;
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        delete URL.createObjectURL;
        delete URL.revokeObjectURL;
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

        // Abrir el menú de la primera solicitud (usamos RegExp exacto para evitar el botón de filtro "Solicitada (1)")
        const menuButton = await screen.findByRole('button', { name: /^Solicitada$/ });
        fireEvent.click(menuButton);

        // Hacer clic en la opción "Recibida"
        const opcionRecibida = await screen.findByRole('menuitem', { name: /Recibida/i });
        fireEvent.click(opcionRecibida);

        await waitFor(() => {
            expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
            expect(mockUpdateDoc).toHaveBeenCalledWith(undefined, { estado: 'Recibida' });
        });
    });

    it('debería filtrar la lista de solicitudes al hacer clic en los botones de filtro', async () => {
        render(<ListaSolicitudes />);

        // Al inicio, deberían estar ambas solicitudes ("Solicitada" y "Recibida")
        expect(await screen.findByText('Rally TrackSIM - CECAI')).toBeInTheDocument(); // Solicitada
        expect(screen.getByText('Rally TrackSIM - MAF')).toBeInTheDocument(); // Recibida

        // Hacer clic en el botón de filtro "Recibida (1)"
        const filtroRecibida = await screen.findByRole('button', { name: /Recibida \(1\)/i });
        fireEvent.click(filtroRecibida);

        // Debería mostrar solo la solicitud de MAF (Recibida) y ocultar la de CECAI (Solicitada)
        await waitFor(() => {
            expect(screen.queryByText('Rally TrackSIM - CECAI')).not.toBeInTheDocument();
            expect(screen.getByText('Rally TrackSIM - MAF')).toBeInTheDocument();
        });

        // Hacer clic en el botón de filtro "Solicitada (1)"
        const filtroSolicitada = await screen.findByRole('button', { name: /Solicitada \(1\)/i });
        fireEvent.click(filtroSolicitada);

        // Debería mostrar solo la de CECAI (Solicitada) y ocultar la de MAF (Recibida)
        await waitFor(() => {
            expect(screen.getByText('Rally TrackSIM - CECAI')).toBeInTheDocument();
            expect(screen.queryByText('Rally TrackSIM - MAF')).not.toBeInTheDocument();
        });

        // Hacer clic en el botón de filtro "Todas (2)"
        const filtroTodas = await screen.findByRole('button', { name: /Todas \(2\)/i });
        fireEvent.click(filtroTodas);

        // Debería mostrar ambas nuevamente
        await waitFor(() => {
            expect(screen.getByText('Rally TrackSIM - CECAI')).toBeInTheDocument();
            expect(screen.getByText('Rally TrackSIM - MAF')).toBeInTheDocument();
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

    it('ofrece Visualizar y Descargar, y visualiza reportes nuevos desde sus IDs', async () => {
        const pdfBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' });
        const onPreviewReport = vi.fn().mockResolvedValue(pdfBlob);
        render(<ListaSolicitudes onPreviewReport={onPreviewReport} />);

        const reportButton = (await screen.findAllByTitle('Opciones del reporte'))[0];
        fireEvent.click(reportButton);
        expect(await screen.findByRole('dialog', { name: 'Reporte' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar opciones de reporte' }));
        expect(screen.queryByRole('dialog', { name: 'Reporte' })).not.toBeInTheDocument();

        fireEvent.click(reportButton);
        fireEvent.click(await screen.findByRole('button', { name: /Visualizar/i }));

        await waitFor(() => expect(mockPdfViewer).toHaveBeenCalled());
        expect(onPreviewReport).toHaveBeenCalledWith(mockSolicitudes[0]);
        expect(Array.from(mockPdfViewer.mock.calls.at(-1)[0].data)).toEqual([1, 2, 3]);

        fireEvent.click(screen.getByRole('button', { name: 'Cerrar vista previa' }));
        fetch.mockResolvedValue({ ok: true, blob: async () => new Blob(['zip']) });
        fireEvent.click((await screen.findAllByTitle('Opciones del reporte'))[0]);
        fireEvent.click(await screen.findByRole('button', { name: /Descargar/i }));
        await waitFor(() => expect(fetch).toHaveBeenCalledWith('http://reporte.url/1.zip'));
    });

    it('extrae el PDF del ZIP al visualizar un reporte histórico sin IDs', async () => {
        const zip = new JSZip();
        zip.file('reporte.pdf', new Uint8Array([37, 80, 68, 70]));
        const zipBytes = await zip.generateAsync({ type: 'uint8array' });
        fetch.mockResolvedValue({
            ok: true,
            arrayBuffer: async () => zipBytes.buffer,
        });
        const onPreviewReport = vi.fn();
        render(<ListaSolicitudes onPreviewReport={onPreviewReport} />);

        fireEvent.click((await screen.findAllByTitle('Opciones del reporte'))[1]);
        fireEvent.click(await screen.findByRole('button', { name: /Visualizar/i }));

        await waitFor(() => expect(mockPdfViewer).toHaveBeenCalled());
        expect(fetch).toHaveBeenCalledWith('http://reporte.url/2.zip');
        expect(onPreviewReport).not.toHaveBeenCalled();
        expect(Array.from(mockPdfViewer.mock.calls.at(-1)[0].data)).toEqual([37, 80, 68, 70]);
    });

    it('ofrece Descargar y Visualizar para el PDF de solicitud', async () => {
        const pdfBytes = new Uint8Array([37, 80, 68, 70]);
        fetch.mockResolvedValue({
            ok: true,
            arrayBuffer: async () => pdfBytes.buffer,
            blob: async () => new Blob([pdfBytes], { type: 'application/pdf' }),
        });
        render(<ListaSolicitudes />);

        const solicitudButton = (await screen.findAllByTitle('Opciones de la solicitud'))[0];
        fireEvent.click(solicitudButton);
        expect(await screen.findByRole('dialog', { name: 'Solicitud' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar opciones de solicitud' }));
        expect(screen.queryByRole('dialog', { name: 'Solicitud' })).not.toBeInTheDocument();

        fireEvent.click(solicitudButton);
        fireEvent.click(await screen.findByRole('button', { name: /Visualizar/i }));
        await waitFor(() => expect(mockPdfViewer).toHaveBeenCalled());
        expect(fetch).toHaveBeenCalledWith('http://solicitud.url/1');
        expect(Array.from(mockPdfViewer.mock.calls.at(-1)[0].data)).toEqual(Array.from(pdfBytes));
        expect(screen.getByRole('heading', { name: 'Vista previa de la solicitud' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Cerrar vista previa' }));
        fireEvent.click(solicitudButton);
        fireEvent.click(await screen.findByRole('button', { name: /Descargar/i }));
        await waitFor(() => expect(fetch).toHaveBeenCalledWith('http://solicitud.url/1'));
    });

    it('cierra la vista previa con Atrás y conserva la página de solicitudes', async () => {
        const pdfBytes = new Uint8Array([37, 80, 68, 70]);
        fetch.mockResolvedValue({ ok: true, arrayBuffer: async () => pdfBytes.buffer });
        const pushState = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
        render(<ListaSolicitudes />);

        fireEvent.click((await screen.findAllByTitle('Opciones de la solicitud'))[0]);
        fireEvent.click(await screen.findByRole('button', { name: /Visualizar/i }));
        expect(await screen.findByRole('dialog', { name: 'Vista previa de la solicitud' })).toBeInTheDocument();
        expect(pushState).toHaveBeenCalledWith(expect.objectContaining({ gastosPreviewEntry: true }), '', window.location.href);

        fireEvent(window, new PopStateEvent('popstate', { state: null }));

        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Vista previa de la solicitud' })).not.toBeInTheDocument());
        expect(screen.getByText('Rally TrackSIM - CECAI')).toBeInTheDocument();
    });
});