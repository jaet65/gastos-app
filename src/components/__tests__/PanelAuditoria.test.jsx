import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import PanelAuditoria from '../PanelAuditoria';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { vi } from 'vitest';

const { pdfDocumentMock, jsPDFMock, autoTableMock } = vi.hoisted(() => {
  const pdfDocumentMock = {
    internal: { pageSize: { getWidth: () => 297 } },
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    setFillColor: vi.fn(),
    setDrawColor: vi.fn(),
    roundedRect: vi.fn(),
    save: vi.fn(),
  };
  return {
    pdfDocumentMock,
    jsPDFMock: vi.fn(function JsPDF() { return pdfDocumentMock; }),
    autoTableMock: vi.fn(),
  };
});

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(),
    update: vi.fn(),
    showLoading: vi.fn(),
  },
}));

vi.mock('jspdf', () => ({ default: jsPDFMock }));
vi.mock('jspdf-autotable', () => ({ default: autoTableMock }));

// Mock Firebase functions
vi.mock('../../firebase', () => ({
  db: {}, // Mock db object
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
}));

describe('PanelAuditoria', () => {
  const mockAllGastos = [];
  const mockAudits = [
    { id: 'audit1', city: 'Test City', startDate: '2023-01-01', endDate: '2023-01-05', totalCiudad: 100, gastosPorCategoria: {} },
  ];

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks(); // Clear all mocks instead of individual ones
    Swal.fire.mockResolvedValue({ isConfirmed: true });

    // Correctly mock getDocs to return an object with a forEach method
    getDocs.mockResolvedValue({
      docs: mockAudits.map(audit => ({
        id: audit.id,
        data: () => audit,
      })),
      forEach: function(callback) {
        this.docs.forEach(callback);
      },
    });
  });

  test('renders PanelAuditoria component without crashing', () => {
    render(<PanelAuditoria allGastos={mockAllGastos} audits={mockAudits} />);
    expect(screen.getByRole('button', { name: /Ciudad/i })).toBeInTheDocument();
  });

  test('renders "Eliminar todos los periodos de auditoría" button', () => {
    render(<PanelAuditoria allGastos={mockAllGastos} audits={mockAudits} />);
    const deleteButton = screen.getByRole('button', { name: /Limpiar/i });
    expect(deleteButton).toBeInTheDocument();
  });

  test('keeps hook order when switching to Periodo without audits', () => {
    render(<PanelAuditoria allGastos={mockAllGastos} audits={[]} />);

    fireEvent.click(screen.getByRole('button', { name: /Periodo/i }));

    expect(screen.getByText('Añade un periodo de ciudad para comenzar la auditoría.')).toBeInTheDocument();
  });

  test('compares imported Costo as income against expenses in city and period views', () => {
    const year = new Date().getFullYear();
    const audits = [{
      id: 'audit-income',
      city: 'Test City',
      startDate: `${year}-01-01`,
      endDate: `${year}-01-05`,
      costo: 100,
    }];
    const allGastos = [{
      id: 'expense',
      fecha: `${year}-01-03`,
      categoria: 'Transporte',
      monto: 60,
    }];

    render(<PanelAuditoria allGastos={allGastos} audits={audits} />);

    expect(screen.getByText('Ingresos anuales')).toBeInTheDocument();
    expect(screen.getByText('Egresos anuales')).toBeInTheDocument();
    expect(screen.getByText('Diferencia anual')).toBeInTheDocument();
    expect(screen.getAllByText('$100.00').some(element => element.className.includes('text-emerald-600'))).toBe(true);
    expect(screen.getAllByText('-$60.00').some(element => element.className.includes('text-red-600'))).toBe(true);
    expect(screen.getAllByText('$40.00').every(element => element.className.includes('text-emerald-600'))).toBe(true);
    expect(screen.getByText('Ingresos (Costo)')).toBeInTheDocument();
    expect(screen.getByText('Ingresos (Costo)').parentElement).toHaveTextContent('$100.00');
    expect(screen.getByText('Egresos (Gastos)')).toBeInTheDocument();
    expect(screen.getByText('Egresos (Gastos)').parentElement).toHaveTextContent('-$60.00');
    expect(screen.getByText('Diferencia').parentElement).toHaveTextContent('$40.00');

    fireEvent.click(screen.getByRole('button', { name: /Periodo/i }));

    expect(screen.getByText('Ingresos (Costo)')).toBeInTheDocument();
    expect(screen.getByText('Ingresos (Costo)').parentElement).toHaveTextContent('$100.00');
    expect(screen.getByText('Egresos (Gastos)')).toBeInTheDocument();
    expect(screen.getByText('Egresos (Gastos)').parentElement).toHaveTextContent('-$60.00');
    expect(screen.getByText('Diferencia').parentElement).toHaveTextContent('$40.00');
  });

  test('shows negative difference in red when expenses exceed income', () => {
    const year = new Date().getFullYear();
    const audits = [{
      id: 'audit-loss',
      city: 'Test City',
      startDate: `${year}-01-01`,
      endDate: `${year}-01-05`,
      costo: 60,
    }];
    const allGastos = [{
      id: 'expense',
      fecha: `${year}-01-03`,
      categoria: 'Transporte',
      monto: 80,
    }];

    render(<PanelAuditoria allGastos={allGastos} audits={audits} />);

    expect(screen.getByText('Diferencia anual')).toBeInTheDocument();
    expect(screen.getAllByText('-$80.00').some(element => element.className.includes('text-red-600'))).toBe(true);
    expect(screen.getAllByText('-$20.00').every(element => element.className.includes('text-red-600'))).toBe(true);
  });

  test('generates a report with the annual comparison and matching city details', async () => {
    const year = new Date().getFullYear();
    const audits = [{
      id: 'audit-report',
      city: 'Test City',
      startDate: `${year}-01-01`,
      endDate: `${year}-01-05`,
      costo: 100,
    }];
    const allGastos = [{
      id: 'expense-report',
      fecha: `${year}-01-03`,
      categoria: 'Transporte',
      monto: 60,
    }];

    render(<PanelAuditoria allGastos={allGastos} audits={audits} />);
    fireEvent.click(screen.getByRole('button', { name: /Generar Reporte/i }));

    await waitFor(() => expect(pdfDocumentMock.save).toHaveBeenCalledWith('TrackSIM_Audit.pdf'));

    expect(jsPDFMock).toHaveBeenCalledWith({ orientation: 'landscape' });
    expect(pdfDocumentMock.text).toHaveBeenCalledWith('INGRESOS ANUALES', expect.any(Number), expect.any(Number));
    expect(pdfDocumentMock.text).toHaveBeenCalledWith('$100.00', expect.any(Number), expect.any(Number));
    expect(pdfDocumentMock.text).toHaveBeenCalledWith('EGRESOS ANUALES', expect.any(Number), expect.any(Number));
    expect(pdfDocumentMock.text).toHaveBeenCalledWith('-$60.00', expect.any(Number), expect.any(Number));
    expect(pdfDocumentMock.text).toHaveBeenCalledWith('DIFERENCIA ANUAL', expect.any(Number), expect.any(Number));

    const report = autoTableMock.mock.calls[0][1];
    expect(report.startY).toBe(47);
    expect(Object.values(report.columnStyles).reduce((total, style) => total + style.cellWidth, 0))
      .toBe(pdfDocumentMock.internal.pageSize.getWidth() - report.margin.left - report.margin.right);
    expect(report.head[0]).toEqual([
      'Ciudad',
      'Periodos considerados',
      'Ingresos (Costo)',
      'Egresos (Gastos)',
      'Diferencia',
      'Promedio/Día',
      'Gastos por categoría',
    ]);
    expect(report.body[0]).toEqual(expect.arrayContaining([
      'Test City',
      `${year}-01-01 al ${year}-01-05`,
      '$100.00',
      '-$60.00',
      '$40.00',
      '$12.00',
      'Transporte: $60.00 ($12.00/día)',
    ]));
  });

  test('places Importar with the report and clear actions', () => {
    const onImport = vi.fn();
    render(<PanelAuditoria allGastos={[]} audits={[]} onImport={onImport} />);

    fireEvent.click(screen.getByRole('button', { name: /Importar/i }));

    expect(onImport).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Generar Reporte/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Limpiar/i })).toBeInTheDocument();
  });

  test('omits cities with no expenses and no income', () => {
    const year = new Date().getFullYear();
    const audits = [
      {
        id: 'audit-empty',
        city: 'Sin actividad',
        startDate: `${year}-01-01`,
        endDate: `${year}-01-05`,
        costo: 0,
      },
      {
        id: 'audit-income',
        city: 'Con ingresos',
        startDate: `${year}-02-01`,
        endDate: `${year}-02-05`,
        costo: 100,
      },
    ];

    render(<PanelAuditoria allGastos={[]} audits={audits} />);

    expect(screen.queryByText('Sin actividad')).not.toBeInTheDocument();
    expect(screen.getByText('Con ingresos')).toBeInTheDocument();
    expect(screen.getByText('Periodos considerados:')).toBeInTheDocument();
    expect(screen.getByText(`${year}-02-01 al ${year}-02-05`)).toBeInTheDocument();
  });

  test('asks for confirmation with SweetAlert before clearing audit periods', async () => {
    render(<PanelAuditoria allGastos={mockAllGastos} audits={mockAudits} />);
    const deleteButton = screen.getByRole('button', { name: /Limpiar/i });
    
    await act(async () => {
      fireEvent.click(deleteButton);
    });
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
      title: '¿Limpiar auditorías?',
      showCancelButton: true,
    }));
  });

  test('shows deletion progress and auto-closing completion after confirmation', async () => {
    // Mock some audit data, including data() method for each document
    const mockAuditsData = [
      { id: 'audit1', data: () => ({ city: 'City A', startDate: '2023-01-01', endDate: '2023-01-05' }) },
      { id: 'audit2', data: () => ({ city: 'City B', startDate: '2023-02-01', endDate: '2023-02-05' }) },
    ];

    // Mock collection to return a simple object that can be passed to getDocs
    collection.mockReturnValue({
      __isCollectionRef: true, // Indicate it's a mock collection ref
    });

    // Mock getDocs to return a QuerySnapshot-like object
    getDocs.mockResolvedValue({
      docs: mockAuditsData,
      forEach: function(callback) {
        this.docs.forEach(callback);
      },
    });

    doc.mockImplementation((db, collectionName, id) => ({ id })); // Mock doc function to return an object with id

    render(<PanelAuditoria allGastos={mockAllGastos} audits={mockAuditsData.map(d => ({id: d.id, ...d.data()}))} />);
    const deleteButton = screen.getByRole('button', { name: /Limpiar/i });
    
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    await waitFor(() => {
      expect(deleteDoc).toHaveBeenCalledTimes(mockAuditsData.length);
    });
    expect(deleteDoc).toHaveBeenCalledWith({ id: 'audit1' });
    expect(deleteDoc).toHaveBeenCalledWith({ id: 'audit2' });
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Limpiando auditorías',
      allowOutsideClick: false,
    }));
    expect(Swal.update).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining('Auditorías eliminadas: 2 de 2'),
    }));
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Limpieza completada',
      timer: 1800,
      showConfirmButton: false,
    }));
  });

  test('does not call deleteDoc if confirmation is false', async () => {
    render(<PanelAuditoria allGastos={mockAllGastos} audits={mockAudits} />);
    const deleteButton = screen.getByRole('button', { name: /Limpiar/i });
    
    Swal.fire.mockResolvedValueOnce({ isConfirmed: false });
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    expect(collection).not.toHaveBeenCalled();
    expect(getDocs).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
    expect(Swal.fire).toHaveBeenCalledTimes(1);
  });
});