export type AttrField =
  | { key: string; label: string; type: 'text'; placeholder?: string }
  | { key: string; label: string; type: 'number'; placeholder?: string; suffix?: string }
  | { key: string; label: string; type: 'choice'; options: string[] };

export const ATTR_SPECS: Record<string, AttrField[]> = {
  vehicles: [
    { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Honda, Hero…' },
    { key: 'model', label: 'Model', type: 'text', placeholder: 'Activa 6G' },
    { key: 'year', label: 'Year', type: 'number', placeholder: '2021' },
    { key: 'kmDriven', label: 'Kilometers driven', type: 'number', suffix: 'km' },
    { key: 'fuel', label: 'Fuel', type: 'choice', options: ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid'] },
    { key: 'owners', label: 'Owners', type: 'choice', options: ['1st', '2nd', '3rd', '4th+'] },
  ],
  electronics: [
    { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Apple, Samsung…' },
    { key: 'model', label: 'Model', type: 'text' },
    { key: 'storage', label: 'Storage', type: 'choice', options: ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'] },
    { key: 'condition', label: 'Condition', type: 'choice', options: ['Like new', 'Good', 'Fair', 'Needs repair'] },
    { key: 'ageMonths', label: 'Age', type: 'number', suffix: 'months' },
    { key: 'warranty', label: 'Warranty left', type: 'choice', options: ['None', '<6 months', '6–12 months', '1 year+'] },
  ],
  appliances: [
    { key: 'brand', label: 'Brand', type: 'text' },
    { key: 'condition', label: 'Condition', type: 'choice', options: ['Like new', 'Good', 'Fair', 'Needs repair'] },
    { key: 'ageYears', label: 'Age', type: 'number', suffix: 'years' },
  ],
  furniture: [
    { key: 'material', label: 'Material', type: 'choice', options: ['Wood', 'Metal', 'Plastic', 'Glass', 'Fabric'] },
    { key: 'condition', label: 'Condition', type: 'choice', options: ['Like new', 'Good', 'Fair', 'Worn'] },
    { key: 'ageYears', label: 'Age', type: 'number', suffix: 'years' },
  ],
  fashion: [
    { key: 'size', label: 'Size', type: 'text', placeholder: 'S, M, 38…' },
    { key: 'condition', label: 'Condition', type: 'choice', options: ['Unused', 'Like new', 'Good', 'Worn'] },
    { key: 'gender', label: 'For', type: 'choice', options: ['Men', 'Women', 'Unisex', 'Kids'] },
  ],
  books: [
    { key: 'author', label: 'Author', type: 'text' },
    { key: 'edition', label: 'Edition', type: 'text' },
    { key: 'condition', label: 'Condition', type: 'choice', options: ['Unused', 'Like new', 'Good', 'Worn'] },
  ],
  kids: [
    { key: 'ageRange', label: 'Age range', type: 'choice', options: ['0–1y', '1–3y', '3–6y', '6–10y', '10y+'] },
    { key: 'condition', label: 'Condition', type: 'choice', options: ['Unused', 'Like new', 'Good', 'Worn'] },
  ],
  sports: [
    { key: 'sport', label: 'Sport', type: 'text' },
    { key: 'condition', label: 'Condition', type: 'choice', options: ['Unused', 'Like new', 'Good', 'Worn'] },
  ],
  home: [
    { key: 'material', label: 'Material', type: 'text' },
    { key: 'condition', label: 'Condition', type: 'choice', options: ['Unused', 'Like new', 'Good', 'Worn'] },
  ],
};

export function attrFields(category: string): AttrField[] {
  return ATTR_SPECS[category] ?? [];
}
