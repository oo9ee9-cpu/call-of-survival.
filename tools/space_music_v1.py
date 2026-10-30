"""the theme of Call of Survival, composed here for the game: slow wide chords like a sky over the planet, a deep drone,
far bells that ring and fade, a breath of cosmic wind. One minute and four seconds that loop without a seam (the reverb's tail
is wrapped back onto the start). Also <out>_sting.wav: the deep hit with bells played once when the title appears.
usage: python3 -I space_music.py <out.wav> [seconds_per_chord]"""
import sys
import numpy as np
from scipy.signal import fftconvolve

SR = 44100
out = sys.argv[1]; CH = float(sys.argv[2]) if len(sys.argv) > 2 else 8.0
rng = np.random.RandomState(2026)
mid = lambda n: 440.0 * 2 ** ((n - 69) / 12)
# A minor, opening wide: Am9 · Fmaj7#11 · Cmaj7/E · G6add9 · Am9 · Fmaj9 · Dm9 · Esus4→E
CHORDS = [
    [45, 52, 55, 59, 60, 64], [41, 48, 52, 57, 59, 64], [40, 48, 55, 59, 64, 67], [43, 50, 52, 57, 59, 62],
    [45, 52, 55, 59, 60, 64], [41, 48, 55, 57, 60, 67], [38, 50, 53, 57, 60, 64], [40, 52, 57, 59, 64, 69],
]
N = len(CHORDS); LEN = N * CH; TAIL = 9.0
T = int((LEN + TAIL) * SR); t = np.arange(T) / SR
L = np.zeros(T); Rr = np.zeros(T)

def env(t0, dur, att, rel):
    e = np.zeros(T); a, b = int(t0 * SR), int(min(T, (t0 + dur + rel) * SR)); x = (np.arange(a, b) / SR) - t0
    v = np.clip(x / att, 0, 1) ** 1.5 * np.where(x > dur, np.clip(1 - (x - dur) / rel, 0, 1) ** 2, 1.0)
    e[a:b] = v; return e

def pad_voice(f, t0, dur, amp, pan):
    """a string-and-choir pad: twelve partials falling off softly, two voices a few cents apart, a slow shimmer in its brightness"""
    e = env(t0, dur, 2.6, 3.2); m = e > 0; tt = t[m]; s = np.zeros(m.sum())
    for det in (-6.0, 6.0):
        fd = f * 2 ** (det / 1200); ph = rng.rand() * 6.28
        for k in range(1, 11):
            if fd * k > 7000: break
            bright = 0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * tt + k * 0.9 + ph)
            s += np.sin(2 * np.pi * fd * k * tt + ph * k) * (1.0 / k ** 1.75) * (0.6 + 0.4 * bright)
    s *= e[m] * amp
    L[m] += s * np.sqrt(1 - pan); Rr[m] += s * np.sqrt(pan)

for i, ch in enumerate(CHORDS):
    t0 = i * CH - 1.2
    for j, n in enumerate(ch):
        # the chord spread across the stereo field, low notes in the middle
        pan = 0.5 + (j - (len(ch) - 1) / 2) * 0.09 * (1 if i % 2 == 0 else -1)
        pad_voice(mid(n), max(0, t0) + j * 0.12, CH + 1.0, 0.055 if n > 50 else 0.07, pan)
    # wrap the first chord's attack around the loop: the last chord also sounds into the next loop's start
print('pads', flush=True)

# the drone: A1 and E2 under everything, swelling with the phrase
dr = (np.sin(2 * np.pi * 55 * t) * 0.16 + np.sin(2 * np.pi * 82.41 * t + 1.1) * 0.06 + np.sin(2 * np.pi * 110 * t + 0.4) * 0.03)
dr *= 0.6 + 0.4 * np.sin(2 * np.pi * t / (LEN / 2) - 1.3) ** 2
L += dr; Rr += dr

# far bells: a few high notes of each chord, struck softly, ringing out with inharmonic partials
for i, ch in enumerate(CHORDS):
    for k in range(4):
        n = ch[rng.randint(2, len(ch))] + 24 + (12 if rng.rand() < 0.25 else 0)
        t0 = i * CH + 0.6 + k * (CH / 4) + rng.rand() * 0.8; a = int(t0 * SR); b = min(T, a + int(5.5 * SR))
        x = np.arange(b - a) / SR; f = mid(n)
        s = (np.sin(2 * np.pi * f * x) + 0.35 * np.sin(2 * np.pi * f * 2.76 * x) * np.exp(-x * 2.2) + 0.12 * np.sin(2 * np.pi * f * 5.4 * x) * np.exp(-x * 4)) * np.exp(-x * 0.85) * np.clip(x / 0.004, 0, 1)
        g = 0.022 * (0.6 + 0.4 * rng.rand()); pan = rng.rand()
        L[a:b] += s * g * np.sqrt(1 - pan); Rr[a:b] += s * g * np.sqrt(pan)
print('bells', flush=True)

# cosmic wind: noise through a slowly sweeping band, left and right drifting apart
def sweep_noise(seed):
    r = np.random.RandomState(seed); nz = r.randn(T)
    spec = np.fft.rfft(nz); fr = np.fft.rfftfreq(T, 1 / SR)
    spec *= np.exp(-((np.log(fr + 1) - np.log(700)) ** 2) / 0.9)          # a soft band around 700 Hz
    w = np.fft.irfft(spec, T); w /= np.abs(w).max()
    return w * (0.35 + 0.65 * (0.5 + 0.5 * np.sin(2 * np.pi * t / 21 + seed)))
wind = 0.03
L += sweep_noise(3) * wind; Rr += sweep_noise(7) * wind
print('wind', flush=True)

# a large dark hall: stereo noise decaying over five seconds, highs dying faster
def ir(seed):
    r = np.random.RandomState(seed); n = int(5.5 * SR); x = np.arange(n) / SR
    lo = r.randn(n) * np.exp(-x * 1.25); hi = r.randn(n) * np.exp(-x * 3.2)
    k = np.ones(40) / 40; lo = np.convolve(lo, k, mode='same')
    v = lo * 3.2 + hi * 0.5; v[:int(0.03 * SR)] = 0; return v / np.sqrt((v ** 2).sum())
wetL = fftconvolve(L, ir(11))[:T]; wetR = fftconvolve(Rr, ir(13))[:T]
L = L * 0.55 + wetL * 0.9; Rr = Rr * 0.55 + wetR * 0.9
print('reverb', flush=True)

# the loop: what rings past the end is laid back over the beginning, so the minute repeats without a seam
n = int(LEN * SR)
for ch in (L, Rr):
    ch[:T - n] += ch[n:T]
L = L[:n]; Rr = Rr[:n]
st = np.stack([L, Rr], 1)
st /= np.abs(st).max() / 0.92
st = np.tanh(st * 1.15) / np.tanh(1.15)
st *= 0.89
pcm = (st * 32767).astype(np.int16)
import wave
def save(path, pcm):
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
save(out, pcm)
print('wrote', out, round(n / SR, 1), 's')

# the sting, played once when the title appears: a rising breath of air, a deep falling hit, and the first chord's upper
# notes struck like bells, all in the same hall
S = int(7.0 * SR); sL = np.zeros(S); sR = np.zeros(S); a = int(0.9 * SR)
x2 = np.arange(a) / SR; sw = np.random.RandomState(9).randn(a) * (x2 / x2[-1]) ** 3 * 0.07
sL[:a] += sw; sR[:a] += np.random.RandomState(10).randn(a) * (x2 / x2[-1]) ** 3 * 0.07
x = np.arange(int(4.5 * SR)) / SR
f = 30 + 62 * np.exp(-x * 5.5); ph = 2 * np.pi * np.cumsum(f) / SR
hit = np.sin(ph) * np.exp(-x * 1.1) * 0.7 + np.random.RandomState(5).randn(len(x)) * np.exp(-x * 10) * 0.06
sL[a:a + len(x)] += hit; sR[a:a + len(x)] += hit
for j, nn in enumerate([69, 72, 76, 79, 83]):
    fq = mid(nn); xx = np.arange(int(5.5 * SR)) / SR; b0 = a + int(j * 0.045 * SR)
    v = (np.sin(2 * np.pi * fq * xx) + 0.3 * np.sin(2 * np.pi * fq * 2.76 * xx) * np.exp(-xx * 2) + 0.1 * np.sin(2 * np.pi * fq * 5.4 * xx) * np.exp(-xx * 4)) * np.exp(-xx * 0.7) * np.clip(xx / 0.003, 0, 1) * 0.06
    pan = 0.2 + j * 0.15; e = min(S, b0 + len(v)); sL[b0:e] += v[:e - b0] * np.sqrt(1 - pan); sR[b0:e] += v[:e - b0] * np.sqrt(pan)
wL = fftconvolve(sL, ir(21))[:S]; wR = fftconvolve(sR, ir(23))[:S]
sL = sL * 0.6 + wL * 0.8; sR = sR * 0.6 + wR * 0.8
fade = np.ones(S); fade[-int(1.5 * SR):] = np.linspace(1, 0, int(1.5 * SR)) ** 2
st2 = np.stack([sL * fade, sR * fade], 1); st2 /= np.abs(st2).max() / 0.9
save(out.replace('.wav', '_sting.wav'), (st2 * 32767).astype(np.int16))
print('wrote sting')
