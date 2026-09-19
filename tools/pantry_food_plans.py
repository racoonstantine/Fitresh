"""Explicit proxies for Philippine packaged products and cafe menu identities."""
from world_food_plans import RESTAURANT_INGREDIENTS, REGIONAL_INGREDIENT_IDS, EXTRA_INGREDIENTS
EXTRA_IDS=dict(coffee_mix=645,instant_noodle=691,corned=354,beef_loaf=903,sardine_tomato=108,
 tuna_oil=479,tuna_brine=478,cracker=685,round_cracker=686,graham=683,polvoron=968,
 puto=165,bibingka=701,biko=162,suman=169,kutsinta=166,palitaw=167,banana_cue=549,turon=550,
 chips_cheese=217,corn_chips=1188,multigrain=1715,chocolate=1878,choc_nuts=1948,
 white_choc=1881,banana_catsup=608,tea=1017,lemon_tea=1013,sago=1175,espresso=1232)
SOURCES={
 'Monde Nissin':'https://mondenissin.com/our-brands/',
 'Lucky Me Original':'https://verification.fda.gov.ph/FoodProduct_Lowriskview.php?ACCOUNTCODE=FR-4000013266042&export=pdf',
 'Lucky Me Chilimansi':'https://verification.fda.gov.ph/All_FoodProductsview.php?ACCOUNTCODE=FR-4000008765235&export=pdf',
 'Nescafe':'https://www.nescafe.com/ph/coffees/formats/instant-coffee',
 'Oishi':'https://www.oishi.com.ph/products/oishi-prawn-crackers/',
 'URC':'https://www.urc.com.ph/stories/life-fun/experience-the-joy-of-snacking-anytime-anywhere-with-urc-grab-n-go-trucks',
 'Century Pacific':'https://www.centurypacific.com.ph/brands/',
 'Maling':'https://verification.fda.gov.ph/FoodProduct_Highriskview.php?ACCOUNTCODE=FR-4000008566085&export=pdf',
 'NutriAsia':'https://online.flippingbook.com/view/252312515/',
 'Energy drinks':'https://www.7-eleven.com.ph/promos/participating-items-for-run-2026/',
 'Goldilocks':'https://www.goldilocks.com.ph/mobile/products/bakeshop/snacks-pasalubong',
 'Starbucks':'https://www.starbucks.ph/menu',
 'PICKUP COFFEE':'https://pickup-coffee.com/menu/',
 'Coca-Cola':'https://www.coca-cola.com/ph/en/brands/coca-cola',
 'Sprite':'https://www.coca-cola.com/ph/en/brands/sprite',
 'Royal':'https://www.coca-cola.com/ph/en/brands/royal',
 'Athlene':'https://athlene.com.ph/products/active-whey-protein',
}
WHEY_IMAGE='https://athlene.com.ph/cdn/shop/products/choco_small_3.png?v=1697512683&width=1946'

def plans():
    out=[]
    def add(name,group,mix,source,note,aliases=()):
        out.append(dict(name=name+' (estimate)',group=group,mixture=mix,url=SOURCES[source],notes=note,aliases=list(aliases)))
    for name in ['Original','Creamy White','Creamy Latte']:
        add('NESCAFE '+name+', dry coffee mix','Coffee mixes',dict(coffee_mix=100),'Nescafe','Generic FNRI coffee-creamer-sugar powder proxy; proprietary ratios unknown. Dry powder, no added water.', ['Nescafe '+name+' 3 in 1'])
    for flavor,src in [('Original','Lucky Me Original'),('Chilimansi','Lucky Me Chilimansi')]:
        add('Lucky Me Pancit Canton '+flavor+', dry noodles and seasoning','Instant noodles',dict(instant_noodle=100),src,'Generic instant noodles with flavoring proxy. DRY contents only; not cooked weight. Flavor-specific nutrition and packet mass unverified.', ['Lucky Me '+flavor,'LuckyMe '+flavor])
        add('Lucky Me Pancit Canton '+flavor+', prepared 2.5x dry-mass yield','Instant noodles',dict(instant_noodle=100,water=150),src,'Assumed 100 g dry flavored noodles plus 150 g retained water. 2.5x yield unmeasured; seasonings retained; not a packet serving.', ['cooked Lucky Me '+flavor])
    for name,key in [('SkyFlakes Original crackers','cracker'),('Fita Original crackers','round_cracker'),('M.Y. San Grahams','graham')]:
        add(name,'Biscuits', {key:100},'Monde Nissin','Exact branded label unavailable; analogous FNRI cracker proxy, not manufacturer nutrition.')
    for name,mix in [('Jack n Jill Piattos, cheese flavor',dict(chips_cheese=100)),('Jack n Jill Chippy, barbecue flavor',dict(corn_chips=100)),('Jack n Jill Nova, modeled multigrain chips',dict(multigrain=85,oil=15)),('Jack n Jill Cream-O, chocolate sandwich cookies',dict(cookie=100)),('Jack n Jill Cloud 9, chocolate caramel peanut bar',dict(choc_nuts=100))]:
        add(name,'Snacks and chocolate',mix,'URC','Manufacturer confirms brand/category only; flavor/formulation is a modeled variant. Generic composition proxy; exact package label not verified.')
    add('Oishi Prawn Crackers, original','Snacks and chocolate',dict(prawncrackers=100),'Oishi','Generic FNRI prawn crackers proxy; oil, seasoning and actual brand formulation unverified.')
    for name,mix in [('Century Tuna Flakes in Oil, undrained',dict(tuna_oil=100)),('Century Tuna Flakes in Brine, undrained',dict(tuna_brine=100)),('555 Sardines in Tomato Sauce, undrained',dict(sardine_tomato=100)),('Argentina Corned Beef, as canned',dict(corned=100)),('Argentina Beef Loaf, as canned',dict(beef_loaf=100)),('555 Carne Norte, as canned',dict(corned=100))]:
        add(name,'Canned goods',mix,'Century Pacific','Generic FNRI canned preparation proxy; exact branded meat/fish ratio, oil and sodium unverified. No draining or frying modeled.', ['sardinas 555'] if name.startswith('555 Sardines') else [])
    add('Maling Chicken Luncheon Meat, as canned','Canned goods',dict(chicken=60,water=20,oil=10,starch=8,salt=2),'Maling','Chicken identity confirmed by FDA listing. Assumed chicken-water-oil-starch-salt model; not pork Maling and not a measured recipe.', ['Ma Ling chicken','maling manok'])
    for name,mix in [('UFC Tamis Anghang Banana Catsup',dict(banana_catsup=100)),('Datu Puti Soy Sauce',dict(soy=100)),('Silver Swan Soy Sauce',dict(soy=100)),('Datu Puti White Vinegar',dict(vinegar=100)),('Datu Puti Fish Sauce',dict(fish_sauce=100))]:
        add(name,'Condiments',mix,'NutriAsia','Generic FNRI condiment proxy; brand sodium/sugar/acidity unverified. Weighed grams only, no tablespoon or ml conversion.')
    for name,mix in [('Goldilocks Classic Polvoron',dict(polvoron=100)),('Goldilocks Cookies and Cream Polvoron',dict(polvoron=80,cookie=20)),('Goldilocks Classic Puto',dict(puto=100)),('Goldilocks Butter Puto',dict(puto=95,butter=5)),('Goldilocks Leche Flan',dict(custard=100))]:
        add(name,'Merienda and desserts',mix,'Goldilocks','Generic FNRI dessert/proportion proxy; no measured brand recipe or piece mass.')
    # Distinct topping variants; the base kakanin identities already exist.
    for name,mix in [('Biko with condensed milk topping',dict(biko=100,condensed=20)),('Suman sa ibos with ripe mango',dict(suman=100,mango=80)),('Kutsinta with condensed milk topping',dict(kutsinta=100,condensed=20)),('Palitaw with condensed milk topping',dict(palitaw=100,condensed=20)),('Turon with vanilla ice cream',dict(turon=100,icecream=60)),('Banana cue with vanilla ice cream',dict(banana_cue=100,icecream=60))]:
        # Combinations are explicitly model-designed; no menu identity claim.
        key=next(iter(mix));fid=EXTRA_IDS[key]
        out.append(dict(name=name+' (estimate)',group='Merienda and desserts',mixture=mix,url='',notes='Model-designed topping combination of existing source foods; not a standardized traditional recipe. Assumed component grams; no piece weight.',aliases=[name.split(' with ')[0]+' dessert'],source_food_id=f'FC{fid:06d}'))
    beverage_note='Assumed milk, syrup and water/ice masses, not an actual cafe size or recipe. Melted ice included; grams only, no ml density inferred.'
    for name,mix in [('Iced Caffe Latte',dict(espresso=40,milk=180,water=100)),('Iced Caramel Macchiato',dict(espresso=40,milk=180,caramel=25,sugar=10,water=100)),('Caffe Mocha, modeled milk and chocolate',dict(espresso=40,milk=200,fudge=35,cream=20)),('Cappuccino, hot',dict(espresso=40,milk=160)),('Hot Brewed Coffee, unsweetened',dict(coffee=100)),('Coffee Frappuccino, modeled blended drink',dict(coffee=60,milk=120,sugar=30,water=130)),('Caramel Frappuccino, modeled blended drink',dict(coffee=60,milk=120,caramel=35,sugar=15,cream=25,water=130)),('Chocolate Cream Frappuccino, modeled blended drink',dict(milk=160,fudge=40,cream=25,water=130))]:
        add('Starbucks Philippines '+name,'Coffee shops',mix,'Starbucks',beverage_note)
    for name,mix in [('Kape Kastila, iced',dict(espresso=40,milk=150,condensed=35,water=100)),('Iced Caramel Macchiato',dict(espresso=40,milk=160,caramel=30,water=100)),('Iced White Mocha Latte',dict(espresso=40,milk=160,white_choc=30,water=100)),('Iced Latte',dict(espresso=40,milk=170,water=100)),('Cappuccino, hot',dict(espresso=40,milk=150)),('Iced Dark Chocolate Latte',dict(espresso=40,milk=160,fudge=30,water=100))]:
        add('PICKUP COFFEE '+name,'Coffee shops',mix,'PICKUP COFFEE',beverage_note,['Pickup '+name])
    for name,mix in [('Cobra Energy Drink, original modeled sweetened liquid',dict(water=87,sugar=13)),('Sting Energy Drink Strawberry, modeled sweetened liquid',dict(water=88,sugar=12))]:
        add(name,'Energy and sweet drinks',mix,'Energy drinks','Sugar-water energy proxy only; sugar concentration ASSUMED, not label-derived. Protein/fat/fiber/sodium/cholesterol and caffeine not estimated; no stimulant content claim. Product identity from PH retailer.',aliases=[name.split(',')[0]])
        out[-1]['unknown_fields']=['protein_g_100g','fat_g_100g','fiber_g_100g','sodium_mg_100g','cholesterol_mg_100g']
    add('C2 lemon green tea, modeled sweetened drink','Energy and sweet drinks',dict(lemon_tea=100),'URC','Generic lemon tea drink proxy; exact flavor label and sugar concentration unverified.')
    for name,mix in [('Athlene ACTIVE Whey Chocolate shake, 32.4 g powder plus 250 g water',dict(whey_label=32.4,water=250)),('Athlene ACTIVE Whey Chocolate shake, 32.4 g powder plus 250 g whole milk',dict(whey_label=32.4,milk=250))]:
        add(name,'Protein shakes',mix,'Athlene','Published chocolate powder label with explicitly assumed water/milk preparation. Fluid amounts weighed in grams; not a manufacturer serving instruction. Fiber unlisted in powder label remains unknown.')
    return out

def drink_labels():
    # Original published per-serving units preserved. Density conversion is estimated.
    return [
      ('Coca-Cola Original Taste',237,100,25,12,'Coca-Cola'),
      ('Coca-Cola Light Taste',320,0,0,20,'Coca-Cola'),
      ('Coca-Cola Zero Sugar',320,0,0,20,'Coca-Cola'),
      ('Sprite, 240 mL label formulation',240,48,12,22,'Sprite'),
      ('Sprite Zero',320,0,0,29,'Sprite'),
      ('Royal Tru-Orange',237,48,12,16,'Royal'),
      ('Royal Zero Sugar',320,0,0,21,'Royal'),
      ('Royal Tru-Grape',320,60,15,35,'Royal'),
      ('Royal Tru-Lemon',237,48,12,26,'Royal'),
    ]
