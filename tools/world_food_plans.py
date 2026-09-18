"""Dish identities and assumed mixtures; none are measured restaurant recipes."""
from regional_food_plans import RESTAURANT_INGREDIENTS, REGIONAL_INGREDIENT_IDS, EXTRA_INGREDIENTS as BASE_EXTRA
EXTRA_INGREDIENTS={**BASE_EXTRA,'chickpea':'Chickpea, dried, boiled','pita':'Bread, pita, white, enriched'}
SOURCES={
 'Botejyu':'https://botejyu.com.ph/',
 'Panda Express':'https://www.pandaexpress.com.ph/our-food',
 'Royal Indian Curry House by Swaadisht':'https://www.foodpanda.ph/restaurant/ue3h/royal-indian-curry-house-by-swaadisht-ue3h',
 'Mister Kabab':'https://www.misterkabab.com.ph/',
 'Banana Leaf':'https://bananaleaf.com.ph/menu/',
 'Shake Shack':'https://www.shakeshack.ph/',
 'Japanese oyakodon':'https://www.justonecookbook.com/oyakodon/',
 'Japanese gyudon':'https://www.justonecookbook.com/gyudon/',
 'Chinese mapo tofu':'https://thewoksoflife.com/ma-po-tofu-real-deal/',
 'Chinese shrimp fried rice':'https://thewoksoflife.com/shrimp-fried-rice/',
 'Indian chana masala':'https://www.indianhealthyrecipes.com/chana-masala/',
 'Indian chicken biryani':'https://www.indianhealthyrecipes.com/chicken-biryani-recipe/',
 'Middle Eastern chicken shawarma':'https://www.themediterraneandish.com/grilled-chicken-shawarma/',
 'Middle Eastern chicken kofta':'https://www.themediterraneandish.com/grilled-chicken-kofta/',
 'Singaporean':'https://www.visitsingapore.com/content/dam/desktop/global/about-singapore/traveller-information/466-tos-singaporelbb-2015-complete-small.pdf',
}

def plans():
    out=[]
    def add(group,item,mix,notes='',aliases=(),kind='restaurant',source=None):
        out.append(dict(group=group,item=item,mixture=mix,notes=notes,aliases=list(aliases),kind=kind,url=SOURCES[source or group]))
    g='Botejyu'
    add(g,'Teriyaki Chicken Salad',dict(chicken=90,egg=40,lettuce=60,tomato=30,soy=12,sugar=8,oil=5),'Assumed dressing and chicken cut; proprietary teriyaki sauce unknown.')
    add(g,'Chawanmushi Egg Custard',dict(egg=70,water=130,chicken=15,shrimp=10,soy=4),'Boiled egg proxies steamed egg; simplified stock and inclusions.')
    add(g,'Cheesy Pork Belly Tonpei',dict(belly=85,egg=80,cheese=20,mayo=12,soy=7,sugar=5,oil=5),'Boiled pork and egg proxies griddled filling and omelette.')
    add(g,'Tamagoyaki',dict(egg=150,sugar=12,soy=4,oil=5,water=15),'Boiled whole egg proxies rolled omelette; assumed retained oil.')
    g='Panda Express'
    add(g,'Orange Chicken, entree only',dict(sweet_sour_chicken=150,sugar=8,chili=1),'Generic Chinese sweet-sour chicken is a coarse orange-sauce/breading proxy; citrus and proprietary sauce unmodeled.')
    add(g,'Kung Pao Chicken, entree only',dict(chicken=120,peanut=20,bell_pepper=35,onion=20,soy=12,chili=3,oil=10,sugar=4),'Assumed peanut, vegetables, sauce and oil; chicken white meat proxies unspecified cut.')
    add(g,'Chow Mein, noodles only',dict(noodles=200,cabbage=35,onion=20,soy=12,oil=12),'Egg noodles proxy wheat noodles; celery omitted, oil and sauce assumed.')
    add(g,'Fried Rice, rice only',dict(rice=220,egg=30,green_pea=15,carrot=20,springonion=5,soy=12,oil=10))
    g='Royal Indian Curry House by Swaadisht'
    add(g,'Murg Makhani Butter Chicken, curry only',dict(chicken=150,tomatosauce=80,cream=45,butter=18,onion=20,curry=4,salt=1),'Muntinlupa listing; boiled chicken proxies tandoori chicken; spice blend and dairy ratio assumed.',aliases=['RICH butter chicken'])
    add(g,'Chicken Biryani, rice and boneless chicken',dict(rice=220,chicken=120,onion=35,butter=15,curry=4,salt=1),'Muntinlupa listing; well-milled cooked rice proxies basmati; yogurt and aromatics simplified.',aliases=['RICH chicken biryani'])
    add(g,'Egg Biryani, rice and egg',dict(rice=220,egg=100,onion=35,butter=14,curry=4,salt=1),'Muntinlupa listing; generic cooked rice proxies basmati.',aliases=['RICH egg biryani'])
    add(g,'Prawn Curry, curry only',dict(shrimp=150,tomatosauce=80,onion=40,cream=25,oil=12,curry=4,salt=1),'Muntinlupa listing; assumed masala gravy with dairy; actual formulation unknown.',aliases=['RICH prawn curry'])
    g='Mister Kabab'
    add(g,'Beef Special Chelo Kabab, modeled rice and beef',dict(rice=220,beef=150,tomato=45,onion=20,butter=12,salt=1),'Cooked ground beef proxies mixed kebab cuts; includes assumed rice, excludes separate garlic sauce.',aliases=['Mister Kebab beef chelo'])
    add(g,'Chicken Special Chelo Kabab, modeled rice and chicken',dict(rice=220,chicken=150,tomato=45,onion=20,butter=12,oil=6,salt=1),'Chicken cut and cooked rice proxies; excludes separate garlic sauce.',aliases=['Mister Kebab chicken chelo'])
    add(g,'Shawarma Sandwich',dict(pita=65,beef=100,tomato=25,onion=15,mayo=18,garlic=3),'Assumed beef filling; ground beef, pita and garlic mayonnaise are coarse meat, bread and sauce proxies.',aliases=['Mister Kebab shawarma'])
    add(g,'Chicken Barbecue, edible chicken only',dict(chicken=150,oil=10,onion=15,garlic=4,salt=1),'Assumed retained marinade; no rice, bones, skewers or dipping sauce.')
    g='Banana Leaf'
    add(g,'Malayan Seafood Laksa',dict(rice_noodles=180,shrimp=45,squid=35,coconut_milk=100,water=160,curry=5,fish_sauce=10,oil=7),'Malaysian/Southeast Asian menu identity; rice noodles proxy unspecified noodles; broth included.')
    add(g,'Hainanese Chicken Set Meal, modeled chicken and rice',dict(chicken=140,rice=220,oil=10,ginger=5,garlic=4,salt=1),'Assumed chicken and flavored rice only; separate soup and dipping sauces excluded.')
    add(g,'Malayan Chicken Curry with Potatoes',dict(chicken=140,potato=100,coconut_milk=100,onion=30,curry=6,oil=8,salt=1),'Curry sauce and retained oil assumed; rice excluded.')
    add(g,'Penang Char Kway Teow',dict(rice_noodles=220,shrimp=40,egg=50,soy=15,oil=15,springonion=8),'Malaysian Penang identity, not labeled Singaporean; simplified seafood-egg version, sausage and cockles unmodeled.')
    g='Shake Shack'
    add(g,'ShackBurger, single sandwich',dict(bun=60,beef=90,cheese=20,lettuce=10,tomato=20,mayo=18),'Generic bun, cooked ground beef, processed cheese and mayonnaise proxy potato bun, patty, cheese and ShackSauce.')
    add(g,'SmokeShack, single sandwich',dict(bun=60,beef=90,cheese=20,bacon=20,chili=8,mayo=18),'Chili proxies cherry peppers; generic bun, bacon and sauce proxies; no official patty weight assumed.')
    add(g,'Hamburger, single sandwich with lettuce and tomato',dict(bun=60,beef=90,lettuce=10,tomato=20),'Specified topping variant; generic bun and beef proxies; sauces excluded.')
    add(g,'Grilled Cheese, sandwich only',dict(bun=60,cheese=40,butter=12),'Generic bun and processed cheddar proxy potato bun and proprietary cheese.')
    add('Japanese','Oyakodon, chicken and egg over rice',dict(rice=200,chicken=100,egg=60,onion=35,soy=12,sugar=8,water=45),'Boiled chicken/egg proxies simmered topping; water-soy mixture proxies dashi; mirin/sake omitted.',kind='dish',source='Japanese oyakodon',aliases=['oyako don','Japanese chicken egg rice bowl'])
    add('Japanese','Gyudon, beef and onion over rice',dict(rice=200,beef=100,onion=50,soy=12,sugar=8,water=40),'Cooked ground beef is a coarse sliced-beef proxy; dashi and mirin simplified.',kind='dish',source='Japanese gyudon',aliases=['gyu don','Japanese beef rice bowl'])
    add('Chinese','Mapo tofu, pork version, no rice',dict(tofu=220,pork=70,miso=18,chili=5,oil=18,garlic=5,ginger=5,water=80,soy=8),'Miso/chili/soy proxy fermented spicy bean sauce; pork and tofu preparation differs; no Sichuan pepper contribution.',kind='dish',source='Chinese mapo tofu',aliases=['ma po tofu','mapo tokwa'])
    add('Chinese','Shrimp and egg fried rice',dict(rice=220,shrimp=70,egg=50,green_pea=20,soy=12,oil=12,springonion=5),'Cooked rice and boiled shrimp/egg proxy wok preparation.',kind='dish',source='Chinese shrimp fried rice',aliases=['sinangag na may hipon at itlog'])
    add('Indian','Chana masala, chickpea curry, no rice',dict(chickpea=220,tomato=80,onion=45,oil=12,curry=5,garlic=5,water=65,salt=1),'Generic curry powder proxies spice blend; assumed retained sauce mass.',kind='dish',source='Indian chana masala',aliases=['chole chickpea curry','garbanzos curry'])
    add('Indian','Chicken biryani, modeled boneless rice mixture',dict(rice=240,chicken=130,onion=45,tomato=30,butter=15,curry=5,salt=1),'Cooked generic rice proxies basmati; yogurt/spice blend simplified and no bone weight included.',kind='dish',source='Indian chicken biryani',aliases=['chicken biriyani'])
    add('Middle Eastern','Chicken shawarma, meat only',dict(chicken=180,oil=12,garlic=5,curry=3,salt=1),'Cooked white meat and curry powder proxy mixed cuts and shawarma spices; no wrap or sauce.',kind='dish',source='Middle Eastern chicken shawarma',aliases=['chicken shawerma meat'])
    add('Middle Eastern','Chicken kofta kebab, meat only',dict(chicken=180,onion=30,garlic=5,oil=10,curry=3,salt=1),'Cooked white meat proxies minced chicken; herbs and spice blend simplified; no bread, rice or sauce.',kind='dish',source='Middle Eastern chicken kofta',aliases=['chicken kafta','chicken kabab'])
    add('Singaporean','Hainanese chicken rice, modeled boneless mixture',dict(rice=220,chicken=130,oil=12,ginger=6,garlic=5,salt=1),'Assumed rice and chicken only; stock simplified; separate soup and dipping sauces excluded.',kind='dish',aliases=['Singapore chicken rice'])
    add('Singaporean','Laksa, shrimp coconut noodle soup',dict(noodles=180,shrimp=60,coconut_milk=120,water=180,curry=5,fish_sauce=10,oil=7),'Simplified shrimp variant; fishcake and cockles omitted; includes broth, no household bowl weight.',kind='dish',aliases=['Singapore laksa'])
    assert len(out)==34
    return out
