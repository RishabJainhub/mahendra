import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabasePublicEnv } from '@/lib/env';

const PUBLIC_PATHS = ['/login', '/reset-password'];

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.')
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const env = getSupabasePublicEnv();

  if (!env) {
    if (!isPublicPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return response;
  }

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user) {
    const appMeta = user.app_metadata ?? {};
    const role = appMeta.role as string | undefined;
    const mustReset = appMeta.must_reset_password === true;

    if (mustReset && role === 'supplier' && !pathname.startsWith('/reset-password')) {
      const url = request.nextUrl.clone();
      url.pathname = '/reset-password';
      return NextResponse.redirect(url);
    }

    if (role === 'admin' && pathname.startsWith('/supplier')) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    if (role === 'supplier' && pathname.startsWith('/admin')) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    if (PUBLIC_PATHS.includes(pathname) && !mustReset) {
      const url = request.nextUrl.clone();
      url.pathname = role === 'admin' ? '/admin' : '/supplier';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
