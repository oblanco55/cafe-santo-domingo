import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireUser, UnauthenticatedError } from '@/lib/session';
import { jsonError } from '@/lib/api-errors';
import type { CreationType } from '@/lib/contracts';
import type { Creation, Prisma } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';

const VALID_TYPES: readonly CreationType[] = ['video', 'photo', 'carousel'];
const PAGE_SIZE = 20;

type Parsed = { type: CreationType | null; page: number };

function parseQuery(searchParams: URLSearchParams): Parsed {
  // type: solo se filtra cuando el valor es uno de los tres válidos.
  // Ningún otro valor → se ignora (no es error: evita romper clientes antiguos).
  const rawType = searchParams.get('type');
  const type =
    rawType && (VALID_TYPES as readonly string[]).includes(rawType)
      ? (rawType as CreationType)
      : null;

  // page: entero >= 1; valores no numéricos o < 1 → página 1.
  const rawPage = searchParams.get('page');
  const parsed = rawPage === null ? NaN : Number(rawPage);
  const page = Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;

  return { type, page };
}

type WhereForList = Prisma.CreationWhereInput;

function whereFor(userId: string, type: CreationType | null): WhereForList {
  return {
    userId,
    status: 'ok' as const,
    hiddenAt: null,
    ...(type ? { type } : {}),
  };
}

/**
 * GET /api/creations?type=video|photo|carousel&page=N
 *
 * Devuelve las creaciones propias del usuario autenticado con status 'ok'
 * y NO ocultas (hiddenAt = null), ordenadas por createdAt desc, 20 por página.
 *
 * Respuesta:
 *   {
 *     count: number,          // total de creaciones visibles (del filtro)
 *     page: number,
 *     pageSize: number,
 *     items: Array<{ id, type, title, platform, createdAt, parentId }>
 *   }
 *
 * title  = output.title  (null si no existe)
 * platform = input.platform (null si no existe)
 */
export async function GET(req: NextRequest) {
  let userId: string;
  try {
    const user = await requireUser();
    userId = user.id;
  } catch (e) {
    if (e instanceof UnauthenticatedError) {
      return NextResponse.json(e.body, { status: e.status });
    }
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }

  const { type, page } = parseQuery(req.nextUrl.searchParams);

  const where: WhereForList = whereFor(userId, type);

  let count = 0;
  let rows: Creation[] = [];
  try {
    [count, rows] = await Promise.all([
      db.creation.count({ where }),
      db.creation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);
  } catch {
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }

  const items = rows.map((row) => {
    const output = row.output as { title?: unknown } | null | undefined;
    const input = row.input as { platform?: unknown } | null | undefined;
    return {
      id: row.id,
      type: row.type as CreationType,
      title: typeof (output?.title ?? null) === 'string' ? (output as { title: string }).title : null,
      platform: typeof (input?.platform ?? null) === 'string' ? (input as { platform: string }).platform : null,
      createdAt: row.createdAt?.toISOString?.() ?? new Date(0).toISOString(),
      parentId: row.parentId ?? null,
    };
  });

  return NextResponse.json({ count, page, pageSize: PAGE_SIZE, items });
}
