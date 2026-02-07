import { describe, it, expect, vi } from 'vitest';
import type { SuggestionDTO } from '@/lib/discover/types';

/**
 * Ranking + pipeline integration test.
 *
 * Verifies:
 * - CLOSED suggestions are filtered out
 * - Deduplication by externalId
 * - Deduplication by venue+title
 * - UNKNOWN hours => confidence LOW
 */

// We test the pipeline logic by mocking the fetch functions
vi.mock('@/lib/discover/ticketmaster', () => ({
  fetchTicketmasterEvents: vi.fn(),
}));

vi.mock('@/lib/discover/osm', () => ({
  fetchOsmPlaces: vi.fn(),
}));

import { fetchAndRankSuggestions } from '@/lib/discover/ranking';
import { fetchTicketmasterEvents } from '@/lib/discover/ticketmaster';
import { fetchOsmPlaces } from '@/lib/discover/osm';

const mockTm = fetchTicketmasterEvents as ReturnType<typeof vi.fn>;
const mockOsm = fetchOsmPlaces as ReturnType<typeof vi.fn>;

function makeSuggestion(overrides: Partial<SuggestionDTO> = {}): SuggestionDTO {
  return {
    source: 'OSM',
    title: 'Test Place',
    isOpenAtTime: 'OPEN',
    confidence: 'HIGH',
    slotStartAt: '2026-02-10T18:00:00.000Z',
    slotEndAt: '2026-02-10T21:00:00.000Z',
    ...overrides,
  };
}

describe('fetchAndRankSuggestions', () => {
  const query = {
    city: 'New York',
    radiusMiles: 10,
    interests: ['cafe'],
    slotStart: new Date('2026-02-10T18:00:00Z'),
    slotEnd: new Date('2026-02-10T21:00:00Z'),
  };

  it('should filter out CLOSED suggestions', async () => {
    mockTm.mockResolvedValue([]);
    mockOsm.mockResolvedValue([
      makeSuggestion({ title: 'Open Cafe', isOpenAtTime: 'OPEN' }),
      makeSuggestion({
        title: 'Closed Cafe',
        isOpenAtTime: 'CLOSED',
        externalId: 'closed-1',
      }),
      makeSuggestion({
        title: 'Unknown Cafe',
        isOpenAtTime: 'UNKNOWN',
        confidence: 'LOW',
        externalId: 'unknown-1',
      }),
    ]);

    const results = await fetchAndRankSuggestions(query);

    expect(results.length).toBe(2);
    expect(results.find((r) => r.title === 'Closed Cafe')).toBeUndefined();
    expect(results.find((r) => r.title === 'Open Cafe')).toBeDefined();
    expect(results.find((r) => r.title === 'Unknown Cafe')).toBeDefined();
  });

  it('should deduplicate by externalId', async () => {
    mockTm.mockResolvedValue([]);
    mockOsm.mockResolvedValue([
      makeSuggestion({ title: 'Cafe A', externalId: 'osm-node-123' }),
      makeSuggestion({ title: 'Cafe A Copy', externalId: 'osm-node-123' }),
    ]);

    const results = await fetchAndRankSuggestions(query);
    expect(results.length).toBe(1);
  });

  it('should deduplicate by venue+title', async () => {
    mockTm.mockResolvedValue([]);
    mockOsm.mockResolvedValue([
      makeSuggestion({ title: 'Good Coffee', venueName: 'Good Coffee' }),
      makeSuggestion({
        title: 'Good Coffee',
        venueName: 'Good Coffee',
        externalId: 'osm-2',
      }),
    ]);

    const results = await fetchAndRankSuggestions(query);
    expect(results.length).toBe(1);
  });

  it('should return UNKNOWN confidence as LOW', async () => {
    mockTm.mockResolvedValue([]);
    mockOsm.mockResolvedValue([
      makeSuggestion({
        title: 'Mystery Place',
        isOpenAtTime: 'UNKNOWN',
        confidence: 'LOW',
        externalId: 'mystery-1',
      }),
    ]);

    const results = await fetchAndRankSuggestions(query);
    expect(results.length).toBe(1);
    expect(results[0].confidence).toBe('LOW');
    expect(results[0].isOpenAtTime).toBe('UNKNOWN');
  });

  it('should merge Ticketmaster and OSM results', async () => {
    mockTm.mockResolvedValue([
      makeSuggestion({
        source: 'TICKETMASTER',
        title: 'Concert',
        externalId: 'tm-1',
      }),
    ]);
    mockOsm.mockResolvedValue([
      makeSuggestion({
        source: 'OSM',
        title: 'Nice Cafe',
        externalId: 'osm-1',
      }),
    ]);

    const results = await fetchAndRankSuggestions(query);
    expect(results.length).toBe(2);
    expect(results.map((r) => r.source).sort()).toEqual([
      'OSM',
      'TICKETMASTER',
    ]);
  });
});
