import { render, screen, fireEvent, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminDashboard from '../AdminDashboard';

const mockGastos = vi.hoisted(() => [
  { id: 'g1', concepto: 'Comida de trabajo', monto: 1200, fecha: `${new Date().toISOString().slice(0, 7)}-15`, userId: 'u1', archivado: false },
  { id: 'g2', concepto: 'Gasto archivado', monto: 50, fecha: `${new Date().toISOString().slice(0, 7)}-10`, userId: 'u1', archivado: true },
]);
const mockSolicitudes = vi.hoisted(() => [
  { id: 's1', estado: 'Enviada' },
  { id: 's2', estado: 'Recibida' },
  { id: 's3', estado: 'Finalizada' },
  { id: 's4', estado: 'Cerrada' },
]);
const mockUsuarios = vi.hoisted(() => [
  { uid: 'u1', displayName: 'Ana Consultora', role: 'user' },
  { uid: 'u2', displayName: 'Luis Consultor', role: 'user' },
  { uid: 'a1', displayName: 'Admin', role: 'admin' },
]);

vi.mock('../../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ name })),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  query: vi.fn((collectionRef) => collectionRef),
  onSnapshot: vi.fn((collectionRef, onData) => {
    const records = collectionRef.name === 'gastos'
      ? mockGastos
      : collectionRef.name === 'solicitudes'
        ? mockSolicitudes
        : mockUsuarios;
    onData({ docs: records.map((record) => ({ id: record.id, data: () => record })) });
    return vi.fn();
  }),
}));

describe('AdminDashboard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resume gastos activos, solicitudes abiertas y consultores', () => {
    render(<AdminDashboard onNavigate={vi.fn()} />);

    const gastoCard = screen.getByText('Gasto del mes').closest('article');
    expect(within(gastoCard).getByText('$1,200.00')).toBeInTheDocument();
    expect(within(screen.getByText('Movimientos').closest('article')).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByText('Solicitudes abiertas').closest('article')).getByText('3')).toBeInTheDocument();
    expect(within(screen.getByText('Consultores').closest('article')).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Comida de trabajo')).toBeInTheDocument();
    expect(screen.queryByText('Gasto archivado')).not.toBeInTheDocument();
  });

  it('permite abrir las vistas relacionadas desde el dashboard', () => {
    const onNavigate = vi.fn();
    render(<AdminDashboard onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: /Revisar solicitudes/i }));
    expect(onNavigate).toHaveBeenCalledWith('solicitudes');
    fireEvent.click(screen.getByRole('button', { name: /Administrar usuarios/i }));
    expect(onNavigate).toHaveBeenCalledWith('usuarios');
  });
});
