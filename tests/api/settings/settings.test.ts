import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetSession = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: () => mockGetSession(),
}));

const mockUserFindUnique = vi.fn();
const mockUserUpdate = vi.fn();
const mockSettingsFindUnique = vi.fn();
const mockSettingsUpsert = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    settings: {
      findUnique: (...args: unknown[]) => mockSettingsFindUnique(...args),
      upsert: (...args: unknown[]) => mockSettingsUpsert(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Test: Profile update rejects duplicate username
// ---------------------------------------------------------------------------

describe('PATCH /api/me/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects duplicate username with 409', async () => {
    const { PATCH } = await import('@/app/api/me/profile/route');

    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
    // Another user already has this username
    mockUserFindUnique.mockResolvedValue({
      id: 'user-2',
      username: 'taken_name',
    });

    const req = new Request('http://localhost/api/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', username: 'taken_name' }),
    });

    const res = await PATCH(req as never);
    expect(res.status).toBe(409);

    const body = await res.json();
    expect(body.error).toContain('already taken');
    expect(body.field).toBe('username');
  });

  it('allows user to keep their own username', async () => {
    const { PATCH } = await import('@/app/api/me/profile/route');

    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
    // Same user owns this username
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      username: 'my_name',
    });
    mockUserUpdate.mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      name: 'Updated Name',
      username: 'my_name',
      avatarUrl: null,
      city: null,
    });

    const req = new Request('http://localhost/api/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name', username: 'my_name' }),
    });

    const res = await PATCH(req as never);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.name).toBe('Updated Name');
    expect(body.username).toBe('my_name');
  });

  it('requires authentication', async () => {
    const { PATCH } = await import('@/app/api/me/profile/route');

    mockGetSession.mockResolvedValue(null);

    const req = new Request('http://localhost/api/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });

    const res = await PATCH(req as never);
    expect(res.status).toBe(401);
  });

  it('validates input with Zod', async () => {
    const { PATCH } = await import('@/app/api/me/profile/route');

    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });

    const req = new Request('http://localhost/api/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }), // empty name should fail
    });

    const res = await PATCH(req as never);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Test: Privacy update persists and is returned via GET /api/me
// ---------------------------------------------------------------------------

describe('Privacy settings persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('persists privacy changes via PATCH /api/me/privacy', async () => {
    const { PATCH } = await import('@/app/api/me/privacy/route');

    const updatedSettings = {
      accountVisibility: 'PRIVATE' as const,
      defaultDetailLevel: 'DETAILS' as const,
      allowSuggestions: false,
    };

    mockSettingsUpsert.mockResolvedValue(updatedSettings);

    const patchReq = new Request('http://localhost/api/me/privacy', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSettings),
    });

    const patchRes = await PATCH(patchReq as never);
    expect(patchRes.status).toBe(200);

    const patchBody = await patchRes.json();
    expect(patchBody.accountVisibility).toBe('PRIVATE');
    expect(patchBody.defaultDetailLevel).toBe('DETAILS');
    expect(patchBody.allowSuggestions).toBe(false);

    // Verify upsert was called with the right data
    expect(mockSettingsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        update: expect.objectContaining({
          accountVisibility: 'PRIVATE',
          defaultDetailLevel: 'DETAILS',
          allowSuggestions: false,
        }),
      })
    );
  });

  it('returns persisted settings via GET /api/me', async () => {
    const { GET } = await import('@/app/api/me/route');

    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      name: 'Test User',
      username: 'testuser',
      avatarUrl: null,
      city: 'SF',
      createdAt: new Date(),
    });

    mockSettingsFindUnique.mockResolvedValue({
      accountVisibility: 'PRIVATE',
      defaultDetailLevel: 'DETAILS',
      allowSuggestions: false,
      emailInvitesEnabled: true,
      emailDigestEnabled: false,
    });

    const getRes = await GET();
    expect(getRes.status).toBe(200);

    const getBody = await getRes.json();
    expect(getBody.user.name).toBe('Test User');
    expect(getBody.settings.accountVisibility).toBe('PRIVATE');
    expect(getBody.settings.defaultDetailLevel).toBe('DETAILS');
    expect(getBody.settings.allowSuggestions).toBe(false);
    expect(getBody.settings.emailInvitesEnabled).toBe(true);
    expect(getBody.settings.emailDigestEnabled).toBe(false);
  });
});
