// prisma/seed.ts
import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const seedUsers = [
  { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@syncmesh.dev' },
  { firstName: 'Alan', lastName: 'Turing', email: 'alan@syncmesh.dev' },
  { firstName: 'Grace', lastName: 'Hopper', email: 'grace@syncmesh.dev' },
];

async function main() {
  const passwordHash = await argon2.hash('Password123!'); // hashed once, reused — same input, no reason to redo the expensive hash 3x

  for (const user of seedUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, passwordHash },
    });
  }
  console.log(`Seeded ${seedUsers.length} users`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
