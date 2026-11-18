// San Cielo Heat — saving: Mara's wallet, health, weapons and story
// progress live in localStorage, so Continue picks up where she left off.

const SAVE_KEY = 'sancielo-heat-save-v1';

export function hasSave() {
  try {
    return !!window.localStorage.getItem(SAVE_KEY);
  } catch (err) {
    return false;
  }
}

export function saveGameState(game) {
  try {
    const p = game.player;
    const data = {
      version: 1,
      money: Math.floor(p.money),
      health: Math.floor(p.health),
      armor: Math.floor(p.armor),
      x: Math.floor(p.x),
      y: Math.floor(p.y),
      weapon: p.weapon,
      ammo: {
        pistol: p.weapons.pistol.ammo,
        smg: p.weapons.smg.ammo,
      },
      smgOwned: p.weapons.smg.owned,
      storyIndex: game.missions.storyIndex,
      completed: game.missions.completed.slice(),
      couriersDone: game.missions.couriersDone,
      storyDone: game.missions.storyDone,
      playTime: Math.floor(game.time),
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGameState() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function applySaveState(game, data) {
  const p = game.player;
  p.money = data.money;
  p.health = data.health;
  p.armor = data.armor;
  p.x = data.x;
  p.y = data.y;
  p.weapon = data.weapon || 'pistol';
  p.weapons.pistol.ammo = data.ammo.pistol;
  p.weapons.smg.ammo = data.ammo.smg;
  p.weapons.smg.owned = !!data.smgOwned;
  game.missions.storyIndex = data.storyIndex || 0;
  game.missions.completed = (data.completed || []).slice();
  game.missions.couriersDone = data.couriersDone || 0;
  game.missions.storyDone = !!data.storyDone;
  game.time = data.playTime || 0;
  game.camera.snapTo(p.x, p.y);
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    // Storage unavailable: nothing to clear.
  }
}
