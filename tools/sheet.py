import sys
from PIL import Image, ImageDraw
out=sys.argv[1]; files=sys.argv[2:]
T=256; cols=4; rows=(len(files)+cols-1)//cols
S=Image.new('RGB',(cols*T,rows*(T+16)),(30,30,30)); d=ImageDraw.Draw(S)
for i,f in enumerate(files):
    try:
        im=Image.open(f); im.load()
        if im.mode in ('P','LA','RGBA','L','I;16','I'):
            im=im.convert('RGBA'); bg=Image.new('RGBA',im.size,(255,0,255,255)); bg.alpha_composite(im); im=bg
        im=im.convert('RGB'); w,h=im.size; im=im.resize((T,T))
    except Exception as e:
        im=Image.new('RGB',(T,T),(90,0,0)); w=h=0
    x=(i%cols)*T; y=(i//cols)*(T+16); S.paste(im,(x,y+16)); d.text((x+3,y+2),f.split('/')[-1][:30]+f' {w}x{h}',fill=(255,255,0))
S.save(out, quality=88)
