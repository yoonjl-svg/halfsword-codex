import { Sound, VOICES } from './sound.js';

const sound = new Sound();
const status = document.querySelector('#status');
const container = document.querySelector('#characters');
let revision = 0;
let loadQueue = Promise.resolve();
let finishTimer;
let activeButton;

function stopAudio() {
  revision++;
  clearTimeout(finishTimer);
  activeButton?.classList.remove('is-playing');
  activeButton = null;
  sound.on = false;
  if (!sound.ctx) return;
  const now = sound.ctx.currentTime;
  for (const event of sound.voices) {
    event.out.gain.cancelScheduledValues(now);
    event.out.gain.setValueAtTime(0, now);
    for (const source of event.srcs) {
      try { source.stop(now); } catch { /* A completed source is already silent. */ }
    }
  }
  sound.voices = [];
}

document.querySelector('#stop').addEventListener('click', () => {
  stopAudio();
  status.textContent = '재생을 멈췄어요.';
});
window.addEventListener('pagehide', stopAudio);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAudio();
    status.textContent = '재생을 멈췄어요. 버튼을 누르면 다시 들을 수 있어요.';
  }
});

async function play(row, voice, kind, label, button) {
  stopAudio();
  const request = revision;
  try {
    // Unlock synchronously in the tap handler, before waiting for downloads.
    sound.unlock();
    if (!sound.ctx) throw new Error('audio-unavailable');
    status.textContent = `${row.name} · ${label} 녹음을 불러오는 중…`;
    const ids = [...new Set([row.before, row.voice].filter(Boolean))];
    if (ids.some((id) => !VOICES[id]?.rec)) throw new Error('voice-unavailable');
    // Keep row switches sequential so an older download cannot replace this row.
    loadQueue = loadQueue.catch(() => {}).then(async () => {
      await sound.samplesReady;
      if (request !== revision) return;
      await sound.loadVoiceSamples(ids);
    });
    await loadQueue;
    if (request !== revision) return;
    if (!sound.samples[`voice:${voice}:${kind}`]?.length) throw new Error('sample-unavailable');
    if (sound.ctx.state !== 'running') throw new Error('audio-suspended');
    sound.on = true;
    if (kind === 'hurt') sound.hurt(voice, 0.7);
    else sound.death(voice, kind === 'ko' ? '기절' : '출혈');
    activeButton = button;
    button.classList.add('is-playing');
    const eventLabel = kind === 'hurt' ? '짧은 신음' : kind === 'ko' ? '기절' : '출혈';
    status.textContent = `${row.name} · ${label} · ${eventLabel} 재생 중`;
    const end = Math.max(sound.ctx.currentTime, ...sound.voices.map((event) => event.end));
    finishTimer = setTimeout(() => {
      if (request !== revision) return;
      button.classList.remove('is-playing');
      activeButton = null;
      status.textContent = `${row.name} · ${label} · 재생 완료`;
    }, Math.max(0, end - sound.ctx.currentTime) * 1000 + 100);
  } catch {
    if (request !== revision) return;
    stopAudio();
    status.textContent = '소리를 재생하지 못했어요. 연결과 휴대폰 음량을 확인한 뒤 버튼을 다시 눌러 주세요.';
  }
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function controls(row, voice, label) {
  const group = element('fieldset');
  group.append(element('legend', label));
  const buttons = element('div', '', 'buttons');
  for (const [kind, text] of [['hurt', '짧은 신음'], ['ko', '기절'], ['bleed', '출혈']]) {
    const button = element('button', text);
    button.type = 'button';
    button.setAttribute('aria-label', `${row.name} ${label} ${text} 듣기`);
    button.addEventListener('click', () => play(row, voice, kind, label, button));
    buttons.append(button);
  }
  group.append(buttons);
  return group;
}

async function showCast() {
  try {
    const response = await fetch('./voice-casting.json');
    if (!response.ok) throw new Error('catalog-unavailable');
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('invalid-catalog');
    const ordered = [...rows].sort((a, b) => Number(Boolean(b.changed)) - Number(Boolean(a.changed)));
    for (const row of ordered) {
      const excluded = row.id === 'sherpa';
      const changed = Boolean(row.changed) && !excluded;
      const card = element('section', '', `character${changed ? ' changed' : ''}`);
      card.dataset.character = row.id;
      const title = element('h2', row.name);
      title.id = `character-${row.id}`;
      card.setAttribute('aria-labelledby', title.id);
      card.append(title);
      const meta = element('p', `${row.id === 'player' ? '내 캐릭터' : row.age == null ? '나이 미상' : `${row.age}세`} · `, 'meta');
      meta.append(element('span', excluded ? '이번 비교 제외 · 기존 유지' : changed ? '새 배정' : row.id === 'player' ? '사망음 교정' : '기존 유지', 'badge'));
      card.append(meta);
      if (row.note) card.append(element('p', row.note));
      if (!excluded) {
        if (changed) card.append(controls(row, row.before, '이전'), controls(row, row.voice, '새 배정'));
        else card.append(controls(row, row.voice, '현재 목소리'));
      }
      if (changed) {
        const link = element('a', '이 인물과 겨루기 →', 'game-link');
        link.href = `./?foe=${encodeURIComponent(row.id)}`;
        card.append(link);
      }
      container.append(card);
    }
    status.textContent = '듣고 싶은 인물의 버튼을 눌러 주세요.';
  } catch {
    status.textContent = '인물 목록을 불러오지 못했어요. 연결을 확인하고 페이지를 새로 열어 주세요.';
  }
}

showCast();
