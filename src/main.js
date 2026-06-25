// main.js

import './style.css';
import { BLOCK_NAMES, BLOCK_COLORS, BIT_SECONDS } from './constants.js';
import { loadSounds, buildAudioEvents, closeAudio, getCtx } from './audio.js';
import { spriteImages, buildSpriteEvents, activateBlock, deactivateBlock } from './sprites.js';

// ── 전역 데이터 ───────────────────────────────────
let songData = {};
let TileConfigs, TileDurations, Tiles, Sounds;

let blockOrder = Array.from({length: 16}, (_, i) => i);
const mutedBlocks = new Set();
let isPlaying = false;
let isPaused = false;
let animFrame = null;
const activeBlocks = new Array(16).fill(null);
let activeTimers = [];
let dragMode = false;
let dragSrcIdx = null;
let noStyleMode = false; // 스타일 없애기 모드

// ── 데이터 로드 ───────────────────────────────────
async function loadGameData() {
  await loadScript('/js/prototype.js');
  await loadScript('/js/data.js');
  await loadScript('/js/tiles.js');
  TileConfigs = window.TileConfigs;
  TileDurations = window.TileDurations;
  Tiles = window.Tiles;
  Sounds = window.Sounds;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── 그리드 생성 ──────────────────────────────────
function buildGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  blockOrder.forEach(id => {
    const el = document.createElement('div');
    el.className = 'block';
    el.dataset.id = id;
    el.style.setProperty('--c', BLOCK_COLORS[id]);
    if (mutedBlocks.has(id)) el.classList.add('muted');
    if (noStyleMode) el.classList.add('no-style');
    el.draggable = dragMode;
    el.innerHTML = `
      <div class="block-flash"></div>
      <img class="block-sprite" alt="">
      <div class="block-placeholder">
        <div class="block-num">${id}</div>
        <div class="block-name">${BLOCK_NAMES[id]}</div>
      </div>
      <div class="block-tile"></div>
      <div class="block-mute-icon">🔇</div>`;

    el.addEventListener('click', () => { if (!dragMode) openSpriteModal(id); });
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      mutedBlocks.has(id) ? mutedBlocks.delete(id) : mutedBlocks.add(id);
      el.classList.toggle('muted');
    });
    grid.appendChild(el);
  });
}

// ── 드래그 ───────────────────────────────────────
function setupDrag() {
  const grid = document.getElementById('grid');

  grid.addEventListener('dragstart', e => {
    const block = e.target.closest('.block');
    if (!block || !dragMode) return;
    dragSrcIdx = blockOrder.indexOf(parseInt(block.dataset.id));
    block.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  grid.addEventListener('dragend', () => {
    document.querySelectorAll('.block').forEach(el => el.classList.remove('dragging'));
  });

  grid.addEventListener('dragover', e => {
    if (!dragMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  grid.addEventListener('drop', e => {
    if (!dragMode) return;
    e.preventDefault();
    const block = e.target.closest('.block');
    if (!block || dragSrcIdx === null) return;
    const dstIdx = blockOrder.indexOf(parseInt(block.dataset.id));
    if (dstIdx === dragSrcIdx) { dragSrcIdx = null; return; }
    [blockOrder[dragSrcIdx], blockOrder[dstIdx]] = [blockOrder[dstIdx], blockOrder[dragSrcIdx]];
    dragSrcIdx = null;
    buildGrid();
  });
}

// ── 스프라이트 편집 팝업 ──────────────────────────
function openSpriteModal(id) {
  const tileCount = Tiles?.[id]?.length ?? 0;
  const nameEl = document.getElementById('sprite-modal-block-name');
  nameEl.textContent = `${BLOCK_NAMES[id]}  (Block ${id})`;
  nameEl.style.color = BLOCK_COLORS[id];

  const tileGrid = document.getElementById('sprite-tile-grid');
  tileGrid.innerHTML = '';

  for (let t = 0; t < tileCount; t++) {
    const key = `${id}_${t}`;
    const item = document.createElement('div');
    item.className = 'sprite-tile-item';

    const img = document.createElement('img');
    if (spriteImages[key]) { img.src = spriteImages[key]; img.style.display = 'block'; }

    const numEl = document.createElement('div');
    numEl.className = 'tile-num';
    numEl.textContent = spriteImages[key] ? '' : t;

    const subEl = document.createElement('div');
    subEl.className = 'tile-sub';
    subEl.textContent = `TILE ${t}`;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';

    item.append(img, numEl, subEl, fileInput);
    item.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      spriteImages[key] = url;
      img.src = url;
      img.style.display = 'block';
      numEl.textContent = '';
      item.style.borderColor = BLOCK_COLORS[id];
      item.style.borderStyle = 'solid';
    });

    tileGrid.appendChild(item);
  }

  document.getElementById('sprite-modal').classList.add('open');
}

// ── 재생/일시정지/정지 ────────────────────────────
let _ctx = null;
let _blockGains = null;
let _startTime = null;
let _pausedAt = null; // 일시정지 시점 (elapsed ms)
let _audioEvents = [];
let _audioPtr = 0;
let _spriteEvents = [];
let _spritePtr = 0;
let _songDuration = 0;

async function playSong() {
  // 일시정지 → 재개
  if (isPaused && _ctx) {
    await _ctx.resume();
    isPaused = false;
    isPlaying = true;
    document.getElementById('btn-play').textContent = '⏸ Pause';
    document.getElementById('status').textContent = 'PLAYING';
    loop();
    return;
  }

  if (isPlaying) return;

  document.getElementById('btn-play').disabled = true;
  document.getElementById('status').textContent = 'LOADING...';

  const { ctx, soundBuffers } = await loadSounds(songData, Sounds);
  _ctx = ctx;

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(ctx.destination);

  _blockGains = {};
  for (let id = 0; id < 16; id++) {
    const g = ctx.createGain();
    g.gain.value = mutedBlocks.has(id) ? 0 : 1;
    g.connect(masterGain);
    _blockGains[id] = g;
  }

  if (ctx.state === 'suspended') await ctx.resume();

  _startTime = ctx.currentTime + 0.1;
  _pausedAt = null;
  _audioPtr = 0;
  _spritePtr = 0;

  _audioEvents = buildAudioEvents(songData, _startTime);
  _spriteEvents = buildSpriteEvents(songData, TileConfigs, TileDurations);
  _songDuration = 0;
  _spriteEvents.forEach(e => { if (e.endMs > _songDuration) _songDuration = e.endMs; });

  document.getElementById('status').textContent = 'PLAYING';
  document.getElementById('btn-play').textContent = '⏸ Pause';
  document.getElementById('btn-play').disabled = false;
  document.getElementById('btn-stop').disabled = false;
  isPlaying = true;
  isPaused = false;

  loop();
}

function pauseSong() {
  if (!isPlaying || !_ctx) return;
  _ctx.suspend();
  _pausedAt = (_ctx.currentTime - _startTime) * 1000;
  isPlaying = false;
  isPaused = true;
  if (animFrame) cancelAnimationFrame(animFrame);
  activeTimers.forEach(clearTimeout);
  activeTimers = [];
  document.getElementById('btn-play').textContent = '▶ Play';
  document.getElementById('status').textContent = 'PAUSED';
}

function stopSong() {
  isPlaying = false;
  isPaused = false;
  _pausedAt = null;
  if (animFrame) cancelAnimationFrame(animFrame);
  activeTimers.forEach(clearTimeout);
  activeTimers = [];
  for (let id = 0; id < 16; id++) deactivateBlock(id);
  document.getElementById('tl-bar').style.width = '0%';
  document.getElementById('status').textContent = 'READY';
  document.getElementById('btn-play').textContent = '▶ Play';
  document.getElementById('btn-play').disabled = false;
  document.getElementById('btn-stop').disabled = true;
  closeAudio();
  _ctx = null;
}

function loop() {
  if (!isPlaying || !_ctx) return;
  const now = _ctx.currentTime;
  const elapsedMs = (now - _startTime) * 1000;
  const LOOKAHEAD = 0.2;

  document.getElementById('tl-bar').style.width =
    Math.min(elapsedMs / _songDuration * 100, 100) + '%';

  while (_audioPtr < _audioEvents.length && _audioEvents[_audioPtr].t < now + LOOKAHEAD) {
    const ev = _audioEvents[_audioPtr++];
    if (ev.t < now - 0.05) continue;
    const src = _ctx.createBufferSource();
    src.buffer = ev.buf;
    src.connect(_blockGains[ev.id]);
    if (ev.dur) src.start(ev.t, 0, ev.dur * BIT_SECONDS);
    else src.start(ev.t);
    src.onended = () => src.disconnect();
  }

  while (_spritePtr < _spriteEvents.length && _spriteEvents[_spritePtr].timeMs <= elapsedMs) {
    const ev = _spriteEvents[_spritePtr++];
    activateBlock(ev.id, ev.tileIdx, mutedBlocks);
    activeBlocks[ev.id] = ev;
    const t = setTimeout(() => {
      if (activeBlocks[ev.id] === ev) {
        deactivateBlock(ev.id);
        activeBlocks[ev.id] = null;
      }
    }, ev.endMs - elapsedMs);
    activeTimers.push(t);
  }

  if (elapsedMs >= _songDuration) { stopSong(); return; }
  animFrame = requestAnimationFrame(loop);
}

// ── 이벤트 바인딩 ─────────────────────────────────
function bindEvents() {
  // Play/Pause 토글
  document.getElementById('btn-play').addEventListener('click', () => {
    if (isPlaying) pauseSong();
    else playSong();
  });
  document.getElementById('btn-stop').addEventListener('click', stopSong);
  document.getElementById('btn-reset').addEventListener('click', stopSong);

  // 설정 패널
  document.getElementById('settings-btn').addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('settings-panel').classList.toggle('open');
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#settings-panel') && !e.target.closest('#settings-btn'))
      document.getElementById('settings-panel').classList.remove('open');
  });

  // 배경색
  document.getElementById('bg-color').addEventListener('input', e => {
    document.body.style.background = e.target.value;
  });

  // 배경 이미지
  document.getElementById('bg-image-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    document.body.style.backgroundImage = `url(${url})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
  });
  document.getElementById('bg-image-clear').addEventListener('click', () => {
    document.body.style.backgroundImage = '';
    document.getElementById('bg-image-input').value = '';
  });

  // 드래그 모드
  document.getElementById('drag-toggle').addEventListener('click', () => {
    dragMode = !dragMode;
    const btn = document.getElementById('drag-toggle');
    btn.textContent = dragMode ? '드래그 모드 ON' : '드래그 모드 OFF';
    btn.classList.toggle('active', dragMode);
    // draggable 속성 직접 업데이트
    document.querySelectorAll('.block').forEach(el => { el.draggable = dragMode; });
  });

  // 스타일 없애기
  document.getElementById('no-style-toggle').addEventListener('click', () => {
    noStyleMode = !noStyleMode;
    const btn = document.getElementById('no-style-toggle');
    btn.textContent = noStyleMode ? '스타일 없애기 ON' : '스타일 없애기 OFF';
    btn.classList.toggle('active', noStyleMode);
    document.querySelectorAll('.block').forEach(el => el.classList.toggle('no-style', noStyleMode));
  });

  // 팝업 닫기
  document.getElementById('sprite-modal-close').addEventListener('click', () => {
    document.getElementById('sprite-modal').classList.remove('open');
  });
  document.getElementById('sprite-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('sprite-modal'))
      document.getElementById('sprite-modal').classList.remove('open');
  });
}

// ── 초기화 ───────────────────────────────────────
async function init() {
  await loadGameData();
  buildGrid();
  setupDrag();
  bindEvents();

  await Promise.all(Array.from({length: 16}, async (_, i) => {
    try {
      const res = await fetch(`/song/${i}.json`);
      songData[i] = await res.json();
    } catch(e) { songData[i] = []; }
  }));

  document.getElementById('status').textContent = 'READY';
}

init();
