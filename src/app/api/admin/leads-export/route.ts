import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // Type assertion in case prisma client is not yet generated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaClient = db as any;

  const users = await prismaClient.user.findMany({
    where: { role: 'user' },
    include: {
      customerLead: true,
      _count: { select: { creations: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const header = [
    'ID',
    'Nombre',
    'Email',
    'WhatsApp',
    'Producto Favorito',
    'Acepta Promos',
    'Avatares Creados',
    'Fecha Registro',
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = users.map((u: any) => [
    u.id,
    `"${(u.name || '').replace(/"/g, '""')}"`,
    u.email,
    u.customerLead?.phone ?? '',
    `"${(u.customerLead?.favoriteProduct ?? '').replace(/"/g, '""')}"`,
    u.customerLead?.marketingOptIn ? 'SI' : 'NO',
    u._count?.creations ?? 0,
    u.createdAt ? new Date(u.createdAt).toISOString() : '',
  ]);

  const csv = [header.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-cafe-santo-domingo-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
