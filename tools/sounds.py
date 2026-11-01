#!/usr/bin/env python3
"""Call of Survival: Front - every sound, synthesised (numpy + scipy), written as OGG Vorbis through ffmpeg.
usage: python3 sounds.py <project_dir>"""
import sys, os, subprocess, tempfile, wave
import numpy as np
from scipy import signal

PROJ = sys.argv[1]
OUT = PROJ + '/sounds'; os.makedirs(OUT, exist_ok=True)
SR = 44100
RS = np.random.RandomState(1234)

def t_(d): return np.arange(int(d * SR)) / SR
def noise(d, rs=RS): return rs.randn(int(d * SR))
def sos(kind, f, order=4):
    f = np.atleast_1d(f) / (SR / 2); f = np.clip(f, 1e-4, 0.999)
    return signal.butter(order, f if len(f) > 1 else f[0], btype=kind, output='sos')
def lp(x, f, o=4): return signal.sosfilt(sos('lowpass', f, o), x)
def hp(x, f, o=4): return signal.sosfilt(sos('highpass', f, o), x)
def bp(x, a, b, o=3): return signal.sosfilt(sos('bandpass', [a, b], o), x)
def decay(d, tau, attack=0.0005):
    t = t_(d); e = np.exp(-t / tau)
    if attack > 0: e *= np.clip(t / attack, 0, 1)
    return e
def pad(x, d):
    n = int(d * SR)
    return np.pad(x, (0, max(0, n - len(x))))[:n] if len(x) < n else x[:n]
def place(dst, x, at):
    i = int(at * SR); n = min(len(x), len(dst) - i)
    if n > 0: dst[i:i + n] += x[:n]
    return dst
def ring(freqs, d, taus, amps):
    t = t_(d); out = np.zeros_like(t)
    for f, tau, a in zip(freqs, taus, amps): out += a * np.sin(2 * np.pi * f * t + RS.uniform(0, 6.28)) * np.exp(-t / tau)
    return out
def sweep(f0, f1, d, tau):
    t = t_(d); f = f0 * (f1 / f0) ** (t / d); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / tau)
def ir(t60, d=None, bright=6000, seed=0):
    rs = np.random.RandomState(seed); d = d or t60 * 1.2; t = t_(d)
    n = rs.randn(len(t)) * np.exp(-6.9 * t / t60)
    return lp(n, bright, 2)
def reverb(x, t60, wet, bright=5000, seed=0):
    r = signal.fftconvolve(x, ir(t60, None, bright, seed))[:len(x) + int(t60 * 1.2 * SR)]
    r = r / (np.abs(r).max() + 1e-9) * (np.abs(x).max() + 1e-9)
    y = np.pad(x, (0, len(r) - len(x)))
    return y * (1 - wet * 0.3) + r * wet
def sat(x, k=2.0): return np.tanh(x * k) / np.tanh(k)
def norm(x, peak=0.95):
    m = np.abs(x).max(); return x * (peak / m) if m > 0 else x
def fade(x, a=0.002, b=0.05):
    n = len(x); ia = int(a * SR); ib = int(b * SR)
    if ia: x[:ia] *= np.linspace(0, 1, ia)
    if ib: x[-ib:] *= np.linspace(1, 0, ib)
    return x
def crackle(d, rate, dur=0.003, lo=800, hi=6000, seed=0):
    rs = np.random.RandomState(seed); out = np.zeros(int(d * SR))
    n = int(d * rate)
    for k in range(n):
        g = bp(rs.randn(int(dur * SR) + 8), lo, hi, 2) * rs.uniform(0.2, 1.0) * decay(dur + 8 / SR, dur * 0.3)[:int(dur * SR) + 8]
        place(out, g, rs.uniform(0, d - dur))
    return out
def loopify(x, xf=1.0):
    """crossfade the tail into the head so the file loops without a click"""
    n = int(xf * SR); head = x[:n].copy(); tail = x[-n:].copy()
    w = np.linspace(0, 1, n)
    y = x[n:].copy(); y[-n:] = tail * (1 - w) + head * w
    return y
def save(name, x, stereo=False, q=4):
    x = np.asarray(x, np.float64)
    if stereo and x.ndim == 1: x = np.stack([x, x], 1)
    x = np.clip(x, -1, 1)
    pcm = (x * 32767).astype('<i2')
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f: tmp = f.name
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(2 if stereo else 1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-c:a', 'libvorbis', '-q:a', str(q), OUT + '/' + name + '.ogg'], check=True)
    os.unlink(tmp)

# ------------------------------------------------------------------ AK
def ak_shot(seed):
    rs = np.random.RandomState(seed); D = 1.6; out = np.zeros(int(D * SR))
    crack = hp(rs.randn(int(0.004 * SR)), 2500, 2) * decay(0.004, 0.0009, 0.00005)[:int(0.004 * SR)]
    place(out, crack * 1.4, 0.0)
    blast = lp(rs.randn(int(0.25 * SR)), 2400, 2) * decay(0.25, 0.045, 0.0003)
    blast += lp(rs.randn(int(0.25 * SR)), 600, 2) * decay(0.25, 0.07, 0.0008) * 1.2
    place(out, blast * 1.3, 0.0005)
    thump = sweep(140 * rs.uniform(0.9, 1.1), 45, 0.25, 0.07)
    place(out, thump * 1.1, 0.0)
    mech = bp(rs.randn(int(0.03 * SR)), 1500, 6000, 2) * decay(0.03, 0.006) + ring([2300, 3650, 5200], 0.06, [0.02, 0.012, 0.008], [0.2, 0.15, 0.1])[:int(0.03 * SR)]
    place(out, mech * 0.35, 0.016 + rs.uniform(0, 0.004))
    for dl, g in ((0.009, 0.45), (0.017, 0.3), (0.031, 0.22), (0.052, 0.15)):
        place(out, lp(blast, 1800, 2) * g, dl + rs.uniform(-0.002, 0.002))
    tail = lp(rs.randn(int(1.4 * SR)), 900, 2) * decay(1.4, 0.32, 0.03) * 0.35
    tail += lp(rs.randn(int(1.4 * SR)), 220, 2) * decay(1.4, 0.45, 0.05) * 0.5
    place(out, tail, 0.02)
    out = sat(out * 1.6, 2.2)
    return fade(norm(out, 0.97), 0.0, 0.2)
for i in range(3): save('ak_shot_%d' % (i + 1), ak_shot(10 + i))
def ak_tail():
    D = 3.0; out = np.zeros(int(D * SR))
    for at, g, f in ((0.12, 0.9, 900), (0.38, 0.6, 700), (0.85, 0.45, 500), (1.4, 0.25, 400)):
        r = lp(RS.randn(int(1.2 * SR)), f, 2) * decay(1.2, 0.18, 0.02) * g
        place(out, r, at)
    out += lp(RS.randn(len(out)), 160, 2) * decay(D, 0.9, 0.1) * 0.5
    return fade(norm(out, 0.8), 0.01, 0.4)
save('ak_tail', ak_tail())
def click(f=3000, d=0.025, g=1.0, seed=0):
    rs = np.random.RandomState(seed)
    c = hp(rs.randn(int(d * SR)), f * 0.5, 2) * decay(d, d * 0.12, 0.0001)
    return c * g + ring([f, f * 1.47, f * 2.13], d, [d * 0.3, d * 0.2, d * 0.15], [0.3, 0.2, 0.1])
def scrape(d, lo=800, hi=5000, seed=0):
    rs = np.random.RandomState(seed); x = bp(rs.randn(int(d * SR)), lo, hi, 2)
    am = 0.5 + 0.5 * np.abs(signal.sosfilt(sos('lowpass', 60, 2), rs.randn(len(x)) * 8))
    return x * am * np.sin(np.linspace(0, np.pi, len(x))) ** 0.6
save('ak_dry', fade(norm(pad(click(3800, 0.03, 1.0, 1), 0.2) + pad(click(1800, 0.04, 0.4, 2), 0.2), 0.7)))
x = np.zeros(int(0.7 * SR)); place(x, click(2600, 0.03, 1, 3), 0.0); place(x, scrape(0.22, 600, 4000, 4) * 0.5, 0.05); place(x, click(4200, 0.05, 0.5, 5) * 0.6, 0.3)
save('ak_mag_out', fade(norm(reverb(x, 0.25, 0.15), 0.8)))
x = np.zeros(int(0.8 * SR)); place(x, scrape(0.18, 700, 4500, 6) * 0.5, 0.0)
th = lp(RS.randn(int(0.08 * SR)), 900, 2) * decay(0.08, 0.015) ; place(x, th * 1.2, 0.2); place(x, click(3100, 0.05, 1.0, 7), 0.2); place(x, click(2000, 0.04, 0.6, 8) * 0.5, 0.24)
save('ak_mag_in', fade(norm(reverb(x, 0.25, 0.15), 0.85)))
x = np.zeros(int(0.8 * SR)); place(x, scrape(0.12, 900, 6000, 9) * 0.6, 0.0); place(x, click(2400, 0.04, 0.8, 10), 0.12)
place(x, click(1900, 0.06, 1.2, 11) + pad(lp(RS.randn(int(0.06 * SR)), 1200, 2) * decay(0.06, 0.012), int(0.06 * SR) / SR) * 0.8, 0.3)
save('ak_bolt', fade(norm(reverb(x, 0.25, 0.15), 0.9)))
x = np.zeros(int(0.3 * SR)); place(x, click(3400, 0.02, 0.8, 12), 0.0); place(x, click(2800, 0.03, 1.0, 13), 0.05)
save('ak_select', fade(norm(x, 0.6)))
for i in range(3):
    rs = np.random.RandomState(20 + i); x = np.zeros(int(0.6 * SR)); at = 0.0; g = 1.0
    for b in range(rs.randint(2, 4)):
        f0 = rs.uniform(4200, 6200)
        place(x, ring([f0, f0 * 1.52, f0 * 2.31], 0.12, [0.03, 0.02, 0.015], [0.5, 0.3, 0.2]) * g + pad(click(5000, 0.01, 0.4, b + i), 0.12) * g, at)
        at += rs.uniform(0.07, 0.14); g *= 0.45
    save('casing_%d' % (i + 1), fade(norm(x, 0.5)))

# ------------------------------------------------------------------ footsteps
def step_dirt(seed):
    rs = np.random.RandomState(seed); x = np.zeros(int(0.35 * SR))
    x += pad(crackle(0.09, 260, 0.004, 600, 5000, seed) * 0.8, 0.35)
    th = lp(rs.randn(int(0.08 * SR)), 300, 2) * decay(0.08, 0.02, 0.004)
    place(x, th * 1.4, 0.0)
    place(x, bp(rs.randn(int(0.12 * SR)), 1500, 7000, 2) * decay(0.12, 0.03, 0.01) * 0.25, 0.02)
    return fade(norm(x, 0.55))
def step_mud(seed):
    rs = np.random.RandomState(seed); D = 0.5; x = np.zeros(int(D * SR))
    slap = bp(rs.randn(int(0.09 * SR)), 250, 1400, 2) * decay(0.09, 0.025, 0.006)
    place(x, slap * 1.2, 0.0)
    suck = lp(rs.randn(int(0.22 * SR)), 900, 2) * np.sin(np.linspace(0, np.pi, int(0.22 * SR))) ** 2 * 0.6
    place(x, suck, 0.12)
    for k in range(rs.randint(2, 5)):
        f = rs.uniform(300, 900); place(x, sweep(f, f * 1.8, 0.04, 0.012) * 0.25, rs.uniform(0.15, 0.35))
    return fade(norm(x, 0.55))
def step_wood(seed):
    rs = np.random.RandomState(seed); x = np.zeros(int(0.4 * SR))
    knock = ring([rs.uniform(95, 130), rs.uniform(240, 300), rs.uniform(520, 640)], 0.3, [0.05, 0.035, 0.02], [0.8, 0.5, 0.3])
    place(x, knock, 0.0); place(x, hp(rs.randn(int(0.01 * SR)), 1500, 2) * decay(0.01, 0.002) * 0.6, 0.0)
    if rs.rand() < 0.4: place(x, sweep(rs.uniform(500, 800), rs.uniform(300, 400), 0.12, 0.05) * 0.08, 0.05)
    return fade(norm(x, 0.55))
def step_water(seed):
    rs = np.random.RandomState(seed); x = np.zeros(int(0.5 * SR))
    sp = bp(rs.randn(int(0.2 * SR)), 700, 6000, 2) * decay(0.2, 0.05, 0.004)
    place(x, sp, 0.0); place(x, lp(rs.randn(int(0.1 * SR)), 500, 2) * decay(0.1, 0.03) * 0.8, 0.0)
    for k in range(4): place(x, sweep(rs.uniform(900, 1700), rs.uniform(1800, 2600), 0.03, 0.01) * 0.12, rs.uniform(0.08, 0.35))
    return fade(norm(x, 0.55))
for i in range(4):
    save('step_dirt_%d' % (i + 1), step_dirt(30 + i)); save('step_mud_%d' % (i + 1), step_mud(40 + i)); save('step_wood_%d' % (i + 1), step_wood(50 + i))
for i in range(3): save('step_water_%d' % (i + 1), step_water(60 + i))
def breath(d, f_lo, f_hi, g, seed):
    rs = np.random.RandomState(seed); x = bp(rs.randn(int(d * SR)), f_lo, f_hi, 2)
    return x * np.sin(np.linspace(0, np.pi, len(x))) ** 1.5 * g
x = np.zeros(int(0.6 * SR)); place(x, breath(0.35, 400, 2200, 0.6, 70), 0.0); place(x, pad(step_dirt(71), 0.3) * 0.6, 0.15)
save('jump', fade(norm(x, 0.5)))
x = np.zeros(int(0.9 * SR)); place(x, scrape(0.5, 400, 3000, 72) * 0.6, 0.0); place(x, breath(0.45, 300, 1800, 0.8, 73), 0.15); place(x, pad(step_dirt(74), 0.3), 0.55)
save('climb', fade(norm(x, 0.55)))
# breathing loop while sprinting
x = np.zeros(int(6.0 * SR)); at = 0.0; k = 0
while at < 5.6:
    inh = breath(0.32, 600, 2600, 0.5, 80 + k); exh = breath(0.38, 300, 1500, 0.8, 90 + k)
    place(x, inh, at); place(x, exh, at + 0.36); at += 0.78 + RS.uniform(-0.05, 0.05); k += 1
save('breath_loop', norm(loopify(x, 0.3), 0.5))

# ------------------------------------------------------------------ impacts
def impact_dirt(seed):
    rs = np.random.RandomState(seed); x = np.zeros(int(0.45 * SR))
    place(x, lp(rs.randn(int(0.07 * SR)), 500, 2) * decay(0.07, 0.015, 0.001) * 1.4, 0.0)
    place(x, bp(rs.randn(int(0.3 * SR)), 1200, 7000, 2) * decay(0.3, 0.06, 0.002) * 0.5, 0.0)
    x += pad(crackle(0.2, 120, 0.003, 1000, 6000, seed) * 0.3, 0.45)
    return fade(norm(x, 0.7))
def impact_wood(seed):
    rs = np.random.RandomState(seed); x = np.zeros(int(0.4 * SR))
    place(x, ring([rs.uniform(300, 420), rs.uniform(800, 1000), rs.uniform(1700, 2100)], 0.25, [0.04, 0.025, 0.015], [0.8, 0.5, 0.3]), 0.0)
    place(x, hp(rs.randn(int(0.04 * SR)), 1500, 2) * decay(0.04, 0.006) * 0.9, 0.0)
    x += pad(crackle(0.1, 150, 0.003, 1500, 7000, seed) * 0.4, 0.4)
    return fade(norm(x, 0.7))
def impact_metal(seed):
    rs = np.random.RandomState(seed); x = np.zeros(int(0.9 * SR))
    f = rs.uniform(1100, 1700)
    place(x, ring([f, f * 2.41, f * 3.87, f * 5.3], 0.8, [0.25, 0.15, 0.08, 0.05], [0.6, 0.4, 0.25, 0.15]), 0.0)
    place(x, hp(rs.randn(int(0.01 * SR)), 2500, 2) * decay(0.01, 0.002) * 0.9, 0.0)
    if rs.rand() < 0.6:
        w = bp(rs.randn(int(0.35 * SR)), 1500, 5000, 2) * decay(0.35, 0.12, 0.03) * sweep(3000, 900, 0.35, 1.0)
        place(x, w * 0.5, 0.02)
    return fade(norm(x, 0.7))
def impact_plate():
    x = np.zeros(int(1.8 * SR))
    place(x, ring([820, 1930, 3120, 4410, 5900], 1.7, [0.6, 0.4, 0.25, 0.15, 0.08], [0.6, 0.45, 0.3, 0.2, 0.1]), 0.0)
    place(x, hp(RS.randn(int(0.01 * SR)), 2500, 2) * decay(0.01, 0.002), 0.0)
    return fade(norm(x, 0.8))
def impact_water(seed):
    rs = np.random.RandomState(seed); x = np.zeros(int(0.6 * SR))
    place(x, bp(rs.randn(int(0.25 * SR)), 900, 7000, 2) * decay(0.25, 0.05, 0.002), 0.0)
    place(x, sweep(rs.uniform(500, 700), rs.uniform(1100, 1500), 0.08, 0.03) * 0.5, 0.01)
    for k in range(6): place(x, sweep(rs.uniform(1200, 2000), rs.uniform(2200, 3000), 0.03, 0.01) * 0.15, rs.uniform(0.1, 0.45))
    return fade(norm(x, 0.6))
def impact_glass():
    x = np.zeros(int(0.8 * SR))
    for k in range(40):
        f = RS.uniform(2500, 7000); place(x, ring([f, f * 1.6], 0.15, [0.03, 0.02], [0.4, 0.2]) * RS.uniform(0.2, 1.0), RS.uniform(0, 0.35) ** 1.5)
    place(x, hp(RS.randn(int(0.02 * SR)), 2000, 2) * decay(0.02, 0.004), 0.0)
    return fade(norm(x, 0.6))
for i in range(3): save('impact_dirt_%d' % (i + 1), impact_dirt(100 + i)); save('impact_metal_%d' % (i + 1), impact_metal(110 + i))
for i in range(2): save('impact_wood_%d' % (i + 1), impact_wood(120 + i)); save('impact_water_%d' % (i + 1), impact_water(130 + i))
save('impact_plate', impact_plate()); save('impact_glass', impact_glass())

# ------------------------------------------------------------------ war in the distance
def expl_far(seed):
    rs = np.random.RandomState(seed); D = 5.5; x = np.zeros(int(D * SR))
    boom = lp(rs.randn(int(4.5 * SR)), 140, 3) * decay(4.5, 0.9, 0.04)
    place(x, boom * 1.5, 0.0)
    place(x, sweep(60, 28, 1.2, 0.5) * 0.9, 0.0)
    for at, g in ((0.6, 0.5), (1.3, 0.35), (2.2, 0.25)):
        place(x, lp(rs.randn(int(2.5 * SR)), 110, 3) * decay(2.5, 0.6, 0.15) * g, at + rs.uniform(-0.1, 0.1))
    return fade(norm(sat(x, 1.4), 0.9), 0.01, 1.0)
def expl_near(seed):
    rs = np.random.RandomState(seed); D = 5.0; x = np.zeros(int(D * SR))
    place(x, lp(rs.randn(int(0.4 * SR)), 1800, 2) * decay(0.4, 0.06, 0.001) * 1.4, 0.0)
    place(x, lp(rs.randn(int(4.0 * SR)), 220, 3) * decay(4.0, 0.8, 0.01) * 1.6, 0.0)
    place(x, sweep(90, 30, 1.0, 0.35) * 1.2, 0.0)
    deb = pad(crackle(2.0, 40, 0.006, 400, 3000, seed) * 0.35, D); deb[:int(0.4 * SR)] = 0.0
    x += np.roll(deb, int(0.4 * SR))
    return fade(norm(sat(reverb(x, 1.2, 0.4, 2000, seed)[:int(D * SR)], 1.8), 0.95), 0.0, 1.0)
for i in range(3): save('expl_far_%d' % (i + 1), expl_far(200 + i))
for i in range(2): save('expl_near_%d' % (i + 1), expl_near(210 + i))
def mg_far(seed):
    rs = np.random.RandomState(seed); D = 2.6; x = np.zeros(int(D * SR)); at = 0.05
    for k in range(rs.randint(6, 13)):
        p = lp(rs.randn(int(0.12 * SR)), 1400, 2) * decay(0.12, 0.025, 0.001) + lp(rs.randn(int(0.12 * SR)), 300, 2) * decay(0.12, 0.04, 0.002)
        place(x, p * rs.uniform(0.7, 1.0), at); at += 1.0 / rs.uniform(9.0, 11.0)
    x = reverb(x, 1.4, 0.5, 1800, seed)[:int(D * SR)]
    return fade(norm(lp(x, 2500, 2), 0.8), 0.0, 0.3)
for i in range(2): save('mg_far_%d' % (i + 1), mg_far(220 + i))
t = t_(1.7); f = 1500 * (430 / 1500) ** (t / 1.7); ph = 2 * np.pi * np.cumsum(f) / SR
wh = (np.sin(ph) * 0.5 + bp(RS.randn(len(t)), 600, 3000, 2) * 0.12) * np.clip(t / 1.2, 0, 1) ** 1.5 * np.clip((1.7 - t) / 0.08, 0, 1)
save('shell_whistle', norm(wh, 0.6))

# ------------------------------------------------------------------ ambience loops (stereo)
def wind_loop(D=34.0):
    out = []
    for ch in range(2):
        rs = np.random.RandomState(300 + ch); n = rs.randn(int(D * SR))
        gust = signal.sosfilt(sos('lowpass', 0.25, 2), rs.randn(len(n)) * 30); gust = (gust - gust.min()) / (gust.max() - gust.min() + 1e-9)
        a = lp(n, 380, 2) * (0.35 + 0.65 * gust)
        b = bp(n, 700, 2600, 2) * (gust ** 2) * 0.35
        w = bp(rs.randn(len(n)), 1600, 1800, 2) * (gust ** 4) * 0.08
        out.append(loopify(a + b + w, 2.0))
    x = np.stack(out, 1); return norm(x, 0.6)
save('wind_loop', wind_loop(), True)
def battle_loop(D=40.0):
    out = []
    for ch in range(2):
        rs = np.random.RandomState(310 + ch); x = lp(rs.randn(int(D * SR)), 120, 3) * 0.25
        for k in range(18):
            b = lp(rs.randn(int(3.0 * SR)), 90, 3) * decay(3.0, 0.7, 0.05) * rs.uniform(0.3, 1.0)
            place(x, b, rs.uniform(0, D - 3.0))
        for k in range(10):
            at = rs.uniform(0, D - 2.0); g = rs.uniform(0.02, 0.06)
            for s in range(rs.randint(4, 10)):
                place(x, lp(rs.randn(int(0.08 * SR)), 900, 2) * decay(0.08, 0.02) * g, at + s * 0.1)
        out.append(loopify(x, 2.0))
    return norm(np.stack(out, 1), 0.6)
save('battle_loop', battle_loop(), True)
def rain_loop(D=20.0):
    out = []
    for ch in range(2):
        rs = np.random.RandomState(320 + ch); n = rs.randn(int(D * SR))
        x = bp(n, 1500, 9000, 2) * 0.25 + lp(n, 300, 2) * 0.25
        x += crackle(D, 900, 0.002, 2000, 9000, 321 + ch) * 0.25
        out.append(loopify(x, 1.5))
    return norm(np.stack(out, 1), 0.55)
save('rain_loop', rain_loop(), True)
def stove_loop(D=14.0):
    rs = np.random.RandomState(330); x = lp(rs.randn(int(D * SR)), 250, 2) * 0.35
    x += crackle(D, 22, 0.004, 700, 6000, 331) * 1.2
    x += crackle(D, 4, 0.012, 300, 2500, 332) * 1.5
    return norm(loopify(x, 1.0), 0.6)
save('stove_loop', stove_loop())
def radio():
    D = 3.2; rs = np.random.RandomState(340); x = bp(rs.randn(int(D * SR)), 300, 3400, 2) * 0.25
    t = t_(D); syl = (np.sin(2 * np.pi * 4.6 * t + 2 * np.sin(2 * np.pi * 0.7 * t)) > 0.1).astype(float)
    syl = signal.sosfilt(sos('lowpass', 30, 2), syl)
    f0 = 140 + 30 * np.sin(2 * np.pi * 0.9 * t)
    voice = signal.sawtooth(2 * np.pi * np.cumsum(f0) / SR) * syl
    v = bp(voice, 500, 900, 2) * 0.7 + bp(voice, 1100, 1700, 2) * 0.5 + bp(voice, 2300, 2900, 2) * 0.3
    x += sat(v * 2.0, 2.0) * 0.8
    x[:int(0.06 * SR)] += hp(rs.randn(int(0.06 * SR)), 1000, 2) * 0.6
    return fade(norm(bp(x, 300, 3400, 2), 0.7), 0.002, 0.15)
save('radio', radio())

# ------------------------------------------------------------------ interface
x = click(2200, 0.03, 0.6, 400); save('ui_click', fade(norm(pad(x, 0.08), 0.4)))
t = t_(0.09); b = np.sin(2 * np.pi * 1650 * t) * np.clip(t / 0.003, 0, 1) * np.clip((0.09 - t) / 0.01, 0, 1)
x = np.zeros(int(0.45 * SR)); place(x, b, 0.0); place(x, b, 0.18); save('rec_beep', norm(x, 0.45))
save('lamp_click', fade(norm(pad(click(2800, 0.02, 0.7, 401), 0.1), 0.45)))
x = np.zeros(int(0.8 * SR)); place(x, scrape(0.3, 500, 3000, 402) * 0.5, 0.0)
for k in range(4): place(x, click(RS.uniform(2500, 4000), 0.04, 0.6, 403 + k) * 0.5, 0.15 + k * 0.12)
save('ammo_pickup', fade(norm(x, 0.6)))
print('sounds:', len(os.listdir(OUT)))
