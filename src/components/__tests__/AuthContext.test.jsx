import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';

const mocks = vi.hoisted(() => ({
  provider: {
    setCustomParameters: vi.fn(),
  },
  signInWithPopup: vi.fn(),
}));

vi.mock('../../firebase', () => ({
  auth: {},
  db: {},
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {
    constructor() {
      return mocks.provider;
    }
  },
  onAuthStateChanged: vi.fn(() => vi.fn()),
  signInWithPopup: mocks.signInWithPopup,
  signOut: vi.fn(),
}));

const LoginButton = () => {
  const { login } = useAuth();
  return <button onClick={login}>Iniciar sesión</button>;
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signInWithPopup.mockResolvedValue({});
  });

  it('solicita seleccionar una cuenta de Google al iniciar sesión', async () => {
    render(
      <AuthProvider>
        <LoginButton />
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(mocks.provider.setCustomParameters).toHaveBeenCalledWith({
        prompt: 'select_account',
      });
      expect(mocks.signInWithPopup).toHaveBeenCalledWith(
        expect.anything(),
        mocks.provider
      );
    });
  });
});
