# Regenerates the 1024x500 Play / F-Droid feature graphic from the repo's own
# assets (website hero photo, logo, Fredoka, two phone screenshots).
#   python3 -m venv /tmp/v && /tmp/v/bin/pip install pillow && /tmp/v/bin/python scripts/make-feature-graphic.py
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
K=2                      # work at 2x, then downsample
W,H=1024*K,500*K
# background: crop of the website hero photo, flipped so the coral sits behind the phones
bg=Image.open(f"{R}/assets/hero-bg.jpg").convert("RGB").transpose(Image.FLIP_LEFT_RIGHT)
bw,bh=bg.size; cw=int(bh*W/H); bg=bg.crop((bw-cw,0,bw,bh)).resize((W,H),Image.LANCZOS)
# darken the text side for legibility
shade=Image.new("L",(W,H))
sd=ImageDraw.Draw(shade)
for x in range(W):
    a=int(150*max(0,1-x/(W*0.62))**1.2)
    sd.line([(x,0),(x,H)],fill=a)
bg=Image.composite(Image.new("RGB",(W,H),(3,97,120)),bg,shade)
img=bg.convert("RGBA")
# phones
def phone(path,width,crop_top=76):
    s=Image.open(path).convert("RGB"); s=s.crop((0,crop_top,s.width,s.height))
    h=int(s.height*width/s.width); s=s.resize((width,h),Image.LANCZOS)
    r=int(34*K)
    m=Image.new("L",s.size,0); ImageDraw.Draw(m).rounded_rectangle((0,0)+s.size,r,fill=255)
    out=Image.new("RGBA",(s.width+8*K,s.height+8*K),(0,0,0,0))
    ring=Image.new("RGBA",out.size,(0,0,0,0))
    ImageDraw.Draw(ring).rounded_rectangle((0,0)+out.size,r+4*K,fill=(250,250,250,255))
    out=Image.alpha_composite(out,ring); out.paste(s,(4*K,4*K),m)
    return out
def drop(base,ph,xy,blur=18,off=(0,10),alpha=120):
    sh=Image.new("RGBA",base.size,(0,0,0,0))
    a=ph.split()[3].point(lambda v:alpha if v>0 else 0)
    sh.paste((0,25,35,255),(xy[0]+off[0]*K,xy[1]+off[1]*K),a)
    sh=sh.filter(ImageFilter.GaussianBlur(blur*K/2))
    base=Image.alpha_composite(base,sh); base.alpha_composite(ph,xy); return base
shots=f"{R}/fastlane/metadata/android/en-US/images/phoneScreenshots"
p2=phone(f"{shots}/3.jpg",250*K)     # species card
p1=phone(f"{shots}/1.jpg",250*K)     # menu
img=drop(img,p2,(int(772*K),int(80*K)))
img=drop(img,p1,(int(600*K),int(150*K)))
# text block
d=ImageDraw.Draw(img)
liz=Image.open(f"{R}/assets/gote.png").convert("RGBA"); lh=int(150*K); liz=liz.resize((int(liz.width*lh/liz.height),lh),Image.LANCZOS)
img.alpha_composite(liz,(int(56*K),int(98*K)))
f=ImageFont.truetype(f"{R}/assets/fonts/Fredoka-SemiBold.ttf",int(150*K))
d.text((int(56*K)+liz.width+int(26*K),int(104*K)),"gote",font=f,fill=(255,255,255,255))
f2=ImageFont.truetype(f"{R}/assets/fonts/Fredoka-SemiBold.ttf",int(40*K))
d.text((int(60*K),int(290*K)),"Learn the species you see",font=f2,fill=(255,255,255,235))
f3=ImageFont.truetype(f"{R}/assets/fonts/Fredoka-SemiBold.ttf",int(26*K))
d.text((int(60*K),int(346*K)),"Quiz rounds from iNaturalist photos",font=f3,fill=(214,240,247,230))
out=img.convert("RGB").resize((1024,500),Image.LANCZOS)
out.save(f"{R}/fastlane/metadata/android/en-US/images/featureGraphic.png",optimize=True)
print(out.size)
