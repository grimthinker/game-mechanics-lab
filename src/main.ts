import { GameApp } from './GameApp';
import { Creature } from './Creature';
import { CreatureType } from './types';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const app = new GameApp(canvas);

app.start();

const toggleObstacles = document.getElementById('toggle-obstacles') as HTMLInputElement;
const fileInput = document.getElementById('file-obstacles') as HTMLInputElement;
const btnTriggerFile = document.getElementById('btn-trigger-file') as HTMLButtonElement;

const spawnModal = document.getElementById('spawn-modal') as HTMLDivElement;
const spawnModalBackdrop = document.getElementById('spawn-modal-backdrop') as HTMLDivElement;
const spawnTypeLabel = document.getElementById('spawn-type-label') as HTMLParagraphElement;
const selectRadius = document.getElementById('select-radius') as HTMLSelectElement;
const inputMass = document.getElementById('input-mass') as HTMLInputElement;
const inputMaxSpeed = document.getElementById('input-max-speed') as HTMLInputElement;
const inputMaxTurnSpeed = document.getElementById('input-max-turn-speed') as HTMLInputElement;
const btnSpawnCancel = document.getElementById('btn-spawn-cancel') as HTMLButtonElement;
const btnSpawnConfirm = document.getElementById('btn-spawn-confirm') as HTMLButtonElement;

const btnAddPlayer = document.getElementById('btn-add-player') as HTMLButtonElement;
const btnAddAi = document.getElementById('btn-add-ai') as HTMLButtonElement;

const selectionHint = document.getElementById('selection-hint') as HTMLParagraphElement;
const selectedStats = document.getElementById('selected-stats') as HTMLDListElement;
const statType = document.getElementById('stat-type') as HTMLElement;
const statRadius = document.getElementById('stat-radius') as HTMLElement;
const statMass = document.getElementById('stat-mass') as HTMLElement;
const statCurrentSpeed = document.getElementById('stat-current-speed') as HTMLElement;
const statCurrentTurnSpeed = document.getElementById('stat-current-turn-speed') as HTMLElement;

let pendingSpawnType: CreatureType | null = null;
const keysPressed = new Set<string>();
let controlledCreature: Creature | null = null;

const CONTROL_KEYS = new Set(['w', 'a', 'd']);

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
}

function getControllablePlayer(): Creature | null {
  const creature = app.selectedCreature;
  return creature?.type === 'player' ? creature : null;
}

function syncPlayerControls(): void {
  const player = getControllablePlayer();

  if (controlledCreature && controlledCreature !== player) {
    controlledCreature.stopMovingForward();
    controlledCreature.stopTurning();
  }

  controlledCreature = player;

  if (!player) return;

  if (keysPressed.has('w')) player.startMovingForward();
  else player.stopMovingForward();

  if (keysPressed.has('a')) player.startTurning(-1);
  else if (keysPressed.has('d')) player.startTurning(1);
  else player.stopTurning();
}

function onSelectionChanged(): void {
  syncPlayerControls();
  updateSelectedCreaturePanel();
}

function getSpawnParams() {
  return {
    radius: parseInt(selectRadius.value, 10),
    mass: parseFloat(inputMass.value),
    maxSpeed: parseFloat(inputMaxSpeed.value),
    maxTurnSpeedDeg: parseFloat(inputMaxTurnSpeed.value),
  };
}

function spawnCreature(type: CreatureType): Creature {
  const { radius, mass, maxSpeed, maxTurnSpeedDeg } = getSpawnParams();
  return app.spawnCreature(type, radius, mass, maxSpeed, maxTurnSpeedDeg);
}

function openSpawnModal(type: CreatureType): void {
  pendingSpawnType = type;
  spawnTypeLabel.textContent = type === 'player' ? 'Тип: Игрок' : 'Тип: ИИ';
  spawnModal.hidden = false;
}

function closeSpawnModal(): void {
  pendingSpawnType = null;
  spawnModal.hidden = true;
}

function updateSelectedCreaturePanel(): void {
  const creature = app.selectedCreature;

  if (!creature) {
    selectionHint.hidden = false;
    selectedStats.hidden = true;
    return;
  }

  selectionHint.hidden = true;
  selectedStats.hidden = false;

  statType.textContent = creature.type === 'player' ? 'Игрок' : 'ИИ';
  statRadius.textContent = `${creature.radius} px`;
  statMass.textContent = `${creature.mass}`;
  statCurrentSpeed.textContent = `${creature.currentSpeed.toFixed(0)} px/с`;
  statCurrentTurnSpeed.textContent = `${((creature.currentTurnSpeed * 180) / Math.PI).toFixed(0)} °/с`;
}

toggleObstacles.addEventListener('change', () => {
  app.physics.setObstaclesEnabled(toggleObstacles.checked);
});

btnTriggerFile.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = JSON.parse(evt.target?.result as string);
      if (Array.isArray(data)) {
        app.loadObstaclesFromData(data);
        console.log('Препятствия успешно загружены:', data.length);
      }
    } catch {
      alert('Ошибка при чтении JSON файла!');
    }
  };
  reader.readAsText(file);
});

btnAddPlayer.addEventListener('click', () => openSpawnModal('player'));
btnAddAi.addEventListener('click', () => openSpawnModal('ai'));

btnSpawnCancel.addEventListener('click', closeSpawnModal);
spawnModalBackdrop.addEventListener('click', closeSpawnModal);
btnSpawnConfirm.addEventListener('click', () => {
  if (!pendingSpawnType) return;
  spawnCreature(pendingSpawnType);
  onSelectionChanged();
  closeSpawnModal();
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  app.zoomAt(e.clientX, e.clientY, e.deltaY);
}, { passive: false });

canvas.addEventListener('click', (e) => {
  const point = app.getCanvasPoint(e.clientX, e.clientY);
  app.selectCreature(app.pickCreatureAt(point));
  onSelectionChanged();
});

window.addEventListener('keydown', (e) => {
  if (!spawnModal.hidden || isTextInputTarget(e.target)) return;

  const key = e.key.toLowerCase();
  if (!CONTROL_KEYS.has(key) || keysPressed.has(key)) return;

  keysPressed.add(key);
  syncPlayerControls();
  e.preventDefault();
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (!CONTROL_KEYS.has(key)) return;

  keysPressed.delete(key);
  syncPlayerControls();
});

window.addEventListener('blur', () => {
  keysPressed.clear();
  syncPlayerControls();
});

app.onFrame = updateSelectedCreaturePanel;

spawnCreature('player');
