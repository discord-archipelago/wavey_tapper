// sprites.js - 스프라이트 이벤트 빌드 및 블록 UI

import { BIT_MS, BLOCK_COLORS, BLOCK_NAMES } from './constants.js';

// 전역 스프라이트 이미지 저장소
export const spriteImages = {}; // "id_tileIdx" → url

export function buildSpriteEvents(songData, TileConfigs, TileDurations) {
  const events = [];
  for (let id = 0; id < 16; id++) {
    const configs = TileConfigs[id];
    const durations = TileDurations[id];
    const song = songData[id];
    if (!song || !configs) continue;
    song.forEach((bar, barIdx) => {
      bar.forEach(ev => {
        const [bit, soundIdx, dur] = ev;
        const cfg = configs[soundIdx];
        if (!cfg) return;
        const [L, R] = cfg;
        const tileIdx = (L > 0 ? L : R) - 1;
        if (tileIdx < 0) return;
        const timeMs = (bit + barIdx * 192) * BIT_MS;
        const durBits = dur ?? (durations?.[soundIdx] ?? 6);
        const endMs = timeMs + durBits * BIT_MS;
        events.push({ timeMs, endMs, id, tileIdx });
      });
    });
  }
  return events.sort((a, b) => a.timeMs - b.timeMs);
}

export function activateBlock(id, tileIdx, mutedBlocks) {
  if (mutedBlocks.has(id)) return;
  const el = document.querySelector(`.block[data-id="${id}"]`);
  if (!el) return;
  el.classList.add('active');
  el.querySelector('.block-tile').textContent = `T${tileIdx}`;
  const img = el.querySelector('.block-sprite');
  const key = `${id}_${tileIdx}`;
  if (spriteImages[key]) {
    img.src = spriteImages[key];
    img.style.display = 'block';
    el.querySelector('.block-placeholder').style.display = 'none';
  } else {
    img.style.display = 'none';
    el.querySelector('.block-placeholder').style.display = 'flex';
    el.querySelector('.block-num').textContent = tileIdx;
  }
  const flash = el.querySelector('.block-flash');
  flash.style.opacity = '0.12';
  setTimeout(() => flash.style.opacity = '0', 80);
}

export function deactivateBlock(id) {
  const el = document.querySelector(`.block[data-id="${id}"]`);
  if (!el) return;
  el.classList.remove('active');
  el.querySelector('.block-tile').textContent = '';
  el.querySelector('.block-num').textContent = id;
  el.querySelector('.block-placeholder').style.display = 'flex';
  el.querySelector('.block-sprite').style.display = 'none';
}
