"""Read-only localhost viewer of live food CSVs. No export/build step required."""
import argparse
import hashlib
import json
import threading
import unicodedata
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from food_db_sources import DB, read_csv
from resolve_food import FoodCatalog

PAGE = Path(__file__).with_name('food_validator.html')
LOCK = threading.Lock()

def normalized(text):
    return ''.join(c for c in unicodedata.normalize('NFKD', text.casefold()) if c.isalnum())

def revision():
    return hashlib.sha256(repr([(p.name,p.stat().st_mtime_ns,p.stat().st_size) for p in sorted(DB.glob('*.csv'))]).encode()).hexdigest()[:16]

def load_live():
    # Read afresh, then reject overlapping writes rather than return a mixed view.
    before=revision()
    catalog=FoodCatalog()
    aliases={}
    for r in read_csv(DB/'aliases.csv'):aliases.setdefault(r['food_id'],[]).append(r['alias'])
    if revision()!=before:raise RuntimeError('Database update in progress. Retry shortly.')
    return catalog,aliases,before

def query(params):
    c,aliases,version=load_live()
    fid=params.get('id',[''])[0]
    if fid:
        if fid not in c.foods:raise ValueError('Unknown food ID')
        row=c.foods[fid];eid=params.get('estimate',[''])[0] or None
        resolved=None;error=None
        try:resolved=c.resolve(fid,estimate_id=eid,edible_grams=float(params.get('grams',['100'])[0]))
        except ValueError as e:error=str(e)
        return dict(version=version,food=row,aliases=aliases.get(fid,[]),resolved=resolved,error=error,
                    estimates=[r for r in c.estimates if r['food_id']==fid],
                    other_sources=[r for r in c.other if r['food_id']==fid],
                    portions=[r for r in c.portions if r['food_id']==fid])
    words=[normalized(w) for w in params.get('q',[''])[0].split() if normalized(w)]
    mode=params.get('mode',['all'])[0];matches=[]
    estimate_ids={r['food_id'] for r in c.estimates}
    for fid,row in c.foods.items():
        has_estimate=fid in estimate_ids
        if mode=='estimates' and not has_estimate:continue
        if mode=='references' and row['data_status'] in {'ESTIMATE_ONLY','NEEDS_FOOD_IDENTITY_VERIFICATION','SOURCE_CONFLICT_REVIEW_REQUIRED'}:continue
        haystack=normalized(' '.join([fid,row['name'],row['aliases'],*aliases.get(fid,[])]))
        if not all(w in haystack for w in words):continue
        matches.append(dict(food_id=fid,name=row['name'],status=row['data_status'],active=row['active'],has_estimate=has_estimate,aliases=aliases.get(fid,[])))
    offset=max(0,int(params.get('offset',['0'])[0]))
    return dict(version=version,directory=str(DB),total_foods=len(c.foods),total_matches=len(matches),offset=offset,
                results=matches[offset:offset+100])

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path=urlparse(self.path)
        try:
            if path.path=='/':return self.reply(200,PAGE.read_bytes(),'text/html; charset=utf-8')
            if path.path=='/api/revision':return self.json(200,dict(version=revision()))
            if path.path=='/api/foods':
                with LOCK:result=query(parse_qs(path.query))
                return self.json(200,result)
            self.json(404,dict(error='Not found'))
        except RuntimeError as e:self.json(503,dict(error=str(e)))
        except (ValueError,KeyError) as e:self.json(400,dict(error=str(e)))
        except Exception as e:self.json(503,dict(error='Could not read current CSVs: '+str(e)))
    def json(self,status,value):self.reply(status,json.dumps(value,allow_nan=False).encode(),'application/json; charset=utf-8')
    def reply(self,status,data,content_type):
        self.send_response(status);self.send_header('Content-Type',content_type)
        self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(data)
    def log_message(self,*args):pass

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--port',type=int,default=8765)
    args=parser.parse_args();server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    print(f'Food DB Validator: http://127.0.0.1:{args.port}\nLive CSVs: {DB}\nPress Ctrl+C to stop.',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
