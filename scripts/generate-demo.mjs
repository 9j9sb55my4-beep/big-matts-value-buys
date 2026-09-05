/**
 * Generates public/demo-week.json + public/price-history.json
 * Seeded synthetic River North weekly ads with multi-week history
 * so analysis (vs typical / rare BOGO) works offline.
 */
import { writeFileSync } from 'fs';

const validFrom = '2026-09-03';
const validTo = '2026-09-09';
const weeks = [
  '2026-08-06',
  '2026-08-13',
  '2026-08-20',
  '2026-08-27',
  '2026-09-03',
];

function norm(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const catalog = [
  // JEWEL — items where THIS week is unusually good
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'meat', name: 'Italian Sausage Links', brand: 'Signature Farms', unit: 'lb', size: 'per lb',
    history: [4.99, 4.99, 5.49, 4.79, 2.49], promos: ['plain','plain','sale','plain','bogo'], bogo: true, regPrice: 4.99, flyerUrl: 'https://www.jewelosco.com/weeklyad', notes: 'BOGO this week — rarely on ad' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'meat', name: 'Boneless Skinless Chicken Breasts', brand: 'Just Bare', unit: 'lb', size: 'per lb',
    history: [3.99, 4.49, 3.79, 4.29, 1.99], promos: ['sale','plain','sale','plain','sale'], regPrice: 4.99, flyerUrl: 'https://www.jewelosco.com/weeklyad' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'meat', name: '80% Lean Ground Beef', brand: 'Open Nature', unit: 'lb', size: 'per lb',
    history: [5.99, 6.49, 5.79, 6.29, 3.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 6.49, flyerUrl: 'https://www.jewelosco.com/weeklyad' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'produce', name: 'Organic Avocados', unit: 'each', size: 'each',
    history: [2.49, 2.29, 2.49, 1.99, 1.0], promos: ['plain','plain','plain','sale','multi'], multiBuyQty: 2, multiBuyPrice: 2.0, regPrice: 2.49, flyerUrl: 'https://www.jewelosco.com/weeklyad', notes: '2 for $2' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'produce', name: 'Honeycrisp Apples', unit: 'lb', size: 'per lb',
    history: [3.49, 3.29, 3.49, 2.99, 1.99], promos: ['plain','plain','plain','sale','sale'], regPrice: 3.49, flyerUrl: 'https://www.jewelosco.com/weeklyad' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'produce', name: 'Broccoli Crowns', unit: 'lb', size: 'per lb',
    history: [2.49, 2.29, 2.49, 1.99, 1.48], promos: ['plain','sale','plain','sale','sale'], regPrice: 2.49, flyerUrl: 'https://www.jewelosco.com/weeklyad' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'dairy', name: 'Lucerne Large Eggs', brand: 'Lucerne', unit: 'each', size: '12 ct',
    history: [3.99, 4.29, 3.79, 4.49, 2.49], promos: ['plain','plain','sale','plain','sale'], regPrice: 4.29, unitPrice: 0.21, flyerUrl: 'https://www.jewelosco.com/weeklyad' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'dairy', name: 'Lucerne Whole Milk', brand: 'Lucerne', unit: 'oz', size: 'gallon',
    history: [4.29, 4.49, 4.19, 4.49, 2.99], promos: ['plain','plain','plain','plain','sale'], regPrice: 4.49, flyerUrl: 'https://www.jewelosco.com/weeklyad' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'dairy', name: 'Tillamook Cheese Block', brand: 'Tillamook', unit: 'oz', size: '8 oz',
    history: [6.99, 6.49, 6.99, 5.99, 3.99], promos: ['plain','sale','plain','sale','multi'], multiBuyQty: 2, multiBuyPrice: 7.0, regPrice: 6.99, flyerUrl: 'https://www.jewelosco.com/weeklyad', notes: '2 for $7' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'frozen', name: 'DiGiorno Rising Crust Pizza', brand: 'DiGiorno', unit: 'each', size: 'each',
    history: [7.99, 8.49, 6.99, 8.49, 4.99], promos: ['plain','plain','sale','plain','multi'], multiBuyQty: 2, multiBuyPrice: 9.0, regPrice: 8.49, flyerUrl: 'https://www.jewelosco.com/weeklyad' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'frozen', name: "Ben & Jerry's Ice Cream", brand: "Ben & Jerry's", unit: 'oz', size: '16 oz',
    history: [5.49, 5.99, 4.99, 5.99, 3.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 5.99, flyerUrl: 'https://www.jewelosco.com/weeklyad' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'alcohol', name: 'La Marca Prosecco', brand: 'La Marca', unit: 'each', size: '750ml',
    history: [15.99, 16.99, 14.99, 16.99, 11.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 16.99, flyerUrl: 'https://www.jewelosco.com/weeklyad' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'alcohol', name: 'White Claw Variety Pack', brand: 'White Claw', unit: 'each', size: '12 pk',
    history: [21.99, 22.99, 19.99, 22.99, 16.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 22.99, flyerUrl: 'https://www.jewelosco.com/weeklyad' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'pantry', name: 'Barilla Pasta', brand: 'Barilla', unit: 'oz', size: '16 oz',
    history: [1.89, 1.79, 1.89, 1.49, 1.0], promos: ['plain','plain','plain','sale','multi'], multiBuyQty: 4, multiBuyPrice: 4.0, regPrice: 1.89, flyerUrl: 'https://www.jewelosco.com/weeklyad', notes: '4 for $4' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'pantry', name: "Rao's Homemade Marinara", brand: "Rao's", unit: 'oz', size: '24 oz',
    history: [8.49, 7.99, 8.49, 6.99, 5.99], promos: ['plain','sale','plain','sale','sale'], regPrice: 8.49, flyerUrl: 'https://www.jewelosco.com/weeklyad' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'snacks', name: "Lay's Classic Chips", brand: "Lay's", unit: 'oz', size: '8 oz',
    history: [4.49, 4.29, 3.99, 4.49, 2.5], promos: ['plain','plain','sale','plain','multi'], multiBuyQty: 2, multiBuyPrice: 5.0, regPrice: 4.49, flyerUrl: 'https://www.jewelosco.com/weeklyad' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'bakery', name: 'Oroweat Whole Grain Bread', brand: 'Oroweat', unit: 'oz', size: '24 oz',
    history: [4.99, 4.79, 4.99, 3.99, 2.99], promos: ['plain','plain','plain','sale','sale'], regPrice: 4.99, flyerUrl: 'https://www.jewelosco.com/weeklyad' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'household', name: 'Bounty Paper Towels', brand: 'Bounty', unit: 'each', size: '6 rolls',
    history: [14.99, 15.99, 13.99, 15.99, 9.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 15.99, flyerUrl: 'https://www.jewelosco.com/weeklyad' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'household', name: 'Tide Pods', brand: 'Tide', unit: 'ct', size: '42 ct',
    history: [17.99, 18.99, 16.99, 18.99, 11.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 18.99, flyerUrl: 'https://www.jewelosco.com/weeklyad' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'household', name: 'Tide Laundry Detergent', brand: 'Tide',
    history: [27.99, 26.99, 27.99, 25.99, 23.99], promos: ['plain','plain','plain','sale','sale'], regPrice: 27.99, flyerUrl: 'https://www.jewelosco.com/weeklyad', notes: 'HOT OFFER' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'deli', name: "Boar's Head Oven Gold Turkey", brand: "Boar's Head", unit: 'lb', size: 'per lb',
    history: [11.99, 12.99, 10.99, 12.99, 8.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 12.99, flyerUrl: 'https://www.jewelosco.com/weeklyad' },

  // ALDI — often cheaper baseline; some real drops
  { store: 'aldi', storeLabel: 'Aldi', category: 'meat', name: 'Never Any! Chicken Breast', brand: 'Never Any!', unit: 'lb', size: 'per lb',
    history: [2.99, 3.29, 2.89, 3.49, 2.49], promos: ['sale','plain','sale','plain','sale'], regPrice: 3.49, flyerUrl: 'https://www.aldi.us/en/weekly-specials/' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'meat', name: 'Italian Sausage', brand: 'Never Any!', unit: 'lb', size: 'per lb',
    history: [3.49, 3.49, 3.69, 3.49, 2.99], promos: ['plain','plain','plain','plain','sale'], regPrice: 3.69, flyerUrl: 'https://www.aldi.us/en/weekly-specials/', notes: 'Cross-store: compare to Jewel BOGO sausage' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'meat', name: 'Ground Chuck 80/20', brand: 'Kirkwood', unit: 'lb', size: 'per lb',
    history: [4.29, 4.49, 3.99, 4.49, 3.69], promos: ['plain','plain','sale','plain','sale'], regPrice: 4.49, flyerUrl: 'https://www.aldi.us/en/weekly-specials/' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'meat', name: 'Salmon Fillets', brand: 'Specially Selected', unit: 'lb', size: 'per lb',
    history: [8.99, 9.99, 7.99, 9.49, 6.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 9.99, flyerUrl: 'https://www.aldi.us/en/weekly-specials/' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'produce', name: 'Avocados', unit: 'each', size: 'each',
    history: [0.99, 1.29, 0.89, 1.19, 0.69], promos: ['sale','plain','sale','plain','sale'], regPrice: 1.29, flyerUrl: 'https://www.aldi.us/en/weekly-specials/' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'produce', name: 'Strawberries', brand: 'Little Salad Bar', unit: 'each', size: '1 lb clamshell',
    history: [2.69, 2.99, 2.49, 2.99, 1.89], promos: ['plain','plain','sale','plain','sale'], regPrice: 2.99, flyerUrl: 'https://www.aldi.us/en/weekly-specials/' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'produce', name: 'Bananas', unit: 'lb', size: 'per lb',
    history: [0.49, 0.59, 0.45, 0.55, 0.39], promos: ['plain','plain','sale','plain','sale'], regPrice: 0.59, flyerUrl: 'https://www.aldi.us/en/weekly-specials/' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'dairy', name: 'Friendly Farms Eggs Large', brand: 'Friendly Farms', unit: 'each', size: '12 ct',
    history: [2.45, 2.65, 2.25, 2.65, 1.85], promos: ['plain','plain','sale','plain','sale'], regPrice: 2.65, flyerUrl: 'https://www.aldi.us/en/weekly-specials/' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'dairy', name: 'Friendly Farms Whole Milk', brand: 'Friendly Farms', unit: 'oz', size: 'gallon',
    history: [3.25, 3.45, 3.15, 3.45, 2.65], promos: ['plain','plain','plain','plain','sale'], regPrice: 3.45, flyerUrl: 'https://www.aldi.us/en/weekly-specials/' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'dairy', name: 'Emporium Selection Cheddar', brand: 'Emporium Selection', unit: 'oz', size: '8 oz',
    history: [2.65, 2.89, 2.49, 2.89, 2.15], promos: ['plain','plain','sale','plain','sale'], regPrice: 2.89, flyerUrl: 'https://www.aldi.us/en/weekly-specials/' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'frozen', name: 'Casa Mamita Burritos', brand: 'Casa Mamita', unit: 'oz', size: '8 ct',
    history: [3.69, 3.99, 3.49, 3.99, 2.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 3.99, flyerUrl: 'https://www.aldi.us/en/weekly-specials/' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'frozen', name: 'Specially Selected Ice Cream', brand: 'Specially Selected', unit: 'oz', size: '1.5 qt',
    history: [3.49, 3.99, 3.29, 3.99, 2.85], promos: ['plain','plain','sale','plain','sale'], regPrice: 3.99, flyerUrl: 'https://www.aldi.us/en/weekly-specials/' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'alcohol', name: 'Winking Owl Cabernet', brand: 'Winking Owl', unit: 'each', size: '750ml',
    history: [3.45, 3.95, 3.25, 3.95, 2.95], promos: ['plain','plain','sale','plain','sale'], regPrice: 3.95, flyerUrl: 'https://www.aldi.us/en/weekly-specials/' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'pantry', name: 'Priano Pasta Sauce', brand: 'Priano', unit: 'oz', size: '24 oz',
    history: [2.09, 2.29, 1.89, 2.29, 1.69], promos: ['plain','plain','sale','plain','sale'], regPrice: 2.29, flyerUrl: 'https://www.aldi.us/en/weekly-specials/' },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', category: 'pantry', name: 'La Preferida Pinto Beans, Black Beans or Chickpeas', brand: 'La Preferida', unit: 'oz', size: '15 oz',
    history: [2.49, 2.49, 2.29, 2.49, 2.49], promos: ['plain','plain','sale','plain','bogo'], bogo: true, regPrice: 2.49, flyerUrl: 'https://www.jewelosco.com/weeklyad', notes: 'BOGO ~$1.25 ea — check Aldi everyday' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'pantry', name: "Dakota's Pride Black Beans", brand: "Dakota's Pride", unit: 'oz', size: '15.5 oz',
    history: [0.95, 0.99, 0.89, 0.95, 0.99], promos: ['plain','plain','plain','plain','plain'], regPrice: 0.99, flyerUrl: 'https://www.aldi.us/en/weekly-specials/', notes: 'Everyday shelf' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'pantry', name: "Dakota's Pride Pinto Beans", brand: "Dakota's Pride", unit: 'oz', size: '15.5 oz',
    history: [0.95, 0.89, 0.95, 0.99, 0.95], promos: ['plain','plain','plain','plain','plain'], regPrice: 0.95, flyerUrl: 'https://www.aldi.us/en/weekly-specials/', notes: 'Everyday shelf' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'pantry', name: 'Reggano Spaghetti', brand: 'Reggano', unit: 'oz', size: '16 oz',
    history: [1.05, 1.15, 0.95, 1.15, 0.85], promos: ['plain','plain','sale','plain','sale'], regPrice: 1.15, flyerUrl: 'https://www.aldi.us/en/weekly-specials/' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'snacks', name: "Clancy's Potato Chips", brand: "Clancy's", unit: 'oz', size: '8 oz',
    history: [1.69, 1.89, 1.49, 1.89, 1.35], promos: ['plain','plain','sale','plain','sale'], regPrice: 1.89, flyerUrl: 'https://www.aldi.us/en/weekly-specials/' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'bakery', name: "L'oven Fresh Bread", brand: "L'oven Fresh", unit: 'oz', size: '20 oz',
    history: [1.59, 1.79, 1.49, 1.79, 1.29], promos: ['plain','plain','sale','plain','sale'], regPrice: 1.79, flyerUrl: 'https://www.aldi.us/en/weekly-specials/' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'bakery', name: 'Bake Shop Croissants 4-pack', brand: 'Bake Shop', unit: 'each', size: '4 ct',
    history: [3.29, 3.49, 2.99, 3.49, 2.49], promos: ['plain','plain','sale','plain','sale'], regPrice: 3.49, flyerUrl: 'https://www.aldi.us/en/weekly-specials/' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'household', name: 'Alpine Fresh Paper Towels', brand: 'Alpine Fresh', unit: 'each', size: '6 rolls',
    history: [7.49, 8.49, 6.99, 8.49, 5.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 8.49, flyerUrl: 'https://www.aldi.us/en/weekly-specials/' },
  { store: 'aldi', storeLabel: 'Aldi', category: 'deli', name: 'Appleton Farms Honey Ham', brand: 'Appleton Farms', unit: 'lb', size: 'per lb sliced',
    history: [4.99, 5.49, 4.49, 5.49, 3.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 5.49, flyerUrl: 'https://www.aldi.us/en/weekly-specials/' },

  // TARGET
  { store: 'target', storeLabel: 'Target', category: 'meat', name: 'Good & Gather Chicken Breast', brand: 'Good & Gather', unit: 'lb', size: 'per lb',
    history: [3.99, 4.49, 3.79, 4.29, 2.99], promos: ['sale','plain','sale','plain','sale'], regPrice: 4.49, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l' },
  { store: 'target', storeLabel: 'Target', category: 'meat', name: 'Good & Gather Ground Beef 85%', brand: 'Good & Gather', unit: 'lb', size: '1 lb',
    history: [5.99, 6.99, 5.49, 6.49, 4.49], promos: ['plain','plain','sale','plain','sale'], regPrice: 6.99, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l' },
  { store: 'target', storeLabel: 'Target', category: 'produce', name: 'Good & Gather Organic Blueberries', brand: 'Good & Gather', unit: 'each', size: '6 oz',
    history: [4.49, 4.99, 3.99, 4.99, 2.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 4.99, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l' },
  { store: 'target', storeLabel: 'Target', category: 'produce', name: 'Bagged Mini Peppers', brand: 'Good & Gather', unit: 'each', size: '1 lb bag',
    history: [3.69, 3.99, 3.29, 3.99, 2.5], promos: ['plain','plain','sale','plain','sale'], regPrice: 3.99, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l' },
  { store: 'target', storeLabel: 'Target', category: 'dairy', name: 'Good & Gather Eggs', brand: 'Good & Gather', unit: 'each', size: '12 ct',
    history: [3.29, 3.79, 2.99, 3.79, 2.29], promos: ['plain','plain','sale','plain','sale'], regPrice: 3.79, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l' },
  { store: 'target', storeLabel: 'Target', category: 'dairy', name: 'Good & Gather Greek Yogurt 4-pack', brand: 'Good & Gather', unit: 'each', size: '4 x 5.3 oz',
    history: [4.99, 5.29, 4.49, 5.29, 3.49], promos: ['plain','plain','sale','plain','sale'], regPrice: 5.29, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l' },
  { store: 'target', storeLabel: 'Target', category: 'frozen', name: 'Good & Gather Frozen Pizza', brand: 'Good & Gather', unit: 'each', size: 'each',
    history: [5.49, 5.99, 4.99, 5.99, 3.99], promos: ['plain','plain','sale','plain','multi'], multiBuyQty: 2, multiBuyPrice: 7.0, regPrice: 5.99, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l', notes: '2 for $7' },
  { store: 'target', storeLabel: 'Target', category: 'frozen', name: 'Favorite Day Ice Cream', brand: 'Favorite Day', unit: 'oz', size: '16 oz',
    history: [3.49, 3.99, 3.29, 3.99, 2.79], promos: ['plain','plain','sale','plain','sale'], regPrice: 3.99, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l' },
  { store: 'target', storeLabel: 'Target', category: 'alcohol', name: 'Barefoot Pinot Grigio', brand: 'Barefoot', unit: 'each', size: '750ml',
    history: [9.99, 10.99, 8.99, 10.99, 7.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 10.99, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l' },
  { store: 'target', storeLabel: 'Target', category: 'alcohol', name: 'Truly Variety Pack', brand: 'Truly', unit: 'each', size: '12 pk',
    history: [18.99, 19.99, 16.99, 19.99, 14.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 19.99, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l' },
  { store: 'target', storeLabel: 'Target', category: 'pantry', name: 'Good & Gather Pasta', brand: 'Good & Gather', unit: 'oz', size: '16 oz',
    history: [1.39, 1.49, 1.29, 1.49, 0.99], promos: ['plain','plain','sale','plain','multi'], multiBuyQty: 5, multiBuyPrice: 4.0, regPrice: 1.49, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l', notes: '5 for $4' },
  { store: 'target', storeLabel: 'Target', category: 'pantry', name: 'Good & Gather Olive Oil', brand: 'Good & Gather', unit: 'oz', size: '50.7 oz',
    history: [9.49, 9.99, 8.99, 9.99, 6.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 9.99, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l' },
  { store: 'target', storeLabel: 'Target', category: 'snacks', name: 'Good & Gather Tortilla Chips', brand: 'Good & Gather', unit: 'oz', size: '13 oz',
    history: [3.29, 3.49, 2.99, 3.49, 2.29], promos: ['plain','plain','sale','plain','sale'], regPrice: 3.49, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l' },
  { store: 'target', storeLabel: 'Target', category: 'snacks', name: 'Favorite Day Cookies', brand: 'Favorite Day', unit: 'oz', size: '12 oz',
    history: [3.69, 3.99, 3.29, 3.99, 2.5], promos: ['plain','plain','sale','plain','multi'], multiBuyQty: 2, multiBuyPrice: 4.0, regPrice: 3.99, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l' },
  { store: 'target', storeLabel: 'Target', category: 'bakery', name: 'Market Pantry Bread', brand: 'Market Pantry', unit: 'oz', size: '20 oz',
    history: [2.49, 2.69, 2.29, 2.69, 1.79], promos: ['plain','plain','sale','plain','sale'], regPrice: 2.69, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l' },
  { store: 'target', storeLabel: 'Target', category: 'bakery', name: 'Freshness Guaranteed Bagels', brand: 'Freshness Guaranteed', unit: 'each', size: '6 ct',
    history: [3.99, 4.29, 3.69, 4.29, 2.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 4.29, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l' },
  { store: 'target', storeLabel: 'Target', category: 'household', name: 'up & up Dish Soap', brand: 'up & up', unit: 'oz', size: '24 oz',
    history: [2.69, 2.99, 2.49, 2.99, 1.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 2.99, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l' },
  { store: 'target', storeLabel: 'Target', category: 'household', name: 'up & up Laundry Detergent', brand: 'up & up', unit: 'oz', size: '100 oz',
    history: [11.99, 12.99, 10.99, 12.99, 8.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 12.99, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l' },
  { store: 'target', storeLabel: 'Target', category: 'deli', name: 'Good & Gather Deli Turkey', brand: 'Good & Gather', unit: 'lb', size: 'per lb',
    history: [7.49, 7.99, 6.99, 7.99, 5.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 7.99, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l' },
  { store: 'target', storeLabel: 'Target', category: 'deli', name: 'Ready Meals Chicken Alfredo', brand: 'Good & Gather', unit: 'each', size: '14 oz',
    history: [6.49, 6.99, 5.99, 6.99, 4.99], promos: ['plain','plain','sale','plain','sale'], regPrice: 6.99, flyerUrl: 'https://www.target.com/c/weekly-ad/-/N-4sr7l' },
];

function promoType(p, item) {
  if (p === 'bogo' || item.bogo) return 'bogo';
  if (p === 'multi' || item.multiBuyQty) return 'multi';
  if (p === 'sale') return 'sale';
  return 'plain';
}

const deals = [];
const historyItems = [];

catalog.forEach((item, idx) => {
  const current = item.history[item.history.length - 1];
  const pType = promoType(item.promos[item.promos.length - 1], item);
  const nName = norm(item.name);
  const deal = {
    id: `${item.store}-${idx}`,
    store: item.store,
    storeLabel: item.storeLabel,
    category: item.category,
    name: item.name,
    normalizedName: nName,
    brand: item.brand,
    price: item.bogo ? current : current,
    regPrice: item.regPrice,
    unitPrice: item.unitPrice ?? (item.unit === 'lb' || item.unit === 'each' ? current : undefined),
    unit: item.unit,
    multiBuyQty: item.multiBuyQty,
    multiBuyPrice: item.multiBuyPrice,
    bogo: !!item.bogo,
    size: item.size,
    validFrom,
    validTo,
    flyerUrl: item.flyerUrl,
    notes: item.notes,
    promoType: pType,
  };
  // BOGO effective price is half
  if (item.bogo) {
    deal.price = current;
    deal.notes = (deal.notes ? deal.notes + ' · ' : '') + `BOGO → ~$${(current / 2).toFixed(2)} ea effective`;
  }
  deals.push(deal);

  const points = item.history.map((price, wi) => ({
    weekStart: weeks[wi],
    price,
    unitPrice: item.unit === 'lb' || item.unit === 'each' ? price : undefined,
    promoType: promoType(item.promos[wi], item),
    onAd: item.promos[wi] !== 'plain',
  }));
  // For current week BOGO, mark as bogo and keep shelf-ish price as listed
  if (item.bogo) {
    points[points.length - 1].promoType = 'bogo';
    points[points.length - 1].onAd = true;
  }

  historyItems.push({
    key: `${item.store}::${nName}`,
    store: item.store,
    normalizedName: nName,
    unit: item.unit,
    category: item.category,
    points,
  });
});

const weekPayload = {
  source: 'demo',
  zip: '60610',
  locationLabel: 'River North / Near North Side, Chicago',
  weekLabel: 'Week of Sep 3–9, 2026',
  validFrom,
  validTo,
  fetchedAt: '2026-09-05T19:00:00Z',
  deals,
  liveNote: 'Demo circular + seeded 5-week price history for River North (60610). Not live retailer data.',
};

const historyPayload = {
  locationLabel: 'River North / Near North Side, Chicago',
  zip: '60610',
  updatedAt: '2026-09-05T19:00:00Z',
  items: historyItems,
};

writeFileSync('public/demo-week.json', JSON.stringify(weekPayload, null, 2));
writeFileSync('public/price-history.json', JSON.stringify(historyPayload, null, 2));
console.log(`deals=${deals.length} historyItems=${historyItems.length}`);
