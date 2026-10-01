import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../../App';
import { useAuth } from '../AuthContext';

// 1. Mock de dependencias
vi.mock('../AuthContext', () => ({
    useAuth: vi.fn(),
}));

vi.mock('../../firebase', () => ({
    db: {}
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    onSnapshot: vi.fn((q, callback) => {
        callback({
            docs: [
                { id: '1', data: () => ({ estado: 'Solicitada' }) },
                { id: '2', data: () => ({ estado: 'Recibida' }) },
                { id: '3', data: () => ({ estado: 'Esperando...' }) },
                { id: '4', data: () => ({ estado: 'Cerrada' }) }
            ]
        });
        return () => {};
    })
}));

// Mock de los componentes hijos para aislar la lógica de App.jsx
vi.mock('../FormularioGasto', () => ({ default: () => <div data-testid="formulario-gasto">Formulario Gasto</div> }));
vi.mock('../ListaGastos', () => ({ default: () => <div data-testid="lista-gastos">Lista Gastos</div> }));
vi.mock('../ListaSolicitudes', () => ({ default: () => <div data-testid="lista-solicitudes">Lista Solicitudes</div> }));
vi.mock('../ListaUsuarios', () => ({ default: () => <div data-testid="lista-usuarios">Lista Usuarios</div> }));
vi.mock('../Login', () => ({ default: () => <div data-testid="login-screen">Login Screen</div> }));

describe('App Component', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.stubEnv('VITE_APP_COMMIT_SHA', 'version-actual');
    });

    it('debería mostrar la pantalla de carga inicialmente', () => {
        useAuth.mockReturnValue({ loading: true, user: null });
        render(<App />);
        expect(screen.getByText(/Cargando.../i)).toBeInTheDocument();
    });

    it('debería mostrar la pantalla de Login si no hay usuario autenticado', () => {
        useAuth.mockReturnValue({ loading: false, user: null });
        render(<App />);
        expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    });

    it('debería mostrar la interfaz principal si hay un usuario autenticado', () => {
        useAuth.mockReturnValue({
            loading: false,
            user: { uid: 'test-user' },
            userData: { role: 'user' }
        });
        render(<App />);
        expect(screen.getByTestId('formulario-gasto')).toBeInTheDocument();
        expect(screen.getByTestId('lista-gastos')).toBeInTheDocument();
    });

    it('debería avisar de las novedades al detectar una nueva versión y recordar el cierre', async () => {
        useAuth.mockReturnValue({
            loading: false,
            user: { uid: 'test-user' },
            userData: { role: 'user' }
        });
        localStorage.setItem('ultimaVersionNovedades', 'version-anterior');
        render(<App />);

        const banner = await screen.findByRole('status');
        expect(banner).toHaveTextContent(/se actualizó/i);
        const formulario = screen.getByTestId('formulario-gasto');
        expect(banner.compareDocumentPosition(formulario) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /Cerrar aviso de actualización/i }));

        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(localStorage.getItem('ultimaVersionNovedades')).toBe('version-actual');
    });

    it('no debería volver a mostrar el aviso para la versión ya notificada', async () => {
        useAuth.mockReturnValue({
            loading: false,
            user: { uid: 'test-user' },
            userData: { role: 'user' }
        });
        localStorage.setItem('ultimaVersionNovedades', 'version-actual');
        render(<App />);

        await waitFor(() => {
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });
    });

    it('debería permitir la navegación entre pestañas', async () => {
        useAuth.mockReturnValue({
            loading: false,
            user: { uid: 'test-user' },
            userData: { role: 'user' }
        });
        render(<App />);

        // La pestaña de gastos es la inicial
        expect(screen.getByTestId('lista-gastos')).toBeInTheDocument();

        // Cambiar a la pestaña de solicitudes
        const solicitudesTab = screen.getByRole('button', { name: /Solicitudes/i });
        fireEvent.click(solicitudesTab);

        expect(screen.getByTestId('lista-gastos').parentElement).toHaveAttribute('hidden');
        expect(await screen.findByTestId('lista-solicitudes')).toBeInTheDocument();
    });

    it('debería mostrar la pestaña de Usuarios solo para usuarios administradores', async () => {
        useAuth.mockReturnValue({
            loading: false,
            user: { uid: 'admin-user' },
            userData: { role: 'admin' }
        });
        render(<App />);

        const adminTab = screen.getByRole('button', { name: /Usuarios/i });
        expect(adminTab).toBeInTheDocument();

        // Cambiar a la pestaña de Admin
        fireEvent.click(adminTab);
        await waitFor(() => {
            expect(screen.getByTestId('lista-usuarios')).toBeInTheDocument();
        });
    });

    it('no debería mostrar la pestaña de Usuarios para usuarios normales', () => {
        useAuth.mockReturnValue({
            loading: false,
            user: { uid: 'test-user' },
            userData: { role: 'user' }
        });
        render(<App />);

        const adminTab = screen.queryByRole('button', { name: /Usuarios/i });
        expect(adminTab).not.toBeInTheDocument();
    });

    it('debería renderizar un único badge dinámico que rota entre los estados activos', () => {
        useAuth.mockReturnValue({
            loading: false,
            user: { uid: 'test-user' },
            userData: { role: 'user' }
        });
        render(<App />);

        const solicitudesTab = screen.getByRole('button', { name: /Solicitudes/i });
        expect(solicitudesTab).toBeInTheDocument();

        // Muestra el estado activo actual
        expect(screen.getByTitle(/Solicitada: 1|Recibida: 1|Esperando...: 1/)).toBeInTheDocument();
    });
});