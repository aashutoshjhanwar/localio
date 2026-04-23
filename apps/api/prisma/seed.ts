import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import ngeohash from 'ngeohash';

const prisma = new PrismaClient();

// Pune HSR-ish centre for demo
const BASE = { lat: 18.5204, lng: 73.8567 };
function jitter(v: number, range = 0.02) { return v + (Math.random() - 0.5) * range; }
function gh(lat: number, lng: number) { return ngeohash.encode(lat, lng, 6); }

async function main() {
  console.log('🌱 Seeding LOCALIO demo data…');

  // Societies
  const societies = await Promise.all([
    upsertSociety('Kasturi Housing', 'Pune', '411021'),
    upsertSociety('Rohan Garima', 'Pune', '411030'),
    upsertSociety('Marigold Heights', 'Pune', '411021'),
  ]);

  // Users
  const pwHash = await bcrypt.hash('demo1234', 8);
  const users = await Promise.all([
    upsertUser('+919000000001', 'Priya Sharma', societies[0].id, 4.8),
    upsertUser('+919000000002', 'Arjun Rao', societies[0].id, 4.2),
    upsertUser('+919000000003', 'Meera Iyer', societies[1].id, 4.6),
    upsertUser('+919000000004', 'Vikram Singh', societies[1].id, 3.9),
    upsertUser('+919000000005', 'Kabir Nair', societies[2].id, 4.5),
  ]);
  void pwHash; // bcrypt imported in case we add a password column later

  // Listings
  const listings: Array<[number, string, string, number, string]> = [
    [0, 'Sofa 3-seater (brown)', 'Moving out sale. Mild wear. Pickup only.', 12000, 'furniture'],
    [1, 'iPhone 13 128GB', 'Battery 92%. Box + charger included.', 34000, 'electronics'],
    [2, 'Honda Activa 6G 2022', '5k km. Single owner. RC clear.', 82000, 'vehicles'],
    [3, 'LG washing machine 7kg', 'Front load. Works perfectly.', 14000, 'appliances'],
    [4, 'Baby crib + mattress', 'Used for 6 months. Clean.', 4500, 'kids'],
    [0, 'IKEA study desk', 'Small scratch on top. Sturdy.', 2800, 'furniture'],
  ];
  for (const [ui, title, desc, priceRupees, cat] of listings) {
    const lat = jitter(BASE.lat); const lng = jitter(BASE.lng);
    await prisma.listing.upsert({
      where: { id: `seed-l-${ui}-${cat}-${title.slice(0, 6)}` },
      create: {
        id: `seed-l-${ui}-${cat}-${title.slice(0, 6)}`,
        sellerId: users[ui].id, title, description: desc, category: cat,
        priceInPaise: priceRupees * 100, lat, lng, geohash: gh(lat, lng),
        images: JSON.stringify([]),
      },
      update: {},
    });
  }

  // Services
  const services: Array<[number, string, string, number, string, string]> = [
    [1, 'Plumbing repairs & installs', 'Taps, geysers, leakage. Same-day service.', 300, 'per_visit', 'plumber'],
    [2, 'Math tutor (grade 8-10)', 'CBSE & ICSE. 6 yrs experience.', 400, 'per_hour', 'tutor'],
    [3, 'Home deep cleaning', 'Team of 2. Eco-friendly products.', 1500, 'per_visit', 'maid'],
    [4, 'Electrician - wiring & fixtures', 'Licensed. Minor and major jobs.', 250, 'per_visit', 'electrician'],
    [0, 'Tiffin service (veg)', 'Daily 3-meal tiffin. Jain options.', 3200, 'per_month', 'tiffin'],
  ];
  for (const [ui, title, desc, priceRupees, unit, cat] of services) {
    const lat = jitter(BASE.lat); const lng = jitter(BASE.lng);
    await prisma.service.upsert({
      where: { id: `seed-s-${ui}-${cat}` },
      create: {
        id: `seed-s-${ui}-${cat}`,
        providerId: users[ui].id, title, description: desc, category: cat,
        priceFrom: priceRupees * 100, priceUnit: unit,
        lat, lng, geohash: gh(lat, lng),
        ratingAvg: 4 + Math.random(), ratingCount: 5 + Math.floor(Math.random() * 20),
      },
      update: {},
    });
  }

  console.log(`✅ Seeded ${societies.length} societies, ${users.length} users, ${listings.length} listings, ${services.length} services.`);
  console.log(`   Try logging in as +919000000001 with OTP 123456 (if OTP_DEV_BYPASS=1).`);
}

async function upsertSociety(name: string, city: string, pincode: string) {
  const id = `seed-soc-${name.toLowerCase().replace(/\s+/g, '-')}`;
  const lat = jitter(BASE.lat, 0.04); const lng = jitter(BASE.lng, 0.04);
  return prisma.society.upsert({
    where: { id },
    create: { id, name, city, pincode, lat, lng, geohash: gh(lat, lng) },
    update: {},
  });
}

async function upsertUser(phone: string, name: string, societyId: string, trust: number) {
  const lat = jitter(BASE.lat); const lng = jitter(BASE.lng);
  return prisma.user.upsert({
    where: { phone },
    create: {
      phone, name, societyId,
      phoneVerified: true, kycVerified: phone.endsWith('1') || phone.endsWith('3'),
      trustScore: trust,
      lat, lng, geohash: gh(lat, lng),
    },
    update: { name, societyId, trustScore: trust },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
