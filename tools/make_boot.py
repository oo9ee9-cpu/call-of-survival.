"""cut the rendered frames into the two films of the loading screen:
  intro.mp4  the warp (2.5 s) into the white flash, then the first second of the fall coming out of the white
  loop.mp4   the fall from its second 1 to 15; its last second is cross-faded into frames 0..1, so it loops without a seam
and the stills: poster.jpg (the first dark frame, shown until the film starts) and still.jpg (the fall, for data saver)
usage: python3 -I make_boot.py <build/boot> <assets/boot> [width] [crf]"""
import sys, os, subprocess, shutil
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]; W = int(sys.argv[3]) if len(sys.argv) > 3 else 1280; CRF = sys.argv[4] if len(sys.argv) > 4 else '22'
H = W * 9 // 16; FPS = 24; LOOP = 14 * FPS; FADE = 24
os.makedirs(dst, exist_ok=True)
warp = sorted(os.listdir(os.path.join(src, 'warp'))); fall = sorted(os.listdir(os.path.join(src, 'fall')))
assert len(fall) >= LOOP + FADE, len(fall)
ld = lambda d, f: Image.open(os.path.join(src, d, f)).convert('RGB').resize((W, H), Image.LANCZOS)
tmp = os.path.join(src, 'cut'); shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp + '/intro'); os.makedirs(tmp + '/loop')
k = 0
for f in warp: ld('warp', f).save(f'{tmp}/intro/{k:04d}.png'); k += 1
white = Image.new('RGB', (W, H), (255, 251, 242))
for j in range(FADE):
    a = (1 - (j + 1) / FADE) ** 1.6                       # out of the white, fast at first
    Image.blend(ld('fall', fall[j]), white, a).save(f'{tmp}/intro/{k:04d}.png'); k += 1
for j in range(FADE, LOOP + FADE):
    im = ld('fall', fall[j])
    if j >= LOOP:                                          # the last second dissolves into the first
        a = (j - LOOP + 0.5) / FADE; im = Image.blend(im, ld('fall', fall[j - LOOP]), a)
    im.save(f'{tmp}/loop/{j - FADE:04d}.png')
enc = ['-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.0', '-movflags', '+faststart', '-an']
vp9 = ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', str(int(CRF) + 11), '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', '-an']
for name in ('intro', 'loop'):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(FPS), '-i', f'{tmp}/{name}/%04d.png'] + enc + [os.path.join(dst, name + '.mp4')], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(FPS), '-i', f'{tmp}/{name}/%04d.png'] + vp9 + [os.path.join(dst, name + '.webm')], check=True)
ld('warp', warp[10]).save(os.path.join(dst, 'poster.jpg'), quality=80)
ld('fall', fall[120]).save(os.path.join(dst, 'still.jpg'), quality=84)
for f in sorted(os.listdir(dst)): print(f, os.path.getsize(os.path.join(dst, f)))
