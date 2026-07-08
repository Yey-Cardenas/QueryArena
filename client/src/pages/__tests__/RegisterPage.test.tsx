import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterPage from '../RegisterPage';

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock useAuth hook — register resolves successfully by default
const mockRegister = jest.fn().mockResolvedValue(undefined);
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ register: mockRegister }),
}));

describe('RegisterPage — validación del lado del cliente', () => {
  function setup() {
    const user = userEvent.setup();
    render(<RegisterPage />);
    return { user };
  }

  beforeEach(() => {
    mockRegister.mockClear();
  });

  // ---------------------------------------------------------------------------
  // Req 15.1 — campos vacíos muestran error antes de enviar la petición
  // ---------------------------------------------------------------------------

  it('muestra errores para todos los campos vacíos al enviar', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /registrarse/i }));

    expect(screen.getByText('El nombre de usuario es requerido')).toBeInTheDocument();
    expect(screen.getByText('El correo electrónico es requerido')).toBeInTheDocument();
    expect(screen.getByText('La contraseña es requerida')).toBeInTheDocument();
  });

  it('muestra error cuando el nombre de usuario está vacío', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/correo electrónico/i), 'test@example.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /registrarse/i }));

    expect(screen.getByText('El nombre de usuario es requerido')).toBeInTheDocument();
  });

  it('muestra error cuando el correo electrónico está vacío', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/nombre de usuario/i), 'testuser');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /registrarse/i }));

    expect(screen.getByText('El correo electrónico es requerido')).toBeInTheDocument();
  });

  it('muestra error cuando la contraseña está vacía', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/nombre de usuario/i), 'testuser');
    await user.type(screen.getByLabelText(/correo electrónico/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /registrarse/i }));

    expect(screen.getByText('La contraseña es requerida')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Req 15.2 — validación de formato de correo
  // ---------------------------------------------------------------------------

  it('muestra error de formato de correo inválido', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/nombre de usuario/i), 'testuser');
    await user.type(screen.getByLabelText(/correo electrónico/i), 'no-es-un-email');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /registrarse/i }));

    expect(screen.getByText('Formato de correo inválido')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Req 15.3 — contraseña mínimo 8 caracteres
  // ---------------------------------------------------------------------------

  it('muestra error para contraseña más corta que 8 caracteres (5 chars)', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/nombre de usuario/i), 'testuser');
    await user.type(screen.getByLabelText(/correo electrónico/i), 'test@example.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'short');   // 5 chars
    await user.click(screen.getByRole('button', { name: /registrarse/i }));

    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres')).toBeInTheDocument();
  });

  it('muestra error para contraseña de exactamente 7 caracteres (caso límite)', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/nombre de usuario/i), 'testuser');
    await user.type(screen.getByLabelText(/correo electrónico/i), 'test@example.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'seven77');  // 7 chars
    await user.click(screen.getByRole('button', { name: /registrarse/i }));

    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Req 15.1 — no llama a la API cuando la validación falla
  // ---------------------------------------------------------------------------

  it('no llama al API de registro cuando la validación falla', async () => {
    const { user } = setup();

    // Enviar con todos los campos vacíos
    await user.click(screen.getByRole('button', { name: /registrarse/i }));

    expect(mockRegister).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Formulario válido — no muestra errores de validación
  // ---------------------------------------------------------------------------

  it('no muestra errores de validación para un formulario completamente válido', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/nombre de usuario/i), 'usuarioválido');
    await user.type(screen.getByLabelText(/correo electrónico/i), 'valido@example.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'contraseñavalida');
    await user.click(screen.getByRole('button', { name: /registrarse/i }));

    expect(screen.queryByText('El nombre de usuario es requerido')).not.toBeInTheDocument();
    expect(screen.queryByText('El correo electrónico es requerido')).not.toBeInTheDocument();
    expect(screen.queryByText('Formato de correo inválido')).not.toBeInTheDocument();
    expect(screen.queryByText('La contraseña es requerida')).not.toBeInTheDocument();
    expect(screen.queryByText('La contraseña debe tener al menos 8 caracteres')).not.toBeInTheDocument();
  });
});
