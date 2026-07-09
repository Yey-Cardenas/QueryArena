/**
 * Unit tests for ExercisesPage
 *
 * ExercisesPage tiene dos useEffect independientes:
 *  1. Carga filtros (levels + categories) → setState fuera de act
 *  2. Carga ejercicios → setState fuera de act
 *
 * Estrategia: los mocks devuelven promesas ya resueltas de forma síncrona
 * para que React las procese dentro del mismo ciclo de microtareas y no
 * genere warnings de act. Se usa `findBy*` (que internamente usa waitFor+act)
 * para todas las aserciones asíncronas.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExercisesPage from '../ExercisesPage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../api/exercises.api', () => ({
  listExercises:  jest.fn(),
  listLevels:     jest.fn(),
  listCategories: jest.fn(),
}));

jest.mock('../../hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

import * as exercisesApi from '../../api/exercises.api';
import { useAuth }       from '../../hooks/useAuth';

const mockListExercises  = exercisesApi.listExercises  as jest.Mock;
const mockListLevels     = exercisesApi.listLevels     as jest.Mock;
const mockListCategories = exercisesApi.listCategories as jest.Mock;
const mockUseAuth        = useAuth                     as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const authUser = {
  id: 'u1', username: 'alice', email: 'alice@example.com',
  role: 'student' as const, createdAt: '',
};

const sampleLevels     = [{ id: 1, name: 'Básico' }, { id: 2, name: 'Intermedio' }];
const sampleCategories = [{ id: 1, name: 'SELECT' }, { id: 2, name: 'JOIN' }];
const sampleExercises  = [
  {
    id: 'ex-1', title: 'Select all users',
    description: 'Write a SELECT * query.',
    level: { id: 1, name: 'Básico' }, category: { id: 1, name: 'SELECT' },
    score: 10, isActive: true, createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'ex-2', title: 'Join tables',
    description: 'Write a JOIN query.',
    level: { id: 2, name: 'Intermedio' }, category: { id: 2, name: 'JOIN' },
    score: 20, isActive: true, createdAt: '2024-01-02T00:00:00.000Z',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: authUser });
  // Promesas ya resueltas — se procesan síncronamente y evitan warnings de act
  mockListLevels.mockResolvedValue(sampleLevels);
  mockListCategories.mockResolvedValue(sampleCategories);
  mockListExercises.mockResolvedValue(sampleExercises);
});

// ---------------------------------------------------------------------------
// Render básico (síncrono — no requiere espera asíncrona)
// ---------------------------------------------------------------------------

describe('ExercisesPage — render inicial', () => {
  it('muestra el heading "Catálogo de Ejercicios"', () => {
    render(<ExercisesPage />);
    expect(
      screen.getByRole('heading', { name: /catálogo de ejercicios/i })
    ).toBeInTheDocument();
  });

  it('muestra los selectores de nivel y categoría', () => {
    render(<ExercisesPage />);
    expect(screen.getByLabelText(/nivel de dificultad/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/categoría/i)).toBeInTheDocument();
  });

  it('muestra "Cargando ejercicios…" antes de que resuelvan las promesas', () => {
    mockListLevels.mockReturnValue(new Promise(() => {}));
    mockListCategories.mockReturnValue(new Promise(() => {}));
    mockListExercises.mockReturnValue(new Promise(() => {}));
    render(<ExercisesPage />);
    expect(screen.getByText('Cargando ejercicios…')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Datos cargados (findBy* usa waitFor+act internamente)
// ---------------------------------------------------------------------------

describe('ExercisesPage — datos cargados', () => {
  it('muestra los ejercicios después de la carga', async () => {
    render(<ExercisesPage />);
    expect(await screen.findByText('Select all users')).toBeInTheDocument();
    expect(screen.getByText('Join tables')).toBeInTheDocument();
  });

  it('muestra la lista accesible con aria-label', async () => {
    render(<ExercisesPage />);
    expect(
      await screen.findByRole('list', { name: /catálogo de ejercicios/i })
    ).toBeInTheDocument();
  });

  it('muestra nivel y categoría de cada ejercicio', async () => {
    render(<ExercisesPage />);
    await screen.findByText('Select all users');
    // 'Básico' aparece en el select (option) y en el badge del ejercicio
    expect(screen.getAllByText('Básico').length).toBeGreaterThanOrEqual(1);
    // 'SELECT' aparece en el select (option) y en el badge del ejercicio
    expect(screen.getAllByText('SELECT').length).toBeGreaterThanOrEqual(1);
  });

  it('muestra el puntaje de cada ejercicio', async () => {
    render(<ExercisesPage />);
    await screen.findByText('Select all users');
    expect(screen.getByText('🏆 10 pts')).toBeInTheDocument();
    expect(screen.getByText('🏆 20 pts')).toBeInTheDocument();
  });

  it('llama a listLevels, listCategories y listExercises al montar', async () => {
    render(<ExercisesPage />);
    await screen.findByText('Select all users');
    expect(mockListLevels).toHaveBeenCalledTimes(1);
    expect(mockListCategories).toHaveBeenCalledTimes(1);
    expect(mockListExercises).toHaveBeenCalledTimes(1);
  });

  it('opciones de nivel aparecen en el selector', async () => {
    render(<ExercisesPage />);
    // Esperar que los filtros carguen: el select pasa de disabled a enabled
    const levelSelect = await screen.findByRole('combobox', { name: /nivel de dificultad/i });
    await waitFor(() => expect(levelSelect).not.toBeDisabled());
    const opts = Array.from((levelSelect as HTMLSelectElement).options).map(o => o.text);
    expect(opts).toContain('Básico');
    expect(opts).toContain('Intermedio');
  });

  it('opciones de categoría aparecen en el selector', async () => {
    render(<ExercisesPage />);
    const catSelect = await screen.findByRole('combobox', { name: /categoría/i });
    await waitFor(() => expect(catSelect).not.toBeDisabled());
    const opts = Array.from((catSelect as HTMLSelectElement).options).map(o => o.text);
    expect(opts).toContain('SELECT');
    expect(opts).toContain('JOIN');
  });
});

// ---------------------------------------------------------------------------
// Lista vacía
// ---------------------------------------------------------------------------

describe('ExercisesPage — lista vacía', () => {
  it('muestra mensaje cuando no hay ejercicios', async () => {
    mockListExercises.mockResolvedValue([]);
    render(<ExercisesPage />);
    expect(
      await screen.findByText('No se encontraron ejercicios con los filtros seleccionados.')
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error de API
// ---------------------------------------------------------------------------

describe('ExercisesPage — error de API', () => {
  it('muestra banner de error cuando listExercises falla', async () => {
    mockListExercises.mockRejectedValue(new Error('Error de conexión'));
    render(<ExercisesPage />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Error de conexión');
  });
});

// ---------------------------------------------------------------------------
// Navegación
// ---------------------------------------------------------------------------

describe('ExercisesPage — navegación', () => {
  it('navega a /exercises/:id al hacer clic en un ejercicio', async () => {
    const user = userEvent.setup();
    render(<ExercisesPage />);

    await screen.findByText('Select all users');

    // El aria-label del botón es "Abrir ejercicio: {title}"
    const btn = await screen.findByRole('button', {
      name: 'Abrir ejercicio: Select all users',
    });
    await user.click(btn);

    expect(mockNavigate).toHaveBeenCalledWith('/exercises/ex-1');
  });
});

// ---------------------------------------------------------------------------
// Filtros — cambio de selección
// ---------------------------------------------------------------------------

describe('ExercisesPage — filtros', () => {
  it('llama a listExercises con levelId al seleccionar un nivel', async () => {
    const user = userEvent.setup();
    render(<ExercisesPage />);

    const levelSelect = await screen.findByRole('combobox', { name: /nivel de dificultad/i });
    await waitFor(() => expect(levelSelect).not.toBeDisabled());

    await user.selectOptions(levelSelect, '1');

    await waitFor(() => {
      const calls = mockListExercises.mock.calls;
      const lastArg = calls[calls.length - 1][0] as { levelId?: number };
      expect(lastArg?.levelId).toBe(1);
    });
  });

  it('llama a listExercises con categoryId al seleccionar una categoría', async () => {
    const user = userEvent.setup();
    render(<ExercisesPage />);

    const catSelect = await screen.findByRole('combobox', { name: /categoría/i });
    await waitFor(() => expect(catSelect).not.toBeDisabled());

    await user.selectOptions(catSelect, '2');

    await waitFor(() => {
      const calls = mockListExercises.mock.calls;
      const lastArg = calls[calls.length - 1][0] as { categoryId?: number };
      expect(lastArg?.categoryId).toBe(2);
    });
  });
});

// ---------------------------------------------------------------------------
// Redirección sin autenticación
// ---------------------------------------------------------------------------

describe('ExercisesPage — redirección', () => {
  it('no renderiza contenido cuando el usuario es null', () => {
    mockUseAuth.mockReturnValueOnce({ user: null });
    const { container } = render(<ExercisesPage />);
    expect(container.firstChild).toBeNull();
  });

  it('llama a navigate("/login") cuando el usuario es null', () => {
    mockUseAuth.mockReturnValueOnce({ user: null });
    render(<ExercisesPage />);
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });
});
