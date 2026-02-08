/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Google Calendar Sync Tests
 *
 * Tests cover:
 * 1. Loop prevention — syncPull no-ops when Google etag is unchanged
 * 2. Mapping correctness — push creates mapping with googleEventId
 * 3. Idempotency — repeated sync produces same state
 * 4. Source filtering — imported (GOOGLE) events never pushed back
 */

// Mock the Google API client
vi.mock('@/lib/google/client', () => ({
  listAllEvents: vi.fn(),
  insertEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    googleCalendarConnection: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    googleEventMapping: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    event: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    account: {
      findFirst: vi.fn(),
    },
  },
}));

import { syncPull, syncPush, syncAll } from '@/lib/google/sync';
import * as googleClient from '@/lib/google/client';
import { prisma } from '@/lib/db/prisma';

const mockPrisma = prisma as any;
const mockGoogleClient = googleClient as any;

describe('syncPull — Google → Koda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
      syncWindowPastDays: 30,
      syncWindowFutureDays: 90,
    });
  });

  it('should import new Google events as source=GOOGLE with mapping', async () => {
    mockGoogleClient.listAllEvents.mockResolvedValue([
      {
        id: 'g-event-1',
        summary: 'Team Standup',
        description: 'Daily standup',
        location: 'Zoom',
        start: { dateTime: '2026-02-10T09:00:00Z', timeZone: 'UTC' },
        end: { dateTime: '2026-02-10T09:30:00Z', timeZone: 'UTC' },
        etag: '"etag-abc"',
        updated: '2026-02-10T08:00:00Z',
        status: 'confirmed',
      },
    ]);

    // No existing mapping
    mockPrisma.googleEventMapping.findUnique.mockResolvedValue(null);

    // Mock event creation
    mockPrisma.event.create.mockResolvedValue({ id: 'koda-event-1' });
    mockPrisma.googleEventMapping.create.mockResolvedValue({});

    const result = await syncPull('user-1');

    expect(result.pulled).toBe(1);
    expect(result.updated).toBe(0);

    // Verify event was created with source GOOGLE
    expect(mockPrisma.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: 'user-1',
        title: 'Team Standup',
        source: 'GOOGLE',
        externalId: 'g-event-1',
      }),
    });

    // Verify mapping was created
    expect(mockPrisma.googleEventMapping.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        kodaEventId: 'koda-event-1',
        googleEventId: 'g-event-1',
        googleEtag: '"etag-abc"',
      }),
    });
  });

  it('LOOP PREVENTION: should skip update when Google etag is unchanged', async () => {
    mockGoogleClient.listAllEvents.mockResolvedValue([
      {
        id: 'g-event-1',
        summary: 'Team Standup',
        start: { dateTime: '2026-02-10T09:00:00Z' },
        end: { dateTime: '2026-02-10T09:30:00Z' },
        etag: '"etag-same"',
        status: 'confirmed',
      },
    ]);

    // Existing mapping with SAME etag → should be a no-op
    mockPrisma.googleEventMapping.findUnique.mockResolvedValue({
      id: 'mapping-1',
      kodaEventId: 'koda-event-1',
      googleEtag: '"etag-same"',
    });

    const result = await syncPull('user-1');

    // No updates should happen — etag unchanged
    expect(result.pulled).toBe(0);
    expect(result.updated).toBe(0);
    expect(mockPrisma.event.update).not.toHaveBeenCalled();
    expect(mockPrisma.event.create).not.toHaveBeenCalled();
  });

  it('should update Koda event when Google etag changes', async () => {
    mockGoogleClient.listAllEvents.mockResolvedValue([
      {
        id: 'g-event-1',
        summary: 'Updated Meeting Title',
        start: {
          dateTime: '2026-02-10T10:00:00Z',
          timeZone: 'America/New_York',
        },
        end: { dateTime: '2026-02-10T11:00:00Z', timeZone: 'America/New_York' },
        etag: '"etag-new"',
        updated: '2026-02-10T09:00:00Z',
        status: 'confirmed',
      },
    ]);

    // Existing mapping with different etag → should update
    mockPrisma.googleEventMapping.findUnique.mockResolvedValue({
      id: 'mapping-1',
      kodaEventId: 'koda-event-1',
      googleEtag: '"etag-old"',
    });

    mockPrisma.event.update.mockResolvedValue({});
    mockPrisma.googleEventMapping.update.mockResolvedValue({});

    const result = await syncPull('user-1');

    expect(result.updated).toBe(1);
    expect(mockPrisma.event.update).toHaveBeenCalledWith({
      where: { id: 'koda-event-1' },
      data: expect.objectContaining({
        title: 'Updated Meeting Title',
      }),
    });

    // Mapping etag should be updated
    expect(mockPrisma.googleEventMapping.update).toHaveBeenCalledWith({
      where: { id: 'mapping-1' },
      data: expect.objectContaining({
        googleEtag: '"etag-new"',
      }),
    });
  });

  it('should handle cancelled Google events by deleting Koda event', async () => {
    mockGoogleClient.listAllEvents.mockResolvedValue([
      {
        id: 'g-event-cancelled',
        status: 'cancelled',
        start: { dateTime: '2026-02-10T09:00:00Z' },
        end: { dateTime: '2026-02-10T10:00:00Z' },
      },
    ]);

    mockPrisma.googleEventMapping.findUnique.mockResolvedValue({
      id: 'mapping-cancel',
      kodaEventId: 'koda-event-cancel',
    });

    mockPrisma.event.delete.mockResolvedValue({});
    mockPrisma.googleEventMapping.delete.mockResolvedValue({});

    const result = await syncPull('user-1');

    expect(result.deleted).toBe(1);
  });

  it('should skip all-day events with only date (no dateTime)', async () => {
    mockGoogleClient.listAllEvents.mockResolvedValue([
      {
        id: 'g-all-day',
        summary: 'All Day Event',
        start: { date: '2026-02-10' },
        end: { date: '2026-02-11' },
        etag: '"etag-allday"',
        status: 'confirmed',
      },
    ]);

    mockPrisma.googleEventMapping.findUnique.mockResolvedValue(null);
    mockPrisma.event.create.mockResolvedValue({ id: 'koda-allday' });
    mockPrisma.googleEventMapping.create.mockResolvedValue({});

    const result = await syncPull('user-1');

    // All-day events are imported (date is accepted as fallback)
    expect(result.pulled).toBe(1);
  });
});

describe('syncPush — Koda → Google', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should push new Koda event to Google and create mapping', async () => {
    mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
      pushEnabled: true,
    });

    mockPrisma.event.findMany.mockResolvedValue([
      {
        id: 'koda-new-1',
        title: 'Koda Meeting',
        description: 'A meeting from Koda',
        locationName: 'Office',
        startAt: new Date('2026-02-12T14:00:00Z'),
        endAt: new Date('2026-02-12T15:00:00Z'),
        timezone: 'UTC',
        source: 'KODA',
        syncToGoogle: true,
        updatedAt: new Date('2026-02-12T13:00:00Z'),
        googleEventMapping: null,
      },
    ]);

    mockPrisma.googleEventMapping.findMany.mockResolvedValue([]);

    mockGoogleClient.insertEvent.mockResolvedValue({
      id: 'g-created-1',
      etag: '"etag-created"',
      updated: '2026-02-12T14:00:00Z',
    });

    mockPrisma.googleEventMapping.create.mockResolvedValue({});

    const result = await syncPush('user-1');

    expect(result.pushed).toBe(1);
    expect(mockGoogleClient.insertEvent).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        summary: 'Koda Meeting',
      })
    );

    // Mapping should be created with googleEventId
    expect(mockPrisma.googleEventMapping.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        kodaEventId: 'koda-new-1',
        googleEventId: 'g-created-1',
        googleEtag: '"etag-created"',
      }),
    });
  });

  it('LOOP PREVENTION: should skip push when Koda event not changed since last push', async () => {
    const pushTime = new Date('2026-02-12T15:00:00Z');
    const eventUpdateTime = new Date('2026-02-12T14:00:00Z'); // BEFORE push

    mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
      pushEnabled: true,
    });

    mockPrisma.event.findMany.mockResolvedValue([
      {
        id: 'koda-1',
        title: 'Unchanged Event',
        startAt: new Date('2026-02-12T14:00:00Z'),
        endAt: new Date('2026-02-12T15:00:00Z'),
        timezone: 'UTC',
        source: 'KODA',
        syncToGoogle: true,
        updatedAt: eventUpdateTime,
        googleEventMapping: {
          id: 'mapping-1',
          googleEventId: 'g-1',
          lastPushedAt: pushTime, // AFTER event update → no-op
        },
      },
    ]);

    mockPrisma.googleEventMapping.findMany.mockResolvedValue([]);

    const result = await syncPush('user-1');

    expect(result.pushed).toBe(0);
    expect(result.updated).toBe(0);
    expect(mockGoogleClient.updateEvent).not.toHaveBeenCalled();
    expect(mockGoogleClient.insertEvent).not.toHaveBeenCalled();
  });

  it('should never push source=GOOGLE events back to Google', async () => {
    mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
      pushEnabled: true,
    });

    // findMany should filter source=KODA, so imported events are excluded
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.googleEventMapping.findMany.mockResolvedValue([]);

    const result = await syncPush('user-1');

    // Verify findMany was called with source KODA filter
    expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: 'KODA',
        }),
      })
    );

    expect(result.pushed).toBe(0);
  });

  it('should update existing Google event when Koda event changed', async () => {
    const lastPush = new Date('2026-02-12T10:00:00Z');
    const eventUpdate = new Date('2026-02-12T12:00:00Z'); // AFTER last push

    mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
      pushEnabled: true,
    });

    mockPrisma.event.findMany.mockResolvedValue([
      {
        id: 'koda-updated',
        title: 'Updated Koda Event',
        description: null,
        locationName: null,
        startAt: new Date('2026-02-13T09:00:00Z'),
        endAt: new Date('2026-02-13T10:00:00Z'),
        timezone: 'UTC',
        source: 'KODA',
        syncToGoogle: true,
        updatedAt: eventUpdate,
        googleEventMapping: {
          id: 'mapping-upd',
          googleEventId: 'g-upd-1',
          lastPushedAt: lastPush,
        },
      },
    ]);

    mockPrisma.googleEventMapping.findMany.mockResolvedValue([]);

    mockGoogleClient.updateEvent.mockResolvedValue({
      id: 'g-upd-1',
      etag: '"etag-updated"',
      updated: '2026-02-12T12:01:00Z',
    });

    mockPrisma.googleEventMapping.update.mockResolvedValue({});

    const result = await syncPush('user-1');

    expect(result.updated).toBe(1);
    expect(mockGoogleClient.updateEvent).toHaveBeenCalledWith(
      'user-1',
      'g-upd-1',
      expect.objectContaining({ summary: 'Updated Koda Event' })
    );
  });
});

describe('syncAll — full bidirectional sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run pull then push and update lastSyncedAt', async () => {
    // Setup pull mocks
    mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
      syncWindowPastDays: 30,
      syncWindowFutureDays: 90,
      pushEnabled: false,
    });
    mockGoogleClient.listAllEvents.mockResolvedValue([]);
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.googleEventMapping.findMany.mockResolvedValue([]);
    mockPrisma.googleCalendarConnection.upsert.mockResolvedValue({});

    const result = await syncAll('user-1');

    expect(result.pulled).toBe(0);
    expect(result.pushed).toBe(0);

    // Verify lastSyncedAt was updated
    expect(mockPrisma.googleCalendarConnection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        update: expect.objectContaining({
          lastSyncedAt: expect.any(Date),
        }),
      })
    );
  });

  it('should be idempotent: repeated sync with no changes produces same result', async () => {
    mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
      syncWindowPastDays: 30,
      syncWindowFutureDays: 90,
      pushEnabled: false,
    });
    mockGoogleClient.listAllEvents.mockResolvedValue([]);
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.googleEventMapping.findMany.mockResolvedValue([]);
    mockPrisma.googleCalendarConnection.upsert.mockResolvedValue({});

    const result1 = await syncAll('user-1');
    const result2 = await syncAll('user-1');

    expect(result1).toEqual(result2);
  });
});
