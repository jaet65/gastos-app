import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Swal from 'sweetalert2';
import ListaSolicitudes from '../ListaSolicitudes';
import { updateDoc, where } from 'firebase/firestore';
import JSZip from 'jszip';

const mockPdfViewer = vi.hoisted(() => vi.fn(() => null));
const mockDeleteField = vi.hoisted(() => vi.fn(() => '__DELETE_FIELD__'));
vi.mock('../PdfCanvasViewer', () => ({ default: mockPdfViewer }));

// Mock de dependencias externas
vi.mock('../AuthContext', () => ({
    useAuth: () => ({
        user: { uid: 'test-user-id', email: 'test@test.com', displayName: 'Test User' }
    }),
}));

const mockSolicitudes = [
    { id: 'sol1', proyecto: 'TrackSIM - CECAI', consultor: 'Usuario de Prueba', fechaInicio: '2026-04-20', fechaFin: '2026-04-25', dias: 6, totalSolicitado: 7800, estado: 'Solicitada', url_pdf_solicitud: 'http://solicitud.url/1', url_reporte_gastos: 'http://reporte.url/1.zip', nombre_archivo_reporte: 'reporte-nuevo.zip', deleteTokenReporte: 'report-delete-token', estadoAnteriorReporte: 'Solicitada', gastosReporteIds: ['g1'] },
    { id: 'sol2', proyecto: 'TrackSIM - MAF', consultor: 'Usuario de Prueba', fechaInicio: '2026-05-01', fechaFin: '2026-05-05', dias: 5, totalSolicitado: 6500, estado: 'Recibida', esMAF: true, url_pdf_solicitud: 'http://solicitud.url/2', url_reporte_gastos: 'http://reporte.url/2.zip', nombre_archivo_reporte: 'reporte-historico.zip' },
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
        getDoc: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ totalSolicitado: 1000 }) }),
        deleteField: mockDeleteField,
    };
});

describe('ListaSolicitudes Component', () => {
    let mockUpdateDoc;
    let mockDeleteDoc;
    let mockGetDoc;

    beforeEach(() => {
        vi.clearAllMocks();
        window.confirm = vi.fn(() => true);
        vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true });
        mockSolicitudes[0].estado = 'Solicitada';
        mockSolicitudes[0].estadoAnteriorReporte = 'Solicitada';
        mockSolicitudes[1].estado = 'Recibida';
        mockSolicitudes[1].url_pdf_solicitud = 'http://solicitud.url/2';
        delete mockSolicitudes[1].deleteToken;
        vi.stubGlobal('fetch', vi.fn());
        vi.stubGlobal('alert', vi.fn());
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        URL.createObjectURL = vi.fn(() => 'blob:download');
        URL.revokeObjectURL = vi.fn();
        // Importar dinámicamente para obtener las funciones mockeadas
        return import('firebase/firestore').then((firestore) => {
            mockUpdateDoc = firestore.updateDoc;
            mockDeleteDoc = firestore.deleteDoc;
            mockGetDoc = firestore.getDoc;
            mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ totalSolicitado: 1000 }) });
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

        expect(await screen.findByText('TrackSIM - CECAI')).toBeInTheDocument();
        expect(screen.getByText('TrackSIM - MAF')).toBeInTheDocument();
        expect(screen.getByText('$7,800.00')).toBeInTheDocument();
        expect(screen.getByText('$6,500.00')).toBeInTheDocument();
    });

    it('consulta solicitudes globales en modo admin sin migrar ni habilitar cambios', async () => {
        render(<ListaSolicitudes adminGlobalView />);

        expect(await screen.findByText('TrackSIM - CECAI')).toBeInTheDocument();
        expect(screen.queryByTitle('Eliminar solicitud')).not.toBeInTheDocument();
        expect(where).not.toHaveBeenCalled();
        expect(updateDoc).not.toHaveBeenCalled();
    });

    it('muestra En revisión y migra el estado legado Esperando...', async () => {
        mockSolicitudes[0].estado = 'Esperando...';
        render(<ListaSolicitudes />);

        expect(await screen.findByRole('button', { name: /^En revisión$/ })).toBeInTheDocument();
        await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith(undefined, { estado: 'En revisión' }));
    });

    it('debería permitir cambiar el estado de una solicitud', async () => {
        render(<ListaSolicitudes />);

        // Abrir el menú de la primera solicitud (usamos RegExp exacto para evitar el botón de filtro "Solicitada (1)")
        const menuButton = await screen.findByRole('button', { name: /^Solicitada$/ });
        expect(menuButton.closest('.tremor-Card-root')).toHaveClass('focus-within:z-20');
        expect(menuButton.querySelector('svg')).toBeInTheDocument();
        fireEvent.click(menuButton);

        const estadoEnRevision = await screen.findByRole('menuitem', { name: /^En revisión$/i });
        expect(estadoEnRevision).toBeVisible();
        expect(estadoEnRevision.querySelector('svg')).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /^Cerrada$/ })).toBeVisible();

        // Hacer clic en la opción "Recibida"
        const opcionRecibida = await screen.findByRole('menuitem', { name: /Recibida/i });
        fireEvent.click(opcionRecibida);

        await waitFor(() => {
            expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
            expect(mockUpdateDoc).toHaveBeenCalledWith(undefined, { estado: 'Recibida' });
        });
        expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
            toast: true,
            icon: 'success',
            title: 'Estado actualizado correctamente a Recibida',
        }));
    });

    it('muestra un SweetAlert si falla el cambio de estado', async () => {
        mockUpdateDoc.mockRejectedValueOnce(new Error('Firestore unavailable'));
        render(<ListaSolicitudes />);

        fireEvent.click(await screen.findByRole('button', { name: /^Solicitada$/ }));
        fireEvent.click(await screen.findByRole('menuitem', { name: /^Recibida$/ }));

        await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Error',
            text: 'Firestore unavailable',
            icon: 'error',
        })));
        expect(alert).not.toHaveBeenCalled();
    });

    it('pregunta y elimina el reporte adjunto de Cloudinary y Firestore al confirmar', async () => {
        mockSolicitudes[0].estado = 'En revisión';
        mockSolicitudes[0].estadoAnteriorReporte = 'Recibida';
        fetch.mockResolvedValue({ ok: true, json: async () => ({ result: 'ok' }) });
        render(<ListaSolicitudes />);

        fireEvent.click(await screen.findByRole('button', { name: /^En revisión$/ }));
        fireEvent.click(await screen.findByRole('menuitem', { name: /^Solicitada$/ }));

        await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledTimes(2));
        expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
            confirmButtonText: 'Sí, cancelar y eliminar',
            cancelButtonText: 'No, mantener',
        }));
        const [cloudinaryUrl, cloudinaryOptions] = fetch.mock.calls[0];
        expect(cloudinaryUrl).toContain('/delete_by_token');
        expect(cloudinaryOptions.headers['Content-Type']).toContain('application/x-www-form-urlencoded');
        expect(cloudinaryOptions.headers['X-Requested-With']).toBe('XMLHttpRequest');
        expect(new URLSearchParams(cloudinaryOptions.body).get('token')).toBe('report-delete-token');
        expect(mockUpdateDoc).toHaveBeenNthCalledWith(1, undefined, { archivado: false });
        expect(mockUpdateDoc).toHaveBeenCalledWith(undefined, expect.objectContaining({
            estado: 'Solicitada',
            url_reporte_gastos: '__DELETE_FIELD__',
            nombre_archivo_reporte: '__DELETE_FIELD__',
            deleteTokenReporte: '__DELETE_FIELD__',
            estadoAnteriorReporte: '__DELETE_FIELD__',
            gastosReporteIds: '__DELETE_FIELD__',
        }));
        expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
            toast: true,
            icon: 'success',
            title: 'Estado actualizado correctamente a Solicitada y reporte cancelado',
        }));
        expect(mockUpdateDoc.mock.calls[0][1]).not.toHaveProperty('deleteToken');
    });

    it('no cambia el estado ni elimina el reporte si se rechaza la cancelación', async () => {
        mockSolicitudes[0].estado = 'En revisión';
        mockSolicitudes[0].estadoAnteriorReporte = 'Recibida';
        Swal.fire.mockResolvedValueOnce({ isConfirmed: false });
        render(<ListaSolicitudes />);

        fireEvent.click(await screen.findByRole('button', { name: /^En revisión$/ }));
        fireEvent.click(await screen.findByRole('menuitem', { name: /^Solicitada$/ }));

        await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
            confirmButtonText: 'Sí, cancelar y eliminar',
        })));
        expect(fetch).not.toHaveBeenCalled();
        expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('elimina el token legado del ZIP MAF sin adjunto de solicitud', async () => {
        mockSolicitudes[1].estado = 'En revisión';
        mockSolicitudes[1].url_pdf_solicitud = '';
        mockSolicitudes[1].deleteToken = 'legacy-maf-report-token';
        fetch.mockResolvedValue({ ok: true, json: async () => ({ result: 'ok' }) });
        render(<ListaSolicitudes />);

        fireEvent.click(await screen.findAllByRole('button', { name: /^En revisión$/ }).then(buttons => buttons[0]));
        fireEvent.click(await screen.findByRole('menuitem', { name: /^Recibida$/ }));

        await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledTimes(1));
        expect(new URLSearchParams(fetch.mock.calls[0][1].body).get('token')).toBe('legacy-maf-report-token');
        expect(mockUpdateDoc.mock.calls[0][1].deleteToken).toBe('__DELETE_FIELD__');
    });

    it('continúa cancelando el reporte si el usuario acepta borrar manualmente el ZIP caducado', async () => {
        mockSolicitudes[0].estado = 'En revisión';
        fetch.mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ error: { message: 'Stale request - reported time is more than 1 hour ago' } }),
        });
        Swal.fire.mockResolvedValue({ isConfirmed: true });
        render(<ListaSolicitudes />);

        fireEvent.click(await screen.findByRole('button', { name: /^En revisión$/ }));
        fireEvent.click(await screen.findByRole('menuitem', { name: /^Recibida$/ }));

        await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledTimes(2));
        expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Token caducado',
        }));
        expect(mockUpdateDoc.mock.calls[0][1]).toEqual({ archivado: false });
        expect(mockUpdateDoc.mock.calls[1][1]).toEqual(expect.objectContaining({
            url_reporte_gastos: '__DELETE_FIELD__',
            gastosReporteIds: '__DELETE_FIELD__',
        }));
    });

    it('mantiene el reporte si se rechaza eliminar manualmente un ZIP con token caducado', async () => {
        mockSolicitudes[0].estado = 'En revisión';
        Swal.fire.mockResolvedValueOnce({ isConfirmed: true }).mockResolvedValueOnce({ isConfirmed: false });
        fetch.mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ error: { message: 'Invalid or expired token' } }),
        });
        render(<ListaSolicitudes />);

        fireEvent.click(await screen.findByRole('button', { name: /^En revisión$/ }));
        fireEvent.click(await screen.findByRole('menuitem', { name: /^Recibida$/ }));

        await waitFor(() => expect(Swal.fire).toHaveBeenCalled());
        expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Token caducado',
        }));
        expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('permite eliminar la solicitud tras aceptar borrar manualmente su PDF caducado', async () => {
        mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ deleteToken: 'expired-request-token', totalSolicitado: 1000 }) });
        fetch.mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ error: { message: 'Invalid or expired token' } }),
        });
        Swal.fire.mockResolvedValue({ isConfirmed: true });
        render(<ListaSolicitudes />);

        fireEvent.click((await screen.findAllByTitle('Eliminar solicitud'))[0]);

        await waitFor(() => expect(mockDeleteDoc).toHaveBeenCalledTimes(1));
        expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
            title: '¿Eliminar solicitud?',
        }));
        expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Token caducado',
        }));
    });

    it('avisa y permite eliminar la solicitud si el PDF no tiene token', async () => {
        mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ url_pdf_solicitud: 'https://res.cloudinary.com/request.pdf', totalSolicitado: 1000 }) });
        Swal.fire.mockResolvedValue({ isConfirmed: true });
        render(<ListaSolicitudes />);

        fireEvent.click((await screen.findAllByTitle('Eliminar solicitud'))[0]);

        await waitFor(() => expect(mockDeleteDoc).toHaveBeenCalledTimes(1));
        expect(fetch).not.toHaveBeenCalled();
        expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
            title: '¿Eliminar solicitud?',
        }));
        expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Sin token de eliminación',
        }));
    });

    it('debería filtrar la lista de solicitudes al hacer clic en los botones de filtro', async () => {
        render(<ListaSolicitudes />);

        // Al inicio, deberían estar ambas solicitudes ("Solicitada" y "Recibida")
        expect(await screen.findByText('TrackSIM - CECAI')).toBeInTheDocument(); // Solicitada
        expect(screen.getByText('TrackSIM - MAF')).toBeInTheDocument(); // Recibida

        // Hacer clic en el botón de filtro "Recibida (1)"
        const filtroRecibida = await screen.findByRole('button', { name: /Recibida \(1\)/i });
        fireEvent.click(filtroRecibida);

        // Debería mostrar solo la solicitud de MAF (Recibida) y ocultar la de CECAI (Solicitada)
        await waitFor(() => {
            expect(screen.queryByText('TrackSIM - CECAI')).not.toBeInTheDocument();
            expect(screen.getByText('TrackSIM - MAF')).toBeInTheDocument();
        });

        // Hacer clic en el botón de filtro "Solicitada (1)"
        const filtroSolicitada = await screen.findByRole('button', { name: /Solicitada \(1\)/i });
        fireEvent.click(filtroSolicitada);

        // Debería mostrar solo la de CECAI (Solicitada) y ocultar la de MAF (Recibida)
        await waitFor(() => {
            expect(screen.getByText('TrackSIM - CECAI')).toBeInTheDocument();
            expect(screen.queryByText('TrackSIM - MAF')).not.toBeInTheDocument();
        });

        // Hacer clic en el botón de filtro "Todas (2)"
        const filtroTodas = await screen.findByRole('button', { name: /Todas \(2\)/i });
        fireEvent.click(filtroTodas);

        // Debería mostrar ambas nuevamente
        await waitFor(() => {
            expect(screen.getByText('TrackSIM - CECAI')).toBeInTheDocument();
            expect(screen.getByText('TrackSIM - MAF')).toBeInTheDocument();
        });
    });

    it('debería llamar a deleteDoc al hacer clic en eliminar', async () => {
        mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ totalSolicitado: 1000 }) });
        Swal.fire.mockResolvedValue({ isConfirmed: true });
        render(<ListaSolicitudes />);
        const deleteButton = (await screen.findAllByTitle('Eliminar solicitud'))[0];
        fireEvent.click(deleteButton);

        await waitFor(() => {
            expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
        });
        expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
            title: '¿Eliminar solicitud?',
        }));
    });

    it('bloquea la eliminación de solicitudes en espera', async () => {
        mockSolicitudes[0].estado = 'En revisión';
        render(<ListaSolicitudes />);

        const deleteButton = await screen.findByTitle('No se puede eliminar una solicitud En revisión');
        expect(deleteButton).toBeDisabled();
        fireEvent.click(deleteButton);

        expect(mockGetDoc).not.toHaveBeenCalled();
        expect(mockDeleteDoc).not.toHaveBeenCalled();
        expect(Swal.fire).not.toHaveBeenCalled();
    });

    it('bloquea la eliminación de solicitudes cerradas', async () => {
        mockSolicitudes[0].estado = 'Cerrada';
        render(<ListaSolicitudes />);

        const deleteButton = await screen.findByTitle('No se puede eliminar una solicitud Cerrada');
        expect(deleteButton).toBeDisabled();
        fireEvent.click(deleteButton);

        expect(mockGetDoc).not.toHaveBeenCalled();
        expect(mockDeleteDoc).not.toHaveBeenCalled();
        expect(Swal.fire).not.toHaveBeenCalled();
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
        expect(screen.getByText('TrackSIM - CECAI')).toBeInTheDocument();
    });
});