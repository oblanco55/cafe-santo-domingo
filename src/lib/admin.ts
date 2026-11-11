/**
 * Servicio de administración (ORDEN F2-3).
 *
 * Todas las operaciones de escritura registran una entrada en AdminAuditLog
 * vía `logAdminAction`. Las rutas REST solo interpretan HTTP y delegan aquí.
 *
 * Reglas de seguridad:
 *  - NUNCA se devuelve la API key en claro: solo `maskSecret`.
 *  - `apiKeyEnc` se cifra con AES-256-GCM antes de persistir.
 *  - Un admin no puede despromoverse ni desactivarse a sí mismo (400).
 *  - El audit log solo admite lecturas; DELETE devuelve 405.
 */
import { AdminError } from '@/lib/admin-errors';
import { AIError } from '@/lib/ai/errors';
import { AnthropicProvider } from '@/lib/ai/anthropic';
import { OpenAICompatibleProvider } from '@/lib/ai/openai-compatible';
import type { AIProvider } from '@/lib/ai/provider';
import { decryptSecret, encryptSecret, maskSecret } from '@/lib/crypto';
import { logAdminAction, type Admin } from '@/lib/audit';
import { db } from '@/lib/db';
import {
  aiproCreateSchema,
  aiproUpdateSchema,
  settingsUpdateSchema,
  isLegalSlug,
  DEFAULT_SETTINGS,
  legalContentSchema,
  legalTitleSchema,
  type AIProviderCreate,
  type AIProviderPublic,
  type AIProviderUpdate,
  type SettingsUpdate,
  type SettingsView,
  type CreationDetail,
  type CreationListQuery,
  type CreationListItem,
  type UserListItem,
  type UserUpdate,
  type AuditLogItem,
  type AuditLogQuery,
  type LegalSlug,
} from '@/lib/contracts/admin';
import type { Role } from '@/generated/prisma/enums';

// ── Errores de negocio ────────────────────────────────────────────────────

export class AdminValidationError extends Error {
  constructor(
    public readonly message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'AdminValidationError';
  }
}

// ── IP de auditoría ───────────────────────────────────────────────────────

export function extractIp(req: { headers: { get(name: string): string | null } }): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const last = fwd.split(',').map((s) => s.trim()).filter(Boolean).at(-1);
    if (last) return last;
  }
  return req.headers.get('x-real-ip')?.trim() ?? 'unknown';
}

// ── Tipos Prisma ──────────────────────────────────────────────────────────

interface AIProviderRow {
  id: string;
  label: string;
  kind: 'anthropic' | 'openai_compatible';
  baseUrl: string | null;
  model: string;
  apiKeyEnc: string | null;
  enabled: boolean;
  isDefault: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: Date;
}

interface CreationRow {
  id: string;
  type: string;
  status: string;
  model: string | null;
  output: unknown;
  input: unknown;
  errorMessage: string | null;
  createdAt: Date;
  userId: string;
  parentId: string | null;
}

interface LegalRow {
  slug: string;
  title: string;
  content: string;
  version: number;
  updatedAt: Date;
  updatedBy: string | null;
}

// ─── AIPROVIDERS ─────────────────────────────────────────────────────────

function toPublic(row: AIProviderRow): AIProviderPublic {
  let apiKeyMasked = '';
  if (row.apiKeyEnc) {
    try {
      apiKeyMasked = maskSecret(decryptSecret(row.apiKeyEnc));
    } catch {
      apiKeyMasked = '••••';
    }
  }
  return {
    id: row.id,
    label: row.label,
    kind: row.kind,
    baseUrl: row.baseUrl ?? '',
    model: row.model,
    enabled: row.enabled,
    isDefault: row.isDefault,
    priority: row.priority,
    apiKeyMasked,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listProviders(): Promise<AIProviderPublic[]> {
  const rows: AIProviderRow[] = await db.aIProvider.findMany({
    orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }, { id: 'asc' }],
  });
  return rows.map(toPublic);
}

async function getProviderRow(id: string): Promise<AIProviderRow> {
  const row = await db.aIProvider.findFirst({ where: { id } });
  if (!row) throw new AdminError(404, 'NOT_FOUND', 'El proveedor no existe.');
  return row as AIProviderRow;
}

export async function createProvider(
  admin: Admin,
  ip: string,
  input: Record<string, unknown>,
): Promise<AIProviderPublic> {
  const parsed = aiproCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new AdminValidationError(
      parsed.error.issues.map((i) => i.message).join('; '),
    );
  }
  const data = parsed.data as AIProviderCreate;
  let apiKeyEnc: string | null = null;
  if (data.apiKey && data.apiKey.trim().length > 0) {
    apiKeyEnc = encryptSecret(data.apiKey);
  }

  const created = (await db.$transaction(async (tx) => {
    const row = await tx.aIProvider.create({
      data: {
        label: data.label,
        kind: data.kind,
        baseUrl: data.baseUrl,
        model: data.model,
        apiKeyEnc,
        enabled: data.enabled,
        isDefault: false,
        priority: data.priority,
      },
    });
    if (data.isDefault) {
      await tx.aIProvider.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
      await tx.aIProvider.update({ where: { id: row.id }, data: { isDefault: true } });
    }
    return row;
  })) as AIProviderRow;

  await logAdminAction(admin, 'aiprovider.create', created.id, {
    label: created.label,
    kind: created.kind,
    model: created.model,
    ip,
  });
  return toPublic(created);
}

export async function updateProvider(
  admin: Admin,
  ip: string,
  id: string,
  input: Record<string, unknown>,
): Promise<AIProviderPublic> {
  await getProviderRow(id);
  const parsed = aiproUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new AdminValidationError(
      parsed.error.issues.map((i) => i.message).join('; '),
    );
  }
  const patch = parsed.data as AIProviderUpdate;

  const data: Record<string, unknown> = {};
  if (patch.label !== undefined) data.label = patch.label;
  if (patch.baseUrl !== undefined) data.baseUrl = patch.baseUrl;
  if (patch.model !== undefined) data.model = patch.model;
  if (patch.enabled !== undefined) data.enabled = patch.enabled;
  if (patch.priority !== undefined) data.priority = patch.priority;
  if (patch.apiKey !== undefined && patch.apiKey.trim().length > 0) {
    data.apiKeyEnc = encryptSecret(patch.apiKey);
  }
  if (patch.isDefault !== undefined) data.isDefault = patch.isDefault;

  if (Object.keys(data).length === 0) {
    throw new AdminValidationError('envía al menos un campo para actualizar');
  }

  const updated = (await db.$transaction(async (tx) => {
    if (patch.isDefault === true) {
      await tx.aIProvider.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }
    return tx.aIProvider.update({ where: { id }, data });
  })) as AIProviderRow;

  await logAdminAction(admin, 'aiprovider.update', id, {
    changed: Object.keys(data).filter((k) => k !== 'apiKeyEnc'),
    apiKeyChanged: Boolean(data.apiKeyEnc),
    ip,
  });
  return toPublic(updated);
}

export async function deleteProvider(
  admin: Admin,
  ip: string,
  id: string,
): Promise<{ deleted: boolean; id: string }> {
  const existing = await getProviderRow(id);
  await db.aIProvider.delete({ where: { id } });
  if (existing.isDefault) {
    const next = await db.aIProvider.findFirst({
      where: { enabled: true },
      orderBy: [{ priority: 'asc' }, { id: 'asc' }],
    });
    if (next) {
      await db.aIProvider.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }
  await logAdminAction(admin, 'aiprovider.delete', id, { ip });
  return { deleted: true, id };
}

// ── Test de conexión a proveedor ─────────────────────────────────────────

export interface ProviderTestResult {
  ok: boolean;
  message: string;
  latencyMs: number | null;
  provider: 'anthropic' | 'openai_compatible';
}

export async function testProviderConnection(
  id: string,
  customKey?: string | null,
): Promise<ProviderTestResult> {
  const row = await getProviderRow(id);

  let apiKey: string | undefined;
  if (customKey && customKey.trim().length > 0) {
    apiKey = customKey;
  }

  const provider: AIProvider =
    row.kind === 'openai_compatible'
      ? new OpenAICompatibleProvider({
          baseUrl: row.baseUrl ?? 'https://api.openai.com/v1',
          apiKey,
          model: row.model,
        })
      : new AnthropicProvider(apiKey ?? 'test-key-placeholder', row.model);

  const start = Date.now();
  try {
    await provider.generate({
      system: 'Test de conexión',
      user: 'Say "ok"',
      toolName: 'test',
      jsonSchema: {
        type: 'object',
        properties: { ok: { type: 'string' } },
        required: ['ok'],
      },
      maxTokens: 16,
    });
    return {
      ok: true,
      message: 'Conexión exitosa',
      latencyMs: Date.now() - start,
      provider: row.kind,
    };
  } catch (e) {
    const latencyMs = Date.now() - start;
    if (e instanceof AIError) {
      return { ok: false, message: e.message, latencyMs, provider: row.kind };
    }
    return {
      ok: false,
      message: 'El proveedor devolvió un error inesperado.',
      latencyMs,
      provider: row.kind,
    };
  }
}

// ─── USERS ───────────────────────────────────────────────────────────────

export interface UsersListQuery {
  q: string | null;
  page: number;
  pageSize: number;
}

export async function listUsers(query: UsersListQuery): Promise<{
  count: number;
  page: number;
  pageSize: number;
  items: UserListItem[];
}> {
  const where: Record<string, unknown> = {};
  if (query.q && query.q.trim().length >= 2) {
    const pattern = query.q.trim().toLowerCase();
    where.OR = [
      { name: { contains: pattern, mode: 'insensitive' as const } },
      { email: { contains: pattern, mode: 'insensitive' as const } },
    ];
  }
  const [count, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { _count: { select: { creations: true } } },
    }),
  ]);

  return {
    count,
    page: query.page,
    pageSize: query.pageSize,
    items: (
      users as Array<UserRow & { _count: { creations: number } }>
    ).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as 'user' | 'admin',
      active: u.active,
      nCreaciones: u._count?.creations ?? 0,
      createdAt: u.createdAt,
    })),
  };
}

export async function updateUser(
  admin: Admin,
  ip: string,
  userId: string,
  patch: { role?: 'user' | 'admin'; active?: boolean },
): Promise<UserUpdate> {
  const user = (await db.user.findFirst({
    where: { id: userId },
    include: { _count: { select: { creations: true } } },
  })) as (UserRow & { _count: { creations: number } }) | null;
  if (!user) throw new AdminError(404, 'NOT_FOUND', 'El usuario no existe.');

  const isSelf = user.id === admin.id;
  if (isSelf && (patch.role !== undefined || patch.active !== undefined)) {
    throw new AdminValidationError(
      'No puedes cambiar tu propio rol ni desactivarte a ti mismo.',
    );
  }
  if (patch.role !== undefined && !['user', 'admin'].includes(patch.role)) {
    throw new AdminValidationError('El rol debe ser "user" o "admin".');
  }
  if (patch.role === 'user' && user.role === 'admin') {
    const adminCount = await db.user.count({ where: { role: 'admin' } });
    if (adminCount <= 1) {
      throw new AdminValidationError('No puedes despromover al único admin del sistema.');
    }
  }

  const data: Record<string, unknown> = {};
  if (patch.role !== undefined) data.role = patch.role;
  if (patch.active !== undefined) data.active = patch.active;

  const updated = await db.user.update({ where: { id: userId }, data });

  await logAdminAction(admin, 'user.update', userId, {
    role: patch.role ?? (user.role as string),
    active: patch.active ?? user.active,
    ip,
  });

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role as 'user' | 'admin',
    active: updated.active,
    nCreaciones: (updated as UserRow & { _count?: { creations: number } })._count?.creations ?? 0,
    createdAt: updated.createdAt,
  };
}

// ─── CREATIONS ───────────────────────────────────────────────────────────

export async function listCreations(query: CreationListQuery): Promise<{
  count: number;
  page: number;
  pageSize: number;
  items: CreationListItem[];
}> {
  const where: Record<string, unknown> = {};
  if (query.type) where.type = query.type;
  if (query.status) where.status = query.status;
  if (query.userId) where.userId = query.userId;

  const [count, rows] = await Promise.all([
    db.creation.count({ where }),
    db.creation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { user: { select: { email: true } } },
    }),
  ]);

  const items = (
    rows as Array<CreationRow & { user: { email: string } | null }>
  ).map((c) => {
    const out = c.output as Record<string, unknown> | null;
    return {
      id: c.id,
      type: c.type,
      status: c.status,
      platform: out && typeof out === 'object' && 'platform' in out ? String(out.platform) : null,
      model: c.model ?? null,
      userEmail: c.user?.email ?? null,
      title: out && typeof out === 'object' && 'title' in out ? String(out.title) : null,
      errorMessage: c.errorMessage ?? null,
      createdAt: c.createdAt,
    };
  });

  return { count, page: query.page, pageSize: query.pageSize, items };
}

export async function getCreationDetail(id: string): Promise<CreationDetail> {
  const row = (await db.creation.findFirst({
    where: { id },
    include: { user: { select: { email: true } } },
  })) as (CreationRow & { user: { email: string } | null }) | null;
  if (!row) throw new AdminError(404, 'NOT_FOUND', 'La creación no existe.');

  const out = row.output as Record<string, unknown> | null;
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    userId: row.userId,
    userEmail: row.user?.email ?? null,
    platform: out && typeof out === 'object' && 'platform' in out ? String(out.platform) : null,
    input: (row.input ?? {}) as Record<string, unknown>,
    output: out,
    errorMessage: row.errorMessage ?? null,
    model: row.model ?? null,
    createdAt: row.createdAt,
    parentId: row.parentId ?? null,
  };
}

// ─── LEGAL ───────────────────────────────────────────────────────────────

export async function listLegalDocuments(): Promise<
  Array<{ slug: string; title: string; version: number; updatedAt: Date; updatedBy: string | null }>
> {
  const rows: LegalRow[] = await db.legalDocument.findMany({ orderBy: { slug: 'asc' } });
  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    version: r.version,
    updatedAt: r.updatedAt,
    updatedBy: r.updatedBy,
  }));
}

export async function getLegalDocument(slug: string): Promise<LegalRow> {
  if (!isLegalSlug(slug)) throw new AdminError(404, 'NOT_FOUND', 'Documento legal no encontrado.');
  const row = await db.legalDocument.findFirst({ where: { slug } });
  if (!row) throw new AdminError(404, 'NOT_FOUND', 'Documento legal no encontrado.');
  return row as LegalRow;
}

export async function upsertLegalDocument(
  admin: Admin,
  ip: string,
  slug: LegalSlug,
  input: Record<string, unknown>,
): Promise<LegalRow> {
  if (!isLegalSlug(slug)) throw new AdminValidationError('Slug inválido.');

  const content = input.content as string | undefined;
  const title = input.title as string | undefined;

  if (content === undefined) throw new AdminValidationError('content es obligatorio.');
  const c = legalContentSchema.safeParse(content);
  if (!c.success) throw new AdminValidationError(c.error.issues.map((i) => i.message).join('; '));

  const t = legalTitleSchema.safeParse(title ?? '');
  if (!t.success) throw new AdminValidationError(t.error.issues.map((i) => i.message).join('; '));

  const existing = await db.legalDocument.findFirst({ where: { slug } });
  const next = await db.legalDocument.upsert({
    where: { slug },
    update: {
      title: t.data,
      content: c.data,
      updatedBy: admin.id,
      version: existing ? existing.version + 1 : 1,
    },
    create: {
      slug,
      title: t.data,
      content: c.data,
      version: existing ? existing.version + 1 : 1,
      updatedBy: admin.id,
    },
  });

  await logAdminAction(admin, 'legal.update', slug, { title: t.data, version: next.version, ip } as Record<string, unknown>);
  return next as LegalRow;
}

// ─── SETTINGS ────────────────────────────────────────────────────────────

function numOrDefault(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

export async function getSettings(): Promise<SettingsView> {
  const keys = ['limits.creationsPer10Min', 'limits.freeCreationsPerMonth'];
  const rows: Array<{ key: string; value: unknown }> = await (
    db.appSetting as unknown as {
      findMany: (args: { where: { key: { in: string[] } } }) => Promise<Array<{ key: string; value: unknown }>>;
    }
  ).findMany({ where: { key: { in: keys } } });
  const map: Record<string, unknown> = {};
  for (const r of rows) map[r.key] = r.value;

  return {
    limits: {
      creationsPer10Min: numOrDefault(map['limits.creationsPer10Min'], DEFAULT_SETTINGS.limits.creationsPer10Min),
      freeCreationsPerMonth: numOrDefault(map['limits.freeCreationsPerMonth'], DEFAULT_SETTINGS.limits.freeCreationsPerMonth),
    },
  };
}

export async function updateSettings(
  admin: Admin,
  ip: string,
  input: Record<string, unknown>,
): Promise<SettingsView> {
  const parsed = settingsUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new AdminValidationError(
      parsed.error.issues.map((i) => i.message).join('; '),
    );
  }
  const data = parsed.data as SettingsUpdate;
  const limits = data.limits ?? {};
  const updates: Array<[string, number]> = [];
  if (limits.creationsPer10Min !== undefined) {
    updates.push(['limits.creationsPer10Min', limits.creationsPer10Min]);
  }
  if (limits.freeCreationsPerMonth !== undefined) {
    updates.push(['limits.freeCreationsPerMonth', limits.freeCreationsPerMonth]);
  }
  if (updates.length === 0) {
    throw new AdminValidationError('envía al menos una llave en "limits".');
  }

  await Promise.all(
    updates.map(([k, v]) =>
      (db.appSetting as unknown as {
        upsert: (args: Record<string, unknown>) => Promise<{ id: string }>;
      }).upsert({
        where: { key: k },
        update: { value: v, updatedBy: admin.id },
        create: { key: k, value: v, updatedBy: admin.id },
      }),
    ),
  );

  await logAdminAction(admin, 'settings.update', null, { keys: updates.map(([k]) => k), ip } as Record<string, unknown>);

  return {
    limits: {
      creationsPer10Min: limits.creationsPer10Min ?? DEFAULT_SETTINGS.limits.creationsPer10Min,
      freeCreationsPerMonth: limits.freeCreationsPerMonth ?? DEFAULT_SETTINGS.limits.freeCreationsPerMonth,
    },
  };
}

// ─── METRICS ─────────────────────────────────────────────────────────────

export async function getMetrics(days: number): Promise<{
  users: { total: number; activos: number; nuevosPeriodo: number };
  creations: {
    total: number;
    periodo: number;
    porTipo: { video: number; photo: number; carousel: number };
    porPlataforma: Record<string, number>;
    errores: number;
    porDia: Array<{ fecha: string; total: number }>;
  };
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const [totalUsers, activeUsers, newUsers, totalCreations, periodoCreations] =
    await Promise.all([
      db.user.count(),
      db.user.count({ where: { active: true } }),
      db.user.count({ where: { createdAt: { gte: cutoff } } }),
      db.creation.count(),
      db.creation.count({ where: { createdAt: { gte: cutoff } } }),
    ]);

  const typeRows = await db.creation.groupBy({
    by: ['type'],
    where: { createdAt: { gte: cutoff } },
    _count: { _all: true },
  });
  const porTipo = { video: 0, photo: 0, carousel: 0 };
  for (const r of typeRows) {
    const k = r.type as keyof typeof porTipo;
    if (k in porTipo) porTipo[k] = r._count._all;
  }

  const errores = await db.creation.count({
    where: { status: 'error', createdAt: { gte: cutoff } },
  });

  const diaRows = await db.creation.findMany({
    where: { createdAt: { gte: cutoff } },
    select: { createdAt: true, output: true },
  });
  const byDay = new Map<string, number>();
  const porPlataforma: Record<string, number> = {};
  for (const r of diaRows) {
    const fecha = r.createdAt.toISOString().slice(0, 10);
    byDay.set(fecha, (byDay.get(fecha) ?? 0) + 1);
    const out = r.output as Record<string, unknown> | null;
    if (out && typeof out === 'object' && 'platform' in out) {
      const p = String(out.platform);
      porPlataforma[p] = (porPlataforma[p] ?? 0) + 1;
    }
  }
  const porDia = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fecha, total]) => ({ fecha, total }));

  return {
    users: { total: totalUsers, activos: activeUsers, nuevosPeriodo: newUsers },
    creations: {
      total: totalCreations,
      periodo: periodoCreations,
      porTipo,
      porPlataforma,
      errores,
      porDia,
    },
  };
}

// ─── AUDIT ───────────────────────────────────────────────────────────────

export async function auditList(query: AuditLogQuery): Promise<{
  count: number;
  page: number;
  pageSize: number;
  items: AuditLogItem[];
}> {
  const where: Record<string, unknown> = {};
  if (query.action) {
    where.action = { startsWith: query.action.split('.')[0] };
  }
  if (query.adminId) where.adminId = query.adminId;

  const [count, rows] = await Promise.all([
    db.adminAuditLog.count({ where }),
    db.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    count,
    page: query.page,
    pageSize: query.pageSize,
    items: (
      rows as Array<{
        id: string;
        adminId: string;
        action: string;
        target: string | null;
        detail: unknown;
        createdAt: Date;
      }>
    ).map((r) => ({
      id: r.id,
      adminId: r.adminId,
      adminName: null,
      action: r.action,
      target: r.target,
      detail: (r.detail ?? null) as Record<string, unknown> | null,
      createdAt: r.createdAt,
    })),
  };
}

