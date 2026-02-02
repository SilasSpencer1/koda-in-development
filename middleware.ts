import { auth } from '@/lib/auth/config';
import { NextResponse } from 'next/server';

// Use NextAuth's auth as middleware wrapper
export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public routes - anyone can access
  const publicRoutes = ['/', '/login', '/signup', '/api/auth'];

  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Protected routes under /app - require authentication
  if (pathname.startsWith('/app')) {
    if (!req.auth) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/auth (NextAuth routes)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
};
