/**
 * Unit tests for PostgresUserRepository
 * Mocks the `query` helper from infrastructure/database so no real DB is needed.
 */

import { PostgresUserRepository } from '../../src/adapters/out/persistence/postgres/PostgresUserRepository';

// ── Mock database ─────────────────────────────────────────────────────────────
jest.mock('../../src/infrastructure/database', () => ({
  query: jest.fn(),
}));

import { query } from '../../src/infrastructure/database';
const mockQuery = query as jest.Mock;

// ── Fixtures ──────────────────────────────────────────────────────────────────
const now = new Date('2024-01-01T00:00:00Z');

const userRow = {
  id: 'u-uuid-1',
  username: 'alice',
  email: 'alice@example.com',
  password_hash: '$2b$10$hashedpassword',
  role: 'student',
  is_active: true,
  created_at: now,
  updated_at: now,
};

const adminRow = {
  ...userRow,
  id: 'u-uuid-2',
  username: 'admin',
  email: 'admin@example.com',
  role: 'admin',
};

function makeResult(rows: object[]) {
  return { rows };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('PostgresUserRepository', () => {
  let repo: PostgresUserRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PostgresUserRepository();
  });

  // ── findByEmail ───────────────────────────────────────────────────────────

  describe('findByEmail', () => {
    it('returns the user when found by email', async () => {
      mockQuery.mockResolvedValue(makeResult([userRow]));

      const result = await repo.findByEmail('alice@example.com');

      expect(result).not.toBeNull();
      expect(result!.email).toBe('alice@example.com');
      expect(result!.role).toBe('student');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE email = $1'),
        ['alice@example.com'],
      );
    });

    it('returns null when email not found', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      const result = await repo.findByEmail('nobody@example.com');
      expect(result).toBeNull();
    });
  });

  // ── findByUsername ────────────────────────────────────────────────────────

  describe('findByUsername', () => {
    it('returns the user when found by username', async () => {
      mockQuery.mockResolvedValue(makeResult([userRow]));

      const result = await repo.findByUsername('alice');

      expect(result).not.toBeNull();
      expect(result!.username).toBe('alice');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE username = $1'),
        ['alice'],
      );
    });

    it('returns null when username not found', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      const result = await repo.findByUsername('ghost');
      expect(result).toBeNull();
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns the user when found by id', async () => {
      mockQuery.mockResolvedValue(makeResult([userRow]));

      const result = await repo.findById('u-uuid-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('u-uuid-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['u-uuid-1'],
      );
    });

    it('returns null when id not found', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      const result = await repo.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('inserts a student and returns the created user', async () => {
      mockQuery.mockResolvedValue(makeResult([userRow]));

      const result = await repo.create({
        username: 'alice',
        email: 'alice@example.com',
        password_hash: '$2b$10$hashedpassword',
        role: 'student',
      });

      expect(result.username).toBe('alice');
      expect(result.role).toBe('student');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['alice', 'alice@example.com', '$2b$10$hashedpassword', 'student'],
      );
    });

    it('inserts an admin and returns the created user', async () => {
      mockQuery.mockResolvedValue(makeResult([adminRow]));

      const result = await repo.create({
        username: 'admin',
        email: 'admin@example.com',
        password_hash: '$2b$10$hashedpassword',
        role: 'admin',
      });

      expect(result.role).toBe('admin');
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates username and email and returns the updated user', async () => {
      const updated = { ...userRow, username: 'alice2', email: 'alice2@example.com' };
      mockQuery.mockResolvedValue(makeResult([updated]));

      const result = await repo.update('u-uuid-1', {
        username: 'alice2',
        email: 'alice2@example.com',
      });

      expect(result.username).toBe('alice2');
      expect(result.email).toBe('alice2@example.com');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        ['u-uuid-1', 'alice2', 'alice2@example.com'],
      );
    });

    it('passes null for omitted fields (COALESCE keeps existing value)', async () => {
      const updated = { ...userRow, username: 'newname' };
      mockQuery.mockResolvedValue(makeResult([updated]));

      await repo.update('u-uuid-1', { username: 'newname' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        ['u-uuid-1', 'newname', null],
      );
    });

    it('throws when user not found', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      await expect(repo.update('nonexistent', { username: 'x' })).rejects.toThrow(
        'User with id "nonexistent" not found',
      );
    });
  });

  // ── toUser — invalid role guard ───────────────────────────────────────────

  describe('toUser — role validation', () => {
    it('throws when the DB row contains an unknown role', async () => {
      const badRow = { ...userRow, role: 'superuser' };
      mockQuery.mockResolvedValue(makeResult([badRow]));

      await expect(repo.findByEmail('alice@example.com')).rejects.toThrow(
        'Unknown user role stored in DB: "superuser"',
      );
    });
  });
});
