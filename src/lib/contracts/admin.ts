import { z } from 'zod';

/**
 * Contratos de los endpoints de administración (ORDEN F2-3).
 */

// ─── Documentos legales ───────────────────────────────────────────────────

export const LEGAL_SLUGS = ['terminos', 'privacidad'] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export function isLegalSlug(s: unknown): s is LegalSlug {
  return typeof s === 'string' && (LEGAL_SLUGS as readonly string[]).includes(s);
}

export const legalSlugSchema = z
  .string()
  .trim()
  .min(1, 'El slug es obligatorio')
  .refine(isLegalSlug, {
    message: `El slug debe ser ${LEGAL_SLUGS.join(' | ')}`,
  });

export const legalContentSchema = z.string().min(1, 'Contenido vacío').max(50_000, 'Contenido demasiado largo (máx. 50.000)');
export const legalTitleSchema = z.string().min(1, 'Título vacío').max(200, 'Título demasiado largo (máx. 200)');

// ─── AIPROVIDERS (CRUD) ──────────────────────────────────────────────────

export const aiproKindSchema = z.enum(['anthropic', 'openai_compatible']);
export type AIPROKind = z.infer<typeof aiproKindSchema>;

export const aiproBaseUrlSchema = z
  .string()
  .min(1, 'baseUrl obligatoria')
  .max(512, 'baseUrl demasiado larga (máx. 512)')
  .refine(
    (v) => {
      try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'baseUrl debe ser una URL válida (http/https)' },
  );

export const aiproCreateSchema = z
  .object({
    label: z.string().min(1, 'label obligatoria').max(80, 'label demasiado larga (máx. 80)'),
    kind: aiproKindSchema,
    baseUrl: aiproBaseUrlSchema,
    model: z.string().min(1, 'model obligatoria').max(200, 'model demasiado larga (máx. 200)'),
    apiKey: z.string().max(2048, 'apiKey demasiado larga (máx. 2048)').optional(),
    enabled: z.boolean(),
    isDefault: z.boolean().default(false),
    priority: z.number().int().min(1, 'priority debe ser >= 1').max(10_000, 'priority debe ser <= 10000').default(100),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'openai_compatible' && !v.baseUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['baseUrl'],
        message: 'El proveedor OpenAI-compatible requiere una baseUrl válida (http/https)',
      });
    }
  });

export type AIProviderCreate = z.infer<typeof aiproCreateSchema>;

export const aiproUpdateSchema = z
  .object({
    label: z.string().min(1, 'label inválida').max(80, 'label demasiado larga (máx. 80)').optional(),
    baseUrl: aiproBaseUrlSchema.optional(),
    model: z.string().min(1, 'model inválida').max(200, 'model demasiado larga (máx. 200)').optional(),
    apiKey: z.string().max(2048, 'apiKey demasiado larga (máx. 2048)').optional(),
    enabled: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    priority: z.number().int().min(1, 'priority debe ser >= 1').max(10_000, 'priority debe ser <= 10000').optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'envía al menos un campo para actualizar',
  });

export type AIProviderUpdate = z.infer<typeof aiproUpdateSchema>;

export const aiproPublicSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: aiproKindSchema,
  baseUrl: z.string(),
  model: z.string(),
  enabled: z.boolean(),
  isDefault: z.boolean(),
  priority: z.number(),
  apiKeyMasked: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type AIProviderPublic = z.infer<typeof aiproPublicSchema>;

// ─── SETTINGS ─────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS = {
  limits: {
    creationsPer10Min: 20,
    freeCreationsPerMonth: 10,
  },
} as const;

export interface SettingsView {
  limits: {
    creationsPer10Min: number;
    freeCreationsPerMonth: number;
  };
}

export const settingsUpdateSchema = z.object({
  limits: z
    .object({
      creationsPer10Min: z
        .number()
        .int()
        .min(1, 'creationsPer10Min debe ser >= 1')
        .max(200, 'creationsPer10Min debe ser <= 200')
        .optional(),
      freeCreationsPerMonth: z
        .number()
        .int()
        .min(0, 'freeCreationsPerMonth debe ser >= 0')
        .max(10_000, 'freeCreationsPerMonth debe ser <= 10000')
        .optional(),
    })
    .optional(),
});

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

// ─── CREATIONS (solo lecturas admin) ─────────────────────────────────────

export interface CreationListQuery {
  type?: string;
  status?: string;
  userId?: string;
  platform?: string;
  page: number;
  pageSize: number;
  q?: string;
}

export interface CreationListItem {
  id: string;
  type: string;
  status: string;
  platform: string | null;
  model: string | null;
  userEmail: string | null;
  title: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

export interface CreationDetail {
  id: string;
  type: string;
  status: string;
  userId: string;
  userEmail: string | null;
  platform: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  model: string | null;
  createdAt: Date;
  parentId: string | null;
}

// ─── USERS (solo lecturas admin) ─────────────────────────────────────────

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  active: boolean;
  nCreaciones: number;
  createdAt: Date;
}

export interface UserUpdate {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  active: boolean;
  nCreaciones: number;
  createdAt: Date;
}

// ─── AUDIT (solo lecturas) ────────────────────────────────────────────────

export interface AuditLogItem {
  id: string;
  adminId: string;
  adminName: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AuditLogQuery {
  page: number;
  pageSize: number;
  action?: string;
  adminId?: string;
}
