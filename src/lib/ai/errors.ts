/**
 * Error estructurado del motor de IA.
 * `code` clasifica el fallo; `fieldErrors` solo para VALIDATION.
 */
export type AIErrorCode = 'VALIDATION' | 'AI_FAILED' | 'RATE_LIMIT' | 'CONFIG';

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    message: string,
    code: AIErrorCode,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    if (fieldErrors !== undefined) this.fieldErrors = fieldErrors;
  }
}
