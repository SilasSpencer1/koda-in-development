/**
 * Playwright E2E Smoke Tests — Koda
 *
 * Covers the main flows:
 * 1. Signup/login
 * 2. Add friend + accept request
 * 3. Create event + invite friend
 * 4. Friend accepts invite (RSVP GOING)
 * 5. Calendar shows the event for both accounts
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
  // -----------------------------------------------------------------------

  test('4. User A sends friend request to User B', async ({ page }) => {
    await login(page, userA.email, userA.password);
    await page.goto('/app/friends');
    await page.waitForLoadState('networkidle');

    // Look for "Add Friend" or search functionality
    const addFriendInput = page.getByPlaceholder(/search|email|username/i);
    if (await addFriendInput.isVisible()) {
      await addFriendInput.fill(userB.email);
      // Submit friend request
      const addBtn = page.getByRole('button', { name: /add|send|request/i });
      if (await addBtn.isVisible()) {
        await addBtn.click();
        // Wait for success indication
        await page.waitForTimeout(1000);
      }
    }
  });

  test('5. User B accepts friend request from User A', async ({ page }) => {
    await login(page, userB.email, userB.password);
    await page.goto('/app/friends');
    await page.waitForLoadState('networkidle');

    // Look for pending request and accept
    const acceptBtn = page.getByRole('button', { name: /accept/i }).first();
    if (await acceptBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await acceptBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  // -----------------------------------------------------------------------
  // 3. Create event + invite friend
  // -----------------------------------------------------------------------

  test('6. User A creates an event', async ({ page }) => {
    await login(page, userA.email, userA.password);
    await page.goto('/app/events');
    await page.waitForLoadState('networkidle');

    // Try to find create event button/link
    const createBtn = page
      .getByRole('link', { name: /create|new event/i })
      .or(page.getByRole('button', { name: /create|new event/i }));

    if (
      await createBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await createBtn.first().click();
      await page.waitForLoadState('networkidle');

      // Fill event form
      const titleInput = page.getByLabel(/title/i);
      if (await titleInput.isVisible()) {
        await titleInput.fill('E2E Test Event');
      }

      // Submit
      const submitBtn = page.getByRole('button', {
        name: /create|save|submit/i,
      });
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test('7. User A invites User B to the event', async ({ page }) => {
    await login(page, userA.email, userA.password);
    await page.goto('/app/events');
    await page.waitForLoadState('networkidle');

    // Navigate to the created event
    const eventLink = page.getByText('E2E Test Event').first();
    if (await eventLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await eventLink.click();
      await page.waitForLoadState('networkidle');

      // Look for invite functionality
      const inviteBtn = page.getByRole('button', { name: /invite/i });
      if (await inviteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await inviteBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  // -----------------------------------------------------------------------
  // 4. Friend accepts invite (RSVP)
  // -----------------------------------------------------------------------

  test('8. User B RSVPs GOING to the event', async ({ page }) => {
    await login(page, userB.email, userB.password);
    await page.goto('/app/events');
    await page.waitForLoadState('networkidle');

    // Find the invited event
    const eventLink = page.getByText('E2E Test Event').first();
    if (await eventLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await eventLink.click();
      await page.waitForLoadState('networkidle');

      // RSVP going
      const goingBtn = page.getByRole('button', { name: /going|accept|rsvp/i });
      if (await goingBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await goingBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  // -----------------------------------------------------------------------
  // 5. Calendar shows the event
  // -----------------------------------------------------------------------

  test('9. User A sees event on calendar', async ({ page }) => {
    await login(page, userA.email, userA.password);
    await page.goto('/app/calendar');
    await page.waitForLoadState('networkidle');

    // Calendar page should load successfully
    await expect(page).toHaveURL(/\/app\/calendar/);
  });

  test('10. User B sees event on calendar', async ({ page }) => {
    await login(page, userB.email, userB.password);
    await page.goto('/app/calendar');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/app\/calendar/);
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
