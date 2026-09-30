import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FormularioGasto from '../FormularioGasto';
import { AuthProvider } from '../AuthContext';

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
        // Mock de alert para que no interrumpa las pruebas
        window.alert = vi.fn();
    });

    it('debería renderizar el formulario con los campos iniciales', () => {
        render(<FormularioGasto />);

        expect(screen.getByText('Nuevo Gasto')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Descripción')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /GUARDAR GASTO/i })).toBeInTheDocument();
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