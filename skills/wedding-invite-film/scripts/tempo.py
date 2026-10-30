"""Estimate a song's tempo and first beat → {"bpm": 83.95, "first_beat": 0.135} on stdout.

usage: python -I tempo.py audio/song.wav

Onset-strength envelope (spectral flux), autocorrelation over 60–180 BPM, then the beat phase with the
strongest onsets. Good enough to land ceremony changes on the beat; set invite.song.bpm by hand if it's off.
"""
import json, subprocess, sys
import numpy as np

SR, HOP, N = 22050, 512, 2048
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", sys.argv[1], "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                     capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32)
frames = np.lib.stride_tricks.sliding_window_view(x, N)[::HOP] * np.hanning(N)
mag = np.log1p(np.abs(np.fft.rfft(frames, axis=1)))
flux = np.maximum(np.diff(mag, axis=0), 0).sum(1)
flux = (flux - flux.mean()) / (flux.std() + 1e-9)
fps = SR / HOP

ac = np.correlate(flux, flux, "full")[len(flux) - 1:]
lags = np.arange(len(ac))
bpms = 60 * fps / np.maximum(lags, 1)
ok = (bpms >= 60) & (bpms <= 180)
# favour tempos near 100 BPM a little (avoids picking double/half time)
score = ac * ok * np.exp(-0.5 * (np.log2(np.maximum(bpms, 1) / 100) / 0.9) ** 2)
lag = int(np.argmax(score))
# refine with parabolic interpolation
if 1 <= lag < len(score) - 1:
    a, b, c = score[lag - 1], score[lag], score[lag + 1]
    lag = lag + 0.5 * (a - c) / (a - 2 * b + c + 1e-12)
bpm = 60 * fps / lag
period = lag
phases = np.arange(0, period, 0.5)
idx = lambda ph: np.round(np.arange(ph, len(flux), period)).astype(int)
best = max(phases, key=lambda ph: flux[idx(ph)[idx(ph) < len(flux)]].mean())
print(json.dumps({"bpm": round(float(bpm), 2), "first_beat": round(float(best / fps), 3)}))
