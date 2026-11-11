import { db } from '@/lib/db';

/**
 * Utilidad de auditoría para las rutas F2-3 (admin).
 *
 * `logAdminAction` persiste una fila en `AdminAuditLog` de forma no
 * bloqueante: un fallo de persistencia nunca rompe la ruta. El `detail`
 * es JSON libre y DEBE contener solo metadatos seguros (nunca API keys,
 * tokens, contraseñas — las funciones de servicio ya las limpian).
 */
export type Admin = {
  id: string;
  name: string | null;
  email: string | null;
};

export async function logAdminAction(
  admin: Admin,
  action: string,
  target: string | null = null,
  detail: Record<string, unknown> = {},
  error: string | null = null,
): Promise<void> {
  const allDetail = { ...detail, ...(error ? { error } : {}) };
  try {
    const row = await db.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action,
        target: target ?? null,
        detail: JSON.parse(JSON.stringify(allDetail)) as object,
      },
    });
    void row;
  } catch {
    // Nunca romper la ruta principal por auditoría.
  }
}
