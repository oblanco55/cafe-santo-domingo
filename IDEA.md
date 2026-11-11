PROYECTO: SCRIPT 28

Integración y desarrollo de los módulos de contenido con IA

Actúa como coordinador técnico del proyecto SCRIPT 28 y utiliza los perfiles especializados disponibles para ejecutar el trabajo.

DOCUMENTACIÓN DE REFERENCIA

Debes estudiar y utilizar como requisitos funcionales:

* La imagen de referencia del flujo completo de SCRIPT 28.
* La especificación funcional del módulo de fotografía estática.
* La especificación funcional del módulo de fotografía y carrusel.

La documentación debe guiar las decisiones funcionales. Si detectas diferencias entre la imagen y los documentos, registra las diferencias y aplica los documentos como referencia detallada para los módulos correspondientes. No resuelvas diferencias funcionales importantes mediante suposiciones silenciosas.

OBJETIVO

Entregar una aplicación funcional en la que un usuario pueda registrarse una sola vez y crear tres tipos de contenido:

1. Guiones de video.
2. Guías de fotografía estática.
3. Guías de carruseles fotográficos.

FASE 1. AUDITORÍA

Antes de escribir código:

* Inspecciona el repositorio completo.
* Lee las instrucciones del proyecto y sus archivos de configuración.
* Identifica el frontend y backend.
* Identifica la base de datos.
* Revisa la autenticación.
* Localiza el módulo de video existente.
* Identifica las integraciones de IA.
* Revisa las variables de entorno y los servicios externos.
* Identifica las pruebas disponibles.
* Determina qué funcionalidades ya están implementadas y cuáles faltan.

No reconstruyas componentes existentes sin necesidad.

FASE 2. PLANIFICACIÓN

Crea una lista priorizada de tareas.

Para cada tarea especifica:

* Objetivo.
* Perfil responsable.
* Archivos o componentes afectados.
* Dependencias.
* Criterios de aceptación.
* Pruebas necesarias.
* Riesgos.
* Estado.

Define los contratos entre frontend, backend y los motores de IA antes de integrar los componentes.

FASE 3. IMPLEMENTACIÓN

Implementa las funcionalidades de acuerdo con la arquitectura existente.

El flujo general debe incluir:

Inicio → Registro o inicio de sesión → Panel principal → Selección de modalidad → Formulario contextual → Validación → Procesamiento mediante IA → Resultado → Copiar o crear otro.

El usuario debe conservar su sesión al cambiar de modalidad.

FASE 4. FOTOGRAFÍA ESTÁTICA

Implementa un formulario y un motor de IA dedicados a una sola fotografía.

La respuesta debe incluir la dirección creativa, preparación, composición, iluminación, fondo, captura, formato, copy y verificación.

Respeta los formatos definidos en la especificación de fotografía estática: cuadrado 1:1 y Story vertical 9:16.

No generes ni edites imágenes automáticamente en esta fase.

FASE 5. CARRUSEL

Implementa un formulario y un motor de IA independientes.

Permite seleccionar 3, 5 o 7 láminas.

Cada lámina debe tener instrucciones fotográficas específicas, texto sobre la imagen y una función narrativa dentro de la secuencia.

Mantén la coherencia visual del carrusel.

No confundas las instrucciones para producir fotografías reales con la generación automática de imágenes.

FASE 6. INTEGRACIÓN

Integra los nuevos módulos con el panel principal y la autenticación existentes.

Preserva el módulo de video y ejecuta pruebas de regresión.

Evita duplicar lógica innecesariamente, pero conserva separados los contratos, validaciones y prompts específicos de cada modalidad.

FASE 7. VALIDACIÓN

Prueba el sistema de extremo a extremo.

Verifica:

* Registro e inicio de sesión.
* Persistencia de datos.
* Validación de formularios.
* Generación de fotografía.
* Generación de carruseles de 3, 5 y 7 láminas.
* Adaptación del copy a la plataforma.
* Copiado de guía y copy.
* Manejo de errores.
* Reintentos.
* Seguridad.
* Compatibilidad móvil.
* Funcionamiento del módulo de video.

No inventes resultados de pruebas.

FASE 8. ENTREGA

Al finalizar, entrega:

1. Resumen de la arquitectura detectada.
2. Funcionalidades implementadas.
3. Archivos creados o modificados.
4. Cambios en la base de datos.
5. Endpoints implementados.
6. Integraciones de IA.
7. Pruebas ejecutadas y resultados reales.
8. Incidencias pendientes.
9. Variables de entorno requeridas, sin revelar sus valores secretos.
10. Instrucciones para ejecutar y desplegar la aplicación.
11. Procedimiento de reversión cuando corresponda.

REGLAS INNEGOCIABLES

* No modificar producción sin autorización.
* No eliminar funcionalidades existentes para simplificar el trabajo.
* No inventar datos comerciales.
* No exponer credenciales.
* No marcar tareas como terminadas sin validarlas.
* No ocultar errores ni pruebas fallidas.
* No hacer cambios destructivos sin respaldo y autorización.
* No implementar funciones fuera del alcance acordado sin documentarlas y solicitar aprobación cuando corresponda.

Comienza por la auditoría y entrega el diagnóstico técnico con el plan de ejecución antes de realizar cambios de arquitectura importantes.
