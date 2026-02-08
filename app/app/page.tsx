'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Calendar, Users, MapPin, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeedEvent {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  locationName: string | null;
}

interface FeedFriend {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  detailLevel: string;
  eventCount: number;
  events: FeedEvent[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatEventTime(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);

  const timeStr = start.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const endTimeStr = end.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${timeStr} – ${endTimeStr}`;
}

function groupEventsByDay(events: FeedEvent[]): Map<string, FeedEvent[]> {
  const groups = new Map<string, FeedEvent[]>();
  for (const event of events) {
    const dateKey = new Date(event.startAt).toDateString();
    const existing = groups.get(dateKey) || [];
    existing.push(event);
    groups.set(dateKey, existing);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [friends, setFriends] = useState<FeedFriend[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFeed = useCallback(async () => {
    try {
      const res = await fetch('/api/feed');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFriends(data.friends || []);
    } catch {
      // Silently fail - feed is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Your Feed</h1>
        <p className="mt-1 text-sm text-gray-500">
          See what your friends are up to this week
        </p>
      </div>

      {/* Quick actions */}
      <div className="mb-8 flex gap-3">
        <Link href="/app/calendar">
          <Button variant="outline" size="sm" className="gap-2">
            <Calendar className="h-4 w-4" />
            My Calendar
          </Button>
        </Link>
        <Link href="/app/friends">
          <Button variant="outline" size="sm" className="gap-2">
            <Users className="h-4 w-4" />
            Friends
          </Button>
        </Link>
        <Link href="/app/discover">
          <Button variant="outline" size="sm" className="gap-2">
            <MapPin className="h-4 w-4" />
            Discover
          </Button>
        </Link>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 bg-white p-6"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
                <div className="space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-12 animate-pulse rounded bg-gray-100" />
                <div className="h-12 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      ) : friends.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <Users className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            Your feed is empty
          </h3>
          <p className="mx-auto mb-6 max-w-sm text-sm text-gray-500">
            Connect with friends and enable calendar sharing to see their
            upcoming events here.
          </p>
          <Link href="/app/friends">
            <Button className="gap-2 bg-blue-600 text-white hover:bg-blue-700">
              Find Friends
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {friends.map((friend) => {
            const dayGroups = groupEventsByDay(friend.events);

            return (
              <div
                key={friend.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                {/* Card header */}
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                  <div className="flex items-center gap-3">
                    {friend.avatarUrl ? (
                      <img
                        src={friend.avatarUrl}
                        alt={friend.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-sm font-bold text-white">
                        {friend.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {friend.name}
                      </p>
                      {friend.username && (
                        <p className="text-xs text-gray-500">
                          @{friend.username}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-gray-400">
                    {friend.eventCount} event
                    {friend.eventCount !== 1 ? 's' : ''} this week
                  </span>
                </div>

                {/* Events grouped by day */}
                <div className="px-5 py-3">
                  {friend.events.length === 0 ? (
                    <p className="py-3 text-center text-sm text-gray-400">
                      No upcoming events this week
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {Array.from(dayGroups.entries()).map(
                        ([dateStr, events]) => (
                          <div key={dateStr}>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                              {getDayLabel(dateStr)}
                            </p>
                            <div className="space-y-2">
                              {events.map((event) => (
                                <div
                                  key={event.id}
                                  className="flex items-start gap-3 rounded-lg bg-gray-50 px-3 py-2.5"
                                >
                                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-gray-900">
                                      {event.title}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {formatEventTime(
                                        event.startAt,
                                        event.endAt
                                      )}
                                    </p>
                                    {event.locationName && (
                                      <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                                        <MapPin className="h-3 w-3" />
                                        {event.locationName}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>

                {/* Card footer */}
                <div className="border-t border-gray-100 px-5 py-3">
                  <Link
                    href={`/app/friends/${friend.id}/calendar`}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    View full calendar
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
