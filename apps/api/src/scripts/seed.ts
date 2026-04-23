import { prisma } from '../db/prisma.js';
import { encodeGeohash } from '../utils/geo.js';

async function main() {
  console.log('🌱 seeding LOCALIO…');

  // Gurgaon society
  const society = await prisma.society.upsert({
    where: { id: 'seed-society-1' },
    update: {},
    create: {
      id: 'seed-society-1',
      name: 'DLF Phase 2',
      city: 'Gurgaon',
      pincode: '122002',
      address: 'DLF Phase 2, Gurgaon',
      lat: 28.4912,
      lng: 77.0896,
      geohash: encodeGeohash(28.4912, 77.0896),
      verified: true,
      memberCount: 0,
    },
  });

  const rahul = await prisma.user.upsert({
    where: { phone: '+919999900001' },
    update: {},
    create: {
      phone: '+919999900001',
      name: 'Rahul Sharma',
      bio: 'SDE @ Gurgaon',
      phoneVerified: true,
      kycVerified: true,
      societyId: society.id,
      lat: 28.4912, lng: 77.0896,
      geohash: encodeGeohash(28.4912, 77.0896),
    },
  });

  const priya = await prisma.user.upsert({
    where: { phone: '+919999900002' },
    update: {},
    create: {
      phone: '+919999900002',
      name: 'Priya Singh',
      phoneVerified: true,
      societyId: society.id,
      lat: 28.4920, lng: 77.0900,
      geohash: encodeGeohash(28.4920, 77.0900),
    },
  });

  const ramesh = await prisma.user.upsert({
    where: { phone: '+919999900003' },
    update: {},
    create: {
      phone: '+919999900003',
      name: 'Ramesh Kumar',
      bio: '15+ years experience plumber',
      phoneVerified: true,
      kycVerified: true,
      societyId: society.id,
      lat: 28.4905, lng: 77.0880,
      geohash: encodeGeohash(28.4905, 77.0880),
    },
  });

  await prisma.listing.createMany({
    data: [
      {
        sellerId: priya.id,
        title: 'LG Washing Machine 7kg',
        description: 'Used 2 years, excellent condition. Pickup from DLF Ph 2.',
        category: 'appliances',
        priceInPaise: 1200000,
        lat: 28.4920, lng: 77.0900, geohash: encodeGeohash(28.4920, 77.0900),
        societyId: society.id,
        images: JSON.stringify(['https://picsum.photos/seed/wm/600/400']),
      },
      {
        sellerId: rahul.id,
        title: 'IKEA Study Table',
        description: 'Barely used. Moving out sale.',
        category: 'furniture',
        priceInPaise: 350000,
        lat: 28.4912, lng: 77.0896, geohash: encodeGeohash(28.4912, 77.0896),
        societyId: society.id,
        images: JSON.stringify(['https://picsum.photos/seed/desk/600/400']),
      },
    ],
  });

  await prisma.service.createMany({
    data: [
      {
        providerId: ramesh.id,
        title: 'Expert Plumber — Ramesh',
        description: 'Leakages, fittings, installations. Available 8am–9pm.',
        category: 'plumber',
        priceFrom: 20000,
        priceUnit: 'per_visit',
        lat: 28.4905, lng: 77.0880, geohash: encodeGeohash(28.4905, 77.0880),
        societyId: society.id,
      },
    ],
  });

  // Community group
  const group = await prisma.group.upsert({
    where: { id: 'seed-group-1' },
    update: {},
    create: {
      id: 'seed-group-1',
      name: 'DLF Phase 2 — Official',
      description: 'Neighbourhood chat, buy/sell, services.',
      societyId: society.id,
      isPublic: true,
    },
  });
  const conv = await prisma.conversation.upsert({
    where: { groupId: group.id },
    update: {},
    create: { type: 'group', groupId: group.id },
  });
  for (const u of [rahul, priya, ramesh]) {
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: u.id } },
      update: {},
      create: { groupId: group.id, userId: u.id, role: u.id === rahul.id ? 'owner' : 'member' },
    });
    await prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId: conv.id, userId: u.id } },
      update: {},
      create: { conversationId: conv.id, userId: u.id },
    });
  }

  console.log('✅ done. Try:');
  console.log('   curl http://localhost:4000/api/feed?lat=28.4912&lng=77.0896');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
