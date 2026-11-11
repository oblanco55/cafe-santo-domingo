import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import type { ApiError } from '@/lib/contracts';

/**
 * Middleware de protección de rutas.
 *
 * - Rutas privadas de UI (/panel, /crear/*): redirige a /login si no hay sesión.
 * - Usuario autenticado en /login o /registro: redirige a /panel.
 * - Rutas privadas de API (/api/creations/*, /api/profile): devuelve 401 JSON (formato ApiError).
 *
 * Nota: Next.js middleware puede exportar `auth` desde src/auth.ts de forma asíncrona,
 * pero para evitar problemas de runtime en el edge, aquí se usa `auth()` sin argumentos
 * que lee la cookie internamente.
 */
export default auth((req) => {
  const user = req.auth?.user;
  const isLoggedIn = Boolean(user?.id);
  const path = req.nextUrl.pathname;

  // Usuario autenticado intenta llegar a /login o /registro → /panel
  if (isLoggedIn && (path === '/login' || path === '/registro')) {
    return NextResponse.redirect(new URL('/panel', req.nextUrl));
  }

  // Rutas privadas de UI
  const isUiPrivate =
    path === '/panel' ||
    path.startsWith('/panel/') ||
    path.startsWith('/crear/') ||
    (path === '/creaciones' || path.startsWith('/creaciones/')) ||
    path === '/perfil';
  if (!isLoggedIn && isUiPrivate) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }

  // Rutas privadas de API → 401 JSON
  const isApiPrivate =
    path.startsWith('/api/creations/') || path === '/api/profile';
  if (!isLoggedIn && isApiPrivate) {
    const body: ApiError = {
      error: { code: 'UNAUTHORIZED', message: 'Debes iniciar sesión para ver estos datos.' },
    };
    return NextResponse.json(body, { status: 401, headers: { 'content-type': 'application/json' } });
  }

  return NextResponse.next();
});

export const config = {
  // Excluir assets estáticos y la propia API de auth de Auth.js para no buclar.
  matcher: ['/panel/:path*', '/crear/:path*', '/creaciones/:path*', '/creaciones', '/perfil', '/login', '/registro', '/api/creations/:path*', '/api/profile'],
  runtime: 'nodejs',
};
