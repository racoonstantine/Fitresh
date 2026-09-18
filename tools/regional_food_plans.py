"""Explicit assumed mixtures; identity sources are not nutrition measurements."""
from ph_restaurant_plans import INGREDIENTS as RESTAURANT_INGREDIENTS
from filipino_recipe_plans import INGREDIENTS as REGIONAL_INGREDIENT_IDS

SOURCES={
 "Gerry's Grill":'https://gerrysgrill.com/PH',
 "Max's Restaurant":'https://delivery.maxschicken.com/',
 "Giligan's":'https://delivery.giligansrestaurant.com/collections/all',
 'Ilocos':'https://app.philippines.travel/articles/intro-to-ilocos-norte',
 'Cagayan Valley':'https://www.tourism.gov.ph/article/all-the-must-try-food-when-in-region-2/',
 'Cabagan supporting source':'https://mirror.pia.gov.ph/features/2023/07/21/pansit-batil-patung-remembering-how-it-all-began',
 'Iloilo and Negros':'https://pia.gov.ph/features/culinary-gem-iloilo-the-city-of-love-and-gastronomy/',
 'Bicol':'https://www.tourism.gov.ph/article/eating-through-region-5-a-taste-of-bicol-s-distinctive-cuisine-0/',
 'Mindanao':'https://www.tourism.gov.ph/article/taste-the-philippines-through-its-halal-food-and-heritage-destinations/',
 'Cordillera':'https://www.pcaarrd.dost.gov.ph/index.php/quick-information-dispatch-qid-articles/etag-s-safety-requirements-recipes-and-packaging-tackled',
 'Visayas':'https://www.evsu.edu.ph/wp-content/uploads/2024/07/PBD-2024-07-14-1.pdf',
}
EXTRA_INGREDIENTS={
 'fried_belly':'Pork belly, fried','pigeon':'Pigeon pea seed, dried, boiled',
 'young_jackfruit':'Jackfruit fruit, unripe','crackling':'Snacks, pork skins, plain',
 'wrapper':'Spring roll wrapper, plain','glutinous':'Rice, white, glutinous, unenriched, cooked',
 'coconut_meat':'Coconut meat, mature','young_coconut':'Coconut meat, young',
 'coconut_water':'Coconut water','santol':'Santol','taro':'Taro, boiled',
 'pili':'Pili nut','turmeric':'Turmeric','lemongrass':'Lemon grass lvs, boiled',
 'tuna':'Fish, tuna, skipjack, fresh, cooked, dry heat',
 'sugarcane':'Juice, sugarcane','fish_paste':'Fish paste, anchovy',
 'rice_flour':'Rice flour','starch':'Cornstarch',
 'heart':'Chicken, heart, all classes, cooked, simmered','green_pea':'Green pea, in brine, cnd',
 'clam':'Clam, freshwater, tulya, boiled',
}

def plans():
    out=[]
    def add(group,name,mix,note='',aliases=(),kind='regional',url=None):
        out.append(dict(group=group,item=name,mixture=mix,notes=note,aliases=list(aliases),kind=kind,url=url or SOURCES[group]))
    # Regional names describe one modeled formulation, never every household recipe.
    g='Ilocos'
    add(g,'Poqui-poqui, eggplant and egg',dict(eggplant=250,egg=100,tomato=80,onion=35,garlic=6,fish_sauce=8,oil=12),aliases=['pokipoki','poqui poqui'])
    add(g,'Dinengdeng, mixed vegetables with grilled milkfish',dict(bangus_broiled=100,squash=100,sitaw=80,okra=80,malunggay=30,fish_paste=15,water=400),aliases=['inabraw with bangus'])
    add(g,'Bagnet with tomato and fish-paste relish',dict(fried_belly=180,tomato=60,onion=20,fish_paste=12,vinegar=15),'Fried pork belly proxies bagnet; specific double-fry moisture loss unknown.')
    g='Cagayan Valley'
    add(g,'Pancit batil patung, beef-proxy noodles with egg and broth',dict(miki=250,beef=70,pork_liver=25,egg=80,cabbage=40,crackling=12,soy=15,oil=8,water=160),'Cooked beef proxies carabao meat; boiled egg proxies poached egg. Broth included.',aliases=['pancit batil patong','pansit batil patung'])
    add(g,'Pancit Cabagan, pork noodles with egg and sauce',dict(miki=260,pork_lean=60,pork_liver=30,egg=45,cabbage=70,carrot=30,soy=20,oil=10,water=130),'Chicken egg proxies quail egg; cooked miki is not a measured local noodle formulation.',aliases=['pansi Cabagan','pansit Cabagan'],url=SOURCES['Cabagan supporting source'])
    add(g,'Sinanta, mixed-noodle seafood soup',dict(miki=160,rice_noodles=120,clam=60,shrimp=30,onion=25,garlic=5,fish_sauce=12,oil=8,water=350),'Cooked miki proxies flat noodles; cooked shrimp proxies dried shrimp. Annatto omitted; seafood broth modeled with retained water and fish sauce.',aliases=['Ibanag sinanta'])
    add(g,'Patupat, sticky rice with sugarcane reduction',dict(glutinous=250,sugarcane=80,sugar=25),'Cooked rice and retained juice/sugar proxy sugarcane reduction; no measured absorption or evaporation.',aliases=['Isabela patupat'])
    g='Iloilo and Negros'
    add(g,'La Paz batchoy, pork-liver noodles and cracklings',dict(miki=200,pork_lean=50,pork_liver=25,crackling=15,springonion=8,garlic=5,fish_sauce=15,water=300),'Broth and toppings included; no raw egg included.',aliases=['Lapaz batchoy','Ilonggo batchoy'])
    add(g,'Pancit Molo, pork-shrimp dumpling soup',dict(wrapper=65,ground_pork=65,shrimp=35,chicken=35,springonion=10,garlic=5,fish_sauce=12,water=400),'Spring-roll wrapper proxies wonton wrapper; no measured boiling uptake.',aliases=['Molo soup'])
    add(g,'KBL, kadyos baboy langka soup',dict(pigeon=180,pork_belly=140,young_jackfruit=140,tamarind=25,onion=30,salt=2,water=400),'Tamarind proxies batwan souring; raw young jackfruit is a cooking proxy.',aliases=['kadios baboy langka','kadyos baboy langka'])
    add(g,'Kansi, beef-shank and young-jackfruit soup',dict(beef_shank=180,young_jackfruit=130,tamarind=25,chili=5,lemongrass=8,onion=30,fish_sauce=15,water=500),'Tamarind proxies batwan; marrow contribution unquantified; bones excluded.',aliases=['cansi','Bacolod kansi'])
    g='Bicol'
    add(g,'Pinangat, taro-leaf parcels with pork',dict(taro_leaves=180,ground_pork=100,coconut_milk=160,ginger=10,garlic=5,chili=5,salt=2,water=40),'Boiled leaves proxy steamed leaves; parcel count is not a serving weight.')
    add(g,'Pinangat, taro-leaf parcels with fish',dict(taro_leaves=180,tuna=100,coconut_milk=160,ginger=10,garlic=5,chili=5,salt=2,water=40),'Cooked skipjack proxies unspecified fish; boiled leaves proxy steamed leaves.')
    add(g,'Kinalas, beef noodle soup with heart proxy',dict(miki=220,beef_shank=70,heart=25,garlic=5,fish_sauce=15,starch=8,water=350),'Beef shank proxies head meat; cooked chicken heart proxies cow/pig heart. Sauce and broth proportions unverified.',aliases=['Naga kinalas'])
    add(g,'Sinantolan, santol and coconut milk',dict(santol=180,coconut_milk=150,bagoong=15,onion=25,garlic=5,chili=4,water=25),'Source santol edible portion proxies minced prepared santol; rind preparation and pressing unmeasured.',aliases=['ginataang santol'])
    add(g,'Kinunot, tuna and malunggay variant',dict(tuna=180,malunggay=55,coconut_milk=150,chili=5,ginger=10,onion=25,salt=2),'Explicit tuna variant; do not interpret as stingray or shark analysis.',aliases=['kinunot na isda tuna'])
    add(g,'Kinaluko, taro with coconut milk',dict(taro=250,coconut_milk=100,salt=1),'Mashed cooked taro and coconut proportions assumed.')
    add(g,'Catandungan latik, rice cake with coconut-sugar topping',dict(glutinous=230,coconut_milk=70,sugar=40,water=20),'Cooked sticky rice proxies steamed cake texture; syrup mass assumed.',aliases=['Catanduanes latik','latik with banar'])
    add(g,'Pili ice cream, generic dairy variant',dict(icecream=150,pili=20),'Generic ice cream plus pili, not 1st Colonial Grill nutrition or recipe.')
    g='Mindanao'
    add(g,'Pastil, rice with chicken kagikit',dict(rice=220,chicken=70,soy=12,onion=20,garlic=5,oil=10),'Banana leaf excluded; no fixed packet mass.',aliases=['pater chicken','chicken pastil'])
    add(g,'Pastil, rice with fish kagikit',dict(rice=220,tuna=70,soy=12,onion=20,garlic=5,oil=10),'Cooked skipjack fish variant; no fixed packet mass.',aliases=['pater fish','fish pastil'])
    add(g,'Pastil, rice with beef kagikit',dict(rice=220,beef=70,soy=12,onion=20,garlic=5,oil=10),'Cooked ground beef proxies shredded meat; no fixed packet mass.',aliases=['pater beef','beef pastil'])
    add(g,'Piaparan a manok, chicken-coconut mixture',dict(chicken=180,coconut_meat=45,coconut_milk=100,springonion=25,ginger=12,turmeric=5,chili=4,salt=2,water=80),'Spring onion proxies local sakurab; no halal certification asserted.',aliases=['piaparan manok','Maranao chicken piaparan'])
    add(g,'Linigid na manok, chicken in coconut milk',dict(chicken=200,coconut_milk=170,ginger=15,turmeric=5,springonion=20,chili=4,salt=2,water=130),'Spring onion proxies sakurab in palapa; no halal certification asserted.',aliases=['linigil','linigil na manok'])
    add(g,'Beef rendang, Mindanao coconut-spice variant',dict(beef_shank=200,coconut_milk=100,coconut_meat=20,ginger=12,turmeric=5,chili=5,onion=30,garlic=6,salt=2),'Simplified dry-curry mixture; reduction not measured.')
    add(g,'Palapa, spring-onion ginger chili proxy',dict(springonion=100,ginger=35,chili=20,turmeric=5,oil=12,salt=3),'Spring onion substitutes sakurab; not an authentic measured formulation.',aliases=['Maranao palapa'])
    add(g,'Dodol, coconut sticky-rice sweet',dict(glutinous=200,coconut_milk=140,sugar=100),'Cooked glutinous rice proxies cooked rice-flour paste; retained moisture and concentration assumed.')
    g='Cordillera'
    add(g,'Pinikpikan, chicken soup with salted-pork proxy',dict(chicken=220,pork_belly=50,ginger=20,pechay=100,salt=5,water=500),'Boiled pork and salt proxy etag. Smoking, native chicken fat and processing yield unknown.',aliases=['Cordillera chicken pinikpikan'])
    g='Visayas'
    add(g,'Humba, home-style pork belly and sweet soy sauce',dict(pork_belly=200,soy=25,vinegar=25,sugar=25,garlic=8,onion=30,water=100),'Home-style simplified mixture; salted black beans omitted. Distinct from existing canned humba.')
    add(g,'Bam-i, mixed noodles with pork and shrimp',dict(miki=180,sotanghon=160,pork_lean=60,shrimp=50,cabbage=80,carrot=35,soy=20,oil=15,water=60),'Cooked miki proxies canton; cooked glass noodles retain their source preparation.',aliases=['bam i','pancit bisaya bam-i'])
    assert len(out)==30

    # Menu component-only models. No combo sizes or order weights are invented.
    soup=lambda meat:dict(**{meat:160},tamarind=20,tomato=70,onion=30,kangkong=60,okra=40,fish_sauce=12,water=450)
    chops=dict(cabbage=120,carrot=70,sitaw=60,shrimp=35,soy=12,oil=12,water=35)
    kare=lambda meat:dict(**{meat:160},peanut=45,eggplant=80,sitaw=60,pechay=60,oil=8,salt=2,water=180)
    canton=dict(noodles=230,pork_lean=50,shrimp=35,cabbage=70,carrot=35,soy=20,oil=12)
    bihon=dict(rice_noodles=240,pork_lean=50,shrimp=35,cabbage=70,carrot=35,soy=20,oil=12)
    caldereta=dict(beef_shank=180,potato=90,carrot=50,tomato_sauce=100,pork_liver=20,bell_pepper=30,oil=10,salt=2,water=60)
    lumpia=dict(wrapper=65,ground_pork=110,carrot=35,onion=20,oil=18,soy=10)
    sisig=dict(fried_belly=150,pork_liver=25,onion=45,chili=4,vinegar=12,soy=10)
    def restaurant(group,name,mix,note=''):
        add(group,name,mix,note+' Shared ingredient references are proxies; actual brand recipe and edible serving mass unverified.',kind='restaurant')
    g="Gerry's Grill"
    for name,mix,note in [
      ('Calamares',dict(squid=160,rice_flour=35,oil=20,salt=2),'Flour and oil model batter; dip excluded.'),
      ('Crispy Kangkong',dict(kangkong=130,rice_flour=35,oil=20,salt=2),'Leaves and coating only.'),
      ('Lumpiang Shanghai',lumpia,'Dip excluded.'),
      ("Tokwat Lechon Kawali",dict(tofu=150,fried_belly=100,vinegar=25,soy=15,onion=30),''),
      ('Chili Cheese Sticks',dict(wrapper=55,cheese=75,chili=20,oil=15),'Dip excluded.'),
      ('Garlic Adobo Shreds',dict(pork_lean=160,soy=18,vinegar=20,garlic=15,oil=20),'Boiled lean pork proxies dried crisp shreds.'),
      ('Sinigang na Baboy',soup('pork_belly'),''),
      ('Sinigang na Boneless Bangus',soup('milkfish'),'Broiled milkfish proxies soup fish.'),
      ('Sinigang na Hipon',soup('shrimp'),''),
      ('Nilagang Bulalo',dict(beef_shank=180,cabbage=100,potato=100,onion=30,fish_sauce=15,water=450),'Bones excluded; marrow not quantified.'),
      ('Ampalaya Guisado',dict(ampalaya=180,egg=70,tomato=60,onion=25,oil=12,salt=2),''),
      ('Chopsuey',chops,''),
      ('Ginataang Gulay',dict(squash=130,sitaw=100,eggplant=80,coconut_milk=140,onion=25,salt=2),''),
      ('Pinakbet',dict(squash=100,eggplant=100,sitaw=80,okra=70,ampalaya=50,bagoong=20,oil=12,water=50),''),
      ('Tortang Talong',dict(eggplant=180,egg=100,oil=15,salt=2),'Boiled egg proxies omelet egg.'),
      ('Inihaw na Pusit',dict(squid=180,tomato=35,onion=25,soy=12,oil=8),'Boiled squid proxies grilled squid.'),
      ('Sizzling Bangus Sisig',dict(milkfish=170,onion=40,chili=4,mayo=20,soy=10),''),
      ('Sizzling Gambas',dict(shrimp=180,tomato_sauce=45,garlic=12,oil=15,chili=4,salt=1),''),
      ('Chicken Kebab',dict(roast=180,bell_pepper=35,onion=30,soy=15,sugar=8,oil=8),'Roast chicken proxies grilled kebab.'),
      ('Garlic Mushroom Chicken',dict(chicken=170,mushroom_soup=80,garlic=15,butter=12),'Canned mushroom soup proxies sauce.'),
      ('Classic Fried Chicken',dict(fried_skin=200),'Bones and dips excluded.'),
      ('Pancit Bihon',bihon,''),('Pancit Canton',canton,''),
      ('Pancit Palabok',dict(rice_noodles=220,shrimp=35,pork=30,egg=45,crackling=15,oil=10,fish_sauce=10,water=60),'Simplified topping sauce.'),
      ('Banana con Leche',dict(banana=140,condensed=35,evap=40,water=100),'Assumed melted ice; no ml conversion.')]:restaurant(g,name,mix,note)
    assert len(out)==55
    g="Max's Restaurant"
    for name,mix,note in [
      ('Fried Chicken',dict(fried_skin=200),'Generic flour-fried chicken proxy; Max-specific skin preparation unverified.'),
      ('Crispy Pata',dict(fried_belly=180,salt=1),'Fried belly proxies hock meat and skin; bones excluded.'),
      ('All Beef Kare-Kare',kare('beef_shank'),''),
      ('Sizzling Tofu',dict(tofu=220,mayo=35,onion=35,bell_pepper=25,chili=3,soy=12,oil=10),''),
      ('Lumpiang Shanghai',lumpia,'Dip excluded.'),
      ('Chicken Sisig',dict(chicken=170,chicken_skin=25,mayo=25,onion=45,chili=4,soy=12),''),
      ('Sizzling Crispy Pork Sisig',sisig,''),
      ('Sinigang na Tiyan ng Bangus',soup('milkfish'),'Whole milkfish edible profile proxies fattier belly.'),
      ('Sinigang na Tiyan ng Bangus sa Miso',dict(soup('milkfish'),miso=25),'Whole milkfish profile proxies belly.'),
      ('Sinigang na Baboy',soup('pork_belly'),''),('Sinigang na Hipon',soup('shrimp'),''),
      ('Lechon Kawali Kare-kare',kare('fried_belly'),''),
      ('Vegetable Kare-Kare',dict(eggplant=150,sitaw=100,pechay=90,peanut=50,oil=10,salt=2,water=150),''),
      ('Seafood Kare-Kare',dict(shrimp=90,squid=90,eggplant=80,sitaw=60,peanut=45,oil=10,salt=2,water=150),'Shrimp/squid mixture proxies unspecified seafood.'),
      ('Chopsuey',chops,''),('Lechon Kawali',dict(fried_belly=180),'Dip excluded.'),
      ('Pocherong Baka',dict(beef_shank=180,banana=80,potato=80,cabbage=70,tomato_sauce=80,fish_sauce=12,water=200),''),
      ('Bulalo',dict(beef_shank=180,corn=70,cabbage=80,onion=30,fish_sauce=15,water=450),'Bones excluded; marrow unquantified.'),
      ('Beef Caldereta',caldereta,''),
      ('Sweet and Sour Fish Fillet',dict(tuna=150,rice_flour=25,oil=18,pineapple=45,tomato_sauce=35,sugar=20,vinegar=20,salt=1),'Skipjack proxy; actual fish species unverified.'),
      ('Boneless Bangus',dict(milkfish=180,oil=12,salt=1),'Broiled milkfish plus oil approximates fried preparation.'),
      ('Pinakbet',dict(squash=100,eggplant=100,sitaw=80,okra=70,ampalaya=50,bagoong=20,oil=12,water=50),''),
      ('Pancit Canton',canton,''),
      ('Pancit Bam-I',dict(noodles=130,sotanghon=130,pork=50,shrimp=35,cabbage=70,carrot=30,soy=20,oil=12),''),
      ('Arroz Caldo',dict(rice=160,chicken=70,ginger=12,garlic=6,fish_sauce=12,oil=8,water=280),'Egg topping excluded.')]:restaurant(g,name,mix,note)
    assert len(out)==80
    g="Giligan's"
    for name,mix,note in [
      ('Kare-kare Gulay',dict(eggplant=150,sitaw=100,pechay=90,peanut=50,oil=10,salt=2,water=150),''),
      ('Fried Chicken',dict(fried_skin=200),'Bones excluded.'),
      ('Bangus Salpicao',dict(milkfish=180,garlic=15,soy=15,oil=15),'Broiled fish proxies pan-fried fish.'),
      ('Beef Caldereta',caldereta,''),('Bihon Guisado',bihon,''),
      ('Binagoongang Kangkong',dict(kangkong=220,bagoong=22,onion=30,garlic=8,oil=12),''),
      ('Binagoongang Lechon Kawali',dict(fried_belly=180,bagoong=25,tomato=60,onion=30,garlic=8,oil=8),''),
      ('Binagoongang Talong',dict(eggplant=240,bagoong=25,tomato=50,onion=30,oil=18),''),
      ('Boneless Cajun Chicken',dict(roast=180,chili=3,garlic=5,oil=10,salt=2),'Simplified chili-garlic proxy for Cajun seasoning.'),
      ('Boneless Chicken BBQ',dict(roast=180,soy=18,sugar=14,ketchup=15,oil=8),'Assumed retained barbecue glaze.'),
      ('Boneless Chicken Inasal',dict(roast=180,vinegar=12,ginger=5,garlic=8,oil=12,salt=2),'No actual marinade retention measurement.'),
      ('Boneless Chicken Teriyaki',dict(roast=180,soy=22,sugar=20,ginger=5,water=20),'Assumed sweet soy glaze.'),
      ('Boneless Garlic Chicken',dict(roast=180,garlic=18,oil=12,soy=12),''),
      ('Boneless Soy Honey Chicken',dict(roast=180,soy=20,sugar=25,oil=8),'Sugar proxies honey glaze solids; not a measured honey formulation.'),
      ('Boneless Sweet and Spicy Chicken',dict(roast=180,sugar=25,chili=5,tomato_sauce=25,oil=10,soy=12),''),
      ('Bulalo Soup',dict(beef_shank=180,cabbage=100,onion=30,fish_sauce=15,water=450),'Bones excluded; marrow unquantified.'),
      ('Cajun Shrimp',dict(shrimp=180,chili=3,garlic=10,oil=18,salt=2),'Simplified chili-garlic seasoning proxy.'),
      ('Calamares Fritos',dict(squid=160,rice_flour=35,oil=20,salt=2),'Dip excluded.'),
      ('Canton Guisado',canton,''),('Chopsuey',chops,'')]:restaurant(g,name,mix,note)
    assert len(out)==100
    return out
