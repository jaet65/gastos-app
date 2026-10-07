import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FormularioGasto from '../FormularioGasto';
import { AuthProvider } from '../AuthContext';
import { analyzeInvoice } from '../invoiceAnalysis';
import { takeSharedInvoice } from '../../shareTarget';
import Swal from 'sweetalert2';

vi.mock('../invoiceAnalysis', () => ({
    analyzeInvoice: vi.fn(),
    appendInvoiceRfcStatus: vi.fn((message) => message),
}));

vi.mock('../../shareTarget', () => ({
    takeSharedInvoice: vi.fn(),
}));

// Mock de dependencias externas
vi.mock('../AuthContext', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useAuth: () => ({
            user: { uid: 'test-user-id', email: 'test@test.com' }
        }),
    };
});

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        addDoc: vi.fn(), // Creamos el mock aquí
        collection: vi.fn(() => ({})), // Devuelve un objeto dummy
        Timestamp: { now: () => new Date() },
    };
});

// Mock de la función de subida a Cloudinary
vi.mock('../utils/cloudinary', () => ({
    subirACloudinary: vi.fn().mockResolvedValue({
        secure_url: 'http://fake.url/factura.pdf',
        delete_token: 'fake-delete-token',
    }),
}));


describe('FormularioGasto Component', () => {

    // Importamos dinámicamente el mock para poder acceder a él en las pruebas
    let mockAddDoc;

    beforeEach(() => {
        vi.clearAllMocks();
        analyzeInvoice.mockResolvedValue({ amount: null, receiverRfc: null });
        takeSharedInvoice.mockResolvedValue(null);
        window.history.replaceState({}, '', '/');
        // Mock de alert para que no interrumpa las pruebas
        window.alert = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('debería renderizar el formulario con los campos iniciales', () => {
        render(<FormularioGasto />);

        expect(screen.getByText('Nuevo Gasto')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Descripción')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
        expect(screen.getByLabelText('Autocompletado por QR disponible')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /GUARDAR GASTO/i })).toBeInTheDocument();
    });

    it('recibe la factura compartida y la carga en el formulario de nuevo gasto', async () => {
        const invoice = new File(['pdf'], 'factura-compartida.pdf', { type: 'application/pdf' });
        takeSharedInvoice.mockResolvedValue(invoice);
        analyzeInvoice.mockResolvedValue({ amount: 321.45, receiverRfc: null });
        window.history.replaceState({}, '', '/?sharedInvoice=share-123');

        render(<FormularioGasto />);

        await waitFor(() => expect(takeSharedInvoice).toHaveBeenCalledWith('share-123'));
        await waitFor(() => expect(screen.getByPlaceholderText('0.00')).toHaveValue(321.45));
        expect(screen.getByText('factura-compartida.pdf')).toBeInTheDocument();
        expect(window.location.search).toBe('');
    });

    it('debería mostrar la opción de propina solo cuando la categoría es "Comida"', async () => {
        render(<FormularioGasto />);

        const categoriaSelect = screen.getByRole('combobox');

        // Inicialmente no debe estar
        expect(screen.queryByText(/¿Agregar Propina/i)).not.toBeInTheDocument();

        // Cambiar a Comida
        fireEvent.change(categoriaSelect, { target: { value: 'Comida' } });
        expect(await screen.findByText(/¿Agregar Propina/i)).toBeInTheDocument();

        // Cambiar a otra categoría
        fireEvent.change(categoriaSelect, { target: { value: 'Otros' } });
        expect(screen.queryByText(/¿Agregar Propina/i)).not.toBeInTheDocument();
    });

    it('debería mostrar la sección de casetas solo cuando la categoría es "Transporte"', async () => {
        render(<FormularioGasto />);

        const categoriaSelect = screen.getByRole('combobox');

        // Inicialmente (Transporte) debe estar
        expect(await screen.findByText('Casetas (Tolls)')).toBeInTheDocument();

        // Cambiar a otra categoría
        fireEvent.change(categoriaSelect, { target: { value: 'Comida' } });
        expect(screen.queryByText('Casetas (Tolls)')).not.toBeInTheDocument();
    });

    it('precarga el monto detectado al adjuntar una factura PDF', async () => {
        analyzeInvoice.mockResolvedValue({ amount: 987.65, receiverRfc: null });
        const { container } = render(<FormularioGasto />);
        const file = new File(['pdf'], 'factura.pdf', { type: 'application/pdf' });

        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });

        await waitFor(() => expect(screen.getByPlaceholderText('0.00')).toHaveValue(987.65));
        expect(screen.getByText('Total detectado: $987.65')).toBeInTheDocument();
    });

    it('cambia automáticamente la categoría a MAF para la RFC MAF', async () => {
        analyzeInvoice.mockResolvedValue({ amount: null, receiverRfc: 'MCE170119JC0' });
        const { container } = render(<FormularioGasto />);

        fireEvent.change(container.querySelector('input[type="file"]'), {
            target: { files: [new File(['pdf'], 'factura-maf.pdf', { type: 'application/pdf' })] },
        });

        await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('MAF'));
    });

    it('no guarda un gasto MAF si su factura tiene otra RFC', async () => {
        analyzeInvoice.mockResolvedValue({ amount: null, receiverRfc: 'CCI190920376' });
        const fireSpy = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true });
        const firestore = await import('firebase/firestore');
        const { container } = render(<FormularioGasto />);
        fireEvent.change(screen.getByPlaceholderText('Descripción'), { target: { value: 'Gasto MAF' } });
        fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '200' } });
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'MAF' } });
        fireEvent.change(container.querySelector('input[type="file"]'), {
            target: { files: [new File(['pdf'], 'factura-otra-rfc.pdf', { type: 'application/pdf' })] },
        });

        const saveButton = container.querySelector('form button[type="submit"]');
        await waitFor(() => expect(saveButton).toBeEnabled());
        fireEvent.click(saveButton);

        await waitFor(() => expect(fireSpy).toHaveBeenCalledWith(expect.objectContaining({
            title: 'RFC incompatible con MAF',
        })));
        expect(firestore.addDoc).not.toHaveBeenCalled();
    });

    it('permite conservar el monto ingresado cuando difiere del total detectado', async () => {
        analyzeInvoice.mockResolvedValue({ amount: 987.65, receiverRfc: null });
        const fireSpy = vi.spyOn(Swal, 'fire').mockResolvedValue({ isDenied: true });
        const { container } = render(<FormularioGasto />);
        const montoInput = screen.getByPlaceholderText('0.00');
        fireEvent.change(montoInput, { target: { value: '800.00' } });

        fireEvent.change(container.querySelector('input[type="file"]'), {
            target: { files: [new File(['pdf'], 'factura.pdf', { type: 'application/pdf' })] },
        });

        await waitFor(() => expect(fireSpy).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Los montos no coinciden',
            showDenyButton: true,
            confirmButtonText: 'Usar detectado ($987.65)',
            denyButtonText: 'Usar ingresado ($800.00)',
        })));
        await waitFor(() => expect(montoInput).toHaveValue(800));
        expect(screen.getByText('Se conservará el monto ingresado: $800.00')).toBeInTheDocument();
    });

    it('permite usar el total detectado cuando difiere del monto ingresado', async () => {
        analyzeInvoice.mockResolvedValue({ amount: 987.65, receiverRfc: null });
        vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true });
        const { container } = render(<FormularioGasto />);
        const montoInput = screen.getByPlaceholderText('0.00');
        fireEvent.change(montoInput, { target: { value: '800.00' } });

        fireEvent.change(container.querySelector('input[type="file"]'), {
            target: { files: [new File(['pdf'], 'factura.pdf', { type: 'application/pdf' })] },
        });

        await waitFor(() => expect(montoInput).toHaveValue(987.65));
        expect(screen.getByText('Total detectado: $987.65')).toBeInTheDocument();
    });

    it('analiza la factura de una caseta y permite elegir entre ambos montos', async () => {
        analyzeInvoice.mockResolvedValue({ amount: 987.65, receiverRfc: null });
        const fireSpy = vi.spyOn(Swal, 'fire').mockResolvedValue({ isDenied: true });
        render(<FormularioGasto />);

        fireEvent.click(screen.getByRole('button', { name: /\+ Agregar/i }));
        const casetaMonto = screen.getAllByPlaceholderText('0.00').at(-1);
        fireEvent.change(casetaMonto, { target: { value: '800.00' } });
        fireEvent.change(screen.getByLabelText('Factura de caseta 1'), {
            target: { files: [new File(['pdf'], 'caseta.pdf', { type: 'application/pdf' })] },
        });

        await waitFor(() => expect(fireSpy).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Los montos no coinciden',
            confirmButtonText: 'Usar detectado ($987.65)',
            denyButtonText: 'Usar ingresado ($800.00)',
        })));
        await waitFor(() => expect(casetaMonto).toHaveValue(800));
        expect(screen.getByText('Se conservará el monto ingresado: $800.00')).toBeInTheDocument();
    });

    it('debería llamar a addDoc con los datos correctos al enviar el formulario', async () => {
        // Antes de renderizar, importamos el mock de addDoc
        const firestore = await import('firebase/firestore');
        mockAddDoc = firestore.addDoc;

        render(<FormularioGasto />);

        // Llenar el formulario
        fireEvent.change(screen.getByPlaceholderText('Descripción'), { target: { value: 'Prueba de concepto' } });
        fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '123.45' } });

        // Enviar
        fireEvent.click(screen.getByRole('button', { name: /GUARDAR GASTO/i }));

        // Esperar a que se resuelvan las promesas y se llame a addDoc
        await waitFor(() => {
            expect(mockAddDoc).toHaveBeenCalledTimes(1);
        });

        // Verificar que se llamó con los datos correctos
        expect(mockAddDoc).toHaveBeenCalledWith(
            expect.any(Object), // El primer argumento es la referencia a la colección
            expect.objectContaining({
                concepto: 'Prueba de concepto',
                monto: 123.45,
                categoria: 'Transporte', // Valor por defecto
                userId: 'test-user-id',
            })
        );

        // Verificar que se mostró la alerta de éxito
        expect(await screen.findByText('¡Guardado correctamente!')).toBeInTheDocument();
    });
});