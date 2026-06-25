// audio.js - 오디오 로드 및 재생

import { BIT_SECONDS, BIT_MS, WAV_FOLDERS, BLOCK_NAMES } from './constants.js';

let ctx = null;
let soundBuffers = {};

export function getCtx() { return ctx; }

export async function loadSounds(songData, Sounds) {
  ctx = new AudioContext();

  const needed = {};
  for (let id = 0; id < 16; id++) {
    needed[id] = new Set();
    (songData[id] ?? []).forEach(bar => bar.forEach(ev => needed[id].add(ev[1])));
  }

  soundBuffers = {};

  for (let id = 0; id < 16; id++) {
    const folder = WAV_FOLDERS[id];
    if (!folder || needed[id].size === 0) continue;
    const list = Sounds[id] ?? [];
    soundBuffers[id] = [];

    document.getElementById('status').textContent =
      `LOADING... ${id + 1}/16  ${BLOCK_NAMES[id]} (${needed[id].size}개)`;

    await Promise.all([...needed[id]].map(async (i) => {
      const name = list[i];
      if (!name) return;
      try {
        const res = await fetch(`/wav_used/${folder}/${name}.wav`);
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        soundBuffers[id][i] = await ctx.decodeAudioData(buf);
      } catch(e) {}
    }));
  }

  return { ctx, soundBuffers };
}

export function buildAudioEvents(songData, startTime) {
  const events = [];
  for (let id = 0; id < 16; id++) {
    const song = songData[id];
    if (!song) continue;
    song.forEach((bar, barIdx) => {
      bar.forEach(ev => {
        const [bit, soundIdx, dur] = ev;
        const buf = soundBuffers[id]?.[soundIdx];
        if (!buf) return;
        const t = startTime + (bit + barIdx * 192) * BIT_SECONDS;
        events.push({ t, buf, dur, id });
      });
    });
  }
  return events.sort((a, b) => a.t - b.t);
}

export function closeAudio() {
  if (ctx) { ctx.close().catch(() => {}); ctx = null; }
  soundBuffers = {};
}
