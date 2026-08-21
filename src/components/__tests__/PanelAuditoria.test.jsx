import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PanelAuditoria from '../PanelAuditoria';
import * as firebase from '../../firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { vi } from 'vitest';

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
    window.confirm = vi.fn(() => true); // Mock window.confirm to return true by default
    window.alert = vi.fn(); // Mock window.alert

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

  test('calls window.confirm when "Eliminar todos los periodos de auditoría" button is clicked', () => {
    render(<PanelAuditoria allGastos={mockAllGastos} audits={mockAudits} />);
    const deleteButton = screen.getByRole('button', { name: /Limpiar/i });
    
    fireEvent.click(deleteButton);
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(window.confirm).toHaveBeenCalledWith("¿Estás seguro de que quieres eliminar TODOS los periodos de auditoría? Esta acción es irreversible y eliminará todos los datos de auditoría de la base de datos.");
  });

  test('calls deleteDoc for each audit if confirmation is true', async () => {
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
    
    window.confirm.mockReturnValueOnce(true); // User confirms deletion
    fireEvent.click(deleteButton);

    await screen.findByRole('button', { name: /Limpiar/i }); // Wait for any async operations to settle by finding the button again

    expect(collection).toHaveBeenCalledWith(firebase.db, 'auditorias');
    expect(getDocs).toHaveBeenCalledWith({ __isCollectionRef: true }); // getDocs is called with the mocked collection reference
    expect(deleteDoc).toHaveBeenCalledTimes(mockAuditsData.length);
    expect(deleteDoc).toHaveBeenCalledWith({ id: 'audit1' });
    expect(deleteDoc).toHaveBeenCalledWith({ id: 'audit2' });
    expect(window.alert).toHaveBeenCalledWith("Todos los periodos de auditoría han sido eliminados correctamente.");
  });

  test('does not call deleteDoc if confirmation is false', async () => {
    render(<PanelAuditoria allGastos={mockAllGastos} audits={mockAudits} />);
    const deleteButton = screen.getByRole('button', { name: /Limpiar/i });
    
    window.confirm.mockReturnValueOnce(false); // User cancels deletion
    fireEvent.click(deleteButton);

    expect(collection).not.toHaveBeenCalled();
    expect(getDocs).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
  });
});