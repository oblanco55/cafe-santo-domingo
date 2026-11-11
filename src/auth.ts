import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { isAdminEmail } from '@/lib/admin-emails';

/**
 * Configuración de Auth.js (NextAuth v5) para Café Santo Domingo.
 * - Provider de credenciales (email + contraseña) verificado contra User.passwordHash.
 * - Sesión JWT en cookie httpOnly (secure en producción por defecto de Auth.js).
 * - Los callbacks exponen user.id y user.name en la sesión.
 * - Usa AUTH_SECRET del entorno; trustHost:true porque Railway está detrás de proxy.
 *
 * IMPORTANTE: db es importado de forma estática desde @/lib/db.
 * El middleware corre con runtime: 'nodejs' (config en src/middleware.ts),
 * así node:fs/node:crypto no rompen la compilación.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Correo electrónico', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email
          ?.toString()
          .trim()
          .toLowerCase();
        const password = credentials?.password?.toString() ?? '';
        if (!email || !password) return null;

        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            role: true,
            active: true,
          },
        });
        if (!user) return null;

        // Cuentas desactivadas no pueden iniciar sesión.
        if (user.active === false) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // Si el correo está en ADMIN_EMAILS pero el role en BD no es admin,
        // se actualiza a admin (idempotente) para mantener coherencia.
        let role = user.role;
        if (isAdminEmail(email) && user.role !== 'admin') {
          await db.user.update({ where: { id: user.id }, data: { role: 'admin' } });
          role = 'admin';
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email ?? undefined,
          role,
        } as {
          id: string;
          name: string;
          email: string | undefined;
          role: 'user' | 'admin';
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id =
          typeof token.id === 'string' ? token.id : (session.user.id as string);
        if (token.name) session.user.name = token.name as string;
        session.user.role = token.role ?? 'user';
      }
      return session;
    },
  },
});
