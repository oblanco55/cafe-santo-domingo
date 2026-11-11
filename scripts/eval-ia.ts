/**
 * Banco de evaluación de prompts (ORDEN F2-2c): genera los 6 casos de
 * tests/ai/fixtures/golden-inputs.ts con el proveedor configurado (BD o
 * entorno) y guarda cada salida en eval-out/<fecha>/<caso>.json + resumen.md.
 * Con AI_PROVIDER=mock funciona sin clave ni base de datos.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateCreation, MockProvider } from '@/lib/ai/engine';
import { GOLDEN_INPUTS } from '../tests/ai/fixtures/golden-inputs';

async function main() {
  const useMock = (process.env.AI_PROVIDER ?? '').trim().toLowerCase() === 'mock';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = join('eval-out', stamp);
  mkdirSync(dir, { recursive: true });

  const rows: string[] = [
    `# Evaluación de prompts — ${stamp}`,
    '',
    '| Caso | Proveedor | Título | Láminas/escenas | Copy (car.) | Hashtags | Supuestos |',
    '|---|---|---|---|---|---|---|',
  ];
  let failures = 0;

  for (const c of GOLDEN_INPUTS) {
    try {
      const r = await generateCreation(c.type, c.input, useMock ? new MockProvider() : undefined);
      writeFileSync(join(dir, `${c.id}.json`), JSON.stringify(r, null, 2));
      const o = r.output as unknown as Record<string, unknown>;
      const items = (o.slides ?? o.scenes) as unknown[] | undefined;
      rows.push(
        `| ${c.id} | ${r.providerLabel ?? r.model} | ${String(o.title ?? '')} | ${items ? items.length : '—'} | ` +
          `${String(o.caption ?? '').length} | ${((o.hashtags as unknown[]) ?? []).length} | ` +
          `${((o.assumptions as unknown[]) ?? []).length} |`,
      );
      console.log(`OK   ${c.id}`);
    } catch (e) {
      failures++;
      rows.push(`| ${c.id} | ERROR | ${(e as Error).message.replace(/\|/g, '/')} | | | | |`);
      console.error(`FAIL ${c.id}: ${(e as Error).message}`);
    }
  }

  writeFileSync(join(dir, 'resumen.md'), rows.join('\n') + '\n');
  console.log(`\nResultados en ${dir}/`);
  process.exit(failures ? 1 : 0);
}

main();
