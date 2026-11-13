import type { Metadata } from 'next';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import CampaignLanding from '@/components/campaign/CampaignLanding';

export const metadata: Metadata = {
  title: 'Café Santo Domingo — ¡Conviértete en el Rostro de Nuestro Café!',
  description:
    'Participa en la campaña oficial de Café Santo Domingo, sube tu selfie y genera tu avatar y video 3D de embajador del café de nuestra tierra.',
};

export const dynamic = 'force-dynamic';

function isCampaignActive(): boolean {
  const endDateStr = process.env.CAMPAIGN_END_DATE;
  if (!endDateStr) return true;
  const endDate = new Date(endDateStr);
  return Number.isNaN(endDate.getTime()) || new Date() <= endDate;
}

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id;

  let initialUser = null;

  if (userId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prismaClient = db as any;
      const user = await prismaClient.user.findUnique({
        where: { id: userId },
        include: { customerLead: true },
      });

      if (user) {
        initialUser = {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.customerLead?.phone,
          age: user.customerLead?.age,
          favoriteProduct: user.customerLead?.favoriteProduct,
        };
      }
    } catch {
      // Si la BD aún no tiene migrada la relación, tomamos los datos de la sesión
      initialUser = {
        id: session.user.id || '',
        name: session.user.name || '',
        email: session.user.email || '',
      };
    }
  }

  const campaignActive = isCampaignActive();

  return (
    <CampaignLanding
      initialUser={initialUser}
      campaignEnded={!campaignActive}
    />
  );
}
