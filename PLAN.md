# Café Santo Domingo — Diagnóstico técnico y plan de ejecución

Roles: **Claude = cerebro** (auditoría, arquitectura, contratos, órdenes, revisión, validación). **Hermes = desarrollador** (escribe todo el código siguiendo las órdenes). Fecha: 2026-10-22.

## 1. Auditoría (Fase 1) — resultado real

| Punto | Hallazgo |
|---|---|
| Repositorio | No existe. La carpeta solo tiene `IDEA.md`, 2 especificaciones (docx/pdf) y 2 imágenes. No es repositorio git. |
| Frontend / backend / BD / auth | No existen. |
| Módulo de video | **No existe** (IDEA.md lo da por existente). Decisión del usuario: empezar desde cero, por lo que se construye también. |
| Integraciones IA | Ninguna. No hay `ANTHROPIC_API_KEY` en el entorno. |
| Pruebas | Ninguna. |
| Entorno local | Node 26.8, npm 11.19, Docker 29.8, Python 3.9. Hermes operativo (perfiles: arquitecto, desarrollador-backend, desarrollador-frontend, especializado-en-inteligencia-artificial, autenticaci-n-y-gesti-n-de-usuarios, devops-y-despliegue). |

### Diferencias detectadas entre imagen y documentos

| # | Diferencia | Resolución |
|---|---|---|
| D1 | Formato foto: Estática = solo 1:1 y 9:16; Carrusel usa 4:5 en ejemplos. | **Solo 1:1 y 9:16** (decisión del usuario). |
| D2 | Imagen: carrusel "3, 5 o más"; documento: exactamente 3/5/7. | Documento: **3, 5 o 7**. |
| D3 | Registro: doc Carrusel exige aceptar términos y privacidad; doc Estática e imagen no. | Se incluye el checkbox (requisito más estricto). Textos legales: **pendientes del usuario**, se usa placeholder marcado. |
| D4 | Sectores distintos: Estática ("inmobiliaria", "servicios profesionales") vs Carrusel ("inmobiliario", "legal/profesional"). | Lista unificada: moda, gastronomía, belleza, salud, educación, tecnología, servicios profesionales, legal, turismo, inmobiliaria, automotriz, hogar, otro (campo libre si "otro"). |
| D5 | Formulario: Estática tiene 6 campos; Carrusel añade destacar, equipo, recursos, tipo de foto. | Formulario compartido de 8 campos para Foto y Carrusel + campos exclusivos (Foto: formato, tipo de foto; Carrusel: nº láminas, estructura, formato). Opcionales según documento. |
| D6 | Imagen 2 (landing oscura) muestra Mis proyectos, Plantillas, Inspiración, Marca, Precios. | **Fuera de alcance**; solo se usa como dirección visual (fondo oscuro, acento naranja→rosa). |
| D7 | Módulo de video: no hay especificación detallada, solo la imagen (plataforma; duración 15/30/45 s; guion por escenas + copy). | Se construye con lo que muestra la imagen y el formulario común. |

## 2. Arquitectura propuesta

- **App:** Next.js 15 (App Router) + TypeScript, fullstack (UI + rutas API) en un solo proyecto.
- **BD:** PostgreSQL 16 en Docker + Prisma ORM.
- **Auth:** Auth.js (NextAuth v5), credenciales email/contraseña con bcrypt, sesión JWT en cookie httpOnly. La sesión se conserva al cambiar de modalidad.
- **IA:** Anthropic API (Claude) vía SDK oficial, salida estructurada con *tool use* + validación **zod**. Un prompt de sistema y un esquema **separados por modalidad** (video / photo / carousel). Datos del usuario tratados como contenido no confiable. Proveedor `mock` para desarrollo y pruebas sin clave.
- **UI:** Tailwind CSS, diseño móvil primero, estética de la imagen 2.
- **Pruebas:** Vitest (unitarias: esquemas, validaciones, motores con mock) + Playwright (E2E, incluido viewport móvil).

### Modelo de datos
- `User` (id, name, email único, passwordHash, termsAcceptedAt, createdAt)
- `BusinessProfile` (userId, countryIso, offerType, sector, sectorOther, description) → precarga de formularios.
- `Creation` (id, userId, type `video|photo|carousel`, input JSON, output JSON, status `ok|error`, errorMessage, model, createdAt) → auditoría operativa.

### Contratos (antes de integrar)
`POST /api/auth/register` · Auth.js `/api/auth/*` · `GET/PUT /api/profile` · `POST /api/creations/{video|photo|carousel}` · `GET /api/creations/:id`

Entrada común: `countryIso, offerType(product|service), sector, sectorOther?, description, platform(instagram|facebook|tiktok|youtube), objective?, equipment?, resources[]?`
- video: `+ duration (15|30|45)`
- photo: `+ aspectRatio ("1:1"|"9:16"), photoStyle?`
- carousel: `+ slideCount (3|5|7), carouselStructure?, aspectRatio`

Salida (doc Carrusel §8): `title, concept, platform, aspect_ratio, visual_style, general_setup, shots[] | slides[] | scenes[], caption, cta, hashtags[], assumptions[]`. Foto añade las 9 secciones obligatorias (resumen creativo, preparación, composición, iluminación, fondo, captura, formato y texto, copy, verificación). Carrusel: `slides.length === slideCount` validado en servidor (si falla → 1 reintento automático → error recuperable).

## 3. Tareas priorizadas (Fase 2)

| # | Tarea | Perfil Hermes | Depende | Criterio de aceptación | Pruebas | Riesgo | Estado |
|---|---|---|---|---|---|---|---|
| T1 | Scaffolding Next.js+TS+Tailwind, Docker Postgres, Prisma, `.env.example`, git init | devops-y-despliegue | — | `npm run dev` y `docker compose up` arrancan; migración aplicada | build + lint | bajo | pendiente |
| T2 | Contratos: esquemas zod compartidos (entradas/salidas 3 modalidades) | arquitecto | T1 | Esquemas exportados y tipados | Vitest de esquemas | medio | pendiente |
| T3 | Auth: registro, login, logout, protección de rutas, términos | autenticaci-n-y-gesti-n-de-usuarios | T1 | Email único, contraseña hasheada, sesión persiste | Vitest + E2E | medio | pendiente |
| T4 | Motor IA: cliente Anthropic + mock, prompts por modalidad, validación, reintento | especializado-en-inteligencia-artificial | T2 | Salida siempre válida o error claro; carrusel exacto 3/5/7 | Vitest con mock | alto (calidad/costo IA) | pendiente |
| T5 | API de creaciones + perfil + persistencia `Creation` | desarrollador-backend | T2,T3,T4 | Endpoints protegidos, guardan entrada/salida | Vitest de rutas | medio | pendiente |
| T6 | UI: landing, registro/login, panel "¿Qué deseas crear?" | desarrollador-frontend | T3 | Flujo Inicio→Registro→Panel en móvil y escritorio | E2E | bajo | pendiente |
| T7 | UI: formularios contextuales (video/foto/carrusel), validación, precarga, botón deshabilitado | desarrollador-frontend | T2,T5,T6 | Campos cambian por Producto/Servicio y modalidad | E2E | medio | pendiente |
| T8 | UI: carga, resultado en bloques, Copiar guía / Copiar copy / Crear otro / Reintentar sin perder respuestas | desarrollador-frontend | T7 | Botones funcionan; error no borra formulario | E2E | bajo | pendiente |
| T9 | Validación E2E completa (Fase 7) + informe real | Claude verifica; Hermes corrige | todas | Todos los puntos de Fase 7 con evidencia | Playwright + manual | — | pendiente |

## 4. Pendiente del usuario
- `ANTHROPIC_API_KEY` (u otro proveedor) para generación real. Sin ella solo funciona el modo `mock`.
- Textos de términos y privacidad.
- Destino de despliegue (no se despliega nada sin autorización).

## 5. Pendientes de pulido UI (para T6, detectados por Claude en verificación de T3b)
- `<title>` y metadata aún "Create Next App"; `<html lang="es">`.
- Iconos del panel son letras (G/F/C): usar iconos (video, cámara, láminas) como en la imagen de referencia.
- Texto "slide" en tarjeta Carrusel → "lámina".
