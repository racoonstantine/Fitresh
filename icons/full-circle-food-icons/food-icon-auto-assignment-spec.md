# Food Icon Auto-Assignment Specification

## Purpose

Implement a reusable automatic food icon assignment system for the health and nutrition app.

The goal is to assign a suitable SVG icon to each food or meal entry without requiring every food record to be manually configured.

The system should work for:

- Foods already stored in the food database
- Newly added foods
- Manual food entries
- Filipino foods and aliases
- Mixed dishes
- Drinks
- Snacks and desserts
- Foods with no known category

The system must always have a safe fallback icon.

---

# 1. Icon Assignment Priority

Use the following priority order when determining which icon to display:

1. `iconOverride`
2. `icon`
3. Category/subcategory mapping
4. Food-name keyword inference
5. `generic-meal` fallback

Example logic:

```js
function getFoodIcon(food) {
  if (food.iconOverride) {
    return food.iconOverride;
  }

  if (food.icon) {
    return food.icon;
  }

  const categoryIcon = getIconFromCategory(
    food.category,
    food.subcategory
  );

  if (categoryIcon) {
    return categoryIcon;
  }

  const keywordIcon = getIconFromKeywords(food.name);

  if (keywordIcon) {
    return keywordIcon;
  }

  return "generic-meal";
}
```

The function should return an icon key only.

Do not put SVG rendering or UI-specific code inside this function.

---

# 2. Recommended Food Database Fields

Add the following optional fields to food records:

```json
{
  "category": "meat",
  "subcategory": "chicken",
  "icon": "chicken",
  "iconOverride": null
}
```

Recommended field behavior:

### `category`

Broad food type.

Examples:

- rice
- meat
- seafood
- vegetables
- fruit
- soup
- noodles
- pasta
- bread
- dessert
- snack
- beverage
- dairy
- egg
- legumes

### `subcategory`

More specific classification.

Examples:

- chicken
- beef
- pork
- fish
- shrimp
- coffee
- cola
- milk
- pandesal

### `icon`

Default icon assigned to the database item.

Example:

```json
{
  "name": "Chicken Adobo",
  "category": "meat",
  "subcategory": "chicken",
  "icon": "chicken"
}
```

### `iconOverride`

Optional manually selected icon.

If present, this MUST take priority over all automatic logic.

Example:

```json
{
  "name": "Chicken Sopas",
  "category": "meat",
  "subcategory": "chicken",
  "icon": "chicken",
  "iconOverride": "soup"
}
```

---

# 3. Initial Icon Keys

Use stable internal keys so SVG files can be replaced later without changing food records.

Recommended initial set:

```text
water
coffee
tea
cola
juice
milk
smoothie
drink

soup
rice
rice-dish
fried-rice
noodles
pasta

bread
pandesal
sandwich
burger
pizza
wrap

chicken
beef
pork
fish
seafood
shrimp
egg
tofu
stew
barbecue

vegetables
leafy-vegetables
salad
beans
potato
corn

fruit
apple
banana
citrus
grapes

cake
pastry
ice-cream
chocolate
candy
cookies
chips
nuts

breakfast
lunch
dinner
snack
dessert

generic-meal
```

Do not use filenames directly throughout the business logic.

Use icon keys such as:

```text
chicken
rice
soup
coffee
```

Then resolve those keys to actual SVG assets separately.

Example:

```js
const FOOD_ICON_PATHS = {
  chicken: "/icons/food/chicken.svg",
  rice: "/icons/food/rice.svg",
  soup: "/icons/food/soup.svg",
  coffee: "/icons/food/coffee.svg",
  "generic-meal": "/icons/food/generic-meal.svg"
};
```

---

# 4. Category Mapping

Create a reusable category map.

Example:

```js
const CATEGORY_ICON_MAP = {
  rice: "rice",
  chicken: "chicken",
  beef: "beef",
  pork: "pork",
  fish: "fish",
  seafood: "seafood",
  egg: "egg",
  tofu: "tofu",
  soup: "soup",
  stew: "stew",
  noodles: "noodles",
  pasta: "pasta",
  bread: "bread",
  vegetables: "vegetables",
  fruit: "fruit",
  dessert: "dessert",
  snack: "snack",
  beverage: "drink",
  coffee: "coffee",
  water: "water",
  cola: "cola",
  milk: "milk"
};
```

If both `category` and `subcategory` exist, prefer the more specific usable mapping.

---

# 5. Keyword-Based Fallback

If the database record has no usable icon information, infer the icon from the food name.

Keep keyword rules in a separate configuration file.

Do NOT build a giant nested `if / else` statement.

Example structure:

```js
const FOOD_ICON_RULES = [
  {
    icon: "coffee",
    keywords: [
      "coffee",
      "kape",
      "espresso",
      "latte",
      "cappuccino",
      "americano",
      "mocha"
    ]
  },
  {
    icon: "rice",
    keywords: [
      "rice",
      "kanin",
      "sinangag",
      "garlic rice",
      "steamed rice"
    ]
  }
];
```

Example matcher:

```js
function getIconFromKeywords(name = "") {
  const text = normalizeFoodName(name);

  for (const rule of FOOD_ICON_RULES) {
    const matched = rule.keywords.some(keyword =>
      text.includes(keyword)
    );

    if (matched) {
      return rule.icon;
    }
  }

  return null;
}
```

---

# 6. Normalize Food Names Before Matching

Create a helper such as:

```js
function normalizeFoodName(value = "") {
  return value
    .toLowerCase()
    .trim()
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ");
}
```

Optional future enhancements:

- Remove punctuation
- Handle plural forms
- Handle common misspellings
- Handle brand prefixes
- Normalize Filipino/English variants
- Use alias tables

---

# 7. Filipino Food Keyword Rules

Include Filipino names and common aliases.

Suggested starting rules:

## Rice

Keywords:

```text
rice
kanin
sinangag
garlic rice
fried rice
java rice
brown rice
white rice
malagkit
```

Default icon:

```text
rice
```

## Chicken

Keywords:

```text
chicken
manok
inasal
chicken breast
chicken thigh
fried chicken
roast chicken
lechon manok
```

Default icon:

```text
chicken
```

## Beef

Keywords:

```text
beef
baka
tapa
roast beef
corned beef
steak
beef steak
bistek
```

Default icon:

```text
beef
```

## Pork

Keywords:

```text
pork
baboy
liempo
kasim
lechon kawali
lechon
pork chop
tocino
longganisa
sisig
```

Default icon:

```text
pork
```

## Fish

Keywords:

```text
fish
isda
bangus
tilapia
galunggong
tuna
salmon
sardines
tamban
dilis
lapu lapu
maya maya
```

Default icon:

```text
fish
```

## Seafood

Keywords:

```text
seafood
shrimp
hipon
prawn
crab
alimango
alimasag
squid
pusit
mussels
tahong
shellfish
```

Default icon:

```text
seafood
```

## Soup

Keywords:

```text
soup
sinigang
tinola
nilaga
bulalo
sopas
mami
lugaw
arroz caldo
batchoy
misua soup
```

Default icon:

```text
soup
```

## Noodles

Keywords:

```text
noodle
noodles
pancit
pansit
bihon
canton
sotanghon
miki
mami
ramen
yakisoba
instant noodles
```

Default icon:

```text
noodles
```

## Pasta

Keywords:

```text
pasta
spaghetti
carbonara
alfredo
macaroni
lasagna
penne
fettuccine
```

Default icon:

```text
pasta
```

## Bread

Keywords:

```text
bread
pandesal
pan de sal
toast
bun
monay
ensaymada
baguette
loaf
```

Default icon:

```text
bread
```

## Vegetables

Keywords:

```text
vegetable
vegetables
gulay
pinakbet
pakbet
chopsuey
chop suey
kangkong
pechay
malunggay
ampalaya
okra
sitaw
kalabasa
talong
```

Default icon:

```text
vegetables
```

## Fruit

Keywords:

```text
fruit
apple
banana
saging
mango
mangga
orange
dalanghita
papaya
pineapple
pinya
grapes
ubas
watermelon
pakwan
melon
guava
bayabas
```

Default icon:

```text
fruit
```

## Coffee

Keywords:

```text
coffee
kape
espresso
americano
latte
cappuccino
mocha
cold brew
iced coffee
3 in 1 coffee
```

Default icon:

```text
coffee
```

## Cola / Soft Drink

Keywords:

```text
cola
coke
coca cola
pepsi
soft drink
softdrink
soda
sprite
royal
mountain dew
7up
7 up
```

Default icon:

```text
cola
```

## Water

Keywords:

```text
water
tubig
mineral water
sparkling water
distilled water
```

Default icon:

```text
water
```

## Milk

Keywords:

```text
milk
gatas
fresh milk
skim milk
whole milk
chocolate milk
```

Default icon:

```text
milk
```

## Dessert

Keywords:

```text
dessert
cake
ice cream
halo halo
halo-halo
leche flan
ube
brownie
donut
doughnut
pastry
cupcake
```

Default icon:

```text
dessert
```

## Chips / Snack

Keywords:

```text
chips
crisps
chichirya
crackers
nachos
popcorn
```

Default icon:

```text
chips
```

## Candy / Chocolate

Keywords:

```text
candy
sweet
sweets
chocolate
chocolates
gummy
lollipop
```

Default icon:

```text
candy
```

---

# 8. Mixed Dish Priority

The first keyword matched should NOT always be the first ingredient mentioned.

The system should try to represent the overall type of dish.

Examples:

```text
Chicken Spaghetti
→ pasta

Chicken Sopas
→ soup

Pork Sinigang
→ soup

Beef Noodle Soup
→ soup

Chicken Pancit Canton
→ noodles

Tuna Pasta
→ pasta

Egg Fried Rice
→ fried-rice or rice

Rice with Chicken Adobo
→ rice-dish

Burger Steak with Rice
→ rice-dish or burger depending on app preference

Pork Barbecue
→ barbecue

Fruit Salad
→ fruit or salad based on explicit priority
```

Recommended priority for mixed-dish keyword inference:

```text
1. beverage-specific
2. soup/stew
3. pasta
4. noodles
5. rice-dish / fried-rice
6. burger / sandwich / pizza
7. dessert
8. vegetables / salad
9. main protein
10. fruit
11. generic
```

This priority should be configurable.

---

# 9. Exact Phrase Rules

Support exact or high-priority phrase matching before generic keywords.

Example:

```js
const FOOD_ICON_PHRASE_RULES = [
  { phrase: "chicken sopas", icon: "soup" },
  { phrase: "pork sinigang", icon: "soup" },
  { phrase: "beef noodle soup", icon: "soup" },
  { phrase: "fried rice", icon: "fried-rice" },
  { phrase: "garlic rice", icon: "rice" },
  { phrase: "rice with", icon: "rice-dish" },
  { phrase: "halo halo", icon: "dessert" },
  { phrase: "halo-halo", icon: "dessert" }
];
```

Resolution order:

```text
iconOverride
↓
food.icon
↓
exact phrase rules
↓
category/subcategory
↓
priority keyword rules
↓
generic-meal
```

Exact phrase matching is useful for avoiding incorrect classification of mixed dishes.

---

# 10. SVG Asset Requirements

All food icons should follow a consistent visual system.

Recommended SVG standard:

```text
viewBox: 0 0 24 24
stroke width: approximately 1.8–2
stroke: currentColor
fill: none
stroke-linecap: round
stroke-linejoin: round
```

Example:

```svg
<svg
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  ...
</svg>
```

Use `currentColor` so icon color can be controlled by CSS.

Do not hard-code icon colors unless an icon specifically requires it.

---

# 11. Suggested Folder Structure

Example:

```text
src/
  assets/
    icons/
      food/
        water.svg
        coffee.svg
        tea.svg
        cola.svg
        soup.svg
        rice.svg
        rice-dish.svg
        chicken.svg
        beef.svg
        pork.svg
        fish.svg
        vegetables.svg
        fruit.svg
        pasta.svg
        noodles.svg
        bread.svg
        dessert.svg
        generic-meal.svg

  config/
    foodIconRules.js

  utils/
    getFoodIcon.js
    normalizeFoodName.js
```

If using TypeScript:

```text
foodIconRules.ts
getFoodIcon.ts
normalizeFoodName.ts
```

---

# 12. Keep Icon Logic Separate From UI

UI components should only ask for an icon key.

Example:

```js
const iconKey = getFoodIcon(food);
const iconPath = FOOD_ICON_PATHS[iconKey];
```

The meal card should not contain classification logic.

Bad:

```js
if (food.name.includes("chicken")) {
  // render chicken icon
}
```

Good:

```js
const iconKey = getFoodIcon(food);
```

This allows icon logic to evolve independently from the UI.

---

# 13. Unknown Foods

Unknown foods should never break rendering.

Example:

```text
"Mama's Special Sunday Meal"
```

If no category or keyword is recognized:

```text
generic-meal
```

Always make sure:

```js
getFoodIcon(food)
```

returns a valid key.

---

# 14. Manual Entry Behavior

For manually entered foods:

1. User enters food name.
2. App automatically assigns an icon using keyword inference.
3. User may optionally select a different icon.
4. If changed manually, save that value as `iconOverride`.

Example:

```json
{
  "name": "Mom's Chicken Macaroni",
  "category": null,
  "subcategory": null,
  "icon": null,
  "iconOverride": "pasta"
}
```

This creates a simple learning-style workflow without requiring AI.

---

# 15. Database Migration

Existing foods do NOT need to be manually updated immediately.

Migration strategy:

### Phase 1

Leave existing records unchanged.

Use keyword inference when category/icon values are missing.

### Phase 2

Gradually populate:

```text
category
subcategory
icon
```

for the main food database.

### Phase 3

Optionally create a script that processes the existing food DB and suggests:

```text
category
subcategory
icon
```

based on the same rule system.

Do not overwrite manually curated values.

---

# 16. Recommended Initial Implementation

Implement these modules first:

```text
foodIconRules
normalizeFoodName
getIconFromKeywords
getIconFromCategory
getFoodIcon
FOOD_ICON_PATHS
```

Recommended API:

```js
getFoodIcon(food)
```

Example input:

```json
{
  "name": "Pork Sinigang",
  "category": "soup",
  "subcategory": "pork",
  "icon": null,
  "iconOverride": null
}
```

Expected result:

```text
soup
```

Example:

```json
{
  "name": "Bangus",
  "category": null,
  "subcategory": null,
  "icon": null,
  "iconOverride": null
}
```

Expected result:

```text
fish
```

Example:

```json
{
  "name": "Chicken Alfredo Pasta"
}
```

Expected result:

```text
pasta
```

---

# 17. Suggested Tests

Add unit tests covering at least these examples:

```text
Chicken Adobo            → chicken
Pork Sinigang            → soup
Chicken Tinola           → soup
Beef Nilaga              → soup
Chicken Sopas            → soup
Bangus                   → fish
Fried Bangus             → fish
Pancit Canton            → noodles
Chicken Pancit Canton    → noodles
Filipino Spaghetti       → pasta
Chicken Alfredo          → pasta
Garlic Rice              → rice
Egg Fried Rice           → fried-rice
Rice with Chicken Adobo  → rice-dish
Pandesal                 → bread
Pinakbet                 → vegetables
Mangga                   → fruit
Iced Coffee              → coffee
Coke Zero                → cola
Mineral Water            → water
Halo-Halo                → dessert
Chocolate Cake           → dessert
Potato Chips             → chips
Unknown Homemade Meal    → generic-meal
```

Also test priority:

```text
food.iconOverride
```

must always win.

Example:

```json
{
  "name": "Chicken Pasta",
  "icon": "chicken",
  "iconOverride": "pasta"
}
```

Expected:

```text
pasta
```

---

# 18. Future Improvements

The initial system should remain deterministic and lightweight.

Possible future enhancements:

- AI-assisted food classification
- Semantic classification
- User-specific learned overrides
- Admin classification tools
- Cuisine categories
- Ingredient-level icon detection
- Brand-specific food recognition
- Confidence score
- Multiple icon tags
- Automatic category suggestions during food DB import

Do not make these requirements for the first implementation.

---

# 19. Implementation Principle

The icon system should follow this principle:

> Database metadata when available, deterministic rules when it is not, and a generic fallback when nothing matches.

Do not require AI calls merely to choose an icon.

The food icon system should be:

- Fast
- Offline-capable
- Predictable
- Easy to maintain
- Filipino-food friendly
- Easy to extend
- Independent from the UI framework

---

# 20. Requested Claude Code Task

Implement this feature in the existing health/nutrition application.

Before modifying files:

1. Inspect the current food data model.
2. Inspect the current meal-log components.
3. Inspect how SVG/icons are currently imported and rendered.
4. Reuse existing project conventions where appropriate.

Then:

1. Add the reusable icon classification configuration.
2. Add `getFoodIcon(food)`.
3. Add category and keyword mappings.
4. Support `icon`, `iconOverride`, `category`, and `subcategory` without breaking existing food records.
5. Add the generic fallback.
6. Integrate the helper into meal/food log cards where food icons are displayed.
7. Keep the classification logic outside UI components.
8. Add tests for the example foods in this document.
9. Do not overwrite existing manually curated database values.
10. Keep the implementation easy to extend when additional SVG icons are added.

If the existing schema already has similar fields, reuse or adapt them rather than introducing duplicate concepts.
