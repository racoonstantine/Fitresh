"""Exercise live HTTP queries, explicit estimates, and on-disk updates."""
import csv,json,shutil,tempfile,threading,unittest
from pathlib import Path
from urllib.request import urlopen
import food_validator as app

class ValidatorTest(unittest.TestCase):
    def test_live_read_only_http(self):
        original=app.DB
        with tempfile.TemporaryDirectory() as temp:
            app.DB=Path(temp)
            for p in original.glob('*.csv'):shutil.copyfile(p,app.DB/p.name)
            before={p.name:p.read_bytes() for p in app.DB.glob('*.csv')}
            server=app.ThreadingHTTPServer(('127.0.0.1',0),app.Handler)
            thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
            base='http://127.0.0.1:'+str(server.server_port)
            def get(path):
                with urlopen(base+path) as response:
                    self.assertEqual(response.headers['Cache-Control'],'no-store')
                    return json.load(response)
            try:
                for term in ['manginasal','KFC','sayote','Botejyu','laksa']:
                    self.assertGreater(get('/api/foods?q='+term)['total_matches'],0,term)
                row=get('/api/foods?q=KFC')['results'][0]
                detail=get('/api/foods?id='+row['food_id'])
                self.assertEqual(detail['resolved']['label'],'Unavailable')
                eid=detail['estimates'][0]['estimate_id']
                selected=get('/api/foods?id='+row['food_id']+'&estimate='+eid)
                self.assertEqual(selected['resolved']['label'],'Estimated')
                self.assertEqual(selected['resolved']['confidence']['level'],'Low')
                for name,data in before.items():self.assertEqual((app.DB/name).read_bytes(),data)
                previous=get('/api/revision')['version']
                with (app.DB/'aliases.csv').open('a',encoding='utf-8',newline='') as f:
                    fields=list(app.read_csv(app.DB/'aliases.csv')[0])
                    writer=csv.DictWriter(f,fieldnames=fields)
                    writer.writerow(dict(food_id=row['food_id'],alias='live_reload_test_8765'))
                self.assertNotEqual(previous,get('/api/revision')['version'])
                self.assertEqual(get('/api/foods?q=live_reload_test_8765')['results'][0]['food_id'],row['food_id'])
            finally:
                server.shutdown();server.server_close();thread.join();app.DB=original

if __name__=='__main__':unittest.main()
