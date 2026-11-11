/**
 * Tipos compartidos del Panel de Administración (F2-4).
 * Definen las formas de respuesta de la API admin que el frontend consume.
 */

// ── Métricas ──────────────────────────────────────────────────────────────

export interface MetricsResponse {
  users: {
    total: number;
    active: number;
    inactive: number;
    byRole: { user: number; admin: number };
    last7: Array<{ date: string; count: number }>;
  };
  creations: {
    total: number;
    ok: number;
    error: number;
    pending: number;
    byType: Array<{ id: string; count: number }>;
    last7: Array<{ date: string; count: number }>;
  };
  ai: {
    providers: number;
    activeProviders: number;
    byModel: Array<{ model: string; count: number }>;
  };
  settings: {
    maxPendingPerUser: number | null;
    limits: Record<string, number | null>;
  };
}

// ── Usuarios ──────────────────────────────────────────────────────────────

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  counts: { creations: number; activeCreations: number };
}

export interface UsersResponse {
  items: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export type UserPatch = { role?: "user" | "admin"; active?: boolean };

// ── Creaciones ────────────────────────────────────────────────────────────

export interface CreationListItem {
  id: string;
  email: string | null;
  name: string | null;
  type: string;
  status: string;
  model: string | null;
  createdAt: string;
}

export interface CreationsResponse {
  items: CreationListItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CreationDetail {
  id: string;
  type: string;
  status: string;
  model: string | null;
  input: unknown;
  output: unknown;
  errorMessage: string | null;
  email: string | null;
  name: string | null;
  createdAt: string;
}

// ── Legal ─────────────────────────────────────────────────────────────────

export interface LegalDocument {
  slug: "terminos" | "privacidad";
  title: string;
  content: string;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
}

export interface LegalResponse {
  docs: LegalDocument[];
}

// ── Settings ──────────────────────────────────────────────────────────────

export interface SettingsView {
  maxPendingPerUser: number | null;
  limits: Record<string, number | null>;
  updatedAt: string | null;
  updatedBy: string | null;
}

// ── AI Providers / Presets ────────────────────────────────────────────────

export interface AIProviderPublic {
  id: string;
  label: string;
  kind: "anthropic" | "openai_compatible";
  baseUrl: string | null;
  model: string;
  apiKeyMasked: string | null;
  enabled: boolean;
  isDefault: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface AIProvidersResponse {
  providers: AIProviderPublic[];
}

export interface AIPreset {
  id: string;
  label: string;
  kind: "anthropic" | "openai_compatible";
  baseUrl: string | null;
  model: string;
}

export interface AIPresetsResponse {
  presets: AIPreset[];
}

export interface AITestResponse {
  ok: boolean;
  model: string;
  tokens: number | null;
  latencyMs: number;
  sample: string | null;
}
