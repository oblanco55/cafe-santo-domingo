import { z } from 'zod';

/**
 * Esquemas de AUTENTICACIÓN (registro e inicio de sesión).
 * Mensajes de error en español, listos para mostrar al usuario.
 * Sin lógica de negocio: solo validación de datos.
 */

const nameSchema = z
  .string()
  .trim()
  .min(2, 'El nombre completo debe tener al menos 2 caracteres.')
  .max(80, 'El nombre completo no debe superar 80 caracteres.');

const emailSchema = z
  .email('Introduce un correo electrónico válido.')
  .max(254, 'El correo electrónico no debe superar 254 caracteres.')
  .transform((v) => v.toLowerCase())
  .describe('Correo electrónico (normalizado a minúsculas)');

const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña no debe superar 72 caracteres.')
  .regex(/[a-zA-Z]/, 'La contraseña debe incluir al menos una letra.')
  .regex(/[0-9]/, 'La contraseña debe incluir al menos un número.');

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal(true, {
    error: 'Debes aceptar los términos y la política de privacidad.',
  }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Introduce tu contraseña.'),
});
export type LoginInput = z.infer<typeof loginSchema>;
