import { describe, it, expect, vi } from 'vitest';
import { POST } from '@/app/api/integrations/google/disconnect/route';
import { NextRequest } from 'next/server';

// Mock the auth functions
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    account: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('Disconnect endpoint', () => {
  it('should return 401 when not authenticated', async () => {
    const { getSession } = await import('@/lib/auth');
    vi.mocked(getSession).mockResolvedValue(null);

    const request = new NextRequest(
      'http://localhost:3000/api/integrations/google/disconnect',
      {
        method: 'POST',
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should disconnect Google account when authenticated', async () => {
    const { getSession } = await import('@/lib/auth');
    const { prisma } = await import('@/lib/db/prisma');

    const mockSession = {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
      },
    };

    const mockAccount = {
      id: 'account-id',
      userId: 'test-user-id',
      provider: 'google',
    };

    vi.mocked(getSession).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.account.findFirst).mockResolvedValue(mockAccount as never);
    vi.mocked(prisma.account.delete).mockResolvedValue(mockAccount as never);

    const request = new NextRequest(
      'http://localhost:3000/api/integrations/google/disconnect',
      {
        method: 'POST',
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(prisma.account.delete).toHaveBeenCalledWith({
      where: { id: 'account-id' },
    });
  });
});
