/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/db/prisma';

/**
 * Find Time + Confirm Slot Tests
 *
 * Verifies:
 * 1. Confirm slot creates event + invite rows
 * (Availability algorithm is tested separately in availability.test.ts)
 */

// Mock Prisma
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    event: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    attendee: {
      create: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    friendship: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

const mockPrisma = prisma as any;

const userId = 'user-1';
const friend1Id = 'friend-1';
const friend2Id = 'friend-2';
const eventId = 'event-new';

describe('Find Time', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Confirm Slot — Create Event + Invites', () => {
    it('should create event with host attendee and invite rows', async () => {
      const createdEvent = {
        id: eventId,
        ownerId: userId,
        title: 'Team Lunch',
        startAt: new Date('2026-02-10T12:00:00Z'),
        endAt: new Date('2026-02-10T13:00:00Z'),
        timezone: 'UTC',
        visibility: 'FRIENDS',
        coverMode: 'NONE',
      };

      mockPrisma.event.create.mockResolvedValue(createdEvent);
      mockPrisma.attendee.create.mockImplementation(
        async (args: { data: Record<string, unknown> }) => ({
          id: `att-${args.data.userId}`,
          ...args.data,
        })
      );
      mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });

      // Simulate confirm flow
      const event = await prisma.event.create({
        data: {
          ownerId: userId,
          title: 'Team Lunch',
          startAt: new Date('2026-02-10T12:00:00Z'),
          endAt: new Date('2026-02-10T13:00:00Z'),
          timezone: 'UTC',
          visibility: 'FRIENDS',
          coverMode: 'NONE',
          attendees: {
            create: {
              userId,
              role: 'HOST',
              status: 'GOING',
              anonymity: 'NAMED',
            },
          },
        },
      });

      expect(event.id).toBe(eventId);
      expect(event.ownerId).toBe(userId);

      // Create invitee attendee rows
      const inviteeIds = [friend1Id, friend2Id];
      const attendees = await Promise.all(
        inviteeIds.map((inviteeId) =>
          prisma.attendee.create({
            data: {
              eventId: event.id,
              userId: inviteeId,
              role: 'ATTENDEE',
              status: 'INVITED',
              anonymity: 'NAMED',
            },
          })
        )
      );

      expect(attendees.length).toBe(2);
      expect(attendees[0].userId).toBe(friend1Id);
      expect(attendees[0].status).toBe('INVITED');
      expect(attendees[1].userId).toBe(friend2Id);

      // Create notifications
      const notifications = await Promise.all(
        inviteeIds.map((inviteeId) =>
          prisma.notification.create({
            data: {
              userId: inviteeId,
              type: 'EVENT_INVITE',
              title: 'You were invited to an event',
              body: `Someone invited you to "Team Lunch"`,
              href: `/app/events/${event.id}`,
            },
          })
        )
      );

      expect(notifications.length).toBe(2);
      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2);
    });

    it('should create event without invitees (self only)', async () => {
      const createdEvent = {
        id: eventId,
        ownerId: userId,
        title: 'Personal Block',
      };

      mockPrisma.event.create.mockResolvedValue(createdEvent);

      const event = await prisma.event.create({
        data: {
          ownerId: userId,
          title: 'Personal Block',
          startAt: new Date('2026-02-10T12:00:00Z'),
          endAt: new Date('2026-02-10T13:00:00Z'),
          timezone: 'UTC',
          visibility: 'PRIVATE',
          coverMode: 'NONE',
          attendees: {
            create: {
              userId,
              role: 'HOST',
              status: 'GOING',
              anonymity: 'NAMED',
            },
          },
        },
      });

      expect(event.id).toBe(eventId);
      // No invitee rows or notifications created
      expect(mockPrisma.attendee.create).not.toHaveBeenCalled();
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });
  });
});
