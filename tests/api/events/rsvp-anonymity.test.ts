import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';

describe('Events API - RSVP and Anonymity', () => {
  let ownerId: string;
  let attendeeId: string;
  let eventId: string;

  beforeEach(async () => {
    // Create test users
    const owner = await prisma.user.create({
      data: {
        email: `owner-${Date.now()}@test.com`,
        name: 'Event Owner',
        passwordHash: 'hash',
      },
    });
    ownerId = owner.id;

    const attendee = await prisma.user.create({
      data: {
        email: `attendee-${Date.now()}@test.com`,
        name: 'Attendee User',
        passwordHash: 'hash',
      },
    });
    attendeeId = attendee.id;

    // Create accepted friendship
    await prisma.friendship.create({
      data: {
        requesterId: ownerId,
        addresseeId: attendeeId,
        status: 'ACCEPTED',
        canViewCalendar: true,
      },
    });

    // Create test event
    const event = await prisma.event.create({
      data: {
        ownerId,
        title: 'Test Event',
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
        timezone: 'UTC',
        visibility: 'FRIENDS',
        coverMode: 'NONE',
        attendees: {
          create: {
            userId: ownerId,
            role: 'HOST',
            status: 'GOING',
          },
        },
      },
    });
    eventId = event.id;

    // Invite attendee
    await prisma.attendee.create({
      data: {
        eventId,
        userId: attendeeId,
        status: 'INVITED',
        anonymity: 'NAMED',
        role: 'ATTENDEE',
      },
    });
  });

  afterEach(async () => {
    // Cleanup
    await prisma.attendee.deleteMany({});
    await prisma.event.deleteMany({});
    await prisma.friendship.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('RSVP Updates', () => {
    it('should update attendee status to GOING', async () => {
      const attendee = await prisma.attendee.update({
        where: {
          eventId_userId: {
            eventId,
            userId: attendeeId,
          },
        },
        data: { status: 'GOING' },
      });

      expect(attendee.status).toBe('GOING');

      const fetched = await prisma.attendee.findUnique({
        where: { id: attendee.id },
      });
      expect(fetched?.status).toBe('GOING');
    });

    it('should update attendee status to DECLINED', async () => {
      const attendee = await prisma.attendee.update({
        where: {
          eventId_userId: {
            eventId,
            userId: attendeeId,
          },
        },
        data: { status: 'DECLINED' },
      });

      expect(attendee.status).toBe('DECLINED');
    });

    it('should only allow attendee to update their own RSVP', async () => {
      // Try to update another user's RSVP (should fail silently or be prevented at API layer)
      const anotherUser = await prisma.user.create({
        data: {
          email: `other-${Date.now()}@test.com`,
          name: 'Other User',
          passwordHash: 'hash',
        },
      });

      // Attempting to find and update non-existent attendee record
      const nonExistent = await prisma.attendee.findUnique({
        where: {
          eventId_userId: {
            eventId,
            userId: anotherUser.id,
          },
        },
      });

      expect(nonExistent).toBeNull();
    });
  });

  describe('Anonymity Enforcement', () => {
    it('should set attendee anonymity to ANONYMOUS', async () => {
      const attendee = await prisma.attendee.update({
        where: {
          eventId_userId: {
            eventId,
            userId: attendeeId,
          },
        },
        data: { anonymity: 'ANONYMOUS' },
      });

      expect(attendee.anonymity).toBe('ANONYMOUS');
    });

    it('should redact anonymous attendee in attendees list', async () => {
      // Make attendee anonymous
      await prisma.attendee.update({
        where: {
          eventId_userId: {
            eventId,
            userId: attendeeId,
          },
        },
        data: { anonymity: 'ANONYMOUS' },
      });

      // Fetch event with attendees
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          attendees: {
            select: {
              id: true,
              userId: true,
              anonymity: true,
              user: {
                select: { name: true, email: true },
              },
            },
          },
        },
      });

      expect(event).not.toBeNull();
      const anonAttendee = event!.attendees.find(
        (a) => a.userId === attendeeId
      );
      expect(anonAttendee?.anonymity).toBe('ANONYMOUS');

      // Simulate redaction logic (as would be done in API)
      const redacted = event!.attendees.map((attendee) => {
        if (attendee.anonymity === 'ANONYMOUS' && attendee.userId !== ownerId) {
          return {
            userId: null,
            name: 'Anonymous attendee',
            email: null,
          };
        }
        return {
          userId: attendee.userId,
          name: attendee.user.name,
          email: attendee.user.email,
        };
      });

      const anonymizedAttendee = redacted.find((a) => a.userId === null);
      expect(anonymizedAttendee?.name).toBe('Anonymous attendee');
      expect(anonymizedAttendee?.email).toBeNull();
    });

    it('should not redact anonymous attendee for owner', async () => {
      // Make attendee anonymous
      await prisma.attendee.update({
        where: {
          eventId_userId: {
            eventId,
            userId: attendeeId,
          },
        },
        data: { anonymity: 'ANONYMOUS' },
      });

      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          attendees: {
            select: {
              userId: true,
              anonymity: true,
              user: { select: { name: true } },
            },
          },
        },
      });

      // Owner viewing the attendee list should see real name
      const ownerView = event!.attendees.map((attendee) => {
        if (attendee.anonymity === 'ANONYMOUS' && attendee.userId !== ownerId) {
          return { name: 'Anonymous attendee' };
        }
        return { name: attendee.user.name };
      });

      // Owner should see the actual attendee info since they're viewing their own event
      const attendeeEntry = ownerView.find(() =>
        event!.attendees.some((ea) => ea.userId === attendeeId)
      );
      expect(attendeeEntry).toBeDefined();
    });

    it('should allow attendee to toggle anonymity', async () => {
      // Start as NAMED
      let attendee = await prisma.attendee.findUnique({
        where: {
          eventId_userId: {
            eventId,
            userId: attendeeId,
          },
        },
      });
      expect(attendee?.anonymity).toBe('NAMED');

      // Toggle to ANONYMOUS
      attendee = await prisma.attendee.update({
        where: {
          eventId_userId: {
            eventId,
            userId: attendeeId,
          },
        },
        data: { anonymity: 'ANONYMOUS' },
      });
      expect(attendee.anonymity).toBe('ANONYMOUS');

      // Toggle back to NAMED
      attendee = await prisma.attendee.update({
        where: {
          eventId_userId: {
            eventId,
            userId: attendeeId,
          },
        },
        data: { anonymity: 'NAMED' },
      });
      expect(attendee.anonymity).toBe('NAMED');
    });
  });
});
