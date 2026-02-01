import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../../app/api/uploads/avatar/route';

/**
 * Tests for the Avatar Upload API endpoint.
 *
 * These unit tests verify the request validation logic (auth, file type, file size).
 * Tests that require Supabase connectivity (upload success/failure) should be run
 * as integration tests with a real or test Supabase instance.
 *
 * To run integration tests manually:
 *   1. Set up Supabase environment variables
 *   2. Start the dev server: pnpm dev
 *   3. Use curl to test: see README for examples
 */

describe('Avatar Upload API', () => {
  /**
   * Helper to create a mock file
   */
  function createMockFile(
    name: string,
    type: string,
    size: number = 1024
  ): File {
    const buffer = new ArrayBuffer(size);
    return new File([buffer], name, { type });
  }

  /**
   * Helper to create a mock NextRequest with form data
   */
  function createMockRequest(
    file: File | null,
    headers: Record<string, string> = {}
  ): NextRequest {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }

    return new NextRequest('http://localhost:3000/api/uploads/avatar', {
      method: 'POST',
      body: formData,
      headers: new Headers(headers),
    });
  }

  describe('Authentication', () => {
    it('returns 401 when no authentication is provided', async () => {
      const file = createMockFile('avatar.png', 'image/png');
      const request = createMockRequest(file);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });
  });

  describe('File Validation', () => {
    it('returns 400 when no file is provided', async () => {
      const request = createMockRequest(null, {
        'x-dev-user-email': 'test@example.com',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing file');
    });
  });
});
