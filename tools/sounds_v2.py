#!/usr/bin/env python3
"""Call of Survival - sounds, second pass (numpy + scipy):
- a clean air-raid siren loop (one source, smooth rise and fall, the rotating horn's slow swell, seamless loop);
- distant gunshots (single shots and short bursts: the crack, the thump, the echo off the hills), short and light,
  in place of the ten-second recording that every far-away bot shot used to start;
- every short one-shot of the game rewritten as WAV, so a firefight does not keep a dozen Vorbis decoders busy
  (the cause of the crackle and drop-outs on phones).
usage: python3 sounds_v2.py <project_dir>"""
import glob
import os
import subprocess
import sys
import wave

import numpy as np
from scipy import signal

PROJ = sys.argv[1]
OUT = PROJ + '/sounds'
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


def norm(x, peak=0.9):
    m = np.abs(x).max()
    return x * (peak / m) if m > 0 else x


def fade(x, a=0.002, b=0.05):
    ia, ib = int(a * SR), int(b * SR)
    if ia:
        x[:ia] *= np.linspace(0, 1, ia)
    if ib:
        x[-ib:] *= np.linspace(1, 0, ib)
    return x


def ir(t60, bright=5000, seed=0, early=()):
    rs = np.random.RandomState(seed)
    t = t_(t60 * 1.2)
    r = lp(rs.randn(len(t)) * np.exp(-6.9 * t / t60), bright, 2)
    for at, g in early:                     # discrete echoes (hills, buildings)
        i = int(at * SR)
        if i < len(r):
            r[i] += g * 6.0
    return r


def reverb(x, t60, wet, bright=4000, seed=0, early=()):
    r = signal.fftconvolve(x, ir(t60, bright, seed, early))
    r = r / (np.abs(r).max() + 1e-9) * (np.abs(x).max() + 1e-9)
    y = np.pad(x, (0, len(r) - len(x)))
    return y * (1 - wet * 0.3) + r * wet


def write_wav(path, x):
    x = np.clip(np.asarray(x, np.float64), -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())


def save_wav(name, x):
    write_wav(OUT + '/' + name + '.wav', x)
    for old in (OUT + '/' + name + '.ogg', OUT + '/' + name + '.ogg.import'):
        if os.path.exists(old):
            os.remove(old)
    print('wav', name, '%.2f s' % (len(x) / SR))


def save_ogg(name, x, q=7):
    tmp = OUT + '/_tmp_' + name + '.wav'
    write_wav(tmp, x)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-c:a', 'libvorbis', '-q:a', str(q), OUT + '/' + name + '.ogg'], check=True)
    os.remove(tmp)
    print('ogg', name, '%.1f s' % (len(x) / SR))


# ---------------------------------------------------------------- the siren
def siren_loop(D=32.0):
    """one motor siren: winds up for 7 s, holds the high note for 9 s, winds down for 10 s, idles low; the rotating
    horn sweeps past the listener four times a second (a gentle swell, not a chop); the pitch curve and the phase both
    come back to where they started, so the loop never clicks"""
    tt = t_(D)
    f = np.interp(tt, [0, 7, 16, 26, 29, D], [190, 560, 575, 210, 185, 190])
    # whole cycles of the low rotor over the loop: no phase jump where it wraps
    cycles = np.sum(f) / SR
    f = f * (np.round(cycles) / cycles)
    out = np.zeros_like(tt)
    for ratio, a in ((1.0, 1.0), (1.26, 0.55)):         # the two rotor chambers (a major third apart)
        ph = 2 * np.pi * np.cumsum(f * ratio) / SR
        out += a * sum(np.sin(k * ph) / k ** 2.0 for k in range(1, 7))
    rot = 4.0 * (np.round(D * 4.0) / (D * 4.0))
    out *= 0.78 + 0.22 * np.sin(2 * np.pi * rot * tt)    # the horn turning
    out *= np.interp(tt, [0, 4, 24, 28, D], [0.55, 1.0, 1.0, 0.6, 0.55])
    out = bp(out, 140, 4200, 2)
    # a short, clean echo off the town (applied circularly so the tail wraps into the start)
    r = signal.fftconvolve(out, ir(2.2, 2600, 7, ((0.31, 0.22), (0.58, 0.12))))
    wrap = np.zeros_like(out)
    for i in range(0, len(r), len(out)):
        seg = r[i:i + len(out)]
        wrap[:len(seg)] += seg
    wrap = wrap / (np.abs(wrap).max() + 1e-9) * np.abs(out).max()
    return norm(out * 0.85 + wrap * 0.3, 0.8)


# ---------------------------------------------------------------- distant gunfire
def shot_far(seed, d=1.6, dist=0.6):
    """one rifle shot from a few hundred metres: the crack arrives thin and short, then the muzzle thump,
    then the echo rolling off the hills and the houses"""
    rs = np.random.RandomState(seed)
    tt = t_(d)
    n = rs.randn(len(tt))
    crack = hp(n, 1800, 2) * np.exp(-tt / 0.0025) * 0.9
    thump = lp(n, 900 - 500 * dist, 2) * np.exp(-tt / (0.018 + 0.02 * dist)) * 1.6
    boom = np.sin(2 * np.pi * np.cumsum(95 * np.exp(-tt / 0.08) + 45) / SR) * np.exp(-tt / 0.07) * 0.7
    x = crack * (1.0 - dist * 0.7) + thump + boom
    x = lp(x, 6000 - 3500 * dist, 2)
    x = reverb(x, 1.3 + 0.6 * dist, 0.55 + 0.25 * dist, 2200, seed + 1, ((0.21 + rs.uniform(0, 0.2), 0.35), (0.55 + rs.uniform(0, 0.3), 0.2)))[:len(tt)]
    return fade(norm(x, 0.85), 0.0005, 0.25)


def burst_far(seed, rounds=3, rpm=650, d=1.9):
    """a short burst from an automatic rifle far away"""
    rs = np.random.RandomState(seed)
    x = np.zeros(int(d * SR))
    for k in range(rounds):
        s = shot_far(seed * 10 + k, 0.9, 0.65) * rs.uniform(0.8, 1.0)
        i = int(k * 60.0 / rpm * SR * rs.uniform(0.95, 1.05))
        x[i:i + len(s)] += s[:len(x) - i]
    return fade(norm(x, 0.85), 0.0005, 0.3)


# ---------------------------------------------------------------- the short one-shots as WAV
def ogg_to_wav(path):
    name = os.path.basename(path)[:-4]
    out = OUT + '/' + name + '.wav'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-sample_fmt', 's16', out], check=True)
    os.remove(path)
    if os.path.exists(path + '.import'):
        os.remove(path + '.import')
    print('wav', name, '(from ogg)')


LONG = {'siren_loop', 'battle_loop', 'wind_loop', 'rain_loop', 'stove_loop', 'drone_loop', 'hypersonic_raid', 'reloads_all',
        'enemy_fire', 'walk_1', 'walk_2', 'walk_3', 'walk_4', 'jet_flyby', 'jet_loop', 'eng_tank', 'eng_car', 'eng_diesel',
        'heli_loop', 'breath_loop', 'wind_fall_loop', 'tracks_loop', 'skid_loop'}

if __name__ == '__main__':
    save_ogg('siren_loop', siren_loop(), 8)
    for k in range(4):
        save_wav('shot_far_%d' % (k + 1), shot_far(300 + k * 7, 1.6, 0.55 + 0.1 * k))
    for k in range(3):
        save_wav('burst_far_%d' % (k + 1), burst_far(400 + k * 5, 3 + k % 2))
    for p in sorted(glob.glob(OUT + '/*.ogg')):
        base = os.path.basename(p)[:-4]
        key = base.rsplit('_', 1)[0] if base.rsplit('_', 1)[-1].isdigit() else base
        if base in LONG or key in LONG:
            continue
        dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p],
                                   capture_output=True, text=True).stdout.strip() or 0)
        if dur <= 6.0:
            ogg_to_wav(p)
