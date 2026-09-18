"""Inspect remaining source references for a Philippine restaurant/sweets expansion."""
import json,re
from collections import Counter
from food_db_sources import *
from expand_food_db import normal,numeric

FNRI_PICKS='A029 D056 D057 D090 D091 D281 D282 D283 D284 D286 D287 D289 D290 D292 D295 E098 E106 F002 F098 F217 F218 F230 F236 F247 F248 F251 F252 F256 F260 F262 F264 F271 G230 M001 M003 M007 M008 M010 M011 M017 M018 M024 M030 M032 M034 M036 M047 M050 M015'.split()

def candidates():
    fnri,usda=load_sources();before=read_csv(DB/'foods.csv')
    used={r['source_food_id'] for r in before+read_csv(DB/'other_food_values.csv')}
    names={normal(r['name']) for r in before}
    out=[]
    for code,r in usda.items():
        name=r['description'];cat=r['food_category_id']
        if code in used or normal(name) in names:continue
        if cat not in ['18','19','21','23','25','1','6','20','4']:continue
        leads=['Cake','Cakes','Candies','Desserts','Ice creams','Ice cream','Frozen yogurts','Frozen novelties','Sherbet','Syrups','Syrup','Jams','Jellies','Marmalade','Chocolate-flavored hazelnut spread','Puddings','Pie fillings','Toppings','Frostings','Honey','Molasses','Sweeteners','Baking chocolate','Cookies','Cookie','Crackers','Doughnuts','Danish pastry','Croissants','Pie','Pies','Cream puff','Cream puff shell','Pastry','Pastries','Strudel','Sweet rolls','Bread','Rolls','Muffins','Pancakes','Waffles','Waffle','French toast','Biscuits','Snacks','Pretzels','Cheese','Cream','Creams','Salad dressing','Salad Dressing','Butter','Margarine','Margarine-like','Vegetable oil-butter spread','Sandwich spread','Soup','Sauce','Fast foods','Restaurant']
        if name.split(',')[0] not in leads:continue
        if re.search(r'\b[A-Z]{3,}\b',name) or re.search(r'babyfood|infant|toddler|alaska native|school lunch|mexican|latino|salvador|pupusa|tamale|refried|general tso|buffalo',name,re.I):continue
        if re.search(r'formula|meal replacement|weight loss|dietary|protein supplement|dry mix|dry,|dry form|unprepared|powder|dehydrated',name,re.I):continue
        values={f:r['nutrients'].get(nid,{}).get('amount','') for f,(_,nid,_) in FIELDS.items()}
        if not all(numeric(values[f]) for f in list(FIELDS)[:4]):continue
        if values['sugar_g_100g'] and float(values['sugar_g_100g'])>float(values['carbs_g_100g'])+.1:continue
        if cat=='1' and not re.search(r'cheese|cream|dessert|pudding',name,re.I):continue
        if cat=='4' and not re.search(r'spread|dressing|butter|margarine',name,re.I):continue
        out.append(dict(source_food_id=code,name=name,category=cat))
    return fnri,usda,out

if __name__=='__main__':
    f,u,out=candidates();print(Counter(r['category'] for r in out));print('\n'.join(r['source_food_id']+' '+r['category']+' '+r['name'] for r in out))
