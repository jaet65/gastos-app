/* globals global */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Swal from 'sweetalert2';
import EditGastoModal from '../EditGastoModal';
import { analyzeInvoice } from '../invoiceAnalysis';

vi.mock('../invoiceAnalysis', () => ({
    analyzeInvoice: vi.fn(),
    appendInvoiceRfcStatus: vi.fn((message) => message),
}));

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
        analyzeInvoice.mockResolvedValue({ amount: null, receiverRfc: null });
        window.alert = vi.fn();
        window.confirm = vi.fn(() => true);
        vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true });

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

    it('analiza la factura principal nueva y confirma el monto detectado', async () => {
        analyzeInvoice.mockResolvedValue({ amount: 987.65, receiverRfc: null });
        const fireSpy = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true });
        const swalContainer = document.createElement('div');
        vi.spyOn(Swal, 'getContainer').mockReturnValue(swalContainer);
        render(<EditGastoModal gasto={mockGastoTransporte} onClose={mockOnClose} onSave={mockOnSave} />);

        fireEvent.change(screen.getByLabelText('Factura principal'), {
            target: { files: [new File(['pdf'], 'factura-nueva.pdf', { type: 'application/pdf' })] },
        });

        await waitFor(() => expect(fireSpy).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Los montos no coinciden',
            confirmButtonText: 'Usar detectado ($987.65)',
            denyButtonText: 'Usar ingresado ($1500.00)',
            didOpen: expect.any(Function),
        })));
        fireSpy.mock.calls.find(([options]) => options.title === 'Los montos no coinciden')[0].didOpen();
        expect(swalContainer.style.zIndex).toBe('100000');
        await waitFor(() => expect(screen.getByDisplayValue('987.65')).toBeInTheDocument());
        expect(screen.getByText('Total detectado: $987.65')).toBeInTheDocument();
    });

    it('cambia automáticamente a categoría MAF cuando la factura tiene RFC MAF', async () => {
        analyzeInvoice.mockResolvedValue({ amount: null, receiverRfc: 'MCE170119JC0' });
        render(<EditGastoModal gasto={mockGastoTransporte} onClose={mockOnClose} onSave={mockOnSave} />);

        fireEvent.change(screen.getByLabelText('Factura principal'), {
            target: { files: [new File(['pdf'], 'factura-maf.pdf', { type: 'application/pdf' })] },
        });

        await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('MAF'));
    });

    it('no guarda un gasto MAF editado con RFC distinta en el QR', async () => {
        analyzeInvoice.mockResolvedValue({ amount: null, receiverRfc: 'CCI190920376' });
        const fireSpy = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true });
        const gastoMaf = { ...mockGastoTransporte, categoria: 'MAF' };
        render(<EditGastoModal gasto={gastoMaf} onClose={mockOnClose} onSave={mockOnSave} />);

        fireEvent.change(screen.getByLabelText('Factura principal'), {
            target: { files: [new File(['pdf'], 'factura-otra-rfc.pdf', { type: 'application/pdf' })] },
        });

        const saveButton = screen.getByRole('button', { name: /Guardar Cambios|Analizando factura/i });
        await waitFor(() => expect(saveButton).toBeEnabled());
        fireEvent.click(saveButton);

        await waitFor(() => expect(fireSpy).toHaveBeenCalledWith(expect.objectContaining({
            title: 'RFC incompatible con MAF',
        })));
        expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('analiza la factura de una caseta editada y conserva el monto elegido', async () => {
        analyzeInvoice.mockResolvedValue({ amount: 987.65, receiverRfc: null });
        vi.spyOn(Swal, 'fire').mockResolvedValue({ isDenied: true });
        const casetaConFactura = { ...mockCasetas[0], url_factura: 'http://factura.url/caseta.pdf', deleteToken: 'token-caseta' };
        mockGetDocs.mockResolvedValueOnce({
            docs: [{ id: casetaConFactura.id, data: () => casetaConFactura }]
        });
        render(<EditGastoModal gasto={mockGastoTransporte} onClose={mockOnClose} onSave={mockOnSave} />);

        expect(await screen.findByTitle('Ver factura guardada')).toBeInTheDocument();
        fireEvent.change(await screen.findByLabelText('Factura de caseta 1'), {
            target: { files: [new File(['pdf'], 'caseta.pdf', { type: 'application/pdf' })] },
        });

        await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Los montos no coinciden',
            confirmButtonText: 'Usar detectado ($987.65)',
            denyButtonText: 'Usar ingresado ($180.00)',
        })));
        expect(await screen.findByDisplayValue('180')).toBeInTheDocument();
        expect(screen.getByText('Se conservará el monto ingresado: $180.00')).toBeInTheDocument();
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

    it('continúa guardando cuando se acepta borrar manualmente una factura con token caducado', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ error: { message: 'Invalid or expired token' } }),
        });
        window.confirm.mockReturnValueOnce(true);
        Swal.fire.mockResolvedValueOnce({ isConfirmed: true });
        render(<EditGastoModal gasto={mockGastoTransporte} onClose={mockOnClose} onSave={mockOnSave} />);

        fireEvent.click(await screen.findByTitle('Eliminar factura actual'));
        fireEvent.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

        await waitFor(() => expect(mockOnSave).toHaveBeenCalledTimes(1));
        expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Token caducado',
        }));
    });

    it('cancela los cambios locales si se rechaza la eliminación manual de una factura caducada', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ error: { message: 'Invalid or expired token' } }),
        });
        window.confirm.mockReturnValueOnce(true);
        Swal.fire.mockResolvedValueOnce({ isConfirmed: false });
        render(<EditGastoModal gasto={mockGastoTransporte} onClose={mockOnClose} onSave={mockOnSave} />);

        fireEvent.click(await screen.findByTitle('Eliminar factura actual'));
        fireEvent.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

        await waitFor(() => expect(Swal.fire).toHaveBeenCalled());
        expect(mockOnSave).not.toHaveBeenCalled();
        expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it('pide eliminar manualmente si la factura guardada no tiene token', async () => {
        const gastoSinToken = { ...mockGastoTransporte, deleteToken: '' };
        window.confirm.mockReturnValueOnce(true);
        Swal.fire.mockResolvedValueOnce({ isConfirmed: true });
        render(<EditGastoModal gasto={gastoSinToken} onClose={mockOnClose} onSave={mockOnSave} />);

        fireEvent.click(await screen.findByTitle('Eliminar factura actual'));
        fireEvent.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

        await waitFor(() => expect(mockOnSave).toHaveBeenCalledTimes(1));
        expect(global.fetch).not.toHaveBeenCalled();
        expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Sin token de eliminación',
        }));
    });
});