import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import {
  validateFriendRequestCreation,
  isBlocked,
} from '@/lib/policies/friendship';
import {
  getClientId,
  checkRateLimit,
  setRateLimitHeaders,
} from '@/lib/rate-limit';
import { z } from 'zod';

// Friend request rate limit: 10 requests per minute per client
const FRIEND_REQUEST_RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60 * 1000,
  keyPrefix: 'friend-request',
};

const friendRequestSchema = z.object({
  targetUserId: z.string().min(1, 'Target user ID is required'),
});

export async function POST(req: NextRequest) {
  try {
    // Authenticate
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit
    const clientId = getClientId(req);
    const rateLimitResult = await checkRateLimit(
      clientId,
      FRIEND_REQUEST_RATE_LIMIT
    );

    if (!rateLimitResult.success) {
      const response = NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
      return setRateLimitHeaders(response, rateLimitResult);
    }

    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch {
      const response = NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
      return setRateLimitHeaders(response, rateLimitResult);
    }

    const result = friendRequestSchema.safeParse(body);
    if (!result.success) {
      const response = NextResponse.json(
        { error: 'Invalid request body', details: result.error.flatten() },
        { status: 400 }
      );
      return setRateLimitHeaders(response, rateLimitResult);
    }

    const { targetUserId } = result.data;

    // Validate friend request
    const validationError = await validateFriendRequestCreation(
      session.user.id,
      targetUserId
    );
    if (validationError) {
      const response = NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
      return setRateLimitHeaders(response, rateLimitResult);
    }

    // Check if blocked (should have been caught by validation, but double-check)
    const blocked = await isBlocked(session.user.id, targetUserId);
    if (blocked) {
      const response = NextResponse.json(
        { error: 'Cannot send request to blocked user' },
        { status: 400 }
      );
      return setRateLimitHeaders(response, rateLimitResult);
    }

    // Create friend request
    const friendship = await prisma.friendship.create({
      data: {
        requesterId: session.user.id,
        addresseeId: targetUserId,
        status: 'PENDING',
      },
      include: {
        requester: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
        addressee: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });

    const response = NextResponse.json(
      {
        id: friendship.id,
        requester: friendship.requester,
        addressee: friendship.addressee,
        status: friendship.status,
        createdAt: friendship.createdAt,
      },
      { status: 201 }
    );

    return setRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    console.error('Error creating friend request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
