import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Semilla idempotente de legal content (Fase 2).
 *
 * Siembra LegalDocument 'terminos' y 'privacidad' con el texto provisional actual
 * de src/app/terminos/page.tsx y src/app/privacidad/page.tsx, usando la versión
 * que ya existe en BD (solo crea si no existe; no sobrescribe).
 *
 * Uso: npx tsx prisma/seed.ts
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TERMINOS: { title: string; content: string } = {
  title: 'Términos y condiciones',
  content: `# Términos y condiciones

> Texto provisional pendiente de aprobación legal.

Café Santo Domingo es una plataforma que acompaña a creadores de contenido en la
estructuración de guiones para videos, fotografías y carruseles. El servicio
funciona como una guía paso a paso: tú aportas las ideas y el contexto de tu
negocio, y la aplicación te ayuda a ordenarlas en una estructura clara y
coherente.

Al registrarte aceptas usar el servicio de forma responsable: con información
veraz, sin pedir que se generen contenidos engañosos, falsos, fraudulentos o
que infrinjan derechos de terceros. Eres responsable de los contenidos que
publicites y de cumplimentar las leyes y regulaciones aplicables en tu
jurisdicción.

Podemos actualizar estos términos cuando sea necesario para reflejar cambios en
el servicio. Te avisaremos dentro del canal o con la antelación razonable
cuando los cambios afecten de forma importante tu uso de la plataforma.
`,
};

const PRIVACIDAD: { title: string; content: string } = {
  title: 'Política de privacidad',
  content: `# Política de privacidad

> Texto provisional pendiente de aprobación legal.

En Café Santo Domingo tomamos la privacidad en serio. Esta página explica qué datos
recopilamos cuando usas la plataforma y con qué finalidad, de forma breve y
directa.

Para crear tu cuenta necesitamos de tu nombre, correo electrónico y una
contraseña. Estos datos nos permiten identificar tu cuenta y personalizar tu
experiencia al trabajar en tus guiones.

Guardamos las creaciones que generes (guiones, fotografías y carruseles) para
que puedas recuperarlas cuando inicies sesión. Puedes gestionar la información
asociada a tu cuenta y, cuando lo desees, solicitar la eliminación de tus datos.
`,
};

async function main() {
  const docs = [
    { slug: 'terminos', ...TERMINOS },
    { slug: 'privacidad', ...PRIVACIDAD },
  ];

  for (const doc of docs) {
    const existing = await prisma.legalDocument.findUnique({ where: { slug: doc.slug } });
    if (existing) {
      console.log(`✓ LegalDocument[${doc.slug}] ya existe (version=${existing.version}); sin cambios`);
    } else {
      const created = await prisma.legalDocument.create({
        data: {
          slug: doc.slug,
          title: doc.title,
          content: doc.content,
          updatedBy: 'seed',
        },
      });
      console.log(`+ LegalDocument[${doc.slug}] creada (version=${created.version})`);
    }
  }
  console.log('Seed completado.');
}

main()
  .catch((err) => {
    console.error('Error en el seed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
