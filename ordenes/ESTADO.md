# ESTADO DEL PROYECTO — traspaso entre sesiones de Claude

Actualizado: 2026-10-23 19:55. Léelo al empezar una sesión nueva, junto con la memoria del proyecto.

## Reglas (no negociables)
- Claude = cerebro (planifica, escribe órdenes, verifica). **Hermes escribe todo el código.**
- Órdenes en `ordenes/*.md`; se ejecutan con `ordenes/run-chain.sh <marca> perfil:orden[:archivo-requerido] ...` lanzado con `nohup … & disown`. Resultado en `ordenes/<marca>.status`.
- Si el chat se congela: **no relanzar**. Comprobar `ordenes/<marca>.status`, `ps` y `tail ~/.hermes/profiles/<perfil>/logs/agent.log`. Solo relanzar si no hay proceso, no hay estado y el log lleva rato inactivo.
- Verificar siempre por cuenta propia (tsc, lint, `npm test`, `npm run build`, `npm run test:e2e`, y navegador) antes de dar algo por bueno. Hermes a veces no hace commit, informa cosas no hechas o inventa datos.
- El Escritorio está en iCloud: si tsc falla por archivos `* 2.ts` en `.next/`, borrar `./.next`.
- Docker (BD local en 5433) se apaga al reiniciar la Mac: `open -a Docker` y `npm run db:up`.

## Hecho y verificado
- Fase 1 completa (T1–T10): auth, 3 modalidades, IA mock, resultado, pruebas, despliegue. Entrega: `docs/ENTREGA.md`.
- F2-1 datos/seguridad, F2-2 IA multi-proveedor, F2-3/3b/3c API admin (incluye IA y legal público).
- Railway: proyecto `script28`, servicio `web` (deploy automático desde `main`), URL https://web-production-38743.up.railway.app. Pre-deploy: `npx prisma migrate deploy && npx prisma db seed` (la semilla legal se aplicará en el próximo deploy; comprobar `GET /api/legal/terminos` → 200).
- Variables en Railway: DATABASE_URL, AUTH_SECRET, AUTH_URL, PORT, AI_PROVIDER=mock, AI_MODEL, SETTINGS_ENCRYPTION_KEY, ADMIN_EMAILS=resp5totech@gmail.com. Falta ANTHROPIC_API_KEY (se podrá poner desde /admin/ia).
- El usuario ya se registró con resp5totech@gmail.com (será admin al iniciar sesión tras el deploy del panel).

## Estado (actualizado 19:55)
- **Fase 2 completa** en `main` y desplegada: admin, IA multi-proveedor (+MiniMax, manual), legal, monetización PayPal (desactivada por defecto), Mis creaciones, Perfil, Regenerar. Entrega: `docs/ENTREGA-F2.md`.
- Verificado: tsc, lint 0 errores, 278 tests unitarios, build, 58/58 E2E (escritorio y móvil), navegador.
- Hermes: sin tareas en curso.

## Siguiente
- Borrar `src/components/admin/AdminHome.tsx` (código muerto).
- Cuando el usuario ponga la clave de IA real: `npm run eval:ia` y revisar calidad.
- Cuando ponga credenciales sandbox de PayPal: prueba real de compra y suscripción (F2-7e).

## Pendiente del usuario
- Guía para obtener y pegar claves: `docs/GUIA-CREDENCIALES.md`.
- Credenciales **sandbox** de PayPal (las pega él en /admin/monetizacion).
- Clave de IA (Claude por defecto) en /admin/ia.
- Decidir si mover el proyecto fuera del Escritorio/iCloud (recomendado).
