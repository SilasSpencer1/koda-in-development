/**
 * Playwright E2E Smoke Tests -- Koda
 *
 * Covers the main flows:
 * 1. Signup/login
 * 2. Add friend + accept request
 * 3. Create event + invite friend
 * 4. Friend accepts invite (RSVP GOING)
 * 5. Calendar shows the event for both accounts
 *
 * Tests that depend on UI not yet implemented are marked test.fixme()
 * so they surface as "fixme" instead of silently passing.
 */

import { test, expect } from '@playwright/test';
import { createUser, login, logout, testUser } from './helpers';

// Two test users for the full flow
const userA = testUser('alice');
const userB = testUser('bob');

test.describe.serial('Koda Smoke Tests', () => {
  // -----------------------------------------------------------------------
  // 1. Signup/Login flow
  // -----------------------------------------------------------------------

  test('1. User A can sign up', async ({ page }) => {
    await createUser(page, userA);
    await expect(page).toHaveURL(/\/app/);
    // Verify user name appears in sidebar (use .first() since name also appears in welcome heading)
    await expect(
      page.getByText(userA.name, { exact: true }).first()
    ).toBeVisible();
  });

  test('2. User B can sign up', async ({ page }) => {
    await createUser(page, userB);
    await expect(page).toHaveURL(/\/app/);
    await expect(
      page.getByText(userB.name, { exact: true }).first()
    ).toBeVisible();
  });

  test('3. User A can log out and log back in', async ({ page }) => {
    await login(page, userA.email, userA.password);
    await expect(page).toHaveURL(/\/app/);
    await logout(page);
    // Log back in
    await login(page, userA.email, userA.password);
    await expect(page).toHaveURL(/\/app/);
  });

  // -----------------------------------------------------------------------
  // 2. Add friend + accept request
  //
  // Friends UI is not yet implemented (page shows "coming soon").
  // These tests are marked fixme so they surface instead of silently passing.
  // -----------------------------------------------------------------------

  test.fixme('4. User A sends friend request to User B', async ({ page }) => {
    await login(page, userA.email, userA.password);
    await page.goto('/app/friends');
    await page.waitForLoadState('networkidle');

    // The add-friend input must be visible for this flow to work
    const addFriendInput = page.getByPlaceholder(/search|email|username/i);
    await expect(addFriendInput).toBeVisible();
    await addFriendInput.fill(userB.email);

    const addBtn = page.getByRole('button', { name: /add|send|request/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Assert success indication (toast, text change, etc.)
    await expect(
      page.getByText(/sent|requested|pending/i).first()
    ).toBeVisible();
  });

  test.fixme('5. User B accepts friend request from User A', async ({
    page,
  }) => {
    await login(page, userB.email, userB.password);
    await page.goto('/app/friends');
    await page.waitForLoadState('networkidle');

    // Pending request accept button must be visible
    const acceptBtn = page.getByRole('button', { name: /accept/i }).first();
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();

    // Assert friendship was established
    await expect(
      page.getByText(/friend|accepted|connected/i).first()
    ).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 3. Create event + invite friend
  //
  // Event creation page (/app/events/new) does not exist yet and no invite
  // UI is present on the event detail page.
  // -----------------------------------------------------------------------

  test.fixme('6. User A creates an event', async ({ page }) => {
    await login(page, userA.email, userA.password);
    await page.goto('/app/events/new');
    await page.waitForLoadState('networkidle');

    // Event title input must be present
    const titleInput = page.getByLabel(/title/i);
    await expect(titleInput).toBeVisible();
    await titleInput.fill('E2E Test Event');

    // Submit the form
    const submitBtn = page.getByRole('button', {
      name: /create|save|submit/i,
    });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Should redirect to event detail or events list
    await expect(page).toHaveURL(/\/app\/events/);
    // Event title should appear on the resulting page
    await expect(page.getByText('E2E Test Event')).toBeVisible();
  });

  test.fixme('7. User A invites User B to the event', async ({ page }) => {
    await login(page, userA.email, userA.password);
    await page.goto('/app/events');
    await page.waitForLoadState('networkidle');

    // Navigate to the created event
    const eventLink = page.getByText('E2E Test Event').first();
    await expect(eventLink).toBeVisible();
    await eventLink.click();
    await page.waitForLoadState('networkidle');

    // Invite button must be visible on the event detail page
    const inviteBtn = page.getByRole('button', { name: /invite/i });
    await expect(inviteBtn).toBeVisible();
    await inviteBtn.click();

    // Assert invite was sent (toast, attendee list update, etc.)
    await expect(page.getByText(/invited|sent/i).first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 4. Friend accepts invite (RSVP)
  //
  // Depends on event creation + invite (tests 6-7) which are fixme.
  // -----------------------------------------------------------------------

  test.fixme('8. User B RSVPs GOING to the event', async ({ page }) => {
    await login(page, userB.email, userB.password);
    await page.goto('/app/events');
    await page.waitForLoadState('networkidle');

    // Find the invited event
    const eventLink = page.getByText('E2E Test Event').first();
    await expect(eventLink).toBeVisible();
    await eventLink.click();
    await page.waitForLoadState('networkidle');

    // RSVP going button must be present
    const goingBtn = page.getByRole('button', {
      name: /going|accept|rsvp/i,
    });
    await expect(goingBtn).toBeVisible();
    await goingBtn.click();

    // Assert RSVP was recorded
    await expect(page.getByText(/going/i).first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 5. Calendar shows the event
  // -----------------------------------------------------------------------

  test('9. User A sees calendar page', async ({ page }) => {
    await login(page, userA.email, userA.password);
    await page.goto('/app/calendar');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/app\/calendar/);
    // Calendar heading should be present
    await expect(
      page.getByRole('heading', { name: /calendar/i })
    ).toBeVisible();
  });

  test('10. User B sees calendar page', async ({ page }) => {
    await login(page, userB.email, userB.password);
    await page.goto('/app/calendar');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/app\/calendar/);
    await expect(
      page.getByRole('heading', { name: /calendar/i })
    ).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Landing page checks
  // -----------------------------------------------------------------------

  test('11. Landing page loads with all sections', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Hero
    await expect(
      page.getByRole('heading', { name: /share availability/i })
    ).toBeVisible();
    await expect(page.getByText(/get started/i).first()).toBeVisible();

    // Features
    await expect(page.getByText(/privacy first/i)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Google Calendar Sync', exact: true })
    ).toBeVisible();

    // FAQ
    await expect(page.getByText(/frequently asked/i)).toBeVisible();

    // Footer
    await expect(page.getByText(/all rights reserved/i)).toBeVisible();
  });

  test('12. Landing page has correct meta tags', async ({ page }) => {
    await page.goto('/');

    // Check title
    const title = await page.title();
    expect(title).toContain('Koda');

    // Check OG tags
    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute('content');
    expect(ogTitle).toContain('Koda');

    const ogDesc = await page
      .locator('meta[property="og:description"]')
      .getAttribute('content');
    expect(ogDesc).toBeTruthy();
  });
});
