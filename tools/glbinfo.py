import sys, json, struct, os
def load(path):
    b=open(path,'rb').read()
    assert b[:4]==b'glTF'
    off=12; js=None; binc=None
    while off<len(b):
        L,T=struct.unpack('<II',b[off:off+8]); c=b[off+8:off+8+L]
        if T==0x4E4F534A: js=json.loads(c)
        elif T==0x004E4942: binc=c
        off+=8+L
    return js,binc
if __name__=='__main__':
    p=sys.argv[1]; js,binc=load(p)
    print('meshes',len(js.get('meshes',[])),'nodes',len(js.get('nodes',[])),'materials',len(js.get('materials',[])),'images',len(js.get('images',[])),'anims',len(js.get('animations',[])),'skins',len(js.get('skins',[])))
    print('extUsed',js.get('extensionsUsed'), 'extReq', js.get('extensionsRequired'))
    acc=js.get('accessors',[])
    tot=0
    for m in js.get('meshes',[]):
        for pr in m['primitives']:
            n=acc[pr['attributes']['POSITION']]['count']; tri=(acc[pr['indices']]['count']//3) if 'indices' in pr else n//3; tot+=tri
            print(' mesh',m.get('name'),'verts',n,'tris',tri,'mat',pr.get('material'),'attrs',list(pr['attributes'].keys()), 'targets', len(pr.get('targets',[])))
    print('total tris',tot)
    for i,mt in enumerate(js.get('materials',[])): print(' mat',i,mt.get('name'),json.dumps(mt)[:300])
    for i,im in enumerate(js.get('images',[])):
        bv=js['bufferViews'][im['bufferView']] if 'bufferView' in im else None
        print(' img',i,im.get('name'),im.get('mimeType'),bv['byteLength'] if bv else im.get('uri'))
        if len(sys.argv)>2 and bv:
            os.makedirs(sys.argv[2],exist_ok=True); ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/ktx2':'ktx2'}.get(im.get('mimeType'),'bin')
            open(os.path.join(sys.argv[2],f'img{i}_{(im.get("name") or "")[:40].replace("/","_")}.{ext}'),'wb').write(binc[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']])
    for a in js.get('animations',[]): print(' anim',a.get('name'),len(a['channels']))
