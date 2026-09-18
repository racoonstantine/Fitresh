"""Menu identities plus explicit assumed mixtures; never official brand nutrition."""
SOURCES={
 'Jollibee':'https://order.jollibee.com/en/ph/menu',
 "McDonald's":'https://www.foodpanda.ph/restaurant/mulw/mcdonalds-ayala-malls-manila-bay-mulw',
 'KFC':'https://www.kfc.com.ph/en/menu',
 'Mang Inasal':'https://www.manginasal.ph/menu',
 'Chowking':'https://www.chowking.ph/menu/allergen-declaration',
 'Ramen Kuroda':'https://www.kuroda.ph/menu',
 'Ramen Nagi':'https://n-nagi.com/english/',
}
# Exact source names prevent accidental numeric-ID ingredient substitutions.
INGREDIENTS={
 'rice':'Rice, well-milled, boiled','noodles':'Noodles, egg, cooked, enriched, with added salt','rice_noodles':'Rice noodles, cooked',
 'pasta':'Pasta, spaghetti, boiled','bun':'Rolls, hamburger or hotdog, plain','bread':'Bread, white loaf',
 'egg':'Egg, chicken, whole, boiled','scrambled':'Egg, whole, cooked, scrambled',
 'beef':'Beef, ground, 80% lean meat / 20% fat, crumbles, cooked, pan-browned',
 'pork':'Pork, fresh, ground, cooked','belly':'Pork belly, boiled','liempo':'Pork belly, broiled',
 'roast':'Chicken, whole, seasoned, roasted','fried':'Chicken, white meat, fried',
 'fried_skin':'Chicken, broilers or fryers, meat and skin, cooked, fried, flour',
 'chicken':'Chicken, white meat, boiled','nugget':'Chicken nugget','hotdog':'Sausage, hotdog',
 'bbq':'Pork, bbq','bacon':'Pork, cured, bacon, cooked, baked',
 'milkfish':'Milkfish, broiled','shrimp':'Shrimp, banana prawn, boiled','squid':'Squid, boiled',
 'salmon':'Fish, salmon, Atlantic, farmed, cooked, dry heat',
 'cheese':'Cheese, cheddar, pasteurized, processed','milk':"Fresh cow's milk",'evap':'Milk, evaporated, filled',
 'condensed':'Milk, sweetn, cond, filled','cream':'Cream','butter':'Butter','oil':'Oil, corn','lard':'Fat, pork',
 'mayo':'Mayonnaise','soy':'Soy sauce','salt':'Salt, coarse','sugar':'Sugar, brown','tomatosauce':'Tomato sauce',
 'ketchup':'Catsup, tomato','chili':'Pepper, chili fruit','garlic':'Garlic bulb','onion':'Onion, Bombay bulb, boiled',
 'springonion':'Onion, spring','lettuce':'Lettuce lvs & petioles','tomato':'Tomato','cabbage':'Cabbage, green',
 'carrot':'Carrot, boiled','corn':'Corn on cob, yellow, boiled','potato':'Potato, boiled','fries':'Potato, French-fried',
 'hashbrown':'Restaurant, family style, hash browns','pancake':'Pancake',
 'mango':'Mango, Manila super, ripe','peach':'Peach, in heavy syrup, cnd','pineapple':'Pineapple',
 'halo':'Halu-halo, w/ ice','custard':'Creme custard','icecream':'Ice cream',
 'cookie':'Cookies, sandwich type, cream-filled','fudge':'Syrups, chocolate, fudge-type',
 'caramel':'Toppings, butterscotch or caramel','pie':'Pie, peach','puff':'Cream puff shell, prepared from recipe',
 'siopao':'Steamed bun, pork filling','miso':'Soybean paste, miso','sesame':'Sesame seed, dried',
 'basil':'Basil, sweet, fresh','coffee':'Beverages, coffee, brewed, prepared with tap water',
 'water':'Beverages, water, tap, drinking','gravy':'Gravy, mushroom, canned','curry':'Spices, curry powder',
 'sweet_sour_chicken':'Restaurant, Chinese, sweet and sour chicken',
 'sweet_sour_pork':'Restaurant, Chinese, sweet and sour pork',
 'chowmein':'Restaurant, Chinese, chicken chow mein',
 'springroll':'Restaurant, Chinese, egg rolls, assorted',
 'buchi':'Rice prep (glutinous), butse, w/ mung bean filling',
 'strawberry_topping':'Toppings, strawberry','banana':'Banana, saba, boiled',
 'prawncrackers':'Chips, prawn crackers','chicken_skin':'Chicken, broilers or fryers, skin only, cooked, roasted',
 'parmesan':'Cheese, parmesan, hard','mushroom_soup':'Soup, cream of mushroom, cnd',
}

def plans():
    out=[]
    def add(brand,name,mix,note='',url=None):
        out.append(dict(brand=brand,menu_item=name,mixture=mix,notes=note,menu_url=url or SOURCES[brand]))
    def burger(meat=45,cheese=0,**extra):
        return dict(bun=50,beef=meat,mayo=12,**({'cheese':cheese} if cheese else {}),**extra)
    spaghetti=dict(pasta=170,tomatosauce=70,hotdog=25,beef=20,sugar=10,cheese=10)
    palabok=dict(rice_noodles=180,shrimp=25,pork=25,egg=30,water=35,oil=5,soy=8)
    mash=dict(potato=100,milk=20,butter=5,gravy=20)
    fillet=dict(fried=100,cream=25,milk=20,butter=5,salt=.5)
    soup=dict(pasta=40,chicken=25,carrot=15,milk=40,water=160,salt=1)
    ricefried=dict(rice=180,egg=30,carrot=15,oil=8,soy=8,springonion=5)
    chickenburger=dict(bun=55,fried=75,mayo=15,lettuce=8)
    halo=dict(halo=200,evap=50,custard=30,icecream=30)
    # Component-only references exclude unspecified combo rice, drinks and sides.
    b='Jollibee'
    add(b,'Chickenjoy, original, edible chicken only',dict(fried_skin=100),'Generic flour-fried chicken proxy; bones, gravy and rice excluded.')
    add(b,'Chickenjoy, spicy, edible chicken only',dict(fried_skin=100,chili=2,oil=2),'Assumed chili/oil coating; proprietary breading unknown.')
    for name,mix in [('Yumburger',burger()),('Cheesy Yumburger',burger(45,15)),('Double Cheesy Yumburger',burger(90,30)),('Bacon Cheesy Yumburger',burger(45,15,bacon=15)),('Champ',burger(110,20,lettuce=10,tomato=20)),('Champ Jr.',burger(60,15,lettuce=8,tomato=15)),('Amazing Aloha Champ Jr.',burger(60,15,bacon=15,pineapple=30))]:add(b,name+', sandwich only',mix,'Generic cooked beef and bun proportions; no measured brand patty or sandwich weight.')
    add(b,'Jolly Spaghetti, pasta and sauce only',spaghetti,'Assumed sweet tomato, hotdog and beef sauce.')
    add(b,'Palabok, noodles and toppings only',palabok,'Simplified shrimp/pork/egg sauce proxy; not a published restaurant recipe.')
    add(b,'Burger Steak, patty and gravy only',dict(beef=80,gravy=50),'Crumbled cooked beef proxies patty; rice excluded.')
    add(b,'Pepper Cream Chicken Fillet, fillet and sauce only',fillet,'Generic fried white meat and assumed cream sauce; rice excluded.')
    add(b,'Crunchy Chicken Sandwich, sandwich only',chickenburger)
    add(b,'Cheesy Classic Jolly Hotdog, sandwich only',dict(bun=55,hotdog=55,cheese=15,mayo=10,ketchup=10))
    add(b,'Peach Mango Pie',dict(pie=80,mango=20,oil=3),'Peach baked pie plus mango and oil is a coarse fried-pie proxy, not actual crust or filling.')
    add(b,'Chicken Nuggets, no dipping sauce',dict(nugget=100))
    add(b,'Jolly Crispy Fries, no dipping sauce',dict(fries=100))
    add(b,'Mashed Potato with gravy',mash)
    add(b,'Chicken Macaroni Soup',soup)
    add(b,'Chocolate Sundae',dict(icecream=100,fudge=20))
    add(b,'Cookies and Cream Sundae',dict(icecream=100,cookie=20))
    add(b,'Iced Latte, modeled milk-coffee mixture',dict(coffee=100,milk=120,water=80),'Includes assumed melted ice; sweetener excluded. Weigh liquid; no ml density assumed.')
    add(b,'Iced Mocha, modeled milk-coffee mixture',dict(coffee=100,milk=100,water=80,fudge=25),'Includes assumed melted ice; no density assumed.')
    add(b,'Iced Caramel, modeled milk-coffee mixture',dict(coffee=100,milk=100,water=80,caramel=25),'Includes assumed melted ice; no density assumed.')
    b="McDonald's"
    official='https://www.mcdonalds.com.ph/our-food'
    for name,mix in [('Hamburger',dict(bun=50,beef=45,ketchup=10,onion=5)),('Cheeseburger',dict(bun=50,beef=45,cheese=15,ketchup=10,onion=5)),('Big Mac',burger(90,20,bun_extra=0))]:
        if 'bun_extra' in mix:mix.pop('bun_extra');mix.update(bun=75,lettuce=15,onion=8,mayo=25)
        add(b,name+', sandwich only',mix,'Reference proportions only; actual patty/bun weights unknown.',official)
    add(b,'Quarter Pounder with Cheese, sandwich only',burger(85,25,onion=8,ketchup=15),'85 g cooked beef is an assumed proxy, not conversion of the raw brand weight claim.',official)
    for name,mix in [('Burger McDo',burger()),('Cheesy Burger McDo',burger(45,15)),('Crispy Chicken Sandwich',chickenburger)]:add(b,name+', sandwich only',mix)
    add(b,'Chicken McDo, edible chicken only',dict(fried_skin=100),'Rice, bones and gravy excluded.')
    add(b,'Crispy Chicken Fillet, fillet only',dict(fried=100),'Rice and gravy excluded.')
    add(b,'Crispy Chicken Fillet Ala King, fillet and sauce only',dict(fried=100,cream=25,milk=20,carrot=5,butter=5,salt=.5))
    add(b,'Mushroom Pepper Steak, patty and sauce only',dict(beef=80,gravy=50))
    add(b,'Chicken McNuggets, without dip',dict(nugget=100),'Generic nugget formulation; actual batter unknown.',official)
    add(b,'Fries, without dip',dict(fries=100))
    add(b,'Hash Browns',dict(hashbrown=100))
    add(b,'Hotcakes, without syrup or butter',dict(pancake=100))
    add(b,'Sausage McMuffin, sandwich only',dict(bun=55,pork=55,cheese=15,salt=.5),'Plain bun and cooked ground pork proxy English muffin and seasoned sausage.')
    add(b,'Sausage McMuffin with Egg, sandwich only',dict(bun=55,pork=55,cheese=15,egg=50,salt=.5),'Plain bun, ground pork and boiled egg proxy muffin, sausage and cooked egg.')
    add(b,'Cheesy Eggdesal, sandwich only',dict(bun=50,scrambled=50,cheese=15),'Plain bun proxies pandesal.')
    add(b,'Cheesy Eggdesal with Sausage, sandwich only',dict(bun=50,scrambled=50,cheese=15,pork=50,salt=.5),'Plain bun and cooked ground pork proxy bread and seasoned sausage.')
    add(b,'Plain Sundae',dict(icecream=100))
    add(b,'Hot Fudge Sundae',dict(icecream=100,fudge=20))
    add(b,'Hot Caramel Sundae',dict(icecream=100,caramel=20))
    add(b,'McFlurry with Oreo',dict(icecream=100,cookie=25),'Generic creme sandwich cookie proxies Oreo; not package-specific cookie values.')
    add(b,'McFlurry Strawberry with Oreo',dict(icecream=100,cookie=25,strawberry_topping=20),'Generic topping and cookie formulation, no official brand ratio.')
    add(b,'McCafe Coffee McFloat',dict(coffee=160,water=60,icecream=60,fudge=15),'Assumed coffee/ice/soft-serve ratio; weigh liquid, no density assumed.')
    b='KFC'
    add(b,'Original Recipe Chicken, edible chicken only',dict(fried_skin=100),'Generic flour-fried meat and skin; no bones, gravy or rice.')
    add(b,'Zinger Burger, sandwich only',dict(bun=55,fried=90,mayo=18,lettuce=10,chili=2))
    add(b,'Chicken Burger, sandwich only',dict(bun=50,nugget=60,mayo=12))
    add(b,'Flavor Shots, chicken bites only',dict(fried_skin=100),'Coarse generic breaded fried-chicken proxy; breading ratio unknown.')
    add(b,'Famous Bowl',dict(potato=100,milk=20,butter=5,nugget=70,corn=30,gravy=40,cheese=15),'Assumed mashed-potato, chicken, corn, cheese and gravy mixture.')
    add(b,'Ala King Zinger Steak, fillet and sauce only',dict(fried=110,cream=30,milk=20,carrot=10,butter=5,chili=2,salt=.5))
    add(b,'Ala King Rice Bowl',dict(rice=150,nugget=70,cream=25,milk=20,carrot=10,salt=.5))
    add(b,'Spaghetti, pasta and sauce only',spaghetti)
    add(b,'Mashed Potato with gravy',mash)
    add(b,'Buttered Corn',dict(corn=100,butter=8))
    add(b,'Mushroom Soup',dict(mushroom_soup=100,water=100),'Canned mushroom soup plus assumed 1:1 water dilution; actual restaurant concentration unknown.')
    add(b,'Zinger Double Down, sandwich only',dict(fried=180,bacon=20,cheese=25,mayo=20,chili=3),'Two fillets form the sandwich; no bun. All weights assumed.')
    add(b,'Original Recipe Double Down, sandwich only',dict(fried=180,bacon=20,cheese=25,mayo=20))
    add(b,'AM Egg Pandesal, sandwich only',dict(bun=50,scrambled=50,mayo=8),'Plain bun proxies pandesal.')
    add(b,'AM Steak Rice Bowl',dict(rice=150,beef=65,egg=40,gravy=30))
    add(b,'AM Cheese Hotdog Rice Bowl',dict(rice=150,hotdog=60,cheese=15,egg=40))
    b='Mang Inasal'
    add(b,'Chicken Inasal Paa, edible chicken only',dict(roast=100,oil=5,soy=5,sugar=3),'Whole seasoned roast proxies leg meat and skin; cut-specific composition unverified. No rice or bones.')
    add(b,'Chicken Inasal Pecho, edible chicken only',dict(chicken=90,chicken_skin=10,oil=5,soy=5,sugar=3),'Boiled white meat and roasted skin proxy grilled breast meat and skin; rice/bones excluded.')
    add(b,'Pork BBQ, meat only',dict(bbq=100),'Generic FNRI barbecue; stick, rice and dipping sauces excluded.')
    add(b,'Spicy Pork BBQ, meat only',dict(bbq=100,chili=2,oil=2))
    add(b,'Grilled Liempo, meat only',dict(liempo=100,soy=5,sugar=3),'Rice and dipping sauces excluded.')
    add(b,'Sizzling Liempo, meat and assumed sauce only',dict(liempo=100,gravy=30,onion=15),'Sauce is a generic proxy; rice excluded.')
    add(b,'Pork Sisig, dish only',dict(liempo=80,chicken=15,onion=20,mayo=15,soy=5),'Simplified belly/white-meat proxy; actual offal mix unknown. Rice excluded.')
    add(b,'Bangus Sisig, dish only',dict(milkfish=100,onion=20,mayo=15,soy=5))
    add(b,'Palabok, noodles and toppings only',palabok)
    add(b,'Lumpiang Togue, roll only',dict(springroll=100),'Generic cooked vegetable/meat egg-roll proxy; actual sprouts/wrapper ratio unknown.')
    add(b,'Extra Creamy Halo-Halo',halo)
    add(b,'Crema de Leche Halo-Halo',dict(water=150,banana=60,evap=60,condensed=25,custard=35),'Assumed ice, banana and milk/flan mixture; actual toppings and dilution vary.')
    b='Chowking'
    add(b,'Pork Chao Fan, rice only',dict(ricefried,pork=35),'Cooked rice, egg, vegetables and pork; no siomai topping.')
    add(b,'Beef Chao Fan, rice only',dict(ricefried,beef=35))
    add(b,'Spicy Chao Fan, rice only',dict(ricefried,pork=35,chili=3,oil=12))
    add(b,'Chinese-Style Fried Chicken, edible chicken only',dict(fried_skin=100,soy=3),'Rice, gravy and bones excluded.')
    add(b,'Chunky Asado Siopao',dict(siopao=100),'Generic FNRI pork-filled steamed bun, not exact asado formulation.')
    add(b,'Bola-Bola Siopao',dict(siopao=100,egg=10),'Generic pork bun plus assumed egg addition; actual filling differs.')
    add(b,'Pork Siomai, no dipping sauce',dict(pork=65,noodles=25,carrot=10,soy=5),'Cooked egg noodles proxy hydrated wrapper; exact wrapper and fat mix unknown.')
    add(b,'Beef Siomai, no dipping sauce',dict(beef=65,noodles=25,carrot=10,soy=5),'Cooked noodles proxy hydrated wrapper.')
    add(b,'Pancit Canton',dict(chowmein=100),'US Chinese chicken chow mein is a coarse cooked-noodle proxy, not PH brand analysis.')
    add(b,'Wonton Soup',dict(pork=35,noodles=25,water=180,soy=10,springonion=5,salt=.5),'Hydrated noodle proxy for wonton wrapper; broth modeled separately.')
    add(b,'Sweet and Sour Chicken, dish only',dict(sweet_sour_chicken=100),'US restaurant reference proxy; rice excluded.')
    add(b,'Sweet and Sour Pork, dish only',dict(sweet_sour_pork=100),'US restaurant reference proxy; rice excluded.')
    add(b,'Halo-Halo Supreme',dict(halo,icecream=45,custard=40))
    add(b,'Chicharap',dict(prawncrackers=100),'Generic prawn cracker reference; dipping sauce excluded.')
    add(b,'Lotus Buchi',dict(buchi=100),'Generic bean-filled sesame rice ball proxies lotus filling; not exact ingredient match.')
    add(b,'Choco Buchi',dict(buchi=85,fudge=15),'Generic sesame rice ball and chocolate filling proxy.')
    b='Ramen Kuroda'
    ramen=dict(noodles=180,belly=60,water=300,milk=30,lard=10,soy=15,springonion=5,salt=1.5)
    ramen_note='Assumed noodles, pork and broth mixture. Water/milk/fat proxy tonkotsu emulsion, not actual ingredients. Includes all modeled broth; no standard bowl weight. Seasoning and fat vary substantially.'
    add(b,'Shiro Ramen, noodles pork and broth',ramen,ramen_note)
    add(b,'Kuro Ramen, noodles pork and broth',dict(ramen,garlic=8,oil=8),ramen_note+' Garlic/oil proxies black garlic oil.')
    add(b,'Aka Ramen, noodles pork and broth',dict(ramen,chili=5,oil=8),ramen_note)
    add(b,'Shiro Chashumen, noodles extra pork and broth',dict(ramen,belly=110),ramen_note)
    add(b,'Kuro Chashumen, noodles extra pork and broth',dict(ramen,belly=110,garlic=8,oil=8),ramen_note)
    add(b,'Aka Chashumen, noodles extra pork and broth',dict(ramen,belly=110,chili=5,oil=8),ramen_note)
    add(b,'Tan Tan Men, noodles pork and broth',dict(ramen,pork=40,sesame=12,miso=15,chili=4),ramen_note)
    add(b,'Curry Ramen, noodles pork and broth',dict(ramen,curry=5,potato=30,onion=20),ramen_note)
    add(b,'Chicken Karaage, chicken only',dict(fried=100,soy=4,garlic=2),'Generic fried white meat; exact starch coating and thigh mix unknown.')
    add(b,'Chicken Nanban, chicken and sauce',dict(fried=100,mayo=25,sugar=8,soy=5,cabbage=30),'Assumed tartar-style mayonnaise and sweet sauce; rice excluded.')
    add(b,'Gyoza, no dipping sauce',dict(pork=55,noodles=30,cabbage=15,oil=5,soy=3),'Cooked noodles proxy hydrated wrapper; assumed retained pan-frying oil.')
    add(b,'Teriyaki Chicken, chicken and sauce only',dict(roast=100,soy=10,sugar=10),'Rice excluded; cooked chicken and assumed teriyaki sauce.')
    b='Ramen Nagi'
    add(b,'Butao Original King, noodles pork and broth',ramen,ramen_note+' Customizations, extra noodles and optional toppings excluded.')
    add(b,'Akao Red King, noodles pork and broth',dict(ramen,pork=35,miso=15,chili=5,garlic=5,oil=8),ramen_note+' Miso pork and chili additions assumed.')
    add(b,'Kuroo Black King, noodles pork and broth',dict(ramen,pork=35,sesame=10,garlic=8,squid=5,oil=8),ramen_note+' Squid meat is a poor nutrient proxy for small ink quantity; exact ink unavailable.')
    add(b,'Midorio Green King, noodles pork and broth',dict(ramen,basil=8,oil=12,parmesan=15),ramen_note+' Corn oil proxies olive oil; basil and parmesan additions assumed.')
    return out
