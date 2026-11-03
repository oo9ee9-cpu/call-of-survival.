#!/usr/bin/env python3
"""Call of Survival - vehicle, aircraft and air-raid sounds, synthesised (numpy + scipy), written as OGG through ffmpeg.
Engine loops are recorded at one engine speed; the game changes their pitch and level with the engine.
usage: python3 sounds_v.py <project_dir> [name ...]"""
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np
from scipy import signal

PROJ = sys.argv[1]
ONLY = set(sys.argv[2:])
OUT = PROJ + '/sounds'
os.makedirs(OUT, exist_ok=True)
SR = 44100


def t_(d):
    return np.arange(int(d * SR)) / SR


def sos(kind, f, order=4):
    f = np.clip(np.atleast_1d(f) / (SR / 2), 1e-4, 0.999)
    return signal.butter(order, f if len(f) > 1 else f[0], btype=kind, output='sos')


def lp(x, f, o=4):
    return signal.sosfilt(sos('lowpass', f, o), x)


def hp(x, f, o=4):
    return signal.sosfilt(sos('highpass', f, o), x)


def bp(x, a, b, o=3):
    return signal.sosfilt(sos('bandpass', [a, b], o), x)


def reso(x, f, q):
    """a resonant peak (a pipe, a cabin, a body panel)"""
    b, a = signal.iirpeak(f / (SR / 2), q)
    return signal.lfilter(b, a, x)


def norm(x, peak=0.9):
    m = np.abs(x).max()
    return x * (peak / m) if m > 0 else x


def sat(x, k=2.0):
    return np.tanh(x * k) / np.tanh(k)


def fade(x, a=0.002, b=0.05):
    n = len(x)
    ia, ib = int(a * SR), int(b * SR)
    if ia:
        x[:ia] *= np.linspace(0, 1, ia)
    if ib:
        x[-ib:] *= np.linspace(1, 0, ib)
    return x


def loopify(x, xf=0.6):
    n = int(xf * SR)
    head, tail = x[:n].copy(), x[-n:].copy()
    w = np.linspace(0, 1, n)
    y = x[n:].copy()
    y[-n:] = tail * (1 - w) + head * w
    return y


def ir(t60, bright=5000, seed=0):
    rs = np.random.RandomState(seed)
    t = t_(t60 * 1.2)
    return lp(rs.randn(len(t)) * np.exp(-6.9 * t / t60), bright, 2)


def reverb(x, t60, wet, bright=4000, seed=0, predelay=0.0):
    r = signal.fftconvolve(x, ir(t60, bright, seed))
    if predelay > 0:
        r = np.concatenate([np.zeros(int(predelay * SR)), r])
    r = r / (np.abs(r).max() + 1e-9) * (np.abs(x).max() + 1e-9)
    y = np.pad(x, (0, len(r) - len(x)))
    return y * (1 - wet * 0.3) + r * wet


def save(name, x, q=5):
    if ONLY and name not in ONLY:
        return
    x = np.clip(np.asarray(x, np.float64), -1, 1)
    pcm = (x * 32767).astype('<i2')
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        tmp = f.name
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-c:a', 'libvorbis', '-q:a', str(q), OUT + '/' + name + '.ogg'], check=True)
    os.unlink(tmp)
    print('saved', name, '%.1f s' % (len(x) / SR))


def pulses(d, f0, shape, jitter=0.01, amp_var=0.25, seed=0):
    """a train of firing pulses at f0 (per-pulse timing and strength vary a little, as in a real engine)"""
    rs = np.random.RandomState(seed)
    out = np.zeros(int(d * SR) + len(shape) + 8)
    t = 0.0
    k = 0
    while t < d:
        i = int(t * SR)
        out[i:i + len(shape)] += shape * (1.0 + rs.randn() * amp_var) * (1.12 if k % 4 == 0 else 1.0)
        t += (1.0 + rs.randn() * jitter) / f0
        k += 1
    return out[:int(d * SR)]


def firing(f_res, tau, d=0.03, seed=0):
    rs = np.random.RandomState(seed)
    t = t_(d)
    s = np.sin(2 * np.pi * f_res * t) * np.exp(-t / tau)
    s += rs.randn(len(t)) * np.exp(-t / (tau * 0.4)) * 0.35
    return s


# ------------------------------------------------------------------ ground vehicles
def car_loop(D=6.0):
    """petrol four, ~2000 rpm: 66 Hz firing, exhaust pipe resonance, intake hiss, valve tick"""
    f0 = 66.0
    x = pulses(D, f0, firing(160, 0.004, seed=1), 0.006, 0.2, 2)
    x = reso(x, 120, 2.0) * 0.8 + reso(x, 340, 3.0) * 0.35 + lp(x, 900, 2) * 0.5
    rs = np.random.RandomState(3)
    x += bp(rs.randn(len(x)), 1800, 5200, 2) * 0.04 * (1 + 0.5 * np.sin(2 * np.pi * f0 * t_(D)))
    x += pulses(D, f0 / 2, firing(3800, 0.0006, 0.004, 4), 0.004, 0.4, 5) * 0.05
    x = sat(norm(x) * 1.3, 1.6)
    return norm(loopify(x, 0.5), 0.8)


def diesel_loop(D=6.0):
    """six-cylinder diesel at ~1000 rpm (50 Hz firing): knock in every combustion, a deep pipe, turbo whistle"""
    f0 = 50.0
    knock = firing(110, 0.006, 0.04, 10)
    t = t_(0.04)
    knock += np.random.RandomState(11).randn(len(t)) * np.exp(-t / 0.0025) * 0.8   # the clatter
    x = pulses(D, f0, knock, 0.01, 0.3, 12)
    x = reso(x, 85, 1.6) * 1.0 + bp(x, 900, 3500, 2) * 0.45 + lp(x, 400, 2) * 0.6
    tt = t_(D)
    x += np.sin(2 * np.pi * 2350 * tt + 0.3 * np.sin(2 * np.pi * 0.7 * tt)) * 0.012
    x = sat(norm(x) * 1.5, 1.8)
    return norm(loopify(x, 0.5), 0.8)


def tank_loop(D=7.0):
    """a tank: big diesel at ~700 rpm (35 Hz), turbo and gearbox whine, the whole hull droning"""
    f0 = 35.0
    x = pulses(D, f0, firing(70, 0.009, 0.06, 20), 0.012, 0.3, 21)
    x = reso(x, 55, 1.4) * 1.2 + reso(x, 180, 2.5) * 0.4 + bp(x, 700, 2500, 2) * 0.25
    tt = t_(D)
    x += np.sin(2 * np.pi * 1650 * tt) * 0.01 + np.sin(2 * np.pi * 820 * tt + 0.4 * np.sin(2 * np.pi * 0.5 * tt)) * 0.015
    x = sat(norm(x) * 1.6, 2.0)
    return norm(loopify(x, 0.6), 0.85)


def tracks_loop(D=4.0):
    """track links slapping over the sprockets and wheels, metal squeal"""
    rs = np.random.RandomState(30)
    x = np.zeros(int(D * SR))
    rate = 14.0
    for k in range(int(D * rate)):
        t = t_(0.05)
        c = (bp(rs.randn(len(t)), 300, 3000, 2) * np.exp(-t / 0.008) + np.sin(2 * np.pi * rs.uniform(500, 900) * t) * np.exp(-t / 0.012) * 0.3)
        i = int((k / rate + rs.randn() * 0.004) * SR)
        if 0 <= i < len(x) - len(t):
            x[i:i + len(t)] += c * rs.uniform(0.5, 1.0)
    x += bp(rs.randn(len(x)), 2000, 5000, 2) * 0.04
    x += lp(rs.randn(len(x)), 150, 2) * 0.3
    return norm(loopify(x, 0.4), 0.7)


def skid_loop(D=3.0):
    rs = np.random.RandomState(40)
    tt = t_(D)
    f = 1100 + 120 * np.sin(2 * np.pi * 3.1 * tt) + 60 * np.sin(2 * np.pi * 7.3 * tt)
    x = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR) * 0.3
    x = bp(x, 800, 4000, 2) + bp(rs.randn(len(tt)), 1500, 6000, 2) * 0.4
    return norm(loopify(x, 0.4), 0.6)


def engine_start(kind='car'):
    """the starter cranking, the catch, a rev and settling to idle"""
    D = 2.4
    rs = np.random.RandomState(50)
    x = np.zeros(int(D * SR))
    tt = t_(0.7)
    crank = np.sin(2 * np.pi * np.cumsum(9 + 3 * tt) / SR * 12) * 0.3 + bp(rs.randn(len(tt)), 200, 1200, 2) * 0.3
    crank *= 0.6 + 0.4 * np.sin(2 * np.pi * 9 * tt) ** 2
    x[:len(tt)] += crank
    f0 = 50.0 if kind == 'car' else 38.0
    run = pulses(1.7, f0, firing(140 if kind == 'car' else 90, 0.005, seed=51), 0.01, 0.3, 52)
    env = np.interp(t_(1.7), [0, 0.15, 0.5, 1.7], [0.0, 1.0, 0.75, 0.6])
    x[int(0.7 * SR):int(0.7 * SR) + len(run)] += lp(run, 1200, 2) * env
    return fade(norm(sat(x * 1.4, 1.5), 0.8), 0.002, 0.2)


def door():
    D = 0.6
    rs = np.random.RandomState(60)
    x = np.zeros(int(D * SR))
    t = t_(0.25)
    thud = np.sin(2 * np.pi * 90 * t) * np.exp(-t / 0.05) + bp(rs.randn(len(t)), 300, 2500, 2) * np.exp(-t / 0.02) * 0.6
    x[int(0.05 * SR):int(0.05 * SR) + len(t)] += thud
    t2 = t_(0.05)
    x[:len(t2)] += bp(rs.randn(len(t2)), 2000, 6000, 2) * np.exp(-t2 / 0.01) * 0.4
    return fade(norm(x, 0.8))


# ------------------------------------------------------------------ aircraft
def jet_loop(D=8.0):
    """a jet engine from outside: the roar (shaped noise), fan whine and its harmonics, a slow beat"""
    rs = np.random.RandomState(70)
    n = rs.randn(int(D * SR))
    roar = lp(n, 1400, 2) * 0.9 + bp(n, 80, 400, 2) * 0.6 + hp(lp(n, 6000, 2), 2500, 2) * 0.15
    tt = t_(D)
    whine = sum(np.sin(2 * np.pi * f * tt + rs.uniform(0, 6) + 0.002 * np.cumsum(rs.randn(len(tt))) / SR) * a
                for f, a in ((3150, 0.06), (6300, 0.025), (1580, 0.03), (4720, 0.015)))
    x = roar * (1 + 0.08 * np.sin(2 * np.pi * 0.35 * tt)) + whine
    return norm(loopify(x, 0.8), 0.8)


def jet_flyby(D=9.0):
    """a fighter passing low and fast: the whine rises as it comes, the roar peaks, then a long rumbling tail"""
    rs = np.random.RandomState(80)
    tt = t_(D)
    tp = 2.6                                           # passing at this moment
    r = np.sqrt(220.0 ** 2 + (280.0 * (tt - tp)) ** 2)  # 280 m/s, 220 m away at the closest
    amp = (220.0 / r) ** 1.2
    v_rad = 280.0 * 280.0 * (tt - tp) / r            # speed away from the listener
    dop = 340.0 / (340.0 + v_rad)                    # > 1 coming, < 1 going
    n = rs.randn(len(tt))
    roar = np.zeros_like(tt)
    for k in range(0, len(tt), 2048):                # the roar darkens as it goes away
        seg = n[k:k + 2048 + 256]
        c = 600 + 2600 * np.clip(dop[k] - 0.5, 0, 1.2)
        roar[k:k + 2048] = lp(seg, min(c, 9000), 2)[:len(roar[k:k + 2048])]
    whine = np.sin(2 * np.pi * np.cumsum(2900 * dop) / SR) * 0.12 + np.sin(2 * np.pi * np.cumsum(5800 * dop) / SR) * 0.05
    whine *= np.clip(dop - 0.8, 0, 1) * 2.0
    crack = np.zeros_like(tt)                          # afterburner crackle as it goes away
    for k in range(int(D * 30)):
        at = rs.uniform(tp, D)
        i = int(at * SR)
        g = bp(rs.randn(300), 200, 3000, 2) * np.exp(-np.arange(300) / 60) * rs.uniform(0.3, 1.0)
        if i + 300 < len(crack):
            crack[i:i + 300] += g * np.exp(-(at - tp) / 2.5)
    rumble = lp(n, 120, 2) * 2.0 * np.exp(-np.maximum(tt - tp, 0) / 3.0) * (tt > tp - 0.5)
    x = (roar + whine) * amp + crack * 0.6 + rumble * amp ** 0.5 * 0.5
    x = reverb(x, 2.5, 0.35, 2500, 81)[:len(x)]
    return fade(norm(sat(norm(x) * 1.3, 1.4), 0.95), 0.4, 1.5)


def heli_loop(D=6.0):
    """a medium helicopter: blade slap (5 blades x 3.2 rev/s), tail rotor buzz, turbine whine"""
    rs = np.random.RandomState(90)
    tt = t_(D)
    f_blade = 16.0
    slap_t = t_(0.06)
    slap = (np.sin(2 * np.pi * 75 * slap_t) * np.exp(-slap_t / 0.02) + lp(rs.randn(len(slap_t)), 900, 2) * np.exp(-slap_t / 0.01) * 0.8)
    x = pulses(D, f_blade, slap, 0.002, 0.12, 91)
    x = lp(x, 1600, 2)
    tail = pulses(D, 78.0, np.sin(2 * np.pi * 300 * t_(0.008)) * np.exp(-t_(0.008) / 0.003), 0.002, 0.1, 92) * 0.12
    whine = np.sin(2 * np.pi * 5200 * tt) * 0.012 + np.sin(2 * np.pi * 2600 * tt) * 0.01
    wash = lp(rs.randn(len(tt)), 500, 2) * 0.25 * (1 + 0.4 * np.sin(2 * np.pi * f_blade * tt))
    x = x + tail + whine + wash
    return norm(loopify(x, 0.5), 0.85)


def wind_fall_loop(D=6.0):
    """free fall: a strong rushing wind with gusts flapping the clothes"""
    rs = np.random.RandomState(100)
    tt = t_(D)
    n = rs.randn(len(tt))
    x = bp(n, 150, 2500, 2) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.6 * tt)) + lp(n, 120, 2) * 1.5
    flap = (np.sin(2 * np.pi * 11 * tt + 2 * np.sin(2 * np.pi * 0.9 * tt)) > 0.6) * bp(n, 400, 2000, 2) * 0.3
    return norm(loopify(x + flap, 0.6), 0.8)


def chute_open():
    D = 1.2
    rs = np.random.RandomState(110)
    x = np.zeros(int(D * SR))
    t = t_(0.5)
    snap = bp(rs.randn(len(t)), 200, 3000, 2) * np.exp(-t / 0.06) + np.sin(2 * np.pi * 60 * t) * np.exp(-t / 0.08) * 0.8
    x[:len(t)] += snap
    t2 = t_(0.7)
    x[int(0.4 * SR):int(0.4 * SR) + len(t2)] += bp(rs.randn(len(t2)), 300, 1500, 2) * np.exp(-t2 / 0.25) * 0.4
    return fade(norm(x, 0.85))


# ------------------------------------------------------------------ air raid
def siren_loop(D=24.0):
    """an air-raid siren heard across town: two rotors rising together, holding, falling; echo off the hills"""
    tt = t_(D)
    # pitch: rises for 5 s, holds 6 s, falls for 8 s, a short low pause; loops at the low point
    f = np.interp(tt, [0, 5, 11, 19, 21, D], [150, 520, 540, 170, 140, 150])
    out = np.zeros_like(tt)
    for ratio, a in ((1.0, 1.0), (1.26, 0.6)):          # the two rotors: a minor third apart
        ph = 2 * np.pi * np.cumsum(f * ratio) / SR
        tone = sum(np.sin(k * ph) / k ** 1.3 for k in range(1, 9))   # rich, a little square
        out += tone * a
    out *= np.interp(tt, [0, 3, 18, 21, D], [0.35, 1.0, 1.0, 0.3, 0.35])
    out = bp(out, 120, 4500, 2)
    out = reverb(out, 3.5, 0.55, 3000, 120, 0.12)[:len(tt)]
    return norm(loopify(out, 1.5), 0.85)


def missile_incoming(D=4.0):
    """a missile coming in: a falling whistle and a growing rush of air"""
    rs = np.random.RandomState(130)
    tt = t_(D)
    f = 2600 * (1 - 0.65 * (tt / D) ** 1.4)
    whistle = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4 + np.sin(2 * np.pi * np.cumsum(f * 2.01) / SR) * 0.1
    rush = bp(rs.randn(len(tt)), 400, 5000, 2) * 0.6
    env = (tt / D) ** 2.2
    x = (whistle + rush) * env
    return fade(norm(x, 0.9), 0.3, 0.02)


def expl_big(D=6.0):
    """a heavy bomb or missile hit: the slam, a deep boom, debris raining down, the roll over the hills"""
    rs = np.random.RandomState(140)
    tt = t_(D)
    n = rs.randn(len(tt))
    slam = n * np.exp(-tt / 0.03) * 1.2
    boom = np.sin(2 * np.pi * np.cumsum(55 * np.exp(-tt / 0.6) + 22) / SR) * np.exp(-tt / 0.9) * 1.4
    body = lp(n, 500, 2) * np.exp(-tt / 0.5) * 1.5
    deb = np.zeros_like(tt)
    for k in range(160):
        at = rs.uniform(0.15, 2.5)
        i = int(at * SR)
        m = int(0.02 * SR)
        g = bp(rs.randn(m), 600, 5000, 2) * np.exp(-np.arange(m) / (m * 0.2)) * rs.uniform(0.05, 0.4) * np.exp(-at / 1.2)
        deb[i:i + m] += g
    x = sat(slam + boom + body, 2.5) + deb
    x = reverb(x, 4.0, 0.6, 1800, 141, 0.08)[:len(tt)]
    return fade(norm(x, 0.98), 0.0005, 1.0)


def cannon():
    """a tank's main gun: a huge crack, the boom, the breech clanking"""
    D = 3.0
    rs = np.random.RandomState(150)
    tt = t_(D)
    n = rs.randn(len(tt))
    x = n * np.exp(-tt / 0.012) * 1.5 + lp(n, 300, 2) * np.exp(-tt / 0.35) * 2.0
    x += np.sin(2 * np.pi * 45 * tt) * np.exp(-tt / 0.4)
    x = sat(x, 3.0)
    x = reverb(x, 2.5, 0.45, 2500, 151)[:len(tt)]
    t = t_(0.08)
    clank = np.sin(2 * np.pi * 1400 * t) * np.exp(-t / 0.02) + bp(rs.randn(len(t)), 1500, 6000, 2) * np.exp(-t / 0.01)
    i = int(1.6 * SR)
    x[i:i + len(t)] += clank * 0.25
    return fade(norm(x, 0.98), 0.0005, 0.6)


def rocket_launch():
    D = 2.5
    rs = np.random.RandomState(160)
    tt = t_(D)
    n = rs.randn(len(tt))
    x = n * np.exp(-tt / 0.02) * 0.8 + bp(n, 300, 4000, 2) * np.exp(-tt / 0.8) * 1.2 + lp(n, 200, 2) * np.exp(-tt / 0.5)
    return fade(norm(sat(x, 2.0), 0.9), 0.001, 0.4)


def plane_gun():
    """an aircraft cannon burst: a buzz of rounds (~70/s)"""
    D = 1.0
    rs = np.random.RandomState(170)
    x = np.zeros(int(D * SR))
    for k in range(70):
        t = t_(0.03)
        s = rs.randn(len(t)) * np.exp(-t / 0.004) + np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.01)
        i = int((0.02 + k / 70.0 * 0.9) * SR)
        x[i:i + len(t)] += s * rs.uniform(0.7, 1.0)
    x = reverb(lp(x, 5000, 2), 1.5, 0.3, 3000, 171)[:len(x)]
    return fade(norm(sat(x, 1.5), 0.9), 0.001, 0.15)


save('eng_car', car_loop())
save('eng_diesel', diesel_loop())
save('eng_tank', tank_loop())
save('tracks_loop', tracks_loop())
save('skid_loop', skid_loop())
save('engine_start', engine_start('car'))
save('engine_start_diesel', engine_start('diesel'))
save('car_door', door())
save('jet_loop', jet_loop())
save('jet_flyby', jet_flyby())
save('heli_loop', heli_loop())
save('wind_fall_loop', wind_fall_loop())
save('chute_open', chute_open())
save('siren_loop', siren_loop())
save('missile_incoming', missile_incoming())
save('expl_big', expl_big())
save('cannon', cannon())
save('rocket_launch', rocket_launch())
save('plane_gun', plane_gun())
