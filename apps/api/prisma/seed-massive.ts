// Massive India-wide seed: ~10,000 users across major cities + ~500 concentrated in Udaipur
// with full marketplace/services/ratings/society coverage so the app feels alive in QA.
//
// Run: npx tsx prisma/seed-massive.ts
import { PrismaClient } from '@prisma/client';
import ngeohash from 'ngeohash';

const prisma = new PrismaClient();

// ----------------- City catalog -----------------
// Population-weighted bias keeps tier-1 metros heaviest.
interface City { name: string; state: string; lat: number; lng: number; pin: string; weight: number; }
const CITIES: City[] = [
  { name: 'Mumbai',     state: 'MH', lat: 19.0760, lng: 72.8777, pin: '400001', weight: 12 },
  { name: 'Delhi',      state: 'DL', lat: 28.6139, lng: 77.2090, pin: '110001', weight: 12 },
  { name: 'Bangalore',  state: 'KA', lat: 12.9716, lng: 77.5946, pin: '560001', weight: 11 },
  { name: 'Hyderabad',  state: 'TG', lat: 17.3850, lng: 78.4867, pin: '500001', weight:  9 },
  { name: 'Chennai',    state: 'TN', lat: 13.0827, lng: 80.2707, pin: '600001', weight:  9 },
  { name: 'Kolkata',    state: 'WB', lat: 22.5726, lng: 88.3639, pin: '700001', weight:  8 },
  { name: 'Pune',       state: 'MH', lat: 18.5204, lng: 73.8567, pin: '411001', weight:  8 },
  { name: 'Ahmedabad',  state: 'GJ', lat: 23.0225, lng: 72.5714, pin: '380001', weight:  7 },
  { name: 'Jaipur',     state: 'RJ', lat: 26.9124, lng: 75.7873, pin: '302001', weight:  6 },
  { name: 'Surat',      state: 'GJ', lat: 21.1702, lng: 72.8311, pin: '395001', weight:  5 },
  { name: 'Lucknow',    state: 'UP', lat: 26.8467, lng: 80.9462, pin: '226001', weight:  5 },
  { name: 'Kanpur',     state: 'UP', lat: 26.4499, lng: 80.3319, pin: '208001', weight:  4 },
  { name: 'Nagpur',     state: 'MH', lat: 21.1458, lng: 79.0882, pin: '440001', weight:  4 },
  { name: 'Indore',     state: 'MP', lat: 22.7196, lng: 75.8577, pin: '452001', weight:  4 },
  { name: 'Bhopal',     state: 'MP', lat: 23.2599, lng: 77.4126, pin: '462001', weight:  3 },
  { name: 'Patna',      state: 'BR', lat: 25.5941, lng: 85.1376, pin: '800001', weight:  3 },
  { name: 'Vadodara',   state: 'GJ', lat: 22.3072, lng: 73.1812, pin: '390001', weight:  3 },
  { name: 'Ghaziabad',  state: 'UP', lat: 28.6692, lng: 77.4538, pin: '201001', weight:  3 },
  { name: 'Ludhiana',   state: 'PB', lat: 30.9010, lng: 75.8573, pin: '141001', weight:  3 },
  { name: 'Agra',       state: 'UP', lat: 27.1767, lng: 78.0081, pin: '282001', weight:  3 },
  { name: 'Nashik',     state: 'MH', lat: 19.9975, lng: 73.7898, pin: '422001', weight:  3 },
  { name: 'Faridabad',  state: 'HR', lat: 28.4089, lng: 77.3178, pin: '121001', weight:  3 },
  { name: 'Meerut',     state: 'UP', lat: 28.9845, lng: 77.7064, pin: '250001', weight:  3 },
  { name: 'Rajkot',     state: 'GJ', lat: 22.3039, lng: 70.8022, pin: '360001', weight:  3 },
  { name: 'Varanasi',   state: 'UP', lat: 25.3176, lng: 82.9739, pin: '221001', weight:  3 },
  { name: 'Amritsar',   state: 'PB', lat: 31.6340, lng: 74.8723, pin: '143001', weight:  2 },
  { name: 'Allahabad',  state: 'UP', lat: 25.4358, lng: 81.8463, pin: '211001', weight:  2 },
  { name: 'Coimbatore', state: 'TN', lat: 11.0168, lng: 76.9558, pin: '641001', weight:  2 },
  { name: 'Visakhapatnam', state: 'AP', lat: 17.6868, lng: 83.2185, pin: '530001', weight: 2 },
  { name: 'Kochi',      state: 'KL', lat: 9.9312,  lng: 76.2673, pin: '682001', weight:  2 },
  { name: 'Thiruvananthapuram', state: 'KL', lat: 8.5241, lng: 76.9366, pin: '695001', weight: 2 },
  { name: 'Bhubaneswar',state: 'OR', lat: 20.2961, lng: 85.8245, pin: '751001', weight:  2 },
  { name: 'Guwahati',   state: 'AS', lat: 26.1445, lng: 91.7362, pin: '781001', weight:  2 },
  { name: 'Chandigarh', state: 'CH', lat: 30.7333, lng: 76.7794, pin: '160001', weight:  2 },
  { name: 'Mysore',     state: 'KA', lat: 12.2958, lng: 76.6394, pin: '570001', weight:  2 },
  { name: 'Dehradun',   state: 'UK', lat: 30.3165, lng: 78.0322, pin: '248001', weight:  2 },
  { name: 'Jodhpur',    state: 'RJ', lat: 26.2389, lng: 73.0243, pin: '342001', weight:  2 },
  { name: 'Gurgaon',    state: 'HR', lat: 28.4595, lng: 77.0266, pin: '122001', weight:  4 },
  { name: 'Noida',      state: 'UP', lat: 28.5355, lng: 77.3910, pin: '201301', weight:  3 },
  { name: 'Udaipur',    state: 'RJ', lat: 24.5854, lng: 73.7125, pin: '313001', weight: 10 }, // bumped to ensure hits
];

// Total weight for sampling
const TOTAL_W = CITIES.reduce((a, c) => a + c.weight, 0);

// ----------------- Indian name pools -----------------
const FIRST_NAMES_M = ['Aarav','Vivaan','Aditya','Vihaan','Arjun','Sai','Reyansh','Ayaan','Krishna','Ishaan','Shaurya','Atharv','Advik','Pranav','Aryan','Dhruv','Kabir','Ritvik','Yash','Veer','Aniket','Rohan','Karan','Rajat','Manish','Suresh','Ramesh','Mahesh','Naveen','Ajay','Vikas','Sandeep','Anil','Sunil','Rakesh','Ravi','Kunal','Akash','Nikhil','Harsh','Tarun','Saurabh','Amit','Nitin','Deepak','Vikram','Aakash','Shubham','Tushar','Mohit'];
const FIRST_NAMES_F = ['Saanvi','Aanya','Aaradhya','Ananya','Diya','Pari','Anika','Navya','Kiara','Myra','Sara','Aadhya','Anvi','Riya','Ishita','Kavya','Mira','Avni','Tanya','Pooja','Neha','Priya','Kavita','Sunita','Anjali','Meera','Rekha','Lakshmi','Geeta','Kiran','Asha','Sushma','Pratibha','Manisha','Sonia','Madhuri','Shweta','Nidhi','Smita','Bhavna'];
const SURNAMES = ['Sharma','Verma','Singh','Kumar','Patel','Shah','Mehta','Joshi','Iyer','Iyengar','Reddy','Naidu','Rao','Pillai','Nair','Menon','Banerjee','Mukherjee','Chatterjee','Gupta','Agarwal','Aggarwal','Bansal','Goyal','Mittal','Jindal','Khanna','Kapoor','Malhotra','Chopra','Arora','Sethi','Bhatia','Chauhan','Rajput','Yadav','Das','Roy','Bose','Saxena','Tripathi','Pandey','Shukla','Mishra','Tiwari','Dwivedi','Chaturvedi','Trivedi','Vyas','Bhatt','Pandit','Khurana','Sood'];

const SOCIETY_PREFIX = ['Greenwood','Sunshine','Lake View','Riverside','Royal','Heritage','Pearl','Crystal','Diamond','Emerald','Sapphire','Sterling','Imperial','Capital','Grand','Premier','Elite','Prestige','Brigade','Sobha','DLF','Lodha','Godrej','Tata','Oberoi','Mahindra','Prestige','Hiranandani','Raheja','Embassy','Phoenix','Adarsh','Shanti','Krishna','Vasant','Pratap','Sanjay','Indira','Gandhi','Ashoka','Nehru','Rajiv','Bhagat','Subhash','Tagore','Nirmal','Anand','Jaihind','Bharat'];
const SOCIETY_SUFFIX = ['Heights','Towers','Residency','Apartments','Enclave','Garden','Park','Vista','Greens','Woods','Springs','Plaza','Square','Court','Pride','Galaxy','Estate','Meadows','Manor','Pinnacle','Skyline','Avenue','Crest','Society','Colony','Nagar','Vihar','Niwas'];

// ----------------- Categories -----------------
const SERVICE_CATS = ['plumber','electrician','carpenter','doctor','tutor','maid','tiffin','mechanic','beauty','pet','pharmacy','other'];
const LISTING_CATS = ['furniture','appliances','electronics','vehicles','fashion','books','kids','sports','home','other'];

const SERVICE_TITLES: Record<string, string[]> = {
  plumber:    ['Plumber — same-day visits','Bathroom & kitchen plumbing','24x7 emergency plumber','Tap, motor & RO repairs'],
  electrician:['Licensed electrician','Wiring + MCB upgrades','Fan/AC install + repair','Inverter + UPS specialist'],
  carpenter:  ['Modular & custom carpentry','Door + cupboard repair','Wardrobe specialist','Bedframe & study desk maker'],
  doctor:     ['Family physician — home visits','Paediatric consults','Dermatologist clinic visits','Physiotherapy at home','Dentist (RCT + crown)'],
  tutor:      ['Maths + Science (9-12)','English spoken & IELTS','Hindi + Sanskrit tutor','Coding for kids (Scratch/Python)','UPSC mentor'],
  maid:       ['Daily maid — sweep + mop','Live-in housekeeper','Deep cleaning team','Cook (veg + non-veg)','Babysitter / nanny'],
  tiffin:     ['Marwari tiffin (veg)','Bengali ghar-ka-khana','South Indian tiffin','Jain tiffin (no onion/garlic)','Healthy diet meals'],
  mechanic:   ['Bike mechanic — all brands','Car AC + general service','Two-wheeler doorstep','Scooter quick fix','Cycle tune-up'],
  beauty:     ['Salon-at-home for women','Bridal makeup + mehendi','Men grooming at home','Threading + waxing','Hair color specialist'],
  pet:        ['Dog walker (morning slot)','Pet grooming at home','Boarding while you travel','Cat sitter + vet visit','Pet trainer'],
  pharmacy:   ['24x7 medicine delivery','Diabetic + BP kit rentals','Surgical supplies','Ayurveda chemist','Vaccines + injections'],
  other:      ['Yoga at home — certified','Car wash at home','Event photographer','Pest control','Genset rental','Packers & movers'],
};

const LISTING_TITLES: Record<string, Array<{title: string; rupees: number}>> = {
  furniture: [
    { title: 'IKEA 3-seater fabric sofa', rupees: 18000 },
    { title: 'Sheesham wood double bed', rupees: 12000 },
    { title: 'Godrej steel almirah 4-door', rupees: 7500 },
    { title: 'Teak study desk + chair', rupees: 6200 },
    { title: 'Marble dining table 6-seater', rupees: 22000 },
    { title: 'Recliner armchair (leatherette)', rupees: 9500 },
    { title: 'Office swivel chair (mesh)', rupees: 4200 },
  ],
  appliances: [
    { title: 'Samsung 1.5T inverter AC', rupees: 18000 },
    { title: 'LG 7kg front-load washer', rupees: 14500 },
    { title: 'Voltas 1T window AC', rupees: 9000 },
    { title: 'IFB dishwasher 12-place', rupees: 22000 },
    { title: 'Whirlpool 250L 3-star fridge', rupees: 11000 },
    { title: 'Crompton ceiling fans (pair)', rupees: 1800 },
    { title: 'Prestige induction cooktop', rupees: 1500 },
  ],
  electronics: [
    { title: 'MacBook Air M1 2020 (256/8)', rupees: 52000 },
    { title: 'iPhone 13 128GB Midnight', rupees: 34000 },
    { title: 'OnePlus 11R 12/256GB', rupees: 28000 },
    { title: 'Sony WH-1000XM4', rupees: 12500 },
    { title: 'Canon EOS 200D DSLR', rupees: 24000 },
    { title: 'Mi 43" smart TV (2022)', rupees: 18000 },
    { title: 'PS5 (slim, sealed)', rupees: 47000 },
    { title: 'Logitech MX Master 3', rupees: 5800 },
  ],
  vehicles: [
    { title: 'Royal Enfield Classic 350 2021', rupees: 145000 },
    { title: 'Honda Activa 6G 2022', rupees: 82000 },
    { title: 'Hero Xpulse 200 4V', rupees: 108000 },
    { title: 'TVS Apache RTR 160', rupees: 92000 },
    { title: 'Bajaj Pulsar NS200', rupees: 110000 },
    { title: 'Maruti Swift VXi 2019', rupees: 525000 },
    { title: 'Yamaha FZ-S V3', rupees: 95000 },
  ],
  fashion: [
    { title: 'Designer lehenga (navy)', rupees: 8500 },
    { title: 'Mens sherwani (cream + gold)', rupees: 3500 },
    { title: 'Banarasi silk saree (red)', rupees: 6500 },
    { title: 'Branded leather jacket (M)', rupees: 4200 },
    { title: 'Wedding poshak Mewari', rupees: 4800 },
    { title: 'Nike running shoes (UK 9)', rupees: 3500 },
  ],
  books: [
    { title: 'UPSC prelims bundle', rupees: 1600 },
    { title: 'NEET PG coaching notes', rupees: 2200 },
    { title: 'Harry Potter 7-book hardcover', rupees: 3800 },
    { title: 'CAT prep full set 2024', rupees: 1900 },
    { title: 'NCERT 6-12 full set', rupees: 1100 },
    { title: 'GATE CSE all subjects', rupees: 2500 },
  ],
  kids: [
    { title: 'Hero kids cycle (6-10 yrs)', rupees: 2200 },
    { title: 'Baby crib + mattress', rupees: 4500 },
    { title: 'Fisher-Price activity gym', rupees: 1400 },
    { title: 'Stroller (Mee Mee)', rupees: 3200 },
    { title: 'Lego Classic 1500-piece', rupees: 2500 },
  ],
  sports: [
    { title: 'MRF Genius cricket bat', rupees: 2800 },
    { title: 'Yonex badminton rackets (pair)', rupees: 1800 },
    { title: 'Adidas football size 5', rupees: 900 },
    { title: 'Decathlon dumbbells 20kg', rupees: 2400 },
    { title: 'Treadmill Powermax', rupees: 16000 },
    { title: 'Yoga mat + props bundle', rupees: 1200 },
  ],
  home: [
    { title: 'Rajasthani wall handicraft set', rupees: 3500 },
    { title: 'Brass pooja thali set', rupees: 2400 },
    { title: 'Jaipur dhurrie rug 6x9', rupees: 5500 },
    { title: 'Pendant light fixtures (3)', rupees: 1800 },
    { title: 'Curtains blackout 4-panels', rupees: 2200 },
  ],
  other: [
    { title: 'Sewing machine (Usha manual)', rupees: 2600 },
    { title: 'Trekking backpack 65L', rupees: 2200 },
    { title: 'Acoustic guitar (Yamaha F310)', rupees: 7500 },
    { title: 'Drum kit (5-piece, used)', rupees: 22000 },
  ],
};

const BIOS = [
  'Local resident, happy to help neighbours.',
  'Aadhaar verified, prompt responses.',
  'Foodie + cyclist, knows the area inside out.',
  'Small-business owner. Believer in local-first.',
  'Home-maker + part-time tutor.',
  'Techie. Replies fast on chat.',
  'Family man. Lived here for 8+ years.',
  'Service provider with 200+ happy customers.',
  'Sustainable living enthusiast.',
  'Verified seller. Genuine items only.',
];

// ----------------- Helpers -----------------
const rand = (v: number, r: number) => v + (Math.random() - 0.5) * r;
const randInt = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1));
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const gh = (lat: number, lng: number) => ngeohash.encode(lat, lng, 6);
const sample = (cities: City[]): City => {
  const r = Math.random() * TOTAL_W;
  let acc = 0;
  for (const c of cities) { acc += c.weight; if (r <= acc) return c; }
  return cities[cities.length - 1];
};

// ----------------- Main -----------------
async function main() {
  console.log('🌱 MASSIVE seed starting — ~10k India users + 500 Udaipur deep concentration');
  const t0 = Date.now();

  // 1. Society catalog: 4-8 per city + 12 dedicated for Udaipur
  console.log('  → societies...');
  const societiesByCity = new Map<string, any[]>();
  for (const c of CITIES) {
    const count = c.name === 'Udaipur' ? 12 : c.weight >= 8 ? 6 : 4;
    const arr: any[] = [];
    for (let i = 0; i < count; i++) {
      const name = `${pick(SOCIETY_PREFIX)} ${pick(SOCIETY_SUFFIX)}`;
      const id = `mass-soc-${c.name}-${i}`.toLowerCase().replace(/\s+/g, '-');
      const lat = rand(c.lat, 0.06);
      const lng = rand(c.lng, 0.06);
      const soc = await prisma.society.upsert({
        where: { id },
        create: {
          id, name, city: c.name, pincode: c.pin,
          lat, lng, geohash: gh(lat, lng),
          verified: Math.random() > 0.4,
          memberCount: 20 + Math.floor(Math.random() * 200),
        },
        update: {},
      });
      arr.push({ ...soc, _city: c });
    }
    societiesByCity.set(c.name, arr);
  }

  // 2. Users — 10,000 spread across India by weight, plus 500 in Udaipur
  console.log('  → 10,000 India-wide users...');
  const targetIndia = 10_000;
  const indiaUsers: any[] = [];
  const phoneBase = 9_500_000_000; // +91 9500000000 .. 9500009999 (10k India users)
  // Bulk-create via createMany for speed
  const userBatch: any[] = [];
  for (let i = 0; i < targetIndia; i++) {
    const c = sample(CITIES);
    const societies = societiesByCity.get(c.name)!;
    const soc = pick(societies);
    const male = Math.random() > 0.45;
    const first = male ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
    const last  = pick(SURNAMES);
    const phone = `+91${phoneBase + i}`;
    const lat = rand(soc.lat, 0.02);
    const lng = rand(soc.lng, 0.02);
    const trust = randInt(20, 95);
    userBatch.push({
      phone,
      name: `${first} ${last}`,
      bio: pick(BIOS),
      societyId: soc.id,
      phoneVerified: true,
      kycVerified: trust > 70,
      trustScore: trust,
      lat, lng, geohash: gh(lat, lng),
    });
  }
  // chunked createMany — sqlite can choke on huge batches
  let created = 0;
  for (let i = 0; i < userBatch.length; i += 500) {
    const slice = userBatch.slice(i, i + 500);
    const res = await prisma.user.createMany({ data: slice }).catch(() => ({ count: 0 }));
    created += res.count;
  }
  console.log(`     ${created} users inserted (skipping any phone collisions)`);
  // Re-read because createMany doesn't return ids in sqlite
  const seededUsers = await prisma.user.findMany({
    where: { phone: { startsWith: '+919500' } },
    select: { id: true, name: true, phone: true, lat: true, lng: true, societyId: true, kycVerified: true, trustScore: true },
    take: 12_000,
  });
  // Group by society
  const usersBySociety = new Map<string, any[]>();
  for (const u of seededUsers) {
    if (!u.societyId) continue;
    if (!usersBySociety.has(u.societyId)) usersBySociety.set(u.societyId, []);
    usersBySociety.get(u.societyId)!.push(u);
  }
  indiaUsers.push(...seededUsers);

  // 3. Udaipur deep concentration: 500 more users
  console.log('  → 500 dedicated Udaipur users...');
  const udSocieties = societiesByCity.get('Udaipur')!;
  const udBatch: any[] = [];
  const udPhoneBase = 9_900_000_000; // +91 9900000000 .. 9900000499 (Udaipur deep)
  for (let i = 0; i < 500; i++) {
    const soc = pick(udSocieties);
    const male = Math.random() > 0.45;
    const first = male ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
    const last  = pick(SURNAMES);
    const phone = `+91${udPhoneBase + i}`;
    const lat = rand(soc.lat, 0.015);
    const lng = rand(soc.lng, 0.015);
    const trust = randInt(35, 95);
    udBatch.push({
      phone,
      name: `${first} ${last}`,
      bio: pick(BIOS),
      societyId: soc.id,
      phoneVerified: true,
      kycVerified: trust > 65,
      trustScore: trust,
      lat, lng, geohash: gh(lat, lng),
    });
  }
  for (let i = 0; i < udBatch.length; i += 500) {
    await prisma.user.createMany({ data: udBatch.slice(i, i + 500) }).catch(() => null);
  }
  const udUsers = await prisma.user.findMany({
    where: { phone: { startsWith: '+919900' } },
    select: { id: true, name: true, lat: true, lng: true, societyId: true, kycVerified: true, trustScore: true },
    take: 600,
  });
  for (const u of udUsers) {
    if (!u.societyId) continue;
    if (!usersBySociety.has(u.societyId)) usersBySociety.set(u.societyId, []);
    usersBySociety.get(u.societyId)!.push(u);
  }

  // 4. Listings — sprinkle 2-4 per city's user pool
  console.log('  → listings (~6,000)...');
  const listingBatch: any[] = [];
  for (const c of CITIES) {
    const cityUsers = [...usersBySociety.entries()]
      .filter(([sid]) => societiesByCity.get(c.name)!.some((s) => s.id === sid))
      .flatMap(([, us]) => us);
    if (cityUsers.length === 0) continue;
    const listingsPerCity = c.name === 'Udaipur' ? 600 : Math.max(40, c.weight * 30);
    for (let i = 0; i < listingsPerCity; i++) {
      const u = pick(cityUsers);
      const cat = pick(LISTING_CATS);
      const tmpl = pick(LISTING_TITLES[cat]!);
      const rupees = Math.round(tmpl.rupees * (0.7 + Math.random() * 0.6));
      const lat = rand(u.lat ?? c.lat, 0.012);
      const lng = rand(u.lng ?? c.lng, 0.012);
      listingBatch.push({
        sellerId: u.id, title: tmpl.title,
        description: `${tmpl.title} — verified seller in ${c.name}. Pickup or local delivery. Genuine item.`,
        category: cat,
        priceInPaise: rupees * 100, negotiable: Math.random() > 0.3,
        status: 'active',
        lat, lng, geohash: gh(lat, lng),
        societyId: u.societyId,
        images: '[]',
        bumpedAt: Math.random() > 0.7 ? new Date() : null,
      });
    }
  }
  console.log(`     queued ${listingBatch.length} listings`);
  for (let i = 0; i < listingBatch.length; i += 500) {
    await prisma.listing.createMany({ data: listingBatch.slice(i, i + 500) }).catch(() => null);
  }

  // 5. Services — every category covered in every major city, dense in Udaipur
  console.log('  → services (~3,500)...');
  const serviceBatch: any[] = [];
  for (const c of CITIES) {
    const cityUsers = [...usersBySociety.entries()]
      .filter(([sid]) => societiesByCity.get(c.name)!.some((s) => s.id === sid))
      .flatMap(([, us]) => us);
    if (cityUsers.length === 0) continue;
    const perCat = c.name === 'Udaipur' ? 18 : c.weight >= 8 ? 6 : 3;
    for (const cat of SERVICE_CATS) {
      for (let i = 0; i < perCat; i++) {
        const u = pick(cityUsers);
        const titleTmpl = pick(SERVICE_TITLES[cat]!);
        const baseRupees = cat === 'doctor' ? 600 : cat === 'beauty' ? 500 : cat === 'tutor' ? 400 : 350;
        const rupees = Math.round(baseRupees * (0.6 + Math.random() * 1.5));
        const lat = rand(u.lat ?? c.lat, 0.015);
        const lng = rand(u.lng ?? c.lng, 0.015);
        serviceBatch.push({
          providerId: u.id,
          title: titleTmpl,
          description: `${titleTmpl} — serving ${c.name} ${c.state}. Same-day visits, transparent pricing.`,
          category: cat,
          priceFrom: rupees * 100,
          priceUnit: cat === 'tiffin' || cat === 'maid' ? 'per_month' : cat === 'tutor' ? 'per_hour' : 'per_visit',
          available: true,
          lat, lng, geohash: gh(lat, lng),
          societyId: u.societyId,
          ratingAvg: Number((3.6 + Math.random() * 1.4).toFixed(2)),
          ratingCount: randInt(3, 80),
          responseTimeMin: randInt(5, 120),
        });
      }
    }
  }
  console.log(`     queued ${serviceBatch.length} services`);
  for (let i = 0; i < serviceBatch.length; i += 500) {
    await prisma.service.createMany({ data: serviceBatch.slice(i, i + 500) }).catch(() => null);
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.society.count(),
    prisma.listing.count(),
    prisma.service.count(),
  ]);
  console.log(`\n✅ MASSIVE seed done in ${dt}s`);
  console.log(`   users:    ${counts[0]}`);
  console.log(`   societies:${counts[1]}`);
  console.log(`   listings: ${counts[2]}`);
  console.log(`   services: ${counts[3]}`);
  console.log(`\n   Test credentials:`);
  console.log(`   • +919500000000..+919500009999  → 10k India users (OTP 123456)`);
  console.log(`   • +919900000000..+919900000499  → 500 Udaipur deep users (OTP 123456)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
