'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Icons from './Icons';

interface AudioPlayerProps {
  src: string;
  uploading?: boolean;
  filename?: string;
}

const BAR_COUNT = 120;
const SPEEDS = [1, 1.3, 1.5, 2] as const;

function fmt(t: number) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ src, uploading, filename }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const peaksRef = useRef<number[] | null>(null);
  const rafRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<number>(1);
  const [waveLoading, setWaveLoading] = useState(true);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Force the audio element to fetch the new src. Without this, swapping src
  // via React props (e.g. blob URL → Convex signed URL after re-mounting from
  // navigation) sometimes leaves the element in a stale state where play()
  // throws NotSupportedError because no media source got attached.
  useEffect(() => {
    setAudioError(null);
    setCurrentTime(0);
    setPlaying(false);
    const a = audioRef.current;
    if (a) {
      try { a.load(); } catch (e) { console.warn('[AudioPlayer] load() failed', e); }
    }
  }, [src]);

  // Decode the audio source into N peak samples for the waveform render.
  // Falls back to a flat bar set on decode failure (some browsers reject blob: URLs).
  useEffect(() => {
    let cancelled = false;
    setWaveLoading(true);
    peaksRef.current = null;
    drawWave();

    (async () => {
      try {
        const res = await fetch(src);
        const buf = await res.arrayBuffer();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        const ac = new AC();
        const audioBuf = await ac.decodeAudioData(buf.slice(0));
        await ac.close().catch(() => {});
        if (cancelled) return;

        const channel = audioBuf.getChannelData(0);
        const blockSize = Math.floor(channel.length / BAR_COUNT);
        const peaks: number[] = new Array(BAR_COUNT);
        for (let i = 0; i < BAR_COUNT; i++) {
          let max = 0;
          const start = i * blockSize;
          const end = Math.min(start + blockSize, channel.length);
          for (let j = start; j < end; j++) {
            const v = Math.abs(channel[j]);
            if (v > max) max = v;
          }
          peaks[i] = max;
        }
        const norm = Math.max(...peaks, 0.001);
        peaksRef.current = peaks.map((p) => p / norm);
        setWaveLoading(false);
        drawWave();
      } catch (e) {
        if (cancelled) return;
        console.warn('[AudioPlayer] decode failed, using flat waveform', e);
        peaksRef.current = new Array(BAR_COUNT).fill(0.4);
        setWaveLoading(false);
        drawWave();
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const drawWave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.clearRect(0, 0, w, h);

    const peaks = peaksRef.current;
    if (!peaks) return;

    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#d4a017';
    const muted = getComputedStyle(document.documentElement).getPropertyValue('--text-faint').trim() || '#888';

    const total = duration || audioRef.current?.duration || 0;
    const progress = total > 0 ? Math.min(1, currentTime / total) : 0;
    const playedBars = Math.floor(progress * BAR_COUNT);

    const gap = Math.max(1, Math.floor(1 * dpr));
    const barW = Math.max(1, Math.floor((w - gap * (BAR_COUNT - 1)) / BAR_COUNT));
    const minH = Math.max(1, Math.floor(2 * dpr));

    for (let i = 0; i < BAR_COUNT; i++) {
      const p = peaks[i];
      const bh = Math.max(minH, Math.floor(p * h * 0.92));
      const x = i * (barW + gap);
      const y = Math.floor((h - bh) / 2);
      ctx.fillStyle = i < playedBars ? accent : muted;
      ctx.fillRect(x, y, barW, bh);
    }
  }, [currentTime, duration]);

  useEffect(() => {
    // Redraw whenever drawWave changes, AND once when waveLoading flips from
    // true → false (canvas only mounts after loading text disappears, so the
    // first draw inside the decode promise misses it).
    drawWave();
  }, [drawWave, waveLoading]);

  useEffect(() => {
    const onResize = () => drawWave();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [drawWave]);

  // Drive currentTime via RAF while playing — gives smoother cursor than `timeupdate`.
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const a = audioRef.current;
      if (a) setCurrentTime(a.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  function onLoadedMeta() {
    const a = audioRef.current;
    if (!a) return;
    if (isFinite(a.duration)) setDuration(a.duration);
  }

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch((err) => {
        console.error('[AudioPlayer] play failed', err);
        setAudioError('Playback failed — try reloading the page');
      });
    } else {
      a.pause();
    }
  }

  function skip(delta: number) {
    const a = audioRef.current;
    if (!a) return;
    const total = duration || a.duration || 0;
    a.currentTime = Math.max(0, Math.min(total, a.currentTime + delta));
    setCurrentTime(a.currentTime);
  }

  function setRate(r: number) {
    setSpeed(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  }

  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const a = audioRef.current;
    if (!a) return;
    const total = duration || a.duration || 0;
    if (total <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    a.currentTime = Math.max(0, Math.min(total, ratio * total));
    setCurrentTime(a.currentTime);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      skip(-15);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      skip(15);
    }
  }

  return (
    <div className="audio-player" tabIndex={0} onKeyDown={onKeyDown}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={onLoadedMeta}
        onDurationChange={onLoadedMeta}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={(e) => {
          const code = e.currentTarget.error?.code;
          console.error('[AudioPlayer] media error', code, e.currentTarget.error?.message);
          setAudioError('Audio failed to load');
        }}
        style={{ display: 'none' }}
      />

      <div className="ap-controls">
        <button className="ap-btn" title="Back 15s" onClick={() => skip(-15)}>
          <Icons.SkipBack size={13} />
        </button>
        <button className="ap-btn ap-play" title={playing ? 'Pause' : 'Play'} onClick={togglePlay}>
          {playing ? <Icons.Pause size={13} /> : <Icons.Play size={13} />}
        </button>
        <button className="ap-btn" title="Forward 15s" onClick={() => skip(15)}>
          <Icons.SkipForward size={13} />
        </button>
      </div>

      <div className="ap-wave-wrap">
        {audioError ? (
          <div className="ap-wave-loading ap-error">{audioError}</div>
        ) : waveLoading ? (
          <div className="ap-wave-loading">loading waveform…</div>
        ) : (
          <canvas ref={canvasRef} className="ap-canvas" onClick={onCanvasClick} />
        )}
      </div>

      <div className="ap-time">
        {fmt(currentTime)} / {fmt(duration)}
      </div>

      <div className="ap-speeds">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={'ap-speed-btn' + (speed === s ? ' active' : '')}
            onClick={() => setRate(s)}
            title={`${s}× playback`}
          >
            {s}×
          </button>
        ))}
      </div>

      <a className="ap-btn" href={src} download={filename} title="Download recording">
        <Icons.Download size={13} />
      </a>

      {uploading && <span className="ap-uploading">uploading…</span>}
    </div>
  );
}
