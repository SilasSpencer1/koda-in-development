'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CalendarGrid, AgendaList } from '@/components/calendar/CalendarGrid';

interface Event {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  timezone: string;
  status?: string;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true);
        setError(null);

        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        const url = new URL('/api/events', window.location.origin);
        url.searchParams.set('from', weekStart.toISOString());
        url.searchParams.set('to', weekEnd.toISOString());

        const response = await fetch(url.toString(), {
          method: 'GET',
          credentials: 'include', // Include cookies for authentication
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: response.statusText }));
          throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const data = await response.json();
        setEvents(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching events:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch events');
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, []);

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-violet-50">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-200/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-200/10 rounded-full blur-3xl" />
      </div>

      {/* Page content */}
      <div className="relative z-10 container max-w-7xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Calendar</h1>
          <p className="text-slate-600">
            View and manage your events with friends
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-slate-600">Loading your calendar...</div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
            Error: {error}
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Calendar grid - main content */}
            <div className="lg:col-span-2">
              <CalendarGrid events={events} onEventClick={handleEventClick} />
            </div>

            {/* Agenda list - sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-4">
                <h2 className="text-xl font-semibold text-slate-900 mb-4">
                  Upcoming Events
                </h2>
                <AgendaList events={events} onEventClick={handleEventClick} />

                <Link
                  href="/app/events/new"
                  className="block mt-6 px-6 py-3 text-center bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white font-semibold rounded-full backdrop-blur-md border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Create Event
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Event detail modal */}
        {selectedEvent && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedEvent(null)}
          >
            <div
              className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {selectedEvent.title}
                  </h2>
                  <p className="text-slate-600 mt-1">
                    {new Date(selectedEvent.startAt).toLocaleString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}{' '}
                    -{' '}
                    {new Date(selectedEvent.endAt).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="flex gap-3">
                <Link
                  href={`/app/events/${selectedEvent.id}`}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors text-center"
                >
                  View Details
                </Link>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
