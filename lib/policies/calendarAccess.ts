/**
 * Calendar access authorization and privacy policy helpers
 *
 * Enforces:
 * 1. Block relationships (if blocked, no access)
 * 2. Friendship acceptance (must be accepted friends)
 * 3. Per-friend overrides (override owner defaults if set)
 * 4. Event visibility rules (PRIVATE events show as busy to friends)
 */

import { prisma } from '@/lib/db/prisma';
import type { EventVisibility } from '@prisma/client';
import { isBlocked } from '@/lib/policies/friendship';

/**
 * Calendar permission result
 */
export interface CalendarPermission {
  allowed: boolean;
  detailLevel: 'BUSY_ONLY' | 'DETAILS' | null;
}

/**
 * Get the effective calendar access permission for a viewer to see an owner's calendar
 *
 * Rules:
 * 1. If blocked (either direction), not allowed
 * 2. If not accepted friends, not allowed
 * 3. If accepted friends, compute effective detailLevel:
 *    - If friendship has canViewCalendar=false, not allowed
 *    - Otherwise, use per-friend override if set, else use owner's default
 */
export async function getFriendCalendarPermission(
  ownerId: string,
  viewerId: string
): Promise<CalendarPermission> {
  // Check if blocked
  const blocked = await isBlocked(viewerId, ownerId);
  if (blocked) {
    return { allowed: false, detailLevel: null };
  }

  // Check if accepted friends (bidirectional check)
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        {
          requesterId: viewerId,
          addresseeId: ownerId,
          status: 'ACCEPTED',
        },
        {
          requesterId: ownerId,
          addresseeId: viewerId,
          status: 'ACCEPTED',
        },
      ],
    },
    select: {
      canViewCalendar: true,
      detailLevel: true,
      requesterId: true,
      addresseeId: true,
    },
  });

  // Not friends
  if (!friendship) {
    return { allowed: false, detailLevel: null };
  }

  // Check canViewCalendar flag
  if (!friendship.canViewCalendar) {
    return { allowed: false, detailLevel: null };
  }

  // Get owner's default settings
  const ownerSettings = await prisma.settings.findUnique({
    where: { userId: ownerId },
    select: { defaultDetailLevel: true },
  });

  // Use per-friend override if set, else use owner default
  const effectiveDetailLevel =
    friendship.detailLevel || ownerSettings?.defaultDetailLevel || 'BUSY_ONLY';

  return { allowed: true, detailLevel: effectiveDetailLevel };
}

/**
 * Redacted event for calendar view
 */
export interface RedactedEvent {
  id: string;
  startAt: Date;
  endAt: Date;
  title: string;
  locationName?: string | null;
  redacted: boolean;
}

/**
 * Filter and redact events based on viewer's calendar permission
 *
 * Rules:
 * - Always include id, startAt, endAt
 * - If detailLevel is BUSY_ONLY or event is PRIVATE:
 *   - title = "Busy"
 *   - exclude locationName
 *   - set redacted = true
 * - If detailLevel is DETAILS and event is not PRIVATE:
 *   - include title
 *   - include optional locationName
 *   - set redacted = false
 * - PRIVATE events always show as Busy even if viewer has DETAILS permission
 */
export function filterEventsForViewer(
  events: Array<{
    id: string;
    title: string;
    startAt: Date;
    endAt: Date;
    locationName?: string | null;
    visibility: EventVisibility;
  }>,
  permission: CalendarPermission
): RedactedEvent[] {
  if (!permission.allowed) {
    return [];
  }

  return events.map((event) => {
    const isPrivate = event.visibility === 'PRIVATE';
    const isBusyOnly = permission.detailLevel === 'BUSY_ONLY';

    const redacted = isPrivate || isBusyOnly;

    return {
      id: event.id,
      startAt: event.startAt,
      endAt: event.endAt,
      title: redacted ? 'Busy' : event.title,
      locationName: redacted ? undefined : event.locationName,
      redacted,
    };
  });
}
