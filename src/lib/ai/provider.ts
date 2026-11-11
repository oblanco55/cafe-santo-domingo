/**
 * Contrato del proveedor de IA (ver ORDEN T4 punto 1).
 * La implementación concreta (Anthropic, mock, falsos de test)
 * debe cumplir esta interfaz exactamente.
 */
export interface GenerateArgs {
  system: string;
  user: string;
  toolName: string;
  jsonSchema: object;
  maxTokens: number;
}

export interface GenerateResult {
  data: unknown;
  model: string;
}

export interface AIProvider {
  generate(args: GenerateArgs): Promise<GenerateResult>;
}
