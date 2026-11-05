import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // 1. Always allow Next.js internal files, static assets, and favicon
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('npgrand_admin_token')?.value;

  // 2. Unauthenticated requests visiting protected routes must go to /login
  if (!token) {
    if (pathname === '/login') {
      return NextResponse.next();
    }
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/' && pathname !== '/dashboard') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 3. Authenticated requests visiting /login should redirect to /dashboard
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 4. Root '/' redirects to /dashboard for authenticated users
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};

