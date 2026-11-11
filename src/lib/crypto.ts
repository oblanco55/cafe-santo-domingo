import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

/**
 * Cifrado de secretos para SCRIPT 28 (Fase 2).
 *
 * AES-256-GCM con clave base64 de 32 bytes leída de SETTINGS_ENCRYPTION_KEY.
 * Formato de salida: "v1:<iv b64>:<tag b64>:<data b64>" (v1 = versión 1 del formato).
 *
 * - La clave NUNCA se persiste ni se registra en logs.
 * - encryptSecret falla con un Error claro si falta la clave o tiene tamaño/codec inválido.
 * - decryptSecret valida la versión del formato y la integridad (tag); una clave distinta
 *   produce un error de autenticación en vez de texto falso.
 */

const FORMAT_VERSION = 'v1';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Devuelve la clave de cifrado (Buffer de 32 bytes) desde SETTINGS_ENCRYPTION_KEY.
 * Lanza Error si la variable falta, no es base64 válido o no tiene 32 bytes.
 */
function getEncryptionKey(): Buffer {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw || raw.trim() === '') {
    throw new Error('Falta SETTINGS_ENCRYPTION_KEY');
  }
  const key = Buffer.from(raw.trim(), 'base64');
  if (
    key.length !== KEY_LENGTH ||
    key.toString('base64') !== raw.trim()
  ) {
    throw new Error(
      'SETTINGS_ENCRYPTION_KEY debe ser un base64 válido de 32 bytes (openssl rand -base64 32)',
    );
  }
  return key;
}

/**
 * Cifra un secreto a texto plano usando AES-256-GCM.
 */
export function encryptSecret(plain: string): string {
  if (typeof plain !== 'string') {
    throw new Error('encryptSecret requiere un string');
  }
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  if (tag.length !== TAG_LENGTH) {
    throw new Error('Fallo interno de cifrado (tag inválido)');
  }
  return [
    FORMAT_VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    data.toString('base64'),
  ].join(':');
}

/**
 * Descifra un secreto cifrado por encryptSecret. Falla si la clave no coincide
 * (error de autenticación GCM) o si el formato no es v1 válido.
 */
export function decryptSecret(enc: string): string {
  if (typeof enc !== 'string') {
    throw new Error('decryptSecret requiere un string');
  }
  // La clave se resuelve ANTES de parsear el formato: si falta, se falla
  // con un mensaje claro y sin exponer detalles del formato.
  const key = getEncryptionKey();
  const parts = enc.split(':');
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new Error('Formato de secreto inválido (se esperaba v1:<iv>:<tag>:<data>)');
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error('IV o tag de longitud inválida');
  }

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Enmascara un secreto para mostrarlo de forma segura: "••••" + últimos 4 caracteres.
 * Vacío → "••••".
 */
export function maskSecret(plain: string): string {
  if (typeof plain !== 'string' || plain.length === 0) {
    return '••••';
  }
  const last = plain.slice(-4);
  return `••••${last}`;
}
