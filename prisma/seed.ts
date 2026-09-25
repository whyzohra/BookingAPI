import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const SEED_SLOTS = [
  {
    id: 'slot-1',
    startTime: new Date('2026-10-01T09:00:00.000Z'),
    endTime: new Date('2026-10-01T09:30:00.000Z'),
  },
  {
    id: 'slot-2',
    startTime: new Date('2026-10-01T09:30:00.000Z'),
    endTime: new Date('2026-10-01T10:00:00.000Z'),
  },
  {
    id: 'slot-3',
    startTime: new Date('2026-10-01T10:00:00.000Z'),
    endTime: new Date('2026-10-01T10:30:00.000Z'),
  },
  {
    id: 'slot-4',
    startTime: new Date('2026-10-01T10:30:00.000Z'),
    endTime: new Date('2026-10-01T11:00:00.000Z'),
  },
  {
    id: 'slot-5',
    startTime: new Date('2026-10-01T11:00:00.000Z'),
    endTime: new Date('2026-10-01T11:30:00.000Z'),
  },
  {
    id: 'slot-6',
    startTime: new Date('2026-10-01T11:30:00.000Z'),
    endTime: new Date('2026-10-01T12:00:00.000Z'),
  },
  {
    id: 'slot-7',
    startTime: new Date('2026-10-01T14:00:00.000Z'),
    endTime: new Date('2026-10-01T14:30:00.000Z'),
  },
  {
    id: 'slot-8',
    startTime: new Date('2026-10-01T14:30:00.000Z'),
    endTime: new Date('2026-10-01T15:00:00.000Z'),
  },
];

export async function seed() {
  console.log('Seeding appointment slots...');

  for (const slot of SEED_SLOTS) {
    await prisma.slot.upsert({
      where: { id: slot.id },
      update: {
        startTime: slot.startTime,
        endTime: slot.endTime,
      },
      create: {
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
      },
    });
  }

  console.log(`Seeded ${SEED_SLOTS.length} appointment slots successfully.`);
}

if (require.main === module) {
  seed()
    .catch((e) => {
      console.error('Error during seeding:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
