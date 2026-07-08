import { render, screen, within, waitFor } from '@testing-library/react';
import DashboardPage from '../DashboardPage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock completo del módulo dashboard.api
jest.mock('../../api/dashboard.api', () => ({
  getSummary:           jest.fn(),
  getProgressByLevel:   jest.fn(),
  getProgressByCategory: jest.fn(),
  getRecentHistory:     jest.fn(),
}));

import * as dashboardApi from '../../api/dashboard.api';

const mockGetSummary            = dashboardApi.getSummary           as jest.Mock;
const mockGetProgressByLevel    = dashboardApi.getProgressByLevel   as jest.Mock;
const mockGetProgressByCategory = dashboardApi.getProgressByCategory as jest.Mock;
const mockGetRecentHistory      = dashboardApi.getRecentHistory     as jest.Mock;

// Usuario autenticado por defecto
const studentUser = { id: 'user-1', username: 'alice', email: 'alice@example.com', role: 'student' as const, createdAt: '' };

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: studentUser }),
}));

// ---------------------------------------------------------------------------
// Datos de ejemplo
// ---------------------------------------------------------------------------

const sampleSummary = {
  totalAttempted: 5, totalCorrect: 3, accumulatedScore: 75, rankingPosition: 2,
};
const sampleLevelProgress  = [{ id: 1, name: 'Básico', attempted: 3, correct: 2 }];
const sampleCatProgress    = [{ id: 1, name: 'SELECT', attempted: 4, correct: 3 }];
const sampleHistory        = [
  { id: 'a-1', userId: 'user-1', exerciseId: 'ex-1', exerciseTitle: 'Select all',
    querySent: 'SELECT *', status: 'correct' as const, score: 10,
    resolutionTimeMs: 1200, createdAt: '2024-06-01T10:00:00.000Z' },
];

function setupApiMocks() {
  mockGetSummary.mockResolvedValue(sampleSummary);
  mockGetProgressByLevel.mockResolvedValue(sampleLevelProgress);
  mockGetProgressByCategory.mockResolvedValue(sampleCatProgress);
  mockGetRecentHistory.mockResolvedValue(sampleHistory);
}

beforeEach(() => {
  jest.clearAllMocks();
  setupApiMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DashboardPage — render y datos', () => {
  it('muestra el heading del dashboard', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
    });
  });

  it('muestra "Cargando dashboard…" mientras carga', () => {
    // Bloquea la respuesta para capturar el estado de carga
    mockGetSummary.mockReturnValue(new Promise(() => {}));
    render(<DashboardPage />);
    expect(screen.getByText('Cargando dashboard…')).toBeInTheDocument();
  });

  it('muestra el resumen con las estadísticas correctas', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Ejercicios intentados')).toBeInTheDocument();
      expect(screen.getByText('Ejercicios correctos')).toBeInTheDocument();
      expect(screen.getByText('Puntaje acumulado')).toBeInTheDocument();
      expect(screen.getByText('Posición en ranking')).toBeInTheDocument();
    });
  });

  it('muestra los valores numéricos del resumen', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.queryByText('Cargando dashboard…')).not.toBeInTheDocument();
    });
    // Acotar la búsqueda a la sección de resumen para evitar duplicados
    const summarySection = screen.getByRole('region', { name: /resumen/i });
    expect(within(summarySection).getByText('5')).toBeInTheDocument();   // totalAttempted
    expect(within(summarySection).getByText('3')).toBeInTheDocument();   // totalCorrect
    expect(within(summarySection).getByText('75')).toBeInTheDocument();  // accumulatedScore
    expect(within(summarySection).getByText('2')).toBeInTheDocument();   // rankingPosition
  });

  it('muestra la tabla de progreso por nivel', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByRole('table', { name: /progreso por nivel/i })).toBeInTheDocument();
      expect(screen.getByText('Básico')).toBeInTheDocument();
    });
  });

  it('muestra la tabla de progreso por categoría', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByRole('table', { name: /progreso por categoría/i })).toBeInTheDocument();
      expect(screen.getByText('SELECT')).toBeInTheDocument();
    });
  });

  it('muestra la tabla de historial reciente con datos correctos', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByRole('table', { name: /historial reciente/i })).toBeInTheDocument();
      expect(screen.getByText('Select all')).toBeInTheDocument();
      expect(screen.getByText('Correcto')).toBeInTheDocument();
      expect(screen.getByText('10 pts')).toBeInTheDocument();
    });
  });

  it('llama a todas las funciones de la API al montar', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(mockGetSummary).toHaveBeenCalledTimes(1);
      expect(mockGetProgressByLevel).toHaveBeenCalledTimes(1);
      expect(mockGetProgressByCategory).toHaveBeenCalledTimes(1);
      expect(mockGetRecentHistory).toHaveBeenCalledTimes(1);
    });
  });
});

describe('DashboardPage — estado vacío', () => {
  it('muestra "No hay intentos aún." en sección de niveles cuando no hay datos', async () => {
    mockGetSummary.mockResolvedValue({ totalAttempted: 0, totalCorrect: 0, accumulatedScore: 0, rankingPosition: 1 });
    mockGetProgressByLevel.mockResolvedValue([]);
    mockGetProgressByCategory.mockResolvedValue([]);
    mockGetRecentHistory.mockResolvedValue([]);

    render(<DashboardPage />);
    await waitFor(() => {
      // Hay 3 secciones con mensaje vacío
      const emptyMsgs = screen.getAllByText('No hay intentos aún.');
      expect(emptyMsgs.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('DashboardPage — error de API', () => {
  it('muestra banner de error cuando la API falla', async () => {
    mockGetSummary.mockRejectedValue(new Error('Network error'));

    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });

  it('muestra botón "Reintentar" en el banner de error', async () => {
    mockGetSummary.mockRejectedValue(new Error('Error de red'));

    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    });
  });
});

describe('DashboardPage — redirección', () => {
  it('no renderiza contenido cuando el usuario es null (redirige)', () => {
    // El mock de useAuth devuelve user=null para este test
    jest.spyOn(
      jest.requireMock('../../hooks/useAuth') as { useAuth: () => { user: null } },
      'useAuth',
    ).mockReturnValueOnce({ user: null });

    const { container } = render(<DashboardPage />);
    // Si user es null, el componente retorna null + ejecuta navigate
    // El contenido del DOM debe estar vacío o sólo mostrar el wrapper raíz
    expect(container.firstChild).toBeNull();
  });
});
