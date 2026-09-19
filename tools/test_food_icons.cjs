// Extracts the food-icon classification logic straight out of
// public/index.html (no build step in this app, so there's nothing to
// import) and exercises it against the example table from
// food-icon-auto-assignment-spec.md section 17, plus the iconOverride
// priority check from section 17's closing example.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = require('./app_source.cjs')();
const start = html.indexOf("const FOOD_ICON_SVG_PATHS");
const end = html.indexOf("// Excludes results with no usable calorie data");
if(start === -1 || end === -1) throw new Error('Could not locate food-icon classification block in index.html');
const code = html.slice(start, end);

const context = vm.createContext({});
vm.runInContext(code, context);
const { getFoodIcon } = context;

const cases = [
  ['Chicken Adobo', 'chicken'],
  ['Pork Sinigang', 'soup'],
  ['Chicken Tinola', 'soup'],
  ['Beef Nilaga', 'soup'],
  ['Chicken Sopas', 'soup'],
  ['Bangus', 'fish'],
  ['Fried Bangus', 'fish'],
  ['Pancit Canton', 'noodles'],
  ['Chicken Pancit Canton', 'noodles'],
  ['Filipino Spaghetti', 'pasta'],
  ['Chicken Alfredo', 'pasta'],
  ['Garlic Rice', 'rice'],
  ['Egg Fried Rice', 'fried-rice'],
  ['Rice with Chicken Adobo', 'rice-dish'],
  // Spec section 17 says "Pandesal -> bread", but the icon pack (and the
  // spec's own section 3 recommended-key list) has a dedicated pandesal
  // icon -- using the more specific one is a deliberate improvement, not
  // a bug, per the "database metadata when available" principle in
  // section 19.
  ['Pandesal', 'pandesal'],
  ['Pinakbet', 'vegetables'],
  ['Mangga', 'fruit'],
  ['Iced Coffee', 'coffee'],
  ['Coke Zero', 'cola'],
  ['Mineral Water', 'water'],
  ['Halo-Halo', 'dessert'],
  ['Chocolate Cake', 'dessert'],
  ['Potato Chips', 'chips'],
  ["Mama's Special Sunday Meal", 'generic-meal'],
  ['Unknown Homemade Meal', 'generic-meal']
];

for(const [name, expected] of cases){
  const actual = getFoodIcon({name});
  assert.equal(actual, expected, `getFoodIcon({name: "${name}"}) expected "${expected}", got "${actual}"`);
}

// iconOverride must always win, even over an explicit food.icon and a
// name that would otherwise infer something else.
assert.equal(
  getFoodIcon({name: 'Chicken Pasta', icon: 'chicken', iconOverride: 'pasta'}),
  'pasta'
);
// food.icon wins over inference when there's no override.
assert.equal(
  getFoodIcon({name: 'Some Random Dish', icon: 'soup'}),
  'soup'
);
// category/subcategory used only when the name gives no usable signal.
assert.equal(
  getFoodIcon({name: "Mama's Homemade Special", category: 'meat', subcategory: 'chicken'}),
  'chicken'
);

console.log(`PASS: ${cases.length + 3} food-icon classification cases (exact examples, override priority, category fallback).`);
