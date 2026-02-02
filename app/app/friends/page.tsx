import Link from 'next/link';
import Image from 'next/image';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { redirect } from 'next/navigation';

export default async function FriendsPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  // Get all accepted friendships
  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: userId }, { addresseeId: userId }],
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

  // Format friendships to show from current user's perspective
  const friends = friendships.map((f) => ({
    friendshipId: f.id,
    friend: f.requesterId === userId ? f.addressee : f.requester,
    canViewCalendar: f.canViewCalendar,
    detailLevel: f.detailLevel,
  }));

  return (
    <div className="max-w-4xl">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Friends</h1>

      {friends.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-gray-600">
            You don&apos;t have any friends yet.{' '}
            <Link
              href="/app"
              className="font-medium text-blue-600 hover:text-blue-700"
            >
              Add one
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {friends.map((f) => (
            <div
              key={f.friendshipId}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-6"
            >
              <div className="flex items-center gap-4">
                {f.friend.avatarUrl && (
                  <Image
                    src={f.friend.avatarUrl}
                    alt={f.friend.name}
                    width={48}
                    height={48}
                    className="rounded-full object-cover"
                  />
                )}
                <div>
                  <p className="font-semibold text-gray-900">{f.friend.name}</p>
                  {f.friend.username && (
                    <p className="text-sm text-gray-600">
                      @{f.friend.username}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/app/friends/${f.friend.id}/calendar`}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  View Calendar
                </Link>
                <Link
                  href={`/app/friends/${f.friendshipId}/sharing`}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Sharing Settings
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
