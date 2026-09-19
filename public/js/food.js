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

// ---------- Recent & favorite foods (quick re-log without a fresh search) ----------
// Snapshots use the same shape as a search result (with _origin fixed to
// 'library', since by the time something is recent/favorited it's already
// a real row in the `foods` table) so they can be dropped straight into
// foodSearchResultsCache/lmSearchResultsCache and reuse all the existing
// measure-picker/confirm/save logic instead of a separate code path.
let recentFoods = [];
let favoriteFoods = [];
async function loadRecentFoods(){
  try{
    const res = await window.storage.get(STORAGE_PREFIX + 'recentFoods', false);
    recentFoods = res && res.value ? JSON.parse(res.value) : [];
  }catch(e){ recentFoods = []; }
}
async function saveRecentFoods(){
  try{ await window.storage.set(STORAGE_PREFIX + 'recentFoods', JSON.stringify(recentFoods), false); }catch(e){}
}
async function loadFavoriteFoods(){
  try{
    const res = await window.storage.get(STORAGE_PREFIX + 'favoriteFoods', false);
    favoriteFoods = res && res.value ? JSON.parse(res.value) : [];
  }catch(e){ favoriteFoods = []; }
}
async function saveFavoriteFoods(){
  try{ await window.storage.set(STORAGE_PREFIX + 'favoriteFoods', JSON.stringify(favoriteFoods), false); }catch(e){}
}
function foodSnapshot(row, foodId){
  return {
    id: foodId, name: row.name, local_name: row.local_name || null, brand: row.brand || null,
    canonical_unit: row.canonical_unit || 'g', canonical_amount: row.canonical_amount || 100,
    personal_food: row.personal_food || null, label: row.label || null,
    confidence: row.confidence || null, estimate: row.estimate || null,
    nutrients: row.nutrients || {}, portions: row.portions || [], _origin: 'library'
  };
}
function recordRecentFood(row, foodId){
  const snap = foodSnapshot(row, foodId);
  recentFoods = recentFoods.filter(f => f.id !== snap.id);
  recentFoods.unshift(snap);
  recentFoods = recentFoods.slice(0, 12);
  saveRecentFoods();
  renderRecentFavorites('food');
  renderRecentFavorites('lm');
}
function isFavoriteFood(id){ return favoriteFoods.some(f => f.id === id); }
function toggleFavoriteFood(snap){
  const idx = favoriteFoods.findIndex(f => f.id === snap.id);
  if(idx >= 0) favoriteFoods.splice(idx, 1);
  else { favoriteFoods.unshift(snap); favoriteFoods = favoriteFoods.slice(0, 20); }
  saveFavoriteFoods();
  renderRecentFavorites('food');
  renderRecentFavorites('lm');
}
// kind is 'food' (Food tab inline search) or 'lm' (dedicated Log Meal page) --
// same list, different container id / results cache / render function.
function renderRecentFavorites(kind){
  const containerId = kind === 'lm' ? 'lmRecentFavorites' : 'foodRecentFavorites';
  const el = document.getElementById(containerId);
  if(!el) return;
  const items = [...favoriteFoods, ...recentFoods.filter(r => !isFavoriteFood(r.id))].slice(0, 10);
  if(!items.length){ el.innerHTML = ''; return; }
  el.innerHTML = `
    <div style="font-size:10.5px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Recent &amp; Favorites</div>
    <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;">
      ${items.map((f, i) => `
        <div class="recent-food-chip" data-idx="${i}" style="flex:0 0 auto;display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--line);border-radius:20px;background:var(--paper-raised);font-size:12px;white-space:nowrap;cursor:pointer;">
          <span style="color:var(--ink-soft);">${renderFoodIconSvg(getFoodIcon(f), 16)}</span>
          <span class="recent-food-star" data-idx="${i}" style="cursor:pointer;color:${isFavoriteFood(f.id) ? 'var(--ochre)' : 'var(--ink-soft)'};">${isFavoriteFood(f.id) ? '★' : '☆'}</span>
          <span class="recent-food-name" data-idx="${i}">${foodSearchEscape(foodDisplayName(f))}</span>
        </div>
      `).join('')}
    </div>
  `;
  el.querySelectorAll('.recent-food-star').forEach(star => {
    star.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavoriteFood(items[parseInt(star.dataset.idx, 10)]);
    });
  });
  el.querySelectorAll('.recent-food-name').forEach(nameEl => {
    nameEl.addEventListener('click', () => {
      const snap = items[parseInt(nameEl.dataset.idx, 10)];
      if(kind === 'lm'){
        lmSearchResultsCache = [snap, ...lmSearchResultsCache.filter(r => r.id !== snap.id)];
        renderLmSearchResults();
      } else {
        foodSearchResultsCache = [snap, ...foodSearchResultsCache.filter(r => r.id !== snap.id)];
        renderFoodSearchResults();
      }
      const panel = document.querySelector(`#${kind === 'lm' ? 'lmSearchResults' : 'foodSearchResults'} .food-result-amount[data-idx="0"]`);
      if(panel){ panel.style.display = 'block'; panel.scrollIntoView({behavior:'smooth', block:'center'}); }
    });
  });
}

async function searchFoodsCombined(query){
  const generation = ++foodSearchGeneration;
  const statusEl = document.getElementById('foodSearchStatus');
  const resultsEl = document.getElementById('foodSearchResults');
  if(query.trim().length < 2){ foodSearchResultsCache = []; resultsEl.innerHTML = ''; statusEl.style.display = 'none'; return; }
  foodSearchResultsCache = [];
  resultsEl.innerHTML = '';
  statusEl.textContent = 'Searching…';
  statusEl.style.display = 'block';
  try{
    const remoteSearch = Promise.all([
      fetch(`api/foods.php?action=search_library&q=${encodeURIComponent(query)}`, {credentials:'same-origin'}).then(r=>r.json()).catch(()=>({results:[]})),
      fetch(`api/food_search.php?q=${encodeURIComponent(query)}`, {credentials:'same-origin'}).then(r=>r.json()).catch(()=>({results:[]}))
    ]);
    const localRes = await fetch(`api/food_catalog.php?q=${encodeURIComponent(query)}&include_estimates=${document.getElementById('foodIncludeEstimates')?.checked ? '1' : '0'}`, {credentials:'same-origin'}).then(r=>r.json()).catch(()=>({results:[], error:'Local food search is temporarily unavailable.'}));
    if(generation !== foodSearchGeneration) return;
    const local = (localRes.results || []).map(r => ({...r, _origin:'catalog'})).filter(hasUsableNutrients);
    foodSearchResultsCache = local;
    renderFoodSearchResults();
    const suggestions = (localRes.suggestions || []).map(word => `<button type="button" class="timer-btn" data-food-suggestion="${foodSearchEscape(word)}">${foodSearchEscape(word)}</button>`).join(' ');
    statusEl.innerHTML = localRes.error ? foodSearchEscape(localRes.error) : (suggestions ? `Did you mean ${suggestions}?` : (local.length ? 'Choose the preparation and edible part that match your food.' : 'Checking other sources…'));
    statusEl.style.display = 'block';
    const [libRes, offRes] = await remoteSearch;
    if(generation !== foodSearchGeneration) return;
    // Do not reset a selected portion while slower external searches finish.
    if([...resultsEl.querySelectorAll('.food-result-amount')].some(el => el.style.display === 'block')) return;
    const library = (libRes.results || []).map(r => ({...r, _origin: 'library'})).filter(hasUsableNutrients).filter(r => r.label !== 'Estimated' || document.getElementById('foodIncludeEstimates')?.checked);
    const external = (offRes.results || []).map(r => ({...r, _origin: 'off'})).filter(hasUsableNutrients);
    const localIds = new Set(local.map(r => r.external_id));
    foodSearchResultsCache = [...local, ...library.filter(r => !(r.source === 'catalog' && localIds.has(r.external_id))), ...external];
    renderFoodSearchResults();
    if(localRes.error){
      statusEl.textContent = localRes.error;
      statusEl.style.display = 'block';
    } else if(local.length || suggestions){
      statusEl.style.display = 'block';
    } else if(offRes.error && !external.length){
      statusEl.textContent = offRes.error;
      statusEl.style.display = 'block';
    } else {
      statusEl.style.display = 'none';
    }
  }catch(e){
    if(generation !== foodSearchGeneration) return;
    statusEl.textContent = 'Search failed — try again.';
  }
}

// Scales a result's per-canonical-amount nutrients to a given amount, e.g.
// 165 kcal/100g at amount=150 -> ~248 kcal.
function foodMeasureOptions(r){
  const base = r.canonical_unit || 'g';
  const options = [{value:base, label:base, factor:1}];
  if(r.personal_food?.definition && base !== 'serving') options.push({value:'serving',label:'Serving: '+r.personal_food.definition.serving_label+' (user entered)',factor:Number(r.personal_food.definition.serving_size)});
  if(base === 'g'){
    options.push({value:'oz', label:'oz (weight)', factor:28.349523125});
    (r.portions || []).forEach(p => options.push({value:'portion:' + p.portion_id, label:'Serving: ' + p.description, factor:Number(p.edible_weight_g), portion:p}));
    options.push({value:'personal_piece',label:'Pieces — my measured weight',factor:null}, {value:'personal_ml',label:'ml — my measured weight',factor:null});
  } else if(base === 'oz') options.push({value:'g',label:'g',factor:1/28.349523125});
  return options;
}
function foodMeasureControls(r, i){
  return `<div style="margin-top:6px;min-width:0;flex:1;">
    <label>Measure <select class="food-unit-input" data-idx="${i}" aria-label="Food measure" style="max-width:100%;">${foodMeasureOptions(r).map(o=>`<option value="${foodSearchEscape(o.value)}">${foodSearchEscape(o.label)}</option>`).join('')}</select></label>
    <label class="food-personal-weight" style="display:none;margin-top:6px;">My measured edible grams per piece / ml <input type="number" class="food-weight-input" min="0.000001" step="any" aria-label="Measured grams per piece or ml" style="width:90px;"></label>
    <div class="food-measure-note" style="font-size:11.5px;color:var(--ink-soft);margin-top:5px;">Saved in ${foodSearchEscape(r.canonical_unit || 'g')}. Use edible weight.</div>
  </div>`;
}
function foodMeasurement(r, panel){
  const amount = Number(panel.querySelector('.food-amount-input').value);
  const option = foodMeasureOptions(r).find(o=>o.value === panel.querySelector('.food-unit-input').value);
  if(!option || !Number.isFinite(amount) || amount <= 0) throw new Error('Enter a positive amount.');
  const factor = option.factor === null ? Number(panel.querySelector('.food-weight-input').value) : option.factor;
  const converted = amount * factor;
  if(!Number.isFinite(factor) || factor <= 0) throw new Error('Enter your measured edible grams per piece or ml.');
  if(!Number.isFinite(converted) || converted < 0.01 || converted > 99999999.99) throw new Error('Converted amount is outside the supported range.');
  const request = {amount, unit:option.portion ? 'portion' : option.value};
  if(option.portion) request.portion_id = option.portion.portion_id;
  if(option.factor === null) request.grams_per_unit = factor;
  return {amount: Math.round((converted + Number.EPSILON)*100)/100, request};
}
function updateFoodMeasurement(r, panel){
  const option = foodMeasureOptions(r).find(o=>o.value === panel.querySelector('.food-unit-input').value);
  panel.querySelector('.food-personal-weight').style.display = option?.factor === null ? 'block' : 'none';
  const note = panel.querySelector('.food-measure-note');
  note.textContent = option?.portion ? `${option.portion.description} = ${option.portion.edible_weight_g} g edible · ${option.portion.data_status}. Saved in grams.` : option?.factor === null ? 'Personal measurement, not a verified database portion. Saved in grams.' : `Saved in ${r.canonical_unit || 'g'}. Use edible weight.`;
  if(option?.portion){
    const link = document.createElement('a'); link.textContent = ' Source'; link.href = option.portion.source_url; link.target = '_blank'; link.rel = 'noopener noreferrer'; note.appendChild(link);
  }
  try{
    const measurement = foodMeasurement(r, panel);
    panel.querySelector('.food-macro-preview').textContent = `${measurement.amount} ${r.canonical_unit || 'g'} · ${macroPreviewText(r, measurement.amount)}`;
  }catch(err){ panel.querySelector('.food-macro-preview').textContent = err.message; }
}
function scaledFoodMacros(r, amount){
  const canonical = r.canonical_amount || 100;
  const factor = canonical > 0 ? amount / canonical : 0;
  const n = r.nutrients || {};
  return {
    kcal: Math.round((n.ENERC_KCAL || 0) * factor),
    protein: +(((n.PROCNT || 0) * factor).toFixed(1)),
    fat: +(((n.FAT || 0) * factor).toFixed(1)),
    carbs: +(((n.CHOCDF || 0) * factor).toFixed(1))
  };
}
function macroPreviewText(r, amount){
  const m = scaledFoodMacros(r, amount);
  return `${m.kcal} kcal · ${m.protein}g protein · ${m.fat}g fat · ${m.carbs}g carbs`;
}

function renderFoodSearchResults(){
  const resultsEl = document.getElementById('foodSearchResults');
  if(!resultsEl) return;
  if(!foodSearchResultsCache.length){ resultsEl.innerHTML = ''; return; }
  resultsEl.innerHTML = foodSearchResultsCache.map((r, i) => {
    const canonicalAmount = r.canonical_amount || 100;
    const canonicalUnit = r.canonical_unit || 'g';
    const hasNutrients = r.nutrients && r.nutrients.ENERC_KCAL !== undefined && r.nutrients.ENERC_KCAL !== null;
    const sub = hasNutrients
      ? `${r.brand ? r.brand + ' · ' : ''}${Math.round(r.nutrients.ENERC_KCAL)} kcal / ${canonicalAmount}${canonicalUnit}`
      : (r.brand || (r._origin === 'library' ? 'Your library' : 'No calorie data'));
    return `
      <div class="food-result-row" data-idx="${i}" style="padding:9px 4px;border-bottom:1px solid var(--line);cursor:pointer;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;">
            <span style="color:var(--ink-soft);flex-shrink:0;">${renderFoodIconSvg(getFoodIcon(r), 20)}</span>
            <div style="min-width:0;">
              <div style="font-weight:600;font-size:13.5px;">${foodSearchEscape(foodDisplayName(r))}</div>
              <div style="font-size:11.5px;color:var(--ink-soft);">${foodSearchEscape(sub)}</div>
              ${r.label ? `<div style="font-size:11.5px;color:var(--ink-soft);">${foodSearchEscape(r.label)}${r.complete === false ? ' · Some nutrients unavailable' : ''}</div>` : ''}
              ${r.confidence ? `<div style="font-size:11.5px;color:var(--ink-soft);" title="${foodSearchEscape(r.confidence.reason)}">${foodSearchEscape(r.confidence.level)} confidence</div>` : ''}
              ${r.estimate ? `<details onclick="event.stopPropagation()"><summary>Estimate assumptions and limitations</summary><p style="font-size:12px;">${foodSearchEscape(r.estimate.assumptions)}</p><p style="font-size:12px;">${foodSearchEscape(r.estimate.limitations)}</p></details>` : ''}
              <button type="button" class="timer-btn" data-personal-copy="${i}" data-personal-surface="food">Save a personal copy</button>
            </div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" style="width:16px;height:16px;stroke:var(--ink-soft);flex-shrink:0;"><path d="M9 18l6-6-6-6"/></svg>
        </div>
        <div class="food-result-amount" data-idx="${i}" style="display:none;margin-top:8px;">
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="number" min="0.000001" step="any" aria-label="Food amount" class="food-amount-input" data-idx="${i}" value="${canonicalAmount}" style="width:80px;padding:6px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:13px;">
            ${foodMeasureControls(r, i)}
          </div>
          <div class="food-macro-preview" data-idx="${i}" style="font-size:11.5px;color:var(--ink-soft);margin-top:8px;">${macroPreviewText(r, canonicalAmount)}</div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="timer-btn start food-log-confirm" data-idx="${i}" type="button" style="flex:1;padding:7px 0;">Save</button>
            <button class="timer-btn reset food-log-cancel" data-idx="${i}" type="button" style="flex:1;padding:7px 0;">Cancel</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

let todayMealsGeneration = 0;
async function renderTodayMeals(){
  const card = document.getElementById('todayMealsCard');
  if(!card) return;
  const generation = ++todayMealsGeneration;
  const date = nutriSelectedDate || dateStrForOffset(0);
  // Guards against rapid day-nav clicks: bail if a newer renderTodayMeals()
  // call has started, or if the day changed again while we were awaiting.
  const stillCurrent = () => generation === todayMealsGeneration && date === (nutriSelectedDate || dateStrForOffset(0));
  const diaryEntry = nutritionLog.find(e => e.date === date);
  const diaryHtml = (diaryEntry && (diaryEntry.meal || diaryEntry.notes)) ? `
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line);">
      <div style="font-size:10.5px;font-weight:600;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;">Notes for ${formatDateLabel(date)}</div>
      ${diaryEntry.meal ? `<div style="font-size:12.5px;color:var(--ink);line-height:1.5;">${foodSearchEscape(diaryEntry.meal)}</div>` : ''}
      ${diaryEntry.notes ? `<div style="font-size:12px;color:var(--ink-soft);font-style:italic;margin-top:4px;">${foodSearchEscape(diaryEntry.notes)}</div>` : ''}
    </div>
  ` : '';
  try{
    const res = await fetch(`api/meals.php?action=day&date=${date}`, {credentials: 'same-origin'});
    const data = await res.json();
    if(!stillCurrent()) return;
    const nonEmptyEntries = (data.entries || []).filter(entry => entry.components.length);
    if(!nonEmptyEntries.length){
      card.innerHTML = `<div class="block-title" style="margin:0 0 8px;">Logged via search</div><div class="dash-empty">Nothing logged this way yet for ${formatDateLabel(date)}.</div>${diaryHtml}`;
      return;
    }
    const typeLabels = {breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack', custom: 'Misc'};
    const MEAL_TYPE_ORDER = ['breakfast', 'lunch', 'dinner', 'snack', 'custom'];
    const sortedEntries = [...nonEmptyEntries].sort((a, b) => MEAL_TYPE_ORDER.indexOf(a.meal_type) - MEAL_TYPE_ORDER.indexOf(b.meal_type));
    const rows = sortedEntries.map(entry => `
      <div style="margin-bottom:10px;">
        <div style="font-size:11px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:4px;">${typeLabels[entry.meal_type] || entry.meal_type}</div>
        ${entry.components.map(c => `
          <div class="meal-component-row" data-id="${c.id}" style="padding:6px 0;border-bottom:1px dashed var(--line);cursor:pointer;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                <span style="color:var(--ink-soft);">${renderFoodIconSvg(getFoodIcon({name: c.name}), 18)}</span>
                <div style="font-size:13px;min-width:0;">${foodSearchEscape(c.name)} <span style="color:var(--ink-soft);font-size:11.5px;">(${foodSearchEscape(c.amount)}${foodSearchEscape(c.unit)})</span></div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                <span style="font-size:12.5px;color:var(--ink-soft);">${Math.round(c.nutrients.ENERC_KCAL || 0)} kcal</span>
                <button class="wi-del meal-delete" data-id="${c.id}" type="button" title="Remove">✕</button>
              </div>
            </div>
            <div style="font-size:10.5px;color:var(--ink-soft);margin-top:2px;">${Math.round((c.nutrients.PROCNT || 0) * 10) / 10}g protein · ${Math.round((c.nutrients.FAT || 0) * 10) / 10}g fat · ${Math.round((c.nutrients.CHOCDF || 0) * 10) / 10}g carbs</div>
            <div class="meal-component-edit" data-edit-id="${c.id}" style="display:none;margin-top:6px;gap:8px;align-items:center;flex-wrap:wrap;">
              <input type="number" class="meal-edit-amount" data-edit-id="${c.id}" value="${c.amount}" style="width:80px;padding:6px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:12.5px;">
              <span style="font-size:11.5px;color:var(--ink-soft);">${c.unit}</span>
              <select class="meal-edit-type" data-edit-id="${c.id}" style="padding:6px 8px;border:1px solid var(--line);border-radius:5px;background:var(--paper);font-size:12.5px;">
                ${MEAL_TYPE_ORDER.map(mt => `<option value="${mt}" ${mt === entry.meal_type ? 'selected' : ''}>${typeLabels[mt] || mt}</option>`).join('')}
              </select>
              <button class="timer-btn start meal-save-amount" data-id="${c.id}" data-unit="${c.unit}" type="button" style="flex:1;padding:6px 0;font-size:12px;">Save</button>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');
    const t = data.totals || {};
    card.innerHTML = `
      <div class="block-title" style="margin:0 0 10px;">Logged via search</div>
      ${rows}
      <div style="display:flex;justify-content:space-between;font-weight:700;padding-top:8px;font-size:13.5px;">
        <span>Total</span>
        <span>${Math.round(t.ENERC_KCAL || 0)} kcal · ${Math.round(t.PROCNT || 0)}g protein</span>
      </div>
      ${diaryHtml}
    `;
    card.querySelectorAll('.meal-delete').forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        e.stopPropagation();
        await fetch('api/meals.php?action=delete_component', {
          method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({id: parseInt(btn.dataset.id, 10)})
        });
        renderTodayMeals();
        renderNutrition();
      });
    });
    card.querySelectorAll('.meal-component-row').forEach(row=>{
      row.addEventListener('click', (e)=>{
        if(e.target.closest('.meal-delete') || e.target.closest('.meal-component-edit')) return;
        const id = row.dataset.id;
        card.querySelectorAll('.meal-component-edit').forEach(el=>{
          el.style.display = (el.dataset.editId === id && el.style.display !== 'flex') ? 'flex' : 'none';
        });
      });
    });
    card.querySelectorAll('.meal-save-amount').forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        e.stopPropagation();
        const id = btn.dataset.id;
        const input = card.querySelector(`.meal-edit-amount[data-edit-id="${id}"]`);
        const typeSelect = card.querySelector(`.meal-edit-type[data-edit-id="${id}"]`);
        const amount = parseFloat(input.value);
        if(!amount || amount <= 0) return;
        btn.disabled = true;
        btn.textContent = 'Saving…';
        await fetch('api/meals.php?action=update_component', {
          method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({id: parseInt(id, 10), amount, unit: btn.dataset.unit || 'g', meal_type: typeSelect ? typeSelect.value : undefined})
        });
        renderTodayMeals();
        renderNutrition();
      });
    });
  }catch(e){
    if(!stillCurrent()) return;
    card.innerHTML = `<div class="dash-empty">Could not load today's search-logged foods.</div>`;
  }
}

let nutritionRenderGeneration = 0;
async function renderNutrition(){
  if(nutriSelectedDate === null) nutriSelectedDate = dateStrForOffset(0);
  renderTodayMeals();
  renderRecentFavorites('food');
  // Capture the selected date now, before the await below -- rapid day-nav
  // clicks fire overlapping calls, and reading the live nutriSelectedDate
  // again AFTER the await (like the rest of this function used to) could
  // show a different day than the one whose totals were actually fetched.
  const selectedDate = nutriSelectedDate;
  const generation = ++nutritionRenderGeneration;
  const rangeSel = document.getElementById('nutriRange');
  const range = rangeSel ? rangeSel.value : 'day';
  const sorted = [...nutritionLog].sort((a,b)=> a.date < b.date ? -1 : 1);
  const windowDays = range === 'month' ? 30 : 7;
  const dateList = range === 'day' ? [selectedDate] : (()=>{ const arr=[]; for(let i=0;i<windowDays;i++) arr.push(dateStrForOffset(-i)); return arr; })();
  await fetchMealTotals(dateList);
  if(generation !== nutritionRenderGeneration) return;
  // Per-date totals from nutritionLog (quick-log) merged with search-logged meals,
  // for whichever dates are in view -- this feeds the cards/banner/macro bar below.
  const combinedList = dateList
    .map(d => ({date: d, ...combinedDayTotals(d, sorted.find(e => e.date === d))}))
    .filter(e => e.hasAny);
  const recent = sorted.filter(e => dateList.includes(e.date));

  const navEl = document.getElementById('nutriDayNav');
  const bannerEl = document.getElementById('nutriTodayBanner');
  navEl.classList.remove('day-nav-loading');

  if(range === 'day'){
    const todayStr = dateStrForOffset(0);
    const isToday = selectedDate === todayStr;
    navEl.innerHTML = `
      <button class="day-nav-btn" id="nutriPrevDay"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div class="day-nav-label">
        <div class="day-nav-date">${isToday ? 'Today' : formatDateLabel(selectedDate)}</div>
        ${!isToday ? `<div class="day-nav-today-link" id="nutriJumpToday">Jump to today</div>` : `<div style="font-size:11px;color:var(--ink-soft);">${formatDateLabel(selectedDate)}</div>`}
      </div>
      <button class="day-nav-btn" id="nutriNextDay" ${isToday ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
    `;
    document.getElementById('nutriPrevDay').addEventListener('click', async ()=>{
      nutriSelectedDate = addDaysToDate(nutriSelectedDate, -1);
      navEl.classList.add('day-nav-loading');
      await renderNutrition();
    });
    const nextBtn = document.getElementById('nutriNextDay');
    if(!isToday){
      nextBtn.addEventListener('click', async ()=>{
        nutriSelectedDate = addDaysToDate(nutriSelectedDate, 1);
        navEl.classList.add('day-nav-loading');
        await renderNutrition();
      });
    }
    if(!isToday){
      document.getElementById('nutriJumpToday').addEventListener('click', async ()=>{
        nutriSelectedDate = todayStr;
        navEl.classList.add('day-nav-loading');
        await renderNutrition();
      });
    }
  } else {
    navEl.innerHTML = '';
  }

  if(range === 'day'){
    const today = selectedDate;
    const todayEntry = sorted.find(e => e.date === today);
    const combinedToday = combinedDayTotals(today, todayEntry);
    const t = getTargets(today);
    const workoutToday = isWorkoutDay(today);
    const eatenCal = combinedToday.calories;
    const eatenProtein = combinedToday.protein;
    const eatenFat = combinedToday.fat;
    const eatenCarbs = combinedToday.carbs;
    const eatenSodium = combinedToday.sodium;
    const eatenFiber = combinedToday.fiber;
    const eatenSugar = combinedToday.sugar;
    const remCal = t.calMin - eatenCal;
    const remProtein = t.proteinMin - eatenProtein;
    const calMet = remCal <= 0, proteinMet = remProtein <= 0;

    const isTodaySel = today === dateStrForOffset(0);
    const dayWord = isTodaySel ? 'today' : 'that day';
    const dayTypeNote = `<div style="font-size:10.5px;color:var(--ink-soft);margin-top:8px;">Targets shown for a ${workoutToday ? 'workout' : 'sedentary/rest'} day.</div>`;

    if(!combinedToday.hasAny){
      bannerEl.innerHTML = `
        <div style="background:var(--paper-raised);border:1px solid var(--line);border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:12.5px;color:var(--ink-soft);">No entry logged for ${dayWord}.</div>
          <div style="font-size:11.5px;color:var(--ink-soft);margin-top:2px;">${isTodaySel ? 'You have' : 'That day had'} the full ${t.calMin}-${t.calMax} kcal / ${t.proteinMin}-${t.proteinMax}g protein target ${isTodaySel ? 'still to hit' : 'to hit'}.</div>
          ${dayTypeNote}
        </div>
      `;
    } else {
      bannerEl.innerHTML = `
        <div style="background:${(calMet && proteinMet) ? 'rgba(47,111,78,0.12)' : 'rgba(180,71,42,0.1)'};border:1px solid ${(calMet && proteinMet) ? 'var(--forest)' : '#B4472A'};border-radius:8px;padding:12px;">
          <div style="font-size:12px;font-weight:600;color:${(calMet && proteinMet) ? 'var(--forest-dark)' : '#B4472A'};margin-bottom:8px;">
            ${(calMet && proteinMet) ? (isTodaySel ? '✓ Today&#39;s target met — nice work' : '✓ Target was met that day') : (isTodaySel ? 'Still room to eat today' : 'Target was not fully met that day')}
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px;">
            <span style="color:var(--ink-soft);">Calories</span>
            <span style="color:var(--ink);font-weight:600;">${Math.round(eatenCal)} / ${t.calMin}-${t.calMax} kcal ${calMet ? '' : `(${Math.round(remCal)} more needed)`}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12.5px;">
            <span style="color:var(--ink-soft);">Protein</span>
            <span style="color:var(--ink);font-weight:600;">${(Math.round(eatenProtein * 10) / 10)}g / ${t.proteinMin}-${t.proteinMax}g ${proteinMet ? '' : `(${remProtein.toFixed(0)}g more needed)`}</span>
          </div>
          ${dayTypeNote}

          ${todayEntry && todayEntry.meal ? `
          <div style="margin-top:12px;background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:10px;">
            <div style="font-size:10.5px;font-weight:600;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;">What was eaten</div>
            <div style="font-size:12.5px;color:var(--ink);line-height:1.5;">${foodSearchEscape(todayEntry.meal)}</div>
            ${todayEntry.notes ? `<div style="font-size:11.5px;color:var(--ink-soft);font-style:italic;margin-top:6px;">${foodSearchEscape(todayEntry.notes)}</div>` : ''}
          </div>
          ` : ''}

          <div style="margin-top:12px;">
            <div class="log-head" data-macro-toggle="1" style="padding:6px 0;cursor:pointer;">
              <div style="flex:1;font-size:11.5px;font-weight:600;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em;">Macro breakdown</div>
              <svg class="log-caret" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
            </div>
            <div class="log-detail open" data-macro-detail="1">
              <div style="padding-top:6px;">
                ${macroBarRow('Calories', eatenCal, t.calMin, t.calMax, ' kcal', 'range')}
                ${macroBarRow('Protein', eatenProtein, t.proteinMin, t.proteinMax, 'g', 'range')}
                ${macroBarRow('Fat', eatenFat, t.fatMin, t.fatMax, 'g', 'range')}
                ${macroBarRow('Carbs', eatenCarbs, 0, t.carbsMax, 'g', 'ceiling')}
                ${(eatenSodium || eatenFiber || eatenSugar) ? `
                  <div style="font-size:10px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.06em;margin:10px 0 6px;">From itemized food logging</div>
                  <div style="display:flex;gap:6px;">
                    ${macroChip('Sodium', eatenSodium, t.sodiumMax, 'mg', 'ceiling')}
                    ${macroChip('Fiber', eatenFiber, t.fiberTarget, 'g', 'floor')}
                    ${macroChip('Sugar', eatenSugar, t.sugarMax, 'g', 'ceiling')}
                  </div>
                ` : ''}
              </div>
            </div>
          </div>

          ${(() => {
            const notes = buildNutritionNotes(
              {cal: eatenCal, protein: eatenProtein, fat: eatenFat, carbs: eatenCarbs, sodium: eatenSodium, fiber: eatenFiber, sugar: eatenSugar},
              t, !!(eatenSodium || eatenFiber || eatenSugar)
            );
            return `
              <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line);">
                <div style="font-size:10.5px;font-weight:600;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Guidance for ${dayWord}</div>
                ${notes.map(n => `<div style="display:flex;gap:6px;font-size:12px;color:var(--ink);line-height:1.4;margin-bottom:5px;"><span>${n.icon}</span><span>${n.text}</span></div>`).join('')}
              </div>
            `;
          })()}
        </div>
      `;
      const macroHead = bannerEl.querySelector('[data-macro-toggle="1"]');
      macroHead.addEventListener('click', ()=>{
        const detail = bannerEl.querySelector('[data-macro-detail="1"]');
        const open = detail.classList.toggle('open');
        macroHead.classList.toggle('expanded', open);
      });
    }
  } else {
    bannerEl.innerHTML = '';
  }

  const avg = (key) => {
    const vals = combinedList.map(e => e[key]).filter(v => !isNaN(v));
    return vals.length ? vals.reduce((a,b)=>a+b,0) / vals.length : null;
  };
  const avgCal = avg('calories'), avgProtein = avg('protein'), avgFat = avg('fat'), avgCarbs = avg('carbs');
  const fastVals = recent.map(e => parseFloat(e.fastHours)).filter(v => !isNaN(v));
  const avgFast = fastVals.length ? fastVals.reduce((a,b)=>a+b,0) / fastVals.length : null;
  const daysMetProtein = combinedList.filter(e => e.protein >= getTargets(e.date).proteinMin).length;
  const daysMetCal = combinedList.filter(e => e.calories >= getTargets(e.date).calMin).length;

  const calColor = avgCal !== null ? (avgCal >= CAL_TARGET_MIN ? 'var(--forest-dark)' : '#B4472A') : 'var(--forest-dark)';
  const proteinColor = avgProtein !== null ? (avgProtein >= PROTEIN_TARGET_MIN ? 'var(--forest-dark)' : '#B4472A') : 'var(--forest-dark)';
  const cardLabel = range === 'day' ? '' : (range === 'month' ? ' (30d)' : ' (7d)');

  clearInterval(nutriFastTickInterval);
  const isTodaySelected = range === 'day' && selectedDate === dateStrForOffset(0);
  document.getElementById('nutriCards').innerHTML = `
    <div class="dash-card"><div class="dash-num" style="color:${calColor};">${avgCal !== null ? Math.round(avgCal) : '—'}</div><div class="dash-label">${range==='day' ? 'Kcal today' : 'Avg kcal'+cardLabel}</div></div>
    <div class="dash-card"><div class="dash-num" style="color:${proteinColor};">${avgProtein !== null ? avgProtein.toFixed(1) : '—'}</div><div class="dash-label">${range==='day' ? 'Protein today' : 'Avg protein'+cardLabel}</div></div>
    <div class="dash-card ${isTodaySelected ? 'open-fasting-screen-link' : ''}" ${isTodaySelected ? 'style="cursor:pointer;"' : ''}>
      <div class="dash-num" id="nutriFastValue">${avgFast !== null ? formatFastHours(avgFast) : '—'}</div>
      <div class="dash-label">${range==='day' ? "Today's fast" : 'Avg fast'+cardLabel}</div>
      ${isTodaySelected ? `<div style="font-size:9.5px;color:var(--ink-soft);margin-top:2px;" id="nutriFastSub"></div>` : ''}
    </div>
    <div class="dash-card"><div class="dash-num">${daysMetProtein}/${combinedList.length}</div><div class="dash-label">Days hit protein</div></div>
    <div class="dash-card"><div class="dash-num">${daysMetCal}/${combinedList.length}</div><div class="dash-label">Days hit kcal floor</div></div>
    <div class="dash-card"><div class="dash-num">${combinedList.length}</div><div class="dash-label">Days logged${cardLabel}</div></div>
  `;
  if(isTodaySelected){
    const todayEntryForFast = sorted.find(e => e.date === selectedDate);
    const lastFast = todayEntryForFast && todayEntryForFast.fastHours ? parseFloat(todayEntryForFast.fastHours) : null;
    const updateNutriFast = ()=>{
      const valEl = document.getElementById('nutriFastValue');
      const subEl = document.getElementById('nutriFastSub');
      if(!valEl) return;
      const info = fastingSummaryText(lastFast);
      valEl.textContent = info.value;
      if(subEl) subEl.textContent = info.sub;
    };
    updateNutriFast();
    if(fastingState.startIso){
      nutriFastTickInterval = setInterval(updateNutriFast, 1000);
    }
  }

  // Macro split bar (avg calorie contribution: protein 4kcal/g, fat 9kcal/g, carbs 4kcal/g)
  const macroEl = document.getElementById('macroBar');
  if(avgProtein !== null && avgFat !== null && avgCarbs !== null){
    const pCal = avgProtein * 4, fCal = avgFat * 9, cCal = avgCarbs * 4;
    const totalCal = pCal + fCal + cCal || 1;
    const pPct = (pCal/totalCal*100), fPct = (fCal/totalCal*100), cPct = (cCal/totalCal*100);
    macroEl.innerHTML = `
      <div style="font-size:11px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin-bottom:6px;">${range==='day' ? "Today's" : 'Avg'} macro split (by calories)</div>
      <div style="display:flex;height:14px;border-radius:7px;overflow:hidden;border:1px solid var(--line);">
        <div style="width:${pPct}%;background:var(--forest);" title="Protein"></div>
        <div style="width:${fPct}%;background:var(--ochre);" title="Fat"></div>
        <div style="width:${cPct}%;background:#B4472A;" title="Carbs"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--ink-soft);margin-top:4px;">
        <span>🟢 Protein ${pPct.toFixed(0)}%</span>
        <span>🟠 Fat ${fPct.toFixed(0)}%</span>
        <span>🔴 Carbs ${cPct.toFixed(0)}%</span>
      </div>
    `;
  } else {
    macroEl.innerHTML = '';
  }

  // Weekly/monthly multi-macro trend (day view already has its own
  // single-day macro bars/banner above, so this only applies to the 7d/30d
  // windows).
  renderNutritionTrendChart(document.getElementById('calorieChart'), range, dateList, sorted);

  renderTodayGlance();
}

// Which macros are plotted on the weekly/monthly nutrition trend chart --
// module-level so the choice survives a re-render (toggling a checkbox) but
// resets on a full page load. Calories on by default per the original ask;
// everything else is opt-in since plotting them all at once gets noisy.
let nutriTrendVisible = {calories: true, protein: false, fat: false, carbs: false, sodium: false, fiber: false};
const NUTRI_TREND_SERIES = [
  {key: 'calories', label: 'Calories', color: '#2F6F4E', target: t => t.calMax},
  {key: 'protein', label: 'Protein', color: '#B4472A', target: t => t.proteinMax},
  {key: 'fat', label: 'Fat', color: '#C9962C', target: t => t.fatMax},
  {key: 'carbs', label: 'Carbs', color: '#6B5B95', target: t => t.carbsMax},
  {key: 'sodium', label: 'Sodium', color: '#3D7A99', target: t => t.sodiumMax},
  {key: 'fiber', label: 'Fiber', color: '#8A6D3B', target: t => t.fiberTarget}
];
function renderNutritionTrendChart(chartEl, range, dateList, sorted){
  if(!chartEl) return;
  if(range === 'day'){ chartEl.innerHTML = ''; return; }

  const legendHtml = NUTRI_TREND_SERIES.map(s => `
    <label style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--ink-soft);margin-right:10px;margin-bottom:4px;cursor:pointer;">
      <input type="checkbox" data-trend-toggle="${s.key}" ${nutriTrendVisible[s.key] ? 'checked' : ''} style="accent-color:${s.color};">
      <span style="width:9px;height:9px;border-radius:50%;background:${s.color};display:inline-block;"></span>${s.label}
    </label>
  `).join('');
  const wireToggles = ()=>{
    chartEl.querySelectorAll('[data-trend-toggle]').forEach(cb=>{
      cb.addEventListener('change', ()=>{
        nutriTrendVisible[cb.dataset.trendToggle] = cb.checked;
        renderNutritionTrendChart(chartEl, range, dateList, sorted);
      });
    });
  };

  // dateList is newest-first (today, today-1, ...); the chart reads left-to-right.
  const chronoDates = [...dateList].reverse();
  const dayTotals = chronoDates.map(d => ({date: d, ...combinedDayTotals(d, sorted.find(e => e.date === d)), targets: getTargets(d)}));
  const activeSeries = NUTRI_TREND_SERIES.filter(s => nutriTrendVisible[s.key]);

  if(!activeSeries.length){
    chartEl.innerHTML = `<div style="margin-bottom:6px;">${legendHtml}</div><div class="dash-empty">Tick a macro above to see its trend.</div>`;
    wireToggles();
    return;
  }
  if(dayTotals.filter(d => d.hasAny).length < 2){
    chartEl.innerHTML = `<div style="margin-bottom:6px;">${legendHtml}</div><div class="dash-empty">Log at least 2 days in this range to see a trend.</div>`;
    wireToggles();
    return;
  }

  const w = 300, h = 150, padL = 34, padR = 8, padT = 10, padB = 20;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const xStep = dayTotals.length > 1 ? plotW / (dayTotals.length - 1) : 0;
  const xFor = i => padL + i * xStep;

  // Different macros live on wildly different scales (calories in the
  // thousands, fiber in tens of grams) -- plotting raw values on one axis
  // would flatten the small ones to nothing, so every series is normalized
  // to "% of that day's target" and shares a 0-150%-ish axis instead.
  const allPct = [];
  const seriesPoints = activeSeries.map(s => {
    const pts = dayTotals.map((d, i) => {
      const val = d[s.key] || 0;
      const target = s.target(d.targets) || 1;
      const pct = (val / target) * 100;
      if(d.hasAny) allPct.push(pct);
      return {x: xFor(i), pct, has: d.hasAny};
    });
    return {series: s, pts};
  });
  const ticks = niceTicks(0, Math.max(100, ...allPct, 10), 4);
  const maxV = ticks[ticks.length - 1];
  const yFor = pct => padT + plotH - (pct / (maxV || 1)) * plotH;

  const gridLines = ticks.map(t => `
    <line x1="${padL}" y1="${yFor(t)}" x2="${w - padR}" y2="${yFor(t)}" stroke="var(--line)" stroke-width="1"/>
    <text x="${padL - 6}" y="${yFor(t) + 3}" text-anchor="end" font-size="9" fill="var(--ink-soft)">${t}%</text>
  `).join('');
  const targetLine = `<line x1="${padL}" y1="${yFor(100)}" x2="${w - padR}" y2="${yFor(100)}" stroke="var(--ochre)" stroke-width="1.5" stroke-dasharray="4,3"/>`;
  const linesHtml = seriesPoints.map(({series, pts}) => {
    const validPts = pts.filter(p => p.has);
    if(validPts.length < 2) return '';
    const linePoints = validPts.map(p => `${p.x},${yFor(p.pct)}`).join(' ');
    const dots = validPts.map(p => `<circle cx="${p.x}" cy="${yFor(p.pct)}" r="3" fill="${series.color}"/>`).join('');
    return `<polyline points="${linePoints}" fill="none" stroke="${series.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>${dots}`;
  }).join('');
  const labelIdxs = dayTotals.length <= 6 ? dayTotals.map((_, i) => i) : [0, Math.round((dayTotals.length - 1) / 2), dayTotals.length - 1];
  const xLabels = labelIdxs.map(i => `<text x="${xFor(i)}" y="${h - 4}" text-anchor="middle" font-size="9" fill="var(--ink-soft)">${formatDateLabel(dayTotals[i].date)}</text>`).join('');

  chartEl.innerHTML = `
    <div style="margin-bottom:6px;">${legendHtml}</div>
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px;overflow:visible;">
      ${gridLines}
      ${targetLine}
      ${linesHtml}
      ${xLabels}
    </svg>
    <div style="font-size:10.5px;color:var(--ochre);text-align:right;margin-top:2px;">- - - 100% of daily target</div>
  `;
  wireToggles();
}

// Which stats are plotted on the Workout Dashboard's weekly/monthly trend
// chart -- same toggle pattern as the nutrition trend chart. Kcal burned is
// on by default; the rest are opt-in.
let workoutTrendVisible = {calories: true, hr: false, steps: false, distance: false, recovery: false};
const WORKOUT_TREND_SERIES = [
  {key: 'calories', label: 'Kcal Burned', color: '#2F6F4E'},
  {key: 'hr', label: 'Avg HR', color: '#B4472A'},
  {key: 'steps', label: 'Steps', color: '#4A90D9'},
  {key: 'distance', label: 'Distance', color: '#6B5B95'},
  {key: 'recovery', label: 'Recovery', color: '#3D7A99'}
];
function dayWorkoutStatTotals(dStr){
  const dayEntries = historyLog.filter(e => e.date === dStr && e.stats);
  const calories = dayEntries.reduce((sum, e) => sum + (parseFloat(e.stats.calories) || 0), 0);
  const distance = dayEntries.reduce((sum, e) => sum + (parseFloat(e.stats.distance) || 0), 0);
  const hrList = dayEntries.filter(e => e.stats.hr).map(e => parseFloat(e.stats.hr));
  const hr = hrList.length ? hrList.reduce((a, b) => a + b, 0) / hrList.length : 0;
  const recoveryList = dayEntries.filter(e => e.stats.recoveryHr).map(e => parseFloat(e.stats.recoveryHr));
  const recovery = recoveryList.length ? recoveryList.reduce((a, b) => a + b, 0) / recoveryList.length : 0;
  const steps = stepsLog[dStr] || 0;
  return {calories, hr, steps, distance, recovery, hasAny: calories > 0 || hr > 0 || steps > 0 || distance > 0 || recovery > 0};
}
function renderWorkoutTrendChart(chartEl, range, windowDays){
  if(!chartEl) return;
  if(range === 'day'){ chartEl.innerHTML = ''; return; }

  const legendHtml = WORKOUT_TREND_SERIES.map(s => `
    <label style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--ink-soft);margin-right:10px;margin-bottom:4px;cursor:pointer;">
      <input type="checkbox" data-workout-trend-toggle="${s.key}" ${workoutTrendVisible[s.key] ? 'checked' : ''} style="accent-color:${s.color};">
      <span style="width:9px;height:9px;border-radius:50%;background:${s.color};display:inline-block;"></span>${s.label}
    </label>
  `).join('');
  const wireToggles = ()=>{
    chartEl.querySelectorAll('[data-workout-trend-toggle]').forEach(cb=>{
      cb.addEventListener('change', ()=>{
        workoutTrendVisible[cb.dataset.workoutTrendToggle] = cb.checked;
        renderWorkoutTrendChart(chartEl, range, windowDays);
      });
    });
  };

  const dates = []; for(let i = windowDays - 1; i >= 0; i--) dates.push(dateStrForOffset(-i));
  const dayStats = dates.map(d => ({date: d, ...dayWorkoutStatTotals(d)}));
  const activeSeries = WORKOUT_TREND_SERIES.filter(s => workoutTrendVisible[s.key]);

  if(!activeSeries.length){
    chartEl.innerHTML = `<div style="margin-bottom:6px;">${legendHtml}</div><div class="dash-empty">Tick a stat above to see its trend.</div>`;
    wireToggles();
    return;
  }
  if(dayStats.filter(d => d.hasAny).length < 2){
    chartEl.innerHTML = `<div style="margin-bottom:6px;">${legendHtml}</div><div class="dash-empty">Log stats for at least 2 days in this range to see a trend.</div>`;
    wireToggles();
    return;
  }

  const w = 300, h = 150, padL = 34, padR = 8, padT = 10, padB = 20;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const xStep = dayStats.length > 1 ? plotW / (dayStats.length - 1) : 0;
  const xFor = i => padL + i * xStep;

  // Kcal/HR/steps/distance/recovery all live on very different scales, so
  // each series is normalized to % of its own max value in the visible
  // window rather than sharing a raw axis -- there's no fixed "target" for
  // these the way there is for nutrition macros, so this is relative
  // (shape of the trend), not absolute.
  const seriesPoints = activeSeries.map(s => {
    const maxVal = Math.max(...dayStats.map(d => d[s.key] || 0), 1);
    const pts = dayStats.map((d, i) => ({x: xFor(i), pct: (d[s.key] || 0) / maxVal * 100, has: d.hasAny && d[s.key] > 0, raw: d[s.key]}));
    return {series: s, pts, maxVal};
  });
  const ticks = niceTicks(0, 100, 4);
  const maxV = ticks[ticks.length - 1];
  const yFor = pct => padT + plotH - (pct / (maxV || 1)) * plotH;

  const gridLines = ticks.map(t => `
    <line x1="${padL}" y1="${yFor(t)}" x2="${w - padR}" y2="${yFor(t)}" stroke="var(--line)" stroke-width="1"/>
    <text x="${padL - 6}" y="${yFor(t) + 3}" text-anchor="end" font-size="9" fill="var(--ink-soft)">${t}%</text>
  `).join('');
  const linesHtml = seriesPoints.map(({series, pts}) => {
    const validPts = pts.filter(p => p.has);
    if(validPts.length < 2) return '';
    const linePoints = validPts.map(p => `${p.x},${yFor(p.pct)}`).join(' ');
    const dots = validPts.map(p => `<circle cx="${p.x}" cy="${yFor(p.pct)}" r="3" fill="${series.color}"/>`).join('');
    return `<polyline points="${linePoints}" fill="none" stroke="${series.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>${dots}`;
  }).join('');
  const labelIdxs = dayStats.length <= 6 ? dayStats.map((_, i) => i) : [0, Math.round((dayStats.length - 1) / 2), dayStats.length - 1];
  const xLabels = labelIdxs.map(i => `<text x="${xFor(i)}" y="${h - 4}" text-anchor="middle" font-size="9" fill="var(--ink-soft)">${formatDateLabel(dayStats[i].date)}</text>`).join('');
  const maxNote = seriesPoints.map(({series, maxVal}) => `${series.label} peak: ${maxVal % 1 === 0 ? maxVal : maxVal.toFixed(1)}`).join(' · ');

  chartEl.innerHTML = `
    <div style="margin-bottom:6px;">${legendHtml}</div>
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px;overflow:visible;">
      ${gridLines}
      ${linesHtml}
      ${xLabels}
    </svg>
    <div style="font-size:10.5px;color:var(--ink-soft);text-align:right;margin-top:2px;">% of each stat's own peak in this range -- ${maxNote}</div>
  `;
  wireToggles();
}

function renderBodyPlaceholders(){
  const grid = document.getElementById('bodyPlaceholderGrid');
  if(!grid) return;
  const tiles = [
    {key:'vitals', label:'Vitals', sub:'Blood pressure, glucose, HRV, resting HR'},
    {key:'mind', label:'Mind', sub:'Minutes, kind, stress score'}
  ];
  grid.innerHTML = tiles.map(t => `
    <div class="hub-tile hub-tile-empty" type="button">
      <div class="hub-tile-head"><span class="hub-tile-label">${t.label}</span></div>
      <div class="hub-tile-value">No entries yet</div>
      <div class="hub-tile-sub">${t.sub}</div>
      <div class="hub-tile-footer">Coming soon</div>
    </div>
  `).join('');
}

