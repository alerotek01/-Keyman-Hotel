// Cafeteria menu seed data — images served from Supabase storage
const BASE = 'https://uuojiyehhnhjcakgpsjd.supabase.co/storage/v1/object/public/rooms';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number; // KES
  image?: string;
  category: 'breakfast' | 'lunch' | 'dinner';
  available: boolean;
}

export interface MealSlot {
  id: string;
  name: string;
  time: string;
  description: string;
  price: string;
  icon: string;
  items: MenuItem[];
}

export const menuItems: MenuItem[] = [
  // Breakfast
  { id: 'b1', name: 'Ugali & Sukuma Wiki', description: 'Fresh ugali with sautéed sukuma wiki and a side of kachumbari', price: 250, image: `${BASE}/single-1.jpg`, category: 'breakfast', available: true },
  { id: 'b2', name: 'Mandazi & Chai', description: 'Freshly fried mandazi with spiced Kenyan chai', price: 150, image: `${BASE}/single-2.jpg`, category: 'breakfast', available: true },
  { id: 'b3', name: 'Full English Breakfast', description: 'Eggs, sausages, baked beans, toast, grilled tomato, and bacon', price: 500, image: `${BASE}/single-3.jpg`, category: 'breakfast', available: true },
  { id: 'b4', name: 'Pancakes & Fruit', description: 'Fluffy pancakes with fresh tropical fruit and honey', price: 350, image: `${BASE}/room-single.jpg`, category: 'breakfast', available: true },
  { id: 'b5', name: 'Porridge & Toast', description: 'Warm uji porridge with buttered toast and jam', price: 200, image: `${BASE}/single-1.jpg`, category: 'breakfast', available: true },
  { id: 'b6', name: 'Fruit Platter', description: 'Seasonal fresh fruit — mango, pineapple, watermelon, passion fruit', price: 300, image: `${BASE}/single-2.jpg`, category: 'breakfast', available: true },

  // Lunch
  { id: 'l1', name: 'Nyama Choma Plate', description: 'Grilled beef with ugali, kachumbari, and greens', price: 650, image: `${BASE}/twin-1.jpg`, category: 'lunch', available: true },
  { id: 'l2', name: 'Pilau & Chicken', description: 'Spiced pilau rice with tender grilled chicken', price: 550, image: `${BASE}/twin-2.jpg`, category: 'lunch', available: true },
  { id: 'l3', name: 'Fish & Chips', description: 'Fresh tilapia fillet with crispy chips and tartar sauce', price: 600, image: `${BASE}/room-twin.jpg`, category: 'lunch', available: true },
  { id: 'l4', name: 'Vegetable Curry & Rice', description: 'Mixed vegetable curry with basmati rice and chapati', price: 400, image: `${BASE}/single-1.jpg`, category: 'lunch', available: true },
  { id: 'l5', name: 'Chicken Burger', description: 'Grilled chicken breast, lettuce, tomato, and special sauce', price: 450, image: `${BASE}/single-2.jpg`, category: 'lunch', available: true },
  { id: 'l6', name: 'Githeri Bowl', description: 'Traditional maize and bean stew with avocado', price: 350, image: `${BASE}/single-3.jpg`, category: 'lunch', available: true },

  // Dinner
  { id: 'd1', name: 'Grilled Steak', description: '250g sirloin steak with mashed potato, vegetables, and pepper sauce', price: 1200, image: `${BASE}/lounge.jpg`, category: 'dinner', available: true },
  { id: 'd2', name: 'Tilapia Fillet', description: 'Pan-seared tilapia with lemon butter, rice, and steamed vegetables', price: 900, image: `${BASE}/hotel-night.jpg`, category: 'dinner', available: true },
  { id: 'd3', name: 'Pasta Bolognese', description: 'Spaghetti with rich beef bolognese and parmesan', price: 650, image: `${BASE}/single-1.jpg`, category: 'dinner', available: true },
  { id: 'd4', name: 'Chicken Tikka', description: 'Marinated chicken tikka with naan, rice, and raita', price: 750, image: `${BASE}/single-2.jpg`, category: 'dinner', available: true },
  { id: 'd5', name: 'Vegetable Stir Fry', description: 'Mixed vegetables in sesame sauce with noodles', price: 500, image: `${BASE}/single-3.jpg`, category: 'dinner', available: true },
  { id: 'd6', name: 'Chef\'s Special', description: 'Ask your server for today\'s chef special', price: 800, image: `${BASE}/lounge.jpg`, category: 'dinner', available: true },
];

export const meals: MealSlot[] = [
  {
    id: 'breakfast',
    name: 'Breakfast',
    time: '6:30 AM — 10:00 AM',
    description: 'Fresh start to the day. Local favourites and continental options.',
    price: 'From KES 150',
    icon: '🌅',
    items: menuItems.filter(i => i.category === 'breakfast'),
  },
  {
    id: 'lunch',
    name: 'Lunch',
    time: '12:00 PM — 2:30 PM',
    description: 'Kenyan classics and international dishes. Quick, filling, honest.',
    price: 'From KES 350',
    icon: '☀️',
    items: menuItems.filter(i => i.category === 'lunch'),
  },
  {
    id: 'dinner',
    name: 'Dinner',
    time: '6:30 PM — 9:30 PM',
    description: 'Three-course dinner with daily specials. Sit down, slow down.',
    price: 'From KES 500',
    icon: '🌙',
    items: menuItems.filter(i => i.category === 'dinner'),
  },
];
