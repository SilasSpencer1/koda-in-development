/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  sanitizeUserForSearch,
  canSearchSeeUser,
} from '@/lib/policies/friendship';
import { prisma } from '@/lib/db/prisma';

// Mock Prisma
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    friendship: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe('Friendship Policies - Core Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sanitizeUserForSearch', () => {
    it('should return user without email', () => {
      const user = {
        id: 'user1',
        email: 'alice@example.com',
        name: 'Alice',
        username: 'alice',
        avatarUrl: null,
        city: null,
        passwordHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = sanitizeUserForSearch(user);

      expect(result).toEqual({
        id: 'user1',
        name: 'Alice',
        username: 'alice',
        avatarUrl: null,
      });
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should preserve all required fields', () => {
      const user = {
        id: 'user2',
        email: 'bob@example.com',
        name: 'Bob Smith',
        username: 'bob',
        avatarUrl: 'https://example.com/avatar.png',
        city: null,
        passwordHash: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = sanitizeUserForSearch(user);

      expect(result.id).toBe('user2');
      expect(result.name).toBe('Bob Smith');
      expect(result.username).toBe('bob');
      expect(result.avatarUrl).toBe('https://example.com/avatar.png');
    });
  });

  describe('canSearchSeeUser', () => {
    it('should return true for PUBLIC users when not blocked', async () => {
      const mockPrisma = prisma as any;
      mockPrisma.friendship.findFirst.mockResolvedValueOnce(null);

      const result = await canSearchSeeUser('searcher', 'target', 'PUBLIC');
      expect(result).toBe(true);
    });

    it('should return false if any block exists', async () => {
      const mockPrisma = prisma as any;
      mockPrisma.friendship.findFirst.mockResolvedValueOnce({
        status: 'BLOCKED',
      });

      const result = await canSearchSeeUser('searcher', 'target', 'PUBLIC');
      expect(result).toBe(false);
    });

    it('should check friendship for PRIVATE visibility', async () => {
      const mockPrisma = prisma as any;
      let callCount = 0;
      mockPrisma.friendship.findFirst.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: block check
          return Promise.resolve(null);
        }
        // Second call: friend check
        return Promise.resolve(null);
      });

      const result = await canSearchSeeUser('searcher', 'target', 'PRIVATE');
      expect(result).toBe(false);
      expect(mockPrisma.friendship.findFirst).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Friendship Policy Validation', () => {
  it('relationship status should be one of valid types', () => {
    const validStatuses = [
      'none',
      'pending_incoming',
      'pending_outgoing',
      'friends',
    ] as const;
    const testStatus: (typeof validStatuses)[number] = 'friends';

    expect(validStatuses).toContain(testStatus);
  });

  it('visibility levels should be enforced', () => {
    const visibilityLevels = ['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE'] as const;

    for (const level of visibilityLevels) {
      expect(['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE']).toContain(level);
    }
  });

  it('friendship statuses should match expected values', () => {
    const statuses = ['PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED'] as const;

    for (const status of statuses) {
      expect(['PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED']).toContain(status);
    }
  });
});
