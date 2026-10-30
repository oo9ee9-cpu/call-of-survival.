"""texture strips with the uploaded vegetation appended as new layers (new file names, so no stale cache mixes old and new):
bark +plane, leaves +plane +planetwig, ground +blades +blades2 +tuft +ivy. usage: python3 -I um_strips.py <user_models dir> <assets/veg dir>"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage

U, D = sys.argv[1:3]

def bleed(im):
    """transparent texels take the colour of the nearest opaque one, so mipmaps do not darken the edges of cards"""
    a = np.array(im.convert('RGBA')).astype(np.float32)
    opaque = a[..., 3] > 127
    if opaque.all() or not opaque.any(): return Image.fromarray(a.astype(np.uint8), 'RGBA')
    _, (iy, ix) = ndimage.distance_transform_edt(~opaque, return_indices=True)
    rgb = a[..., :3][iy, ix]; out = a.copy(); out[..., :3] = np.where(opaque[..., None], a[..., :3], rgb)
    return Image.fromarray(out.astype(np.uint8), 'RGBA')

def append(strip_in, strip_out, layers, size, mode, **save):
    base = Image.open(os.path.join(D, strip_in)).convert(mode)
    w, h = base.size; assert w == size, (strip_in, base.size)
    out = Image.new(mode, (w, h + size * len(layers)))
    out.paste(base, (0, 0))
    for k, im in enumerate(layers): out.paste(im.convert(mode).resize((size, size), Image.LANCZOS), (0, h + k * size))
    out.save(os.path.join(D, strip_out), **save)
    print(strip_out, out.size, (h + size * len(layers)) // size, 'layers')

T = os.path.join(U, 'tree_animate/textures')
append('bark_albedo.jpg', 'bark_albedo_v2.jpg', [Image.open(os.path.join(T, 'Bark_diffuse.png'))], 512, 'RGB', quality=88)
append('bark_normal.jpg', 'bark_normal_v2.jpg', [Image.open(os.path.join(T, 'Bark_normal.png'))], 512, 'RGB', quality=92)
leaf = bleed(Image.open(os.path.join(T, 'Leaf_diffuse.png')).resize((512, 512), Image.LANCZOS))
twig = bleed(Image.open(os.path.join(T, 'Branch_diffuse.png')).resize((512, 512), Image.LANCZOS))
append('leaves_v2.webp', 'leaves_v3.webp', [leaf, twig], 512, 'RGBA', quality=92, method=6)

# ground cover: grass blade plates (wide, so squeezed: thinner blades), a grass tuft, ivy leaves; blade roots go to the bottom
R = os.path.join(U, 'realtime_grass/textures'); M = os.path.join(U, '3ds_max_meadow_game_environment_test/textures')
def card(path, flip, sq=256):
    im = Image.open(path).convert('RGBA')
    if flip: im = im.transpose(Image.FLIP_TOP_BOTTOM)
    return bleed(im.resize((sq, sq), Image.LANCZOS))
g = [card(os.path.join(R, 'Plate1_baseColor.png'), True), card(os.path.join(R, 'Plate3_baseColor.png'), True),
     card(os.path.join(M, 'Material_28_baseColor.png'), True), card(os.path.join(M, 'Material_27_baseColor.png'), False)]
append('ground_v3.webp', 'ground_v4.webp', g, 256, 'RGBA', quality=92, method=6)
for k, im in enumerate(g): im.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'shots', f'um_ground_{k}.png'))
