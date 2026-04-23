import { PrismaClient } from '@prisma/client';
import ngeohash from 'ngeohash';

const prisma = new PrismaClient();

// Bohra Ganesh Ji Temple area, Udaipur, Rajasthan
const BASE = { lat: 24.5890, lng: 73.6814 };
const rand = (v: number, r = 0.015) => v + (Math.random() - 0.5) * r;
const gh = (lat: number, lng: number) => ngeohash.encode(lat, lng, 6);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const FIRST_NAMES_M = ['Rohit', 'Kuldeep', 'Sanjay', 'Nitin', 'Ashok', 'Mahesh', 'Deepak', 'Rajesh', 'Bhanu', 'Lokesh', 'Harish', 'Vinod', 'Yogesh', 'Kailash', 'Manoj', 'Rakesh', 'Ramesh', 'Jitendra', 'Sunil', 'Prakash', 'Dev', 'Gopal', 'Ravi', 'Umesh'];
const FIRST_NAMES_F = ['Anjali', 'Pooja', 'Meenal', 'Heena', 'Priyanka', 'Sonal', 'Shweta', 'Neha', 'Ritu', 'Kavita', 'Sunita', 'Seema', 'Aarti', 'Urvashi', 'Divya', 'Jyoti', 'Rekha', 'Manisha', 'Lata', 'Pallavi'];
const SURNAMES = ['Paliwal', 'Menaria', 'Chauhan', 'Jain', 'Purohit', 'Audichya', 'Dashora', 'Sharma', 'Mehta', 'Vyas', 'Joshi', 'Nagar', 'Pandya', 'Trivedi', 'Sisodia', 'Rathore', 'Gurjar', 'Soni', 'Bohra', 'Kothari', 'Chhaparwal', 'Lodha', 'Baghela'];

async function main() {
  console.log('🌱 Seeding Udaipur / Bohra Ganesh — 50 users + services in every category…');

  const societies = await Promise.all([
    upsertSociety('Bohra Ganesh Residency', 'Udaipur', '313001', 24.5885, 73.6820),
    upsertSociety('Pratap Nagar Enclave', 'Udaipur', '313001', 24.5925, 73.6795),
    upsertSociety('Shakti Nagar Heights', 'Udaipur', '313001', 24.5862, 73.6788),
    upsertSociety('Bhuwana Greens', 'Udaipur', '313004', 24.6040, 73.6920),
    upsertSociety('Sukhadia Residency', 'Udaipur', '313001', 24.5810, 73.6850),
    upsertSociety('Fatehpura Colony', 'Udaipur', '313001', 24.5950, 73.6755),
  ]);

  // 50 users anchored around Bohra Ganesh
  const users: any[] = [];
  for (let i = 0; i < 50; i++) {
    const male = Math.random() > 0.45;
    const first = male ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
    const name = `${first} ${pick(SURNAMES)}`;
    const phone = `+91982900${String(1000 + i).padStart(4, '0')}`;
    const soc = societies[i % societies.length];
    const trust = 3.4 + Math.random() * 1.6;
    const lat = rand(BASE.lat); const lng = rand(BASE.lng);
    const u = await prisma.user.upsert({
      where: { phone },
      create: {
        phone, name, societyId: soc.id,
        phoneVerified: true, kycVerified: trust > 4.4,
        trustScore: Number(trust.toFixed(2)),
        lat, lng, geohash: gh(lat, lng),
        bio: randomBio(first),
      },
      update: { name, societyId: soc.id, trustScore: Number(trust.toFixed(2)), lat, lng, geohash: gh(lat, lng) },
    });
    users.push(u);
  }

  // Listings — ≥1 in every listing category
  const listingCats = [
    ['furniture', 'Makrana marble 6-seater dining table', 'Pickup only. Near Bohra Ganesh.', 22000],
    ['furniture', 'Godrej 4-door steel almirah', 'Solid. Locker inside. Moving out.', 7500],
    ['furniture', 'Teak wood study desk + chair', 'Barely used, bought during lockdown.', 6200],
    ['appliances', 'Samsung 1.5-ton inverter AC', '3 yrs old, serviced last month.', 18000],
    ['appliances', 'LG 7kg front-load washing machine', 'Excellent condition, manuals included.', 14500],
    ['appliances', 'Crompton ceiling fans (pair)', 'Both working. Removed during renovation.', 1200],
    ['electronics', 'MacBook Air M1 2020', '256GB/8GB. With charger + sleeve.', 52000],
    ['electronics', 'iPhone 13 128GB Midnight', 'Battery 92%. Box + charger.', 34000],
    ['electronics', 'Sony WH-1000XM4 headphones', 'Mild wear, sounds perfect.', 12500],
    ['vehicles', 'Royal Enfield Classic 350 2021', '12k km. Single owner. Papers clean.', 145000],
    ['vehicles', 'Honda Activa 6G 2022', '5k km. Single owner.', 82000],
    ['vehicles', 'Hero Xpulse 200 4V', '18k km. Trip-ready.', 108000],
    ['fashion', 'Mewari traditional poshak (red)', 'Worn once for wedding. Size M.', 4800],
    ['fashion', 'Men sherwani (cream + gold)', 'Embroidery intact. Dry-cleaned.', 3500],
    ['fashion', 'Designer lehenga (navy)', 'Worn at engagement, M size.', 8500],
    ['books', 'UPSC prelims bundle', 'NCERTs + Lucent + 2 test series.', 1600],
    ['books', 'NEET PG coaching notes', 'Full set, 8 subjects.', 2200],
    ['books', 'Harry Potter 7-book set (hardcover)', 'Like new.', 3800],
    ['kids', 'Hero kids cycle (6-10 yrs)', 'Barely used, tyres fine.', 2200],
    ['kids', 'Baby crib + mattress', 'Used 6 months, clean.', 4500],
    ['kids', 'Fisher-Price activity gym', 'All toys intact.', 1400],
    ['sports', 'MRF Genius cricket bat (English willow)', 'Lightly used, knocked-in.', 2800],
    ['sports', 'Yonex badminton rackets (pair)', 'String recently replaced.', 1800],
    ['sports', 'Adidas football size 5', 'Used on grass a few times.', 900],
    ['home', 'Rajasthani handicraft wall set', 'Mirror-work + carved wood.', 3500],
    ['home', 'Brass pooja thali set', 'Heavy brass, traditional work.', 2400],
    ['home', 'Handloom jaipur dhurrie rug 6x9', 'New, bought extra.', 5500],
    ['other', 'Sewing machine (Usha, manual)', 'Works smoothly.', 2600],
    ['other', 'Trekking backpack 65L', 'Used on 2 treks. Rain cover included.', 2200],
  ];
  for (let i = 0; i < listingCats.length; i++) {
    const [cat, title, desc, rupees] = listingCats[i] as [string, string, string, number];
    const seller = users[i % users.length];
    const lat = rand(BASE.lat); const lng = rand(BASE.lng);
    await prisma.listing.upsert({
      where: { id: `seed-udp-l-${i}` },
      create: {
        id: `seed-udp-l-${i}`,
        sellerId: seller.id, title, description: desc, category: cat,
        priceInPaise: rupees * 100, lat, lng, geohash: gh(lat, lng),
        societyId: seller.societyId,
        images: JSON.stringify([]),
      },
      update: {},
    });
  }

  // Services — ≥2 in every service category
  const serviceCats: Array<[string, string, string, number, string]> = [
    ['plumber', 'Plumber — 10+ yrs in Udaipur', 'Taps, motor, RO, bathroom leakage. Same-day.', 250, 'per_visit'],
    ['plumber', 'Ganesh Plumbing Works', 'Chimney + kitchen sinks + bathroom fittings.', 300, 'per_visit'],
    ['electrician', 'Electrician (licensed)', 'MCB, wiring, fan/AC install. Near Bohra Ganesh.', 300, 'per_visit'],
    ['electrician', 'Shyam Electricals', 'Emergency night calls for power trips.', 450, 'per_visit'],
    ['carpenter', 'Carpenter — modular & repair', 'Cupboards, beds, door fittings.', 500, 'per_visit'],
    ['carpenter', 'Ramesh Ji Carpenter', 'Custom bookshelves, wardrobes to order.', 700, 'per_visit'],
    ['doctor', 'Dr. Nitin Dashora — Family physician', 'Home visits 9am-8pm. Paediatric too.', 600, 'per_visit'],
    ['doctor', 'Dr. Kavita Mehta — Dermatologist', 'Skin & hair consults, clinic @ Shakti Nagar.', 800, 'per_visit'],
    ['tutor', 'Maths + Science tutor (9-12)', 'RBSE & CBSE. Evening batches.', 400, 'per_hour', ],
    ['tutor', 'English spoken + IELTS coach', 'Group + 1:1 batches.', 500, 'per_hour'],
    ['tutor', 'Hindi & Sanskrit tutor', 'Class 6-10 specialty. RBSE board.', 300, 'per_hour'],
    ['maid', 'Home deep cleaning', 'Team of 2, eco-friendly. 3BHK in 5h.', 1800, 'per_visit'],
    ['maid', 'Daily maid — sweeping + mopping', 'Monthly contract, punctual.', 2200, 'per_month'],
    ['maid', 'Cook (veg, Rajasthani cuisine)', 'Dal-baati, gatta, kadhi. Monthly hire.', 6000, 'per_month'],
    ['tiffin', 'Marwari tiffin service (veg)', '3 meals, Jain options, delivery included.', 3000, 'per_month'],
    ['tiffin', 'Ghar-ka-khana tiffin', '2-meal plan, lunch + dinner.', 2200, 'per_month'],
    ['mechanic', 'Bike mechanic — all brands', 'Home pickup within 3km of Bohra Ganesh.', 400, 'per_visit'],
    ['mechanic', 'Car AC + general service', 'Split + home visit available.', 1200, 'per_visit'],
    ['beauty', 'Mehendi & bridal makeup', 'Mewari + Arabic designs. Home service.', 1500, 'per_visit'],
    ['beauty', 'Salon-at-home for women', 'Threading, waxing, facials.', 800, 'per_visit'],
    ['beauty', 'Men grooming at home', 'Haircut + beard + head massage.', 350, 'per_visit'],
    ['pet', 'Dog walker (morning)', 'Daily 45-min walk, Bohra Ganesh area.', 2500, 'per_month'],
    ['pet', 'Pet grooming at home', 'Bath, nail-clip, de-shed. Dogs + cats.', 900, 'per_visit'],
    ['pharmacy', '24x7 Medicine delivery', 'Orders on WhatsApp, delivered in 30min.', 0, 'per_visit'],
    ['pharmacy', 'Diabetic + BP kit rentals', 'Glucometer, BP monitor, nebuliser.', 200, 'per_visit'],
    ['other', 'Yoga at home — certified', 'Morning sessions 6-7:30am.', 2500, 'per_month'],
    ['other', 'Car wash at home', 'Foam + interior vacuum. Sedan/SUV.', 350, 'per_visit'],
    ['other', 'Event photographer (weddings)', 'Half/full day packages. Sample reel on request.', 15000, 'per_visit'],
  ];
  for (let i = 0; i < serviceCats.length; i++) {
    const [cat, title, desc, rupees, unit] = serviceCats[i];
    const provider = users[(i * 3 + 7) % users.length];
    const lat = rand(BASE.lat); const lng = rand(BASE.lng);
    await prisma.service.upsert({
      where: { id: `seed-udp-s-${i}` },
      create: {
        id: `seed-udp-s-${i}`,
        providerId: provider.id, title, description: desc, category: cat,
        priceFrom: rupees * 100, priceUnit: unit,
        lat, lng, geohash: gh(lat, lng),
        societyId: provider.societyId,
        ratingAvg: Number((4 + Math.random()).toFixed(2)),
        ratingCount: 5 + Math.floor(Math.random() * 40),
        responseTimeMin: 10 + Math.floor(Math.random() * 50),
      },
      update: {},
    });
  }

  // Events
  const daysFromNow = (n: number) => new Date(Date.now() + n * 24 * 3600 * 1000);
  const events: Array<[number, string, string, string, number]> = [
    [0, 'Bohra Ganesh aarti + prasad meet', 'Community aarti followed by chai & gathiya.', 'Bohra Ganesh Ji Temple', 2],
    [3, 'Weekend garage sale', 'Furniture, appliances, books at steep discounts.', 'Pratap Nagar Enclave, Block A', 3],
    [5, 'Mehendi workshop (beginners)', 'Learn Mewari patterns. Free cones for first 10.', 'Shakti Nagar community hall', 5],
    [8, 'Yoga-in-the-park morning', '6am Surya namaskar + breathwork. Bring a mat.', 'Sajjangarh base garden', 7],
    [10, 'Kids summer sketching club', '7-12 yr olds, 3 sessions/week, July batch.', 'Bhuwana Greens clubhouse', 10],
    [14, 'Neighborhood plogging drive', 'Run + pick trash around Fateh Sagar. Gloves provided.', 'Fateh Sagar lakeside', 12],
    [20, 'Home-business bazaar', 'Stalls for home-cooks, mehendi, sketch artists.', 'Sukhadia Residency lawn', 15],
  ];
  for (let i = 0; i < events.length; i++) {
    const [ui, title, desc, locText, dayOffset] = events[i];
    const lat = rand(BASE.lat); const lng = rand(BASE.lng);
    await prisma.event.upsert({
      where: { id: `seed-udp-e-${i}` },
      create: {
        id: `seed-udp-e-${i}`,
        creatorId: users[ui].id, title, description: desc,
        locationText: locText, lat, lng, geohash: gh(lat, lng),
        startsAt: daysFromNow(dayOffset),
        capacity: i % 2 === 0 ? 30 + Math.floor(Math.random() * 50) : null,
      },
      update: {},
    });
  }

  // Community posts (Ask the Neighborhood)
  const posts: Array<[number, string, string, string, string]> = [
    [0, 'question', 'Best paediatrician near Bohra Ganesh?', 'My daughter (3yr) has frequent cough. Looking for someone patient with kids who is available on weekends.', 'kids'],
    [1, 'recommendation', 'Gopal ji kachori wale — 10/10', 'Behind the temple lane, 4-7pm only. Fresh, crisp, super tangy imli chutney. Try the khasta variant.', 'food'],
    [2, 'lost_found', 'Found: brown labrador near Fateh Sagar', 'Friendly, red collar, no tag. Keeping with me tonight. DM to claim — I can verify pics.', 'pets'],
    [3, 'announcement', 'Society water tanker Fri 7–11am', 'Full tank cleaning scheduled. Please store water Thursday night. — Sukhadia Residency committee', 'civic'],
    [4, 'question', 'Reliable RO service that comes to Bhuwana?', 'Our filter has been leaking for a week. AquaGuard guys keep bailing. Anyone used a local tech?', 'home'],
    [5, 'recommendation', 'Maid agency near Pratap Nagar', 'Mewar Helpers — ₹500 registration, but actually screens people. Our cook is through them since Jan.', 'home'],
    [6, 'question', 'Carpool to Chetak Circle mornings?', 'I leave Bohra Ganesh at 8:40 weekdays. Happy to split fuel. Reply if interested.', 'transport'],
    [7, 'announcement', 'Society Holi — entries open', 'Colour, snacks, DJ. ₹200/adult, ₹100/kid. Register with building secretary by Sunday.', 'events'],
    [8, 'lost_found', 'Lost: silver bracelet near Sajjangarh', 'Sunday evening hike. Sentimental. Reward for anyone who finds it 🙏', 'personal'],
    [9, 'question', 'Anyone tried the new bakery in Shakti Nagar?', 'The one next to Reliance Smart. Worth the queue?', 'food'],
  ];
  for (let i = 0; i < posts.length; i++) {
    const [ui, kind, title, body] = posts[i];
    const lat = rand(BASE.lat); const lng = rand(BASE.lng);
    await prisma.post.upsert({
      where: { id: `seed-udp-p-${i}` },
      create: {
        id: `seed-udp-p-${i}`, authorId: users[ui].id,
        kind, title, body, lat, lng, geohash: gh(lat, lng),
        upvotes: Math.floor(Math.random() * 12),
      },
      update: {},
    });
  }

  // Polls
  const pollDefs: Array<[number, string, string[]]> = [
    [1, 'Should we organize a Holi meet-up this year?', ['Yes — with DJ', 'Yes — quiet & family-friendly', 'Skip it']],
    [4, 'Where should the new society playground go?', ['Behind Block A', 'Next to parking', 'Roof terrace']],
    [7, 'How often should the common lawn be mowed?', ['Weekly', 'Fortnightly', 'Monthly']],
  ];
  for (let i = 0; i < pollDefs.length; i++) {
    const [ui, question, options] = pollDefs[i];
    const lat = rand(BASE.lat); const lng = rand(BASE.lng);
    await prisma.poll.upsert({
      where: { id: `seed-udp-poll-${i}` },
      create: {
        id: `seed-udp-poll-${i}`, authorId: users[ui].id,
        question, lat, lng, geohash: gh(lat, lng),
        options: { create: options.map((label, idx) => ({ label, idx })) },
      },
      update: {},
    });
  }

  console.log(`✅ Udaipur seed: ${societies.length} societies, ${users.length} users, ${listingCats.length} listings, ${serviceCats.length} services across all categories, ${events.length} events, ${posts.length} posts, ${pollDefs.length} polls.`);
  console.log(`   Centre: ${BASE.lat}, ${BASE.lng} (Bohra Ganesh Ji area)`);
  console.log(`   Login: +919829001000 through +919829001049 — OTP 123456`);
}

function randomBio(first: string): string {
  const bios = [
    `Lifelong ${first.length % 2 === 0 ? 'Udaipur' : 'Mewar'} resident. Happy to help neighbours.`,
    `Foodie & weekend cyclist around Fateh Sagar.`,
    `Small-business owner. Believer in local-first.`,
    `Home-maker + part-time tutor.`,
    `Techie who misses the lake view every time I'm away.`,
    `Aadhaar-verified. Prompt responses guaranteed.`,
  ];
  return pick(bios);
}

async function upsertSociety(name: string, city: string, pincode: string, lat: number, lng: number) {
  const id = `seed-udp-soc-${name.toLowerCase().replace(/\s+/g, '-')}`;
  return prisma.society.upsert({
    where: { id },
    create: { id, name, city, pincode, lat, lng, geohash: gh(lat, lng), verified: true, memberCount: 20 + Math.floor(Math.random() * 80) },
    update: { name, city, pincode, lat, lng, geohash: gh(lat, lng) },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
