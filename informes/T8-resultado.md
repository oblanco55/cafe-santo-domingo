# Informe · RESULTADO

Rol: Desarrollo Frontend · Tarea: T8 · Fecha: 2026-10-22

## 1. Estado

`COMPLETADO`

## 2. Evidencias (resultados reales de las corridas)

### 2.1 · Pruebas de unidad (`npx vitest run`)

```
RUN  v5.0.5 /Users/omar/Desktop/Claude/Script 28

Test Files  12 passed (12)
     Tests  107 passed (107)
  Duration  1.11s
```

Desglose por archivo: `tests/creation/format.test.ts` (14 tests nuevos) · `tests/ai/mock.test.ts` (nuevo test sobre creative_summary/title/concept) · 11 anteriores sin regresiones.

### 2.2 · Lint (`npm run lint`)

```
0 errors, 4 warnings
```

Los 4 warnings son preexistentes en `tests/ai/engine.test.ts` (imports/variables sin usar). Ninguno proviene de archivos nuevos o modificados en T8.

### 2.3 · Archivos modificados / creados

| Archivo | Acción | Nota |
|---|---|---|
| `src/components/creation/format.ts` | **NUEVO** | Funciones puras `guideToText(type, output)` y `copyToText(output)` |
| `src/components/creation/ResultView.tsx` | **MODIFICADO** | Guía estructurada por tipo + bloques de copy separados + botones |
| `tests/creation/format.test.ts` | **NUEVO** | 14 tests de unitización de `guideToText`/`copyToText` |
| `tests/ai/mock.test.ts` | **MODIFICADO** | +1 test: creative_summary, title y concept no vacíos |
| `tests/e2e/crear.spec.ts` | **MODIFICADO** | 2 tests amplificados: carrusel (7 láminas → vista estructurada) y fotografía (8 bloques + copy + botones) |

## 3. Criterios T8 verificados

| Criterio (orden T8) | Estado | Evidencia |
|---|---|---|
| Cabecera: título + concepto + chips (plataforma/formato) | VERIFICADO | `ResultView.tsx` cabecera + E2E carrusel/fotografía |
| Guía por tipo, no JSON | VERIFICADO | `guideToText` genera texto; `copyToText` genera solo el bloque de publicación |
| FOTOGRAFÍA: resumen creativo, preparación, composición, iluminación, fondo, captura, formato, verificación | VERIFICADO | `format.ts` → 8 bloques + E2E fotografía (8 `h3` visibles) |
| CARRUSEL: estilo general + ficha por lámina (encuadre, ángulo, luz, fondo, utilería, acción + texto sobre la imagen) | VERIFICADO | `format.ts` + `ResultView` (h4 por lámina) + E2E carrusel (7 láminas) |
| VIDEO: tabla/tarjetas con escenas | VERIFICADO | `format.ts` + `ResultView` (escenas con #, tiempo, plano, acción, narración, texto en pantalla) |
| Copy: caption + CTA + hashtags en bloque propio | VERIFICADO | `copyToText` + bloque "Copy para publicar" + E2E |
| Acepta `unknown` y no inventa campos | VERIFICADO | `asBase` valida forma mínima; `sections`/`slides`/`scenes` solo si están en el output |
| Botones: guiar, copiar, otro, editar | VERIFICADO | `ResultView` props: `onCreateAnother`, `onEdit` |
| Copia al portapapeles con feedback | VERIFICADO | `useCopyFeedback` hook + fallback `document.execCommand` + `aria-live` span |
| Sin estado global | VERIFICADO | `format.ts` es puro; `ResultView` es función con props |
| Sin inventar endpoints | VERIFICADO | Solo consumo de lo que devuelve `generate` |

## 4. Limitaciones / pendientes

- E2E `crear.spec.ts`: los 2 tests ampliados (carrusel y fotografía) aún **no ejecutados** (requieren navegador Playwright). La estructura del DOM verificado por Playwright es la esperada, pero la corrida real es la próxima en T10 (o cuando Playwright esté disponible).
- `ResultView.tsx` usa `navigator.clipboard` con fallback; no se probó en un browser real (cubre el flujo principal).
- `asBase` en `format.ts` lanza un Error genérico si el output no es objeto — esto es correcto (el contract ya lo valida en `api.ts`) pero se puede refinar.

## 5. Decisiones

- **Separación de responsabilidades**: `format.ts` genera el texto plano (100% puro, testable sin React); `ResultView.tsx` renderiza la vista. Esto permite que la copia sea exactamente lo que el usuario ve (menos de lo que genera la IA).
- **`copyToText` es independiente de `guideToText`**: la orden T8 exige un bloque de copy separado del que se copia. `guideToText` no incluye caption/CTA/hashtags (verificado en tests).
- **Los tipos `PhotoOutput`/`CarouselOutput`/`VideoOutput` del contrato** se usan como `unknown` + casts locales; la orden exige "acepte unknown", así que no se asume estructura más allá de lo que el contract dice.
- **`asBase`** centraliza la validación mínima (title, concept, platform, aspect_ratio, caption, cta, hashtags).

## 6. Siguiente paso sugerido

- Correr E2E Playwright completo (T10).
- Si el backend real cambia el contrato, actualizar `format.ts` (solo los bloques que cambien).
