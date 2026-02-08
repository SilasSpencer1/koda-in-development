import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get accepted friendships where calendar viewing is allowed
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId, status: 'ACCEPTED', canViewCalendar: true },
          { addresseeId: userId, status: 'ACCEPTED', canViewCalendar: true },
        ],
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
        addressee: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Build map of friendId -> { friend info, detail level }
    const friendMap = new Map<
      string,
      {
        friend: {
          id: string;
          name: string;
          username: string | null;
          avatarUrl: string | null;
        };
        detailLevel: string;
      }
    >();

    for (const f of friendships) {
      const friendId = f.requesterId === userId ? f.addresseeId : f.requesterId;
      const friend = f.requesterId === userId ? f.addressee : f.requester;
      friendMap.set(friendId, { friend, detailLevel: f.detailLevel });
    }

    if (friendMap.size === 0) {
      return NextResponse.json({ friends: [] });
    }

    // Fetch upcoming events for all viewable friends in a single query
    const events = await prisma.event.findMany({
      where: {
        ownerId: { in: Array.from(friendMap.keys()) },
        startAt: { lte: weekFromNow },
        endAt: { gte: now },
        visibility: { in: ['FRIENDS', 'PUBLIC'] },
      },
      select: {
        id: true,
        title: true,
        description: true,
        startAt: true,
        endAt: true,
        locationName: true,
        ownerId: true,
      },
      orderBy: { startAt: 'asc' },
    });

    // Group events by friend
    const eventsByFriend = new Map<string, typeof events>();
    for (const event of events) {
      const existing = eventsByFriend.get(event.ownerId) || [];
      existing.push(event);
      eventsByFriend.set(event.ownerId, existing);
    }

    // Build response array
    const friends = Array.from(friendMap.entries()).map(
      ([friendId, { friend, detailLevel }]) => {
        const friendEvents = eventsByFriend.get(friendId) || [];
        return {
          ...friend,
          detailLevel,
          eventCount: friendEvents.length,
          events: friendEvents.map((e) => ({
            id: e.id,
            title: detailLevel === 'BUSY_ONLY' ? 'Busy' : e.title,
            description: detailLevel === 'BUSY_ONLY' ? null : e.description,
            startAt: e.startAt,
            endAt: e.endAt,
            locationName: detailLevel === 'BUSY_ONLY' ? null : e.locationName,
          })),
        };
      }
    );

    // Sort: friends with most upcoming events first
    friends.sort((a, b) => b.eventCount - a.eventCount);

    return NextResponse.json({ friends });
  } catch (error) {
    console.error('[GET /api/feed]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
