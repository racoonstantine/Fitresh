// ============================================================================
// Food icon auto-assignment (see food-icon-auto-assignment-spec.md).
// Pure classification logic, no UI/rendering here -- renderFoodIconSvg() at
// the bottom is the only piece that touches markup, and everything else
// (meal cards, etc.) should only ever ask getFoodIcon(food) for a key.
// ============================================================================

// One shared <path>/<circle> fragment per icon key, from icons/food/*.svg
// (viewBox 0 0 24 24, currentColor, stroke-width 1.8 -- see
// icons/full-circle-food-icons/README.md for the source pack). Keeping the
// path data inline avoids a per-icon fetch in a single-file app with no
// build step, while still rendering as real inline SVG so `currentColor`
// follows the surrounding theme (light/dark) instead of being baked in.
const FOOD_ICON_SVG_PATHS = {
  'apple': '<path d="M12 8c-2-2-6-1-6 4 0 4 3 7 6 7s6-3 6-7c0-5-4-6-6-4Z"/><path d="M12 8c0-2 1-4 3-5"/><path d="M13 5c2 0 3 0 4 1"/>',
  'banana': '<path d="M6 7c3 6 7 8 12 7-2 4-6 6-10 4-4-2-5-6-2-11Z"/><path d="m6 7-1-2M18 14l1-1"/>',
  'barbecue': '<path d="m6 18 12-12"/><circle cx="9" cy="15" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="15" cy="9" r="1.5"/><path d="m5 19-1 1"/>',
  'beans': '<path d="M8 7c3 0 4 2 3 4s-4 4-6 2 0-6 3-6Z"/><path d="M16 10c3 0 4 2 3 4s-4 4-6 2 0-6 3-6Z"/>',
  'beef': '<path d="M5 12c0-4 3-7 7-7 4.5 0 7 3.5 7 7 0 4-3 7-7 7s-7-3-7-7Z"/><path d="M9 9c1-1 3-1 4 0s1 3 0 4-3 1-4 0-1-3 0-4Z"/>',
  'bread': '<path d="M6 10c-1.5-1-1.5-3 0-4 1.2-.9 2.6-.5 3 .3C10 4.6 13 4.6 14 6.3c1-.8 2.8-.8 3.8.4 1.1 1.3.5 3-.8 3.5V19H7v-9Z"/><path d="M10 8v2M14 8v2"/>',
  'breakfast': '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>',
  'burger': '<path d="M5 10c.5-3 3-5 7-5s6.5 2 7 5H5Z"/><path d="M5 14h14"/><path d="M6 17h12"/><path d="M5 10h14l-1 3H6l-1-3Z"/>',
  'cake': '<path d="M6 10h12v9H6v-9Z"/><path d="M6 13c2-2 4 2 6 0s4 2 6 0"/><path d="M12 10V6"/><path d="M10 6h4"/>',
  'candy': '<path d="m7 9-3-2 1 4-1 4 3-2"/><path d="m17 9 3-2-1 4 1 4-3-2"/><rect x="7" y="8" width="10" height="8" rx="4"/>',
  'chicken': '<path d="M9 7c2-2 5-1 6 1s0 5-2 6-5 0-6-2 0-4 2-5Z"/><path d="m8 13-3 3"/><circle cx="4.5" cy="16.5" r="1.2"/><circle cx="6.5" cy="18.5" r="1.2"/>',
  'chips': '<path d="M7 4h10l2 16H5L7 4Z"/><path d="M8 8h8"/><path d="M9 12c2-2 4-2 6 0M10 15h4"/>',
  'chocolate': '<rect x="6" y="5" width="12" height="14" rx="1"/><path d="M10 5v14M14 5v14M6 10h12M6 15h12"/>',
  'citrus': '<circle cx="12" cy="12" r="7"/><path d="M12 12 7 8M12 12l5-4M12 12v7M12 12H5M12 12h7"/><path d="M12 5c0-1 1-2 2-2"/>',
  'coffee': '<path d="M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 5c0-1 1-1 1-2M12 5c0-1 1-1 1-2"/>',
  'cola': '<path d="M8 4h8l-1 16H9L8 4Z"/><path d="M8.5 7h7"/><path d="M10 11c1.5-1 2.5 1 4 0"/>',
  'cookies': '<circle cx="12" cy="12" r="7"/><circle cx="9" cy="9" r=".7"/><circle cx="14.5" cy="8.5" r=".7"/><circle cx="15" cy="14" r=".7"/><circle cx="9.5" cy="15" r=".7"/>',
  'corn': '<path d="M12 5c3 0 5 3 5 7s-2 7-5 7-5-3-5-7 2-7 5-7Z"/><path d="M9 8h6M8 11h8M8 14h8M9 17h6"/><path d="M12 5v14"/>',
  'dessert': '<path d="M6 14h12l-2 5H8l-2-5Z"/><path d="M8 14c0-3 2-5 4-5s4 2 4 5"/><circle cx="12" cy="7" r="1.5"/>',
  'dinner': '<path d="M5 15h14"/><path d="M7 15a5 5 0 0 1 10 0"/><path d="M12 7V5"/><path d="M4 19h16"/>',
  'drink': '<path d="M7 6h10l-1.5 14h-7L7 6Z"/><path d="m12 6 2-3"/><path d="M8 10h8"/>',
  'egg': '<path d="M12 4c3 0 6 5 6 9a6 6 0 0 1-12 0c0-4 3-9 6-9Z"/><circle cx="12" cy="13" r="2.2"/>',
  'fish': '<path d="M4 12c3-4 7-5 11-2l4-3v10l-4-3c-4 3-8 2-11-2Z"/><circle cx="13" cy="11" r=".6"/><path d="M8 10c1 1 1 3 0 4"/>',
  'fried-rice': '<path d="M4 12h16a8 8 0 0 1-16 0Z"/><path d="M6 12c1-3 3-5 6-5s5 2 6 5"/><circle cx="10" cy="10" r=".7"/><circle cx="14" cy="9.5" r=".7"/><path d="m11.5 11 1 1"/>',
  'fruit': '<circle cx="12" cy="13" r="6"/><path d="M12 7c0-2 1-3 3-4"/><path d="M13 6c2 0 3-1 4-2"/>',
  'generic-meal': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M3 5v6M5 5v6M4 11v8M19 5v14"/>',
  'grapes': '<circle cx="12" cy="9" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="12" cy="15" r="2"/><circle cx="9.5" cy="17.5" r="1.5"/><circle cx="14.5" cy="17.5" r="1.5"/><path d="M12 7c0-2 1-3 3-4"/>',
  'ice-cream': '<path d="M8 10h8l-4 10-4-10Z"/><path d="M8 10a4 4 0 1 1 8 0"/><path d="M10 15h4"/>',
  'juice': '<path d="M7 7h10l-1 13H8L7 7Z"/><path d="m12 7 2-4"/><path d="M9 11h6"/>',
  'leafy-vegetables': '<path d="M12 20V8"/><path d="M12 11C8 11 6 9 6 6c3 0 5 1 6 3"/><path d="M12 14c4 0 6-2 6-5-3 0-5 1-6 3"/><path d="M12 17c-3 0-5-1.5-5-4 2.5 0 4 1 5 2"/>',
  'lunch': '<circle cx="12" cy="12" r="7"/><path d="M12 5v7l4 2"/><path d="M5 18h14"/>',
  'milk': '<path d="M9 4h6l2 4v12H7V8l2-4Z"/><path d="M9 4l3 4 3-4"/><path d="M7 8h10"/>',
  'noodles': '<path d="M4 12h16a8 8 0 0 1-16 0Z"/><path d="M8 5v6M11 5v6M14 5v6M17 5v6"/><path d="M6 5h12"/>',
  'nuts': '<path d="M8 6c3 0 5 3 4 6s-3 6-6 5-3-4-2-7 1-4 4-4Z"/><path d="M16 8c3 0 4 3 3 6s-3 5-5 4-2-4-1-6 1-4 2-4Z"/>',
  'pandesal': '<path d="M5 13c0-3 2.5-6 7-6s7 3 7 6-3 5-7 5-7-2-7-5Z"/><path d="m9 9 1.5 2M13 8.5l1 2.5"/>',
  'pasta': '<circle cx="12" cy="12" r="8"/><path d="M8 9c2 1 2 5 4 6s3-2 4-1"/><path d="M8 14c1.5-2 3-2 4-1"/>',
  'pastry': '<path d="M5 14c0-4 3-7 7-7s7 3 7 7H5Z"/><path d="M7 14v3h10v-3"/><path d="M9 10h6"/>',
  'pizza': '<path d="m5 5 14 4-8 11L5 5Z"/><path d="M7 8c4 0 8 1 10 2"/><circle cx="11" cy="11" r="1"/><circle cx="13.5" cy="15" r="1"/>',
  'pork': '<path d="M5 13c0-4 3-7 7-7 3 0 5 1.5 6 4 1 2.5-.3 6-3 7.5-3.5 2-10 .5-10-4.5Z"/><circle cx="15.5" cy="11" r=".7"/><path d="M7 8 5 6M17 8l2-2"/>',
  'potato': '<path d="M7 7c2-2 6-2 9 0 3 2 3 7 0 10-3 3-8 3-11 0-2-2-1-7 2-10Z"/><circle cx="9" cy="10" r=".5"/><circle cx="14" cy="13" r=".5"/><circle cx="10" cy="16" r=".5"/>',
  'rice-dish': '<circle cx="12" cy="12" r="8"/><path d="M5.5 12h13"/><path d="M8 8.5c1.5-1 3-1 4.5 0"/><path d="M13.5 15.5c1-.8 2-.8 3 0"/>',
  'rice': '<path d="M4 12h16a8 8 0 0 1-16 0Z"/><path d="M6 12c1-3 3-5 6-5s5 2 6 5"/><path d="M9 9c.5-.8 1.2-1.2 2-1.5M13 8c.8.4 1.3.9 1.7 1.5"/>',
  'salad': '<path d="M5 11h14a7 7 0 0 1-14 0Z"/><path d="M8 10c0-2 2-4 4-2 1-2 4-1 4 2"/><path d="M11 9c-1-2 0-4 2-5"/>',
  'sandwich': '<path d="m5 9 7-4 7 4-7 4-7-4Z"/><path d="m5 13 7 4 7-4"/><path d="m5 9v4M19 9v4"/>',
  'seafood': '<path d="M7 15c-2-1-3-3-2-5 1-2 3-3 5-2 2 1 3 3 2 5-1 2-3 3-5 2Z"/><path d="M12 11c3-2 5-1 7 1"/><path d="m17 8 2-2M18 10h3"/>',
  'shrimp': '<path d="M6 15c-2-2-1-5 1-7 3-3 8-2 10 1 2 3 0 7-3 8-2 .8-4 .2-5-1"/><path d="M11 9c1 1 2 2 2 4"/><circle cx="16" cy="10" r=".6"/>',
  'smoothie': '<path d="M7 8h10l-1 11H8L7 8Z"/><path d="M9 5h6l1 3H8l1-3Z"/><path d="m12 5 2-2"/><circle cx="11" cy="12" r="1"/><circle cx="14" cy="14.5" r="1"/>',
  'snack': '<path d="M7 5h10l1 14H6L7 5Z"/><path d="M9 9h6"/><path d="M10 13h4"/>',
  'soup': '<path d="M4 11h16a8 8 0 0 1-16 0Z"/><path d="M7 8c0-1 1-1 1-2M11 8c0-1 1-1 1-2M15 8c0-1 1-1 1-2"/>',
  'stew': '<path d="M5 10h14v7H5v-7Z"/><path d="M7 8h10"/><path d="M9 5c0 1 1 1 1 2M13 5c0 1 1 1 1 2"/><path d="M3 12h2M19 12h2"/>',
  'tea': '<path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Z"/><path d="M16 10h2a2 2 0 1 1 0 4h-2"/><path d="M11 4v5"/><path d="M10 4h2"/>',
  'tofu': '<path d="m6 8 6-3 6 3-6 3-6-3Z"/><path d="M6 8v8l6 3 6-3V8"/><path d="M12 11v8"/>',
  'vegetables': '<path d="M12 19v-7"/><path d="M12 12c-4 0-6-2-6-5 3 0 5 1 6 3"/><path d="M12 12c4 0 6-2 6-5-3 0-5 1-6 3"/><path d="M9 19h6"/>',
  'water': '<path d="M12 3s5 6 5 10a5 5 0 0 1-10 0c0-4 5-10 5-10Z"/><path d="M9.5 14.5c.6 1.2 1.5 1.8 2.5 1.8"/>',
  'wrap': '<path d="M7 5h10l-2 15H9L7 5Z"/><path d="M8 9h8"/><path d="M10 5c0 2 4 2 4 0"/>'
};

// category (or category+subcategory) -> icon key. Subcategory checked first
// since it's the more specific classification when both are present.
const CATEGORY_ICON_MAP = {
  'meat:chicken': 'chicken', 'meat:beef': 'beef', 'meat:pork': 'pork',
  chicken: 'chicken', beef: 'beef', pork: 'pork',
  fish: 'fish', seafood: 'seafood', shrimp: 'shrimp',
  egg: 'egg', tofu: 'tofu', legumes: 'beans', beans: 'beans',
  soup: 'soup', stew: 'stew', barbecue: 'barbecue',
  rice: 'rice', 'rice-dish': 'rice-dish', 'fried-rice': 'fried-rice',
  noodles: 'noodles', pasta: 'pasta',
  bread: 'bread', pandesal: 'pandesal', sandwich: 'sandwich', burger: 'burger', pizza: 'pizza', wrap: 'wrap',
  vegetables: 'vegetables', 'leafy-vegetables': 'leafy-vegetables', salad: 'salad',
  potato: 'potato', corn: 'corn',
  fruit: 'fruit', apple: 'apple', banana: 'banana', citrus: 'citrus', grapes: 'grapes',
  dessert: 'dessert', cake: 'cake', pastry: 'pastry', 'ice-cream': 'ice-cream',
  chocolate: 'chocolate', candy: 'candy', cookies: 'cookies', chips: 'chips', nuts: 'nuts', snack: 'snack',
  beverage: 'drink', drink: 'drink', coffee: 'coffee', tea: 'tea', water: 'water', cola: 'cola',
  juice: 'juice', milk: 'milk', smoothie: 'smoothie', dairy: 'milk',
  breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner'
};

// High-priority exact/near-exact phrase matches, checked before the generic
// keyword rules below -- resolves ambiguous mixed dishes (e.g. "Chicken
// Sopas" reads as chicken by keyword-only matching, but it's really soup).
const FOOD_ICON_PHRASE_RULES = [
  {phrase: 'chicken sopas', icon: 'soup'}, {phrase: 'pork sinigang', icon: 'soup'},
  {phrase: 'chicken sinigang', icon: 'soup'}, {phrase: 'chicken tinola', icon: 'soup'},
  {phrase: 'beef nilaga', icon: 'soup'}, {phrase: 'pork nilaga', icon: 'soup'},
  {phrase: 'beef noodle soup', icon: 'soup'}, {phrase: 'chicken noodle soup', icon: 'soup'},
  {phrase: 'beef bulalo', icon: 'soup'}, {phrase: 'pork bulalo', icon: 'soup'},
  {phrase: 'chicken pancit canton', icon: 'noodles'}, {phrase: 'pork pancit canton', icon: 'noodles'},
  {phrase: 'beef pancit canton', icon: 'noodles'}, {phrase: 'chicken pancit', icon: 'noodles'},
  {phrase: 'chicken sopas noodles', icon: 'soup'},
  {phrase: 'filipino spaghetti', icon: 'pasta'}, {phrase: 'chicken alfredo', icon: 'pasta'},
  {phrase: 'chicken spaghetti', icon: 'pasta'}, {phrase: 'tuna pasta', icon: 'pasta'},
  {phrase: 'chicken carbonara', icon: 'pasta'}, {phrase: 'chicken pasta', icon: 'pasta'},
  {phrase: 'garlic rice', icon: 'rice'}, {phrase: 'steamed rice', icon: 'rice'}, {phrase: 'plain rice', icon: 'rice'},
  {phrase: 'egg fried rice', icon: 'fried-rice'}, {phrase: 'fried rice', icon: 'fried-rice'},
  {phrase: 'rice with', icon: 'rice-dish'}, {phrase: 'rice and', icon: 'rice-dish'}, {phrase: 'with rice', icon: 'rice-dish'},
  {phrase: 'burger steak', icon: 'rice-dish'}, {phrase: 'burger steak with rice', icon: 'rice-dish'},
  {phrase: 'pork barbecue', icon: 'barbecue'}, {phrase: 'chicken barbecue', icon: 'barbecue'}, {phrase: 'beef barbecue', icon: 'barbecue'},
  {phrase: 'fried bangus', icon: 'fish'}, {phrase: 'daing na bangus', icon: 'fish'},
  {phrase: 'fruit salad', icon: 'fruit'}, {phrase: 'chicken salad', icon: 'salad'}, {phrase: 'vegetable salad', icon: 'salad'},
  {phrase: 'halo halo', icon: 'dessert'}, {phrase: 'halo-halo', icon: 'dessert'},
  {phrase: 'chocolate cake', icon: 'dessert'}, {phrase: 'leche flan', icon: 'dessert'},
  {phrase: 'potato chips', icon: 'chips'}, {phrase: 'banana chips', icon: 'chips'},
  {phrase: 'coke zero', icon: 'cola'}, {phrase: 'mineral water', icon: 'water'}, {phrase: 'iced coffee', icon: 'coffee'}
];

// Fallback keyword rules, grouped by icon and checked in this order (per
// the spec's "mixed dish priority": beverages first, then soup/stew, then
// pasta/noodles/rice, then breads/mains, then desserts and produce last).
const FOOD_ICON_RULES = [
  {icon: 'coffee', keywords: ['coffee', 'kape', 'espresso', 'latte', 'cappuccino', 'americano', 'mocha', 'cold brew']},
  {icon: 'tea', keywords: ['tea', 'iced tea']},
  {icon: 'cola', keywords: ['cola', 'coke', 'coca cola', 'pepsi', 'soft drink', 'softdrink', 'soda', 'sprite', 'royal', 'mountain dew', '7up', '7 up']},
  {icon: 'water', keywords: ['water', 'tubig', 'sparkling water', 'distilled water']},
  {icon: 'milk', keywords: ['milk', 'gatas']},
  {icon: 'smoothie', keywords: ['smoothie', 'milkshake', 'shake']},
  {icon: 'juice', keywords: ['juice', 'juice drink']},
  {icon: 'soup', keywords: ['soup', 'sinigang', 'tinola', 'nilaga', 'bulalo', 'sopas', 'mami', 'lugaw', 'arroz caldo', 'batchoy', 'misua']},
  {icon: 'stew', keywords: ['stew', 'caldereta', 'kaldereta', 'mechado', 'menudo', 'afritada']},
  {icon: 'pasta', keywords: ['pasta', 'spaghetti', 'carbonara', 'alfredo', 'macaroni', 'lasagna', 'penne', 'fettuccine']},
  {icon: 'noodles', keywords: ['noodle', 'noodles', 'pancit', 'pansit', 'bihon', 'canton', 'sotanghon', 'miki', 'ramen', 'yakisoba', 'instant noodles']},
  {icon: 'fried-rice', keywords: ['fried rice', 'sinangag', 'java rice']},
  {icon: 'rice', keywords: ['rice', 'kanin', 'malagkit', 'brown rice', 'white rice']},
  {icon: 'burger', keywords: ['burger', 'cheeseburger', 'hamburger']},
  {icon: 'sandwich', keywords: ['sandwich', 'club sandwich']},
  {icon: 'pizza', keywords: ['pizza']},
  {icon: 'wrap', keywords: ['wrap', 'burrito', 'shawarma']},
  {icon: 'pandesal', keywords: ['pandesal', 'pan de sal', 'monay', 'ensaymada']},
  {icon: 'bread', keywords: ['bread', 'toast', 'bun', 'baguette', 'loaf']},
  {icon: 'dessert', keywords: ['dessert', 'halo halo', 'halo-halo', 'ube', 'brownie', 'cupcake']},
  {icon: 'cake', keywords: ['cake']},
  {icon: 'ice-cream', keywords: ['ice cream', 'sorbetes']},
  {icon: 'pastry', keywords: ['pastry', 'croissant', 'donut', 'doughnut']},
  {icon: 'chocolate', keywords: ['chocolate', 'chocolates']},
  {icon: 'candy', keywords: ['candy', 'sweet', 'sweets', 'gummy', 'lollipop']},
  {icon: 'cookies', keywords: ['cookie', 'cookies', 'biscuit']},
  {icon: 'chips', keywords: ['chips', 'crisps', 'chichirya', 'crackers', 'nachos', 'popcorn']},
  {icon: 'nuts', keywords: ['nuts', 'peanuts', 'almonds', 'cashew']},
  {icon: 'salad', keywords: ['salad', 'chopsuey', 'chop suey']},
  {icon: 'vegetables', keywords: ['vegetable', 'vegetables', 'gulay', 'pinakbet', 'pakbet', 'kangkong', 'pechay', 'malunggay', 'ampalaya', 'okra', 'sitaw', 'kalabasa', 'talong']},
  {icon: 'leafy-vegetables', keywords: ['leafy green', 'spinach', 'lettuce']},
  {icon: 'potato', keywords: ['potato', 'patatas']},
  {icon: 'corn', keywords: ['corn', 'mais']},
  {icon: 'beans', keywords: ['beans', 'monggo', 'mung bean', 'legume']},
  {icon: 'egg', keywords: ['egg', 'itlog', 'omelet', 'omelette']},
  {icon: 'tofu', keywords: ['tofu', 'tokwa']},
  {icon: 'barbecue', keywords: ['barbecue', 'bbq', 'inihaw', 'grilled']},
  {icon: 'chicken', keywords: ['chicken', 'manok', 'inasal', 'lechon manok']},
  {icon: 'beef', keywords: ['beef', 'baka', 'tapa', 'corned beef', 'steak', 'bistek']},
  {icon: 'pork', keywords: ['pork', 'baboy', 'liempo', 'kasim', 'lechon kawali', 'lechon', 'pork chop', 'tocino', 'longganisa', 'sisig', 'adobo']},
  {icon: 'fish', keywords: ['fish', 'isda', 'bangus', 'tilapia', 'galunggong', 'tuna', 'salmon', 'sardines', 'tamban', 'dilis', 'lapu lapu', 'maya maya']},
  {icon: 'shrimp', keywords: ['shrimp', 'hipon', 'prawn']},
  {icon: 'seafood', keywords: ['seafood', 'crab', 'alimango', 'alimasag', 'squid', 'pusit', 'mussels', 'tahong', 'shellfish']},
  {icon: 'fruit', keywords: ['fruit', 'apple', 'banana', 'saging', 'mango', 'mangga', 'orange', 'dalanghita', 'papaya', 'pineapple', 'pinya', 'grapes', 'ubas', 'watermelon', 'pakwan', 'melon', 'guava', 'bayabas']},
  {icon: 'breakfast', keywords: ['breakfast', 'silog']},
  {icon: 'lunch', keywords: ['lunch']},
  {icon: 'dinner', keywords: ['dinner', 'supper']}
];

function normalizeFoodName(value = ''){
  return value.toLowerCase().trim().replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ');
}
function getIconFromCategory(category, subcategory){
  if(subcategory && CATEGORY_ICON_MAP[String(subcategory).toLowerCase()]) return CATEGORY_ICON_MAP[String(subcategory).toLowerCase()];
  if(category && subcategory && CATEGORY_ICON_MAP[`${String(category).toLowerCase()}:${String(subcategory).toLowerCase()}`]) return CATEGORY_ICON_MAP[`${String(category).toLowerCase()}:${String(subcategory).toLowerCase()}`];
  if(category && CATEGORY_ICON_MAP[String(category).toLowerCase()]) return CATEGORY_ICON_MAP[String(category).toLowerCase()];
  return null;
}
function getIconFromKeywords(name = ''){
  const text = normalizeFoodName(name);
  for(const rule of FOOD_ICON_PHRASE_RULES){
    if(text.includes(rule.phrase)) return rule.icon;
  }
  for(const rule of FOOD_ICON_RULES){
    if(rule.keywords.some(keyword => text.includes(keyword))) return rule.icon;
  }
  return null;
}
// Priority: iconOverride > icon > phrase/keyword rules > category mapping >
// generic fallback. Phrase/keyword rules sit above category on purpose --
// a food's own stored category is often coarser ("meat") than what its
// actual name tells us ("Chicken Sopas" should read as soup, not chicken),
// and name-based inference is what actually distinguishes mixed dishes.
function getFoodIcon(food){
  if(!food) return 'generic-meal';
  if(food.iconOverride && FOOD_ICON_SVG_PATHS[food.iconOverride]) return food.iconOverride;
  if(food.icon && FOOD_ICON_SVG_PATHS[food.icon]) return food.icon;
  const keywordIcon = getIconFromKeywords(food.name);
  if(keywordIcon) return keywordIcon;
  const categoryIcon = getIconFromCategory(food.category, food.subcategory);
  if(categoryIcon) return categoryIcon;
  return 'generic-meal';
}
function renderFoodIconSvg(iconKey, size){
  const inner = FOOD_ICON_SVG_PATHS[iconKey] || FOOD_ICON_SVG_PATHS['generic-meal'];
  const s = size || 20;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:${s}px;height:${s}px;flex-shrink:0;" aria-hidden="true">${inner}</svg>`;
}

// Excludes results with no usable calorie data (missing or 0 kcal) so users
// don't pick something that logs as "0 kcal" -- e.g. an OFF/library entry
// that was never given full nutrition info.
function hasUsableNutrients(r){
  const kcal = r.nutrients && r.nutrients.ENERC_KCAL;
  return kcal !== undefined && kcal !== null && kcal > 0;
}

