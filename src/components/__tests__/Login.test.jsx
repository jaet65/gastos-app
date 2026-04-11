import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Login from '../Login';
import { useAuth } from '../AuthContext';

// Mock the AuthContext
vi.mock('../AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('Login Component', () => {
  it('renders correctly', () => {
    useAuth.mockReturnValue({ login: vi.fn() });
    render(<Login />);
    
    expect(screen.getByText(/Iniciar sesión para control de gastos/i)).toBeInTheDocument();
    expect(screen.getByText(/Continuar con Google/i)).toBeInTheDocument();
  });

  it('calls login function when button is clicked', async () => {
    const mockLogin = vi.fn().mockResolvedValue({});
    useAuth.mockReturnValue({ login: mockLogin });
    render(<Login />);
    
    const loginButton = screen.getByText(/Continuar con Google/i);
    fireEvent.click(loginButton);
    
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it('shows error message when login fails', async () => {
    const mockLogin = vi.fn().mockRejectedValue(new Error('Login failed'));
    useAuth.mockReturnValue({ login: mockLogin });
    render(<Login />);
    
    const loginButton = screen.getByText(/Continuar con Google/i);
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Login failed/i)).toBeInTheDocument();
    });
  });
});
