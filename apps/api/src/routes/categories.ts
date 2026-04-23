import { Router } from 'express';

export const categoryRouter = Router();

export const LISTING_CATEGORIES = [
  { key: 'furniture', label: 'Furniture', icon: '🛋️' },
  { key: 'appliances', label: 'Appliances', icon: '🧺' },
  { key: 'electronics', label: 'Electronics', icon: '📱' },
  { key: 'vehicles', label: 'Vehicles', icon: '🛵' },
  { key: 'fashion', label: 'Fashion', icon: '👗' },
  { key: 'books', label: 'Books', icon: '📚' },
  { key: 'kids', label: 'Kids & Baby', icon: '🧸' },
  { key: 'sports', label: 'Sports', icon: '⚽' },
  { key: 'home', label: 'Home Decor', icon: '🪴' },
  { key: 'other', label: 'Other', icon: '📦' },
];

export const SERVICE_CATEGORIES = [
  { key: 'plumber', label: 'Plumber', icon: '🔧' },
  { key: 'electrician', label: 'Electrician', icon: '⚡' },
  { key: 'carpenter', label: 'Carpenter', icon: '🪚' },
  { key: 'doctor', label: 'Doctor', icon: '🩺' },
  { key: 'tutor', label: 'Tutor', icon: '📖' },
  { key: 'maid', label: 'Maid / Cook', icon: '🧹' },
  { key: 'tiffin', label: 'Tiffin', icon: '🍱' },
  { key: 'mechanic', label: 'Mechanic', icon: '🛠️' },
  { key: 'beauty', label: 'Beauty', icon: '💇' },
  { key: 'pet', label: 'Pet Care', icon: '🐶' },
  { key: 'pharmacy', label: 'Pharmacy', icon: '💊' },
  { key: 'other', label: 'Other', icon: '🧰' },
];

categoryRouter.get('/', (_req, res) => {
  res.json({ listings: LISTING_CATEGORIES, services: SERVICE_CATEGORIES });
});
