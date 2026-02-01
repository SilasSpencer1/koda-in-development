import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create 3 users with upsert for idempotency
  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {
      name: 'Alice Johnson',
      username: 'alice',
      city: 'San Francisco',
    },
    create: {
      email: 'alice@example.com',
      name: 'Alice Johnson',
      username: 'alice',
      city: 'San Francisco',
    },
  });
  console.log(`  Created/updated user: ${alice.name} (${alice.email})`);

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {
      name: 'Bob Smith',
      username: 'bob',
      city: 'San Francisco',
    },
    create: {
      email: 'bob@example.com',
      name: 'Bob Smith',
      username: 'bob',
      city: 'San Francisco',
    },
  });
  console.log(`  Created/updated user: ${bob.name} (${bob.email})`);

  const charlie = await prisma.user.upsert({
    where: { email: 'charlie@example.com' },
    update: {
      name: 'Charlie Brown',
      username: 'charlie',
      city: 'New York',
    },
    create: {
      email: 'charlie@example.com',
      name: 'Charlie Brown',
      username: 'charlie',
      city: 'New York',
    },
  });
  console.log(`  Created/updated user: ${charlie.name} (${charlie.email})`);

  // Create settings for each user
  for (const user of [alice, bob, charlie]) {
    await prisma.settings.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        accountVisibility:
          user.email === 'alice@example.com' ? 'PUBLIC' : 'FRIENDS_ONLY',
        defaultDetailLevel: 'BUSY_ONLY',
        allowSuggestions: true,
      },
    });
  }
  console.log('  Created/updated settings for all users');

  // Create an accepted friendship between Alice and Bob
  // Use a deterministic approach: always have the lower ID as requester
  const [requesterId, addresseeId] = [alice.id, bob.id].sort();
  await prisma.friendship.upsert({
    where: {
      requesterId_addresseeId: {
        requesterId,
        addresseeId,
      },
    },
    update: {
      status: 'ACCEPTED',
      canViewCalendar: true,
      detailLevel: 'DETAILS',
    },
    create: {
      requesterId,
      addresseeId,
      status: 'ACCEPTED',
      canViewCalendar: true,
      detailLevel: 'DETAILS',
    },
  });
  console.log('  Created/updated friendship: Alice <-> Bob (accepted)');

  // Create some events
  // First, delete existing events by these users to avoid duplicates
  // (events don't have a natural unique key like email)
  const existingEvents = await prisma.event.findMany({
    where: { ownerId: { in: [alice.id, bob.id] } },
    select: { id: true },
  });

  if (existingEvents.length > 0) {
    await prisma.attendee.deleteMany({
      where: { eventId: { in: existingEvents.map((e) => e.id) } },
    });
    await prisma.event.deleteMany({
      where: { id: { in: existingEvents.map((e) => e.id) } },
    });
    console.log('  Cleaned up existing events');
  }

  // Create new events
  const coffeeDate = await prisma.event.create({
    data: {
      ownerId: alice.id,
      title: 'Coffee with Bob',
      description: 'Weekly coffee catch-up',
      locationName: 'Blue Bottle Coffee, SF',
      startAt: new Date('2026-02-05T10:00:00Z'),
      endAt: new Date('2026-02-05T11:00:00Z'),
      timezone: 'America/Los_Angeles',
      visibility: 'FRIENDS',
      coverMode: 'NONE',
      source: 'KODA',
    },
  });
  console.log(`  Created event: ${coffeeDate.title}`);

  const teamLunch = await prisma.event.create({
    data: {
      ownerId: bob.id,
      title: 'Team Lunch',
      description: 'Monthly team gathering',
      locationName: 'The Italian Place',
      startAt: new Date('2026-02-10T12:00:00Z'),
      endAt: new Date('2026-02-10T13:30:00Z'),
      timezone: 'America/Los_Angeles',
      visibility: 'FRIENDS',
      coverMode: 'NONE',
      source: 'KODA',
    },
  });
  console.log(`  Created event: ${teamLunch.title}`);

  const privateEvent = await prisma.event.create({
    data: {
      ownerId: alice.id,
      title: 'Dentist Appointment',
      locationName: "Dr. Smith's Office",
      startAt: new Date('2026-02-08T14:00:00Z'),
      endAt: new Date('2026-02-08T15:00:00Z'),
      timezone: 'America/Los_Angeles',
      visibility: 'PRIVATE',
      coverMode: 'BUSY_ONLY',
      source: 'KODA',
    },
  });
  console.log(`  Created event: ${privateEvent.title}`);

  // Create attendees
  // Alice is host of coffee date, Bob is attendee
  await prisma.attendee.create({
    data: {
      eventId: coffeeDate.id,
      userId: alice.id,
      status: 'GOING',
      role: 'HOST',
      anonymity: 'NAMED',
    },
  });
  await prisma.attendee.create({
    data: {
      eventId: coffeeDate.id,
      userId: bob.id,
      status: 'GOING',
      role: 'ATTENDEE',
      anonymity: 'NAMED',
    },
  });
  console.log('  Created attendees for Coffee with Bob');

  // Bob is host of team lunch, Alice is invited
  await prisma.attendee.create({
    data: {
      eventId: teamLunch.id,
      userId: bob.id,
      status: 'GOING',
      role: 'HOST',
      anonymity: 'NAMED',
    },
  });
  await prisma.attendee.create({
    data: {
      eventId: teamLunch.id,
      userId: alice.id,
      status: 'INVITED',
      role: 'ATTENDEE',
      anonymity: 'NAMED',
    },
  });
  console.log('  Created attendees for Team Lunch');

  // Alice is sole attendee (host) of private event
  await prisma.attendee.create({
    data: {
      eventId: privateEvent.id,
      userId: alice.id,
      status: 'GOING',
      role: 'HOST',
      anonymity: 'NAMED',
    },
  });
  console.log('  Created attendee for Dentist Appointment');

  console.log('Seed completed successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
