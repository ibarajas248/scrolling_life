import io
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image
from image_store import ImageStore

def picture(color='red', size=(800,600)):
    out=io.BytesIO()
    Image.new('RGB',size,color).save(out,'PNG')
    return out.getvalue()

class StoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.store=ImageStore(self.tmp.name)
    def tearDown(self):
        self.tmp.cleanup()
    def test_compress_and_restart(self):
        row=self.store.add(picture(size=(2400,1800)),.3,2100)
        path=self.store.images/(row['id']+'.webp')
        with Image.open(path) as image:
            self.assertEqual(image.format,'WEBP')
            self.assertLessEqual(max(image.size),1600)
        self.assertLessEqual(path.stat().st_size,180000)
        self.store.move(row['id'],.8,8000)
        restored=ImageStore(self.tmp.name).snapshot()['images'][0]
        self.assertEqual((restored['x'],restored['y']),(.8,8000))
    def test_oldest_deleted_even_if_moved(self):
        raw=picture()
        first=self.store.add(raw,0,0)
        second=self.store.add(raw,0,100)
        self.store.move(first['id'],.4,400)
        self.store.limit=first['bytes']*2
        third=self.store.add(raw,0,200)
        self.assertEqual([r['id'] for r in self.store.snapshot()['images']],[second['id'],third['id']])
        self.assertFalse((self.store.images/(first['id']+'.webp')).exists())
        self.assertLessEqual(sum(p.stat().st_size for p in self.store.images.iterdir()),self.store.limit)
    def test_invalid_upload_does_not_evict(self):
        first=self.store.add(picture(),0,0)
        self.store.limit=first['bytes']
        with self.assertRaises(ValueError): self.store.add(b'not image',0,0)
        with self.assertRaises(ValueError): self.store.add(picture(),float('nan'),0)
        with self.assertRaises(ValueError): self.store.move(first['id'],0,-1)
        self.assertEqual(len(self.store.snapshot()['images']),1)
    def test_delete_requires_own_upload_token(self):
        first=self.store.add(picture(),0,0)
        other=self.store.add(picture(),0,100)
        for token in (None, '', other['deleteToken'], 'x'*43):
            with self.assertRaises(PermissionError):
                self.store.delete(first['id'],token)
        self.assertEqual(len(self.store.snapshot()['images']),2)
        restarted=ImageStore(self.tmp.name)
        restarted.delete(first['id'],first['deleteToken'])
        self.assertEqual([r['id'] for r in restarted.snapshot()['images']],[other['id']])
        self.assertFalse((self.store.images/(first['id']+'.webp')).exists())
    def test_ownership_secrets_are_not_public(self):
        row=self.store.add(picture(),0,0)
        self.assertNotIn('delete_hash',row)
        moved=self.store.move(row['id'],.5,200)
        for public in (moved,self.store.snapshot()['images'][0]):
            self.assertNotIn('deleteToken',public)
            self.assertNotIn('delete_hash',public)
        self.assertNotIn(row['deleteToken'],self.store.index.read_text())
        self.store.delete(row['id'],row['deleteToken'])
    def test_legacy_upload_cannot_be_claimed(self):
        row=self.store.add(picture(),0,0)
        rows=self.store._read()
        del rows[0]['delete_hash']
        self.store._write(rows)
        with self.assertRaises(PermissionError):
            self.store.delete(row['id'],row['deleteToken'])
        self.assertEqual(len(self.store.snapshot()['images']),1)
    def test_concurrent_writes_and_quota(self):
        raw=picture()
        sample=self.store.add(raw,0,0)
        self.store.limit=sample['bytes']*3
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(lambda i:self.store.add(raw,.5,i*100),range(10)))
        self.assertEqual(len(self.store.snapshot()['images']),3)
        self.assertEqual(len(list(self.store.images.glob('*.webp'))),3)
        self.assertLessEqual(sum(p.stat().st_size for p in self.store.images.iterdir()),self.store.limit)

if __name__=='__main__': unittest.main()
