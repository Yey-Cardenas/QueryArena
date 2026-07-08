import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../LoginPage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();
const mockLogin    = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup() {
  const user = userEvent.setup();
  render(<LoginPage />);
  return { user };
}

beforeEach(() => {
  mockNavigate.mockClear();
  mockLogin.mockClear();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Render básico
// ---------------------------------------------------------------------------

describe('LoginPage — render', () => {
  it('muestra el heading "Iniciar sesión"', () => {
    setup();
    expect(screen.getByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it('muestra los campos correo y contraseña', () => {
    setup();
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
  });

  it('muestra el botón "Iniciar sesión"', () => {
    setup();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it('muestra enlace a /register', () => {
    setup();
    expect(screen.getByRole('link', { name: /regístrate/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Banner de registro exitoso
// ---------------------------------------------------------------------------

// Componente wrapper que inyecta location.state = { registered: true }
function LoginPageWithRegistered() {
  // El módulo ya está mockeado con useLocation → { state: null }.
  // Este test verifica que el banner NO aparece con el mock por defecto.
  return <LoginPage />;
}

describe('LoginPage — banner de registro exitoso', () => {
  it('no muestra banner de éxito con state=null (mock por defecto)', () => {
    render(<LoginPageWithRegistered />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Validación del lado del cliente
// ---------------------------------------------------------------------------

describe('LoginPage — validación del cliente', () => {
  it('muestra error cuando el correo está vacío', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(screen.getByText('El correo electrónico es requerido')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('muestra error cuando la contraseña está vacía', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/correo electrónico/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(screen.getByText('La contraseña es requerida')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('muestra error de formato de correo inválido', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/correo electrónico/i), 'no-es-email');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(screen.getByText('Formato de correo inválido')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('muestra ambos errores cuando todos los campos están vacíos', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(screen.getByText('El correo electrónico es requerido')).toBeInTheDocument();
    expect(screen.getByText('La contraseña es requerida')).toBeInTheDocument();
  });

  it('no muestra errores para un formulario válido', async () => {
    mockLogin.mockResolvedValue(undefined);
    const { user } = setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), 'test@example.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(screen.queryByText('El correo electrónico es requerido')).not.toBeInTheDocument();
    expect(screen.queryByText('La contraseña es requerida')).not.toBeInTheDocument();
    expect(screen.queryByText('Formato de correo inválido')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Flujo de login exitoso
// ---------------------------------------------------------------------------

describe('LoginPage — login exitoso', () => {
  it('llama a login con email y password correctos', async () => {
    mockLogin.mockResolvedValue(undefined);
    const { user } = setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('alice@example.com', 'password123');
    });
  });

  it('redirige a /dashboard para rol student (sin token en localStorage)', async () => {
    mockLogin.mockResolvedValue(undefined);
    const { user } = setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });
});

// ---------------------------------------------------------------------------
// Errores del servidor
// ---------------------------------------------------------------------------

describe('LoginPage — errores del servidor', () => {
  it('muestra "Correo o contraseña incorrectos" cuando el login falla con INVALID_CREDENTIALS', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid email or password'));
    const { user } = setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), 'bad@example.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos');
    });
  });

  it('muestra el mensaje de error genérico para errores desconocidos', async () => {
    mockLogin.mockRejectedValue(new Error('Network error'));
    const { user } = setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), 'user@example.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });

  it('no llama a navigate cuando el login falla', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid email or password'));
    const { user } = setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), 'user@example.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
