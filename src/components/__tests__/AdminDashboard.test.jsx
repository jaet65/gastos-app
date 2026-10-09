import { render, screen, fireEvent, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminDashboard from '../AdminDashboard';

const mockGastos = vi.hoisted(() => {
  const mesActual = new Date();
  const mesAnterior = new Date(mesActual.getFullYear(), mesActual.getMonth() - 1, 15);
  const mesActualKey = `${mesActual.getFullYear()}-${String(mesActual.getMonth() + 1).padStart(2, '0')}`;
  const mesAnteriorKey = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, '0')}`;

  return [
    { id: 'g1', concepto: 'Comida de trabajo', monto: 1200, fecha: `${mesActualKey}-15`, userId: 'u1', categoria: 'Comida', archivado: false },
    { id: 'g2', concepto: 'Gasto archivado', monto: 50, fecha: `${mesActualKey}-10`, userId: 'u1', categoria: 'Comida', archivado: true },
    { id: 'g3', concepto: 'Taxi', monto: 300, fecha: `${mesAnteriorKey}-15`, userId: 'u2', categoria: 'Transporte', archivado: false },
  ];
});
const mockSolicitudes = vi.hoisted(() => [
  { id: 's1', estado: 'Enviada' },
  { id: 's2', estado: 'Recibida' },
  { id: 's3', estado: 'Esperando...' },
  { id: 's4', estado: 'Finalizada' },
  { id: 's5', estado: 'Cerrada' },
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
    expect(within(gastoCard).getByText('$1,250.00')).toBeInTheDocument();
    expect(within(gastoCard).getByText(/Gastos no archivados: \$1,200\.00/)).toBeInTheDocument();
    expect(within(screen.getByText('Movimientos').closest('article')).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByText('Solicitudes abiertas').closest('article')).getByText('4')).toBeInTheDocument();
    expect(within(screen.getByText('Consultores').closest('article')).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Comida de trabajo')).toBeInTheDocument();
    expect(screen.getAllByText('En revisión').length).toBeGreaterThan(0);
    expect(screen.queryByText('Gasto archivado')).not.toBeInTheDocument();
  });

  it('permite abrir las vistas relacionadas desde el dashboard', () => {
    const onNavigate = vi.fn();
    render(<AdminDashboard onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: /Revisar solicitudes/i }));
    expect(onNavigate).toHaveBeenCalledWith('solicitudes');
    fireEvent.click(screen.getByRole('button', { name: /Usuarios/i }));
    expect(onNavigate).toHaveBeenCalledWith('usuarios');
  });

  it('muestra gastos por categoría y usuario para el mes seleccionado', () => {
    render(<AdminDashboard onNavigate={vi.fn()} />);

    const resumenCategoria = screen.getByLabelText('Gastos por categoría');
    const resumenUsuario = screen.getByLabelText('Gastos por usuario');
    const grafica = screen.getByRole('img', { name: /Gráfica de línea de gastos por mes/i });
    expect(grafica.querySelectorAll('circle')).toHaveLength(2);
    expect(grafica.querySelector('polyline')).toBeInTheDocument();
    expect(grafica.querySelector('polyline').getAttribute('points').split(' ')).toHaveLength(2);
    expect(grafica).toHaveAttribute('viewBox', '0 0 720 160');
    expect(grafica).toHaveAttribute('preserveAspectRatio', 'none');
    expect(grafica.parentElement.parentElement).toHaveClass('md:col-span-2');
    expect(grafica.querySelectorAll('[data-selected="true"]')).toHaveLength(1);
    expect(grafica.querySelector('[aria-label*="$1,250.00"]')).toBeInTheDocument();
    const mesInicialResaltado = grafica.querySelector('[data-selected="true"]').parentElement.getAttribute('aria-label');
    expect(within(resumenCategoria).getByText('Comida')).toBeInTheDocument();
    expect(within(resumenCategoria).getByText('$1,250.00')).toBeInTheDocument();
    expect(within(resumenCategoria).getByText('2 movimientos')).toBeInTheDocument();
    expect(within(resumenCategoria).getByText('Promedio diario: $40.32')).toBeInTheDocument();
    expect(within(resumenUsuario).getByText('Ana Consultora')).toBeInTheDocument();
    expect(within(resumenUsuario).getByText('$1,250.00')).toBeInTheDocument();
    const tarjetaGasto = screen.getByText('Gasto del mes').closest('article');
    expect(within(tarjetaGasto).getByText('$1,250.00')).toBeInTheDocument();
    expect(within(tarjetaGasto).getByText(/Gastos no archivados: \$1,200\.00/)).toBeInTheDocument();

    const mesAnterior = mockGastos[2].fecha.slice(0, 7);
    fireEvent.change(screen.getByLabelText('Mes del resumen'), { target: { value: mesAnterior } });

    expect(grafica.querySelectorAll('[data-selected="true"]')).toHaveLength(1);
    expect(grafica.querySelector('[data-selected="true"]').parentElement.getAttribute('aria-label')).not.toBe(mesInicialResaltado);
    expect(within(tarjetaGasto).getByText('$300.00')).toBeInTheDocument();
    expect(within(tarjetaGasto).getByText(/Gastos no archivados: \$300\.00/)).toBeInTheDocument();
    expect(within(resumenCategoria).getByText('Transporte')).toBeInTheDocument();
    expect(within(resumenCategoria).getByText('$300.00')).toBeInTheDocument();
    expect(within(resumenCategoria).getByText('Promedio diario: $10.00')).toBeInTheDocument();
    expect(within(resumenUsuario).getByText('Luis Consultor')).toBeInTheDocument();
    expect(within(resumenUsuario).getByText('$300.00')).toBeInTheDocument();
  });

  it('cambia el mes seleccionado al activar un nodo de la gráfica', () => {
    render(<AdminDashboard onNavigate={vi.fn()} />);

    const grafica = screen.getByRole('img', { name: /Gráfica de línea de gastos por mes/i });
    const nodoMesAnterior = grafica.querySelector('[data-selected="false"]');
    fireEvent.click(nodoMesAnterior);

    expect(screen.getByLabelText('Mes del resumen')).toHaveValue(mockGastos[2].fecha.slice(0, 7));
    expect(nodoMesAnterior.closest('[role="button"]')).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByLabelText('Gastos por categoría')).getByText('Transporte')).toBeInTheDocument();
    expect(within(screen.getByText('Gasto del mes').closest('article')).getByText('$300.00')).toBeInTheDocument();
  });
});
