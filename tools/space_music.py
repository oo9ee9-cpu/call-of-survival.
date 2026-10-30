"""the theme of Call of Survival, composed here for the game: slow wide chords like a sky over the planet, a deep drone, far
bells that ring and fade, a breath of cosmic wind, all in a large dark hall. The minute is built on a circle: every note that
rings past the end comes back at the start, the drone and the wind repeat exactly, and the hall is a circular convolution, so
it loops with no seam at all. Also writes <out>_sting.wav: the deep hit with bells played once when the title appears.
usage: python3 -I space_music.py <out.wav> [seconds_per_chord]"""
import sys, wave
import numpy as np

SR = 44100
out = sys.argv[1]; CH = float(sys.argv[2]) if len(sys.argv) > 2 else 8.0
rng = np.random.RandomState(2026)
mid = lambda n: 440.0 * 2 ** ((n - 69) / 12)
# A minor, opening wide: Am9 · Fmaj7#11 · Cmaj7/E · G6add9 · Am9 · Fmaj9 · Dm9 · Esus4
CHORDS = [
    [45, 52, 55, 59, 60, 64], [41, 48, 52, 57, 59, 64], [40, 48, 55, 59, 64, 67], [43, 50, 52, 57, 59, 62],
    [45, 52, 55, 59, 60, 64], [41, 48, 55, 57, 60, 67], [38, 50, 53, 57, 60, 64], [40, 52, 57, 59, 64, 69],
]
N = int(len(CHORDS) * CH * SR)
L = np.zeros(N); Rr = np.zeros(N)

def add(dst, start, sig):
    """add sig into the circular buffer from sample `start`, wrapping round the end"""
    start %= N; k = 0
    while k < len(sig):
        m = min(len(sig) - k, N - start); dst[start:start + m] += sig[k:k + m]; k += m; start = 0

def pad_voice(f, t0, dur, amp, pan, att=2.6, rel=3.2):
    """a string-and-choir pad: soft partials, two voices a few cents apart, a slow shimmer in its brightness"""
    n = int((dur + rel) * SR); x = np.arange(n) / SR
    e = np.clip(x / att, 0, 1) ** 1.5 * np.where(x > dur, np.clip(1 - (x - dur) / rel, 0, 1) ** 2, 1.0)
    s = np.zeros(n); ph = rng.rand() * 6.28
    for det in (-6.0, 6.0):
        fd = f * 2 ** (det / 1200)
        for k in range(1, 11):
            if fd * k > 7000: break
            bright = 0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * x + k * 0.9 + ph)
            s += np.sin(2 * np.pi * fd * k * x + ph * k) * (1.0 / k ** 1.75) * (0.6 + 0.4 * bright)
    s *= e * amp; i0 = int(round(t0 * SR))
    add(L, i0, s * np.sqrt(1 - pan)); add(Rr, i0, s * np.sqrt(pan))

for i, ch in enumerate(CHORDS):
    t0 = i * CH - 1.2          # each chord swells in just before its bar (the first one wraps round from the end)
    for j, n in enumerate(ch):
        pan = 0.5 + (j - (len(ch) - 1) / 2) * 0.09 * (1 if i % 2 == 0 else -1)
        pad_voice(mid(n), t0 + j * 0.12, CH + 1.0, 0.055 if n > 50 else 0.07, pan)
print('pads', flush=True)

# the drone: A1, E2 and A2 under everything (whole numbers of cycles in the minute), swelling twice per loop
t = np.arange(N) / SR
dr = np.sin(2 * np.pi * 55 * t) * 0.16 + np.sin(2 * np.pi * 82.5 * t + 1.1) * 0.06 + np.sin(2 * np.pi * 110 * t + 0.4) * 0.03
dr *= 0.6 + 0.4 * np.sin(2 * np.pi * t / (N / SR / 2) - 1.3) ** 2
L += dr; Rr += dr

# far bells: a few high notes of each chord, struck softly, ringing out with inharmonic partials
for i, ch in enumerate(CHORDS):
    for k in range(4):
        n = ch[rng.randint(2, len(ch))] + 24 + (12 if rng.rand() < 0.25 else 0)
        t0 = i * CH + 0.6 + k * (CH / 4) + rng.rand() * 0.8; x = np.arange(int(5.5 * SR)) / SR; f = mid(n)
        s = (np.sin(2 * np.pi * f * x) + 0.35 * np.sin(2 * np.pi * f * 2.76 * x) * np.exp(-x * 2.2) + 0.12 * np.sin(2 * np.pi * f * 5.4 * x) * np.exp(-x * 4)) * np.exp(-x * 0.85) * np.clip(x / 0.004, 0, 1)
        g = 0.022 * (0.6 + 0.4 * rng.rand()); pan = rng.rand(); i0 = int(round(t0 * SR))
        add(L, i0, s * g * np.sqrt(1 - pan)); add(Rr, i0, s * g * np.sqrt(pan))
print('bells', flush=True)

# cosmic wind: noise through a soft band (filtered on the circle), breathing three times per loop, left and right apart
fr = np.fft.rfftfreq(N, 1 / SR)
def wind(seed):
    spec = np.fft.rfft(np.random.RandomState(seed).randn(N)) * np.exp(-((np.log(fr + 1) - np.log(700)) ** 2) / 0.9)
    w = np.fft.irfft(spec, N); w /= np.abs(w).max()
    return w * (0.35 + 0.65 * (0.5 + 0.5 * np.sin(2 * np.pi * t * 3 / (N / SR) + seed)))
L += wind(3) * 0.03; Rr += wind(7) * 0.03
print('wind', flush=True)

# a large dark hall: stereo noise decaying over five seconds, highs dying faster; convolved round the circle
IRN = int(5.5 * SR)
def ir(seed, n):
    r = np.random.RandomState(seed); x = np.arange(IRN) / SR
    lo = np.convolve(r.randn(IRN) * np.exp(-x * 1.25), np.ones(40) / 40, mode='same'); hi = r.randn(IRN) * np.exp(-x * 3.2)
    v = lo * 3.2 + hi * 0.5; v[:int(0.03 * SR)] = 0; v /= np.sqrt((v ** 2).sum())
    o = np.zeros(n); o[:IRN] = v; return o
def circ(sig, h): return np.fft.irfft(np.fft.rfft(sig) * np.fft.rfft(h), len(sig))
L = L * 0.55 + circ(L, ir(11, N)) * 0.9; Rr = Rr * 0.55 + circ(Rr, ir(13, N)) * 0.9
print('reverb', flush=True)

def master(st, peak=0.92, drive=1.15, gain=0.89):
    st = st / (np.abs(st).max() / peak); st = np.tanh(st * drive) / np.tanh(drive); return st * gain
def save(path, st):
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(st, -1, 1) * 32767).astype(np.int16).tobytes())
save(out, master(np.stack([L, Rr], 1)))
print('wrote', out, round(N / SR, 1), 's')

# the sting, played once when the title appears: a rising breath of air, a deep falling hit, and the first chord's upper
# notes struck like bells, all in the same hall
S = int(7.0 * SR); sL = np.zeros(S); sR = np.zeros(S); a = int(0.9 * SR)
x2 = np.arange(a) / SR
sL[:a] += np.random.RandomState(9).randn(a) * (x2 / x2[-1]) ** 3 * 0.07; sR[:a] += np.random.RandomState(10).randn(a) * (x2 / x2[-1]) ** 3 * 0.07
x = np.arange(int(4.5 * SR)) / SR
f = 30 + 62 * np.exp(-x * 5.5); ph = 2 * np.pi * np.cumsum(f) / SR
hit = np.sin(ph) * np.exp(-x * 1.1) * 0.7 + np.random.RandomState(5).randn(len(x)) * np.exp(-x * 10) * 0.06
sL[a:a + len(x)] += hit; sR[a:a + len(x)] += hit
for j, nn in enumerate([69, 72, 76, 79, 83]):
    fq = mid(nn); xx = np.arange(int(5.5 * SR)) / SR; b0 = a + int(j * 0.045 * SR)
    v = (np.sin(2 * np.pi * fq * xx) + 0.3 * np.sin(2 * np.pi * fq * 2.76 * xx) * np.exp(-xx * 2) + 0.1 * np.sin(2 * np.pi * fq * 5.4 * xx) * np.exp(-xx * 4)) * np.exp(-xx * 0.7) * np.clip(xx / 0.003, 0, 1) * 0.06
    pan = 0.2 + j * 0.15; e = min(S, b0 + len(v)); sL[b0:e] += v[:e - b0] * np.sqrt(1 - pan); sR[b0:e] += v[:e - b0] * np.sqrt(pan)
def lin(sig, h):
    n = len(sig) + len(h); return np.fft.irfft(np.fft.rfft(sig, n) * np.fft.rfft(h, n), n)[:len(sig)]
sL = sL * 0.6 + lin(sL, ir(21, IRN)) * 0.8; sR = sR * 0.6 + lin(sR, ir(23, IRN)) * 0.8
fade = np.ones(S); fade[-int(1.5 * SR):] = np.linspace(1, 0, int(1.5 * SR)) ** 2
st2 = np.stack([sL * fade, sR * fade], 1); st2 /= np.abs(st2).max() / 0.9
save(out.replace('.wav', '_sting.wav'), st2)
print('wrote sting')
