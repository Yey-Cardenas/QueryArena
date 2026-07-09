/**
 * Unit tests for PostgresUserRepository
 * Mocks the `query` helper from database.ts — no real DB required.
 */

import { PostgresUserRepository } from '../../src/adapters/out/persistence/postgres/PostgresUserRepository';

jest.mock('../../src/infrastructure/database', () => ({
  query: jest.fn(),
}));

import { query } from '../../src/infrastructure/database';
const mockQuery = query as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseRow = {
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  password_hash: 'hashed',
  role: 'student',
  is_active: true,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-02'),
};

const expectedUser = {
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  password_hash: 'hashed',
  role: 'student',
  is_active: true,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-02'),
};

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// findByEmail
// ---------------------------------------------------------------------------

describe('PostgresUserRepository.findByEmail', () => {
  it('returns a User when a row is found', async () => {
    mockQuery.mockResolvedValue({ rows: [baseRow] });
    const repo = new PostgresUserRepository();
    const result = await repo.findByEmail('alice@example.com');
    expect(result).toEqual(expectedUser);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE email = $1'),
      ['alice@example.com'],
    );
  });

  it('returns null when no row is found', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresUserRepository();
    const result = await repo.findByEmail('unknown@example.com');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findByUsername
// ---------------------------------------------------------------------------

describe('PostgresUserRepository.findByUsername', () => {
  it('returns a User when a row is found', async () => {
    mockQuery.mockResolvedValue({ rows: [baseRow] });
    const repo = new PostgresUserRepository();
    const result = await repo.findByUsername('alice');
    expect(result).toEqual(expectedUser);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE username = $1'),
      ['alice'],
    );
  });

  it('returns null when no row is found', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresUserRepository();
    expect(await repo.findByUsername('ghost')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findById
// ---------------------------------------------------------------------------

describe('PostgresUserRepository.findById', () => {
  it('returns a User when a row is found', async () => {
    mockQuery.mockResolvedValue({ rows: [baseRow] });
    const repo = new PostgresUserRepository();
    const result = await repo.findById('user-1');
    expect(result).toEqual(expectedUser);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1'),
      ['user-1'],
    );
  });

  it('returns null when no row is found', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresUserRepository();
    expect(await repo.findById('nonexistent')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe('PostgresUserRepository.create', () => {
  it('inserts and returns the created User', async () => {
    mockQuery.mockResolvedValue({ rows: [baseRow] });
    const repo = new PostgresUserRepository();
    const result = await repo.create({
      username: 'alice',
      email: 'alice@example.com',
      password_hash: 'hashed',
      role: 'student',
    });
    expect(result).toEqual(expectedUser);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      ['alice', 'alice@example.com', 'hashed', 'student'],
    );
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe('PostgresUserRepository.update', () => {
  it('updates and returns the updated User', async () => {
    const updatedRow = { ...baseRow, username: 'alice2' };
    mockQuery.mockResolvedValue({ rows: [updatedRow] });
    const repo = new PostgresUserRepository();
    const result = await repo.update('user-1', { username: 'alice2' });
    expect(result.username).toBe('alice2');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users'),
      ['user-1', 'alice2', null],
    );
  });

  it('updates email only when only email is provided', async () => {
    const updatedRow = { ...baseRow, email: 'new@example.com' };
    mockQuery.mockResolvedValue({ rows: [updatedRow] });
    const repo = new PostgresUserRepository();
    const result = await repo.update('user-1', { email: 'new@example.com' });
    expect(result.email).toBe('new@example.com');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users'),
      ['user-1', null, 'new@example.com'],
    );
  });

  it('throws when no row is returned (user not found)', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresUserRepository();
    await expect(repo.update('ghost', {})).rejects.toThrow('User with id "ghost" not found');
  });
});

// ---------------------------------------------------------------------------
// toUser — invalid role guard
// ---------------------------------------------------------------------------

describe('toUser mapper — invalid role', () => {
  it('throws when DB returns an unknown role', async () => {
    mockQuery.mockResolvedValue({ rows: [{ ...baseRow, role: 'superuser' }] });
    const repo = new PostgresUserRepository();
    await expect(repo.findByEmail('alice@example.com')).rejects.toThrow(
      'Unknown user role stored in DB: "superuser"',
    );
  });
});
