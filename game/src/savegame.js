// San Cielo Heat — saving: the player's progress lives in localStorage, so
// closing the tab keeps money, missions, position and the wanted level.

const SAVE_KEY = 'san-cielo-heat-save-v1';

export function hasSave() {
  try {
    return !!window.localStorage.getItem(SAVE_KEY);
  } catch (err) {
    return false;
  }
}

export function saveGameState(game) {
  try {
    const player = game.player;
    const data = {
      version: 1,
      x: player.inCar ? player.inCar.x : player.x,
      y: player.inCar ? player.inCar.y : player.y,
      health: player.health,
      armor: player.armor,
      money: player.money,
      wanted: player.wanted,
      weapon: player.weapon,
      ammo: player.ammo,
      kills: player.kills,
      carsStolen: player.carsStolen,
      missionsDone: player.missionsDone,
      courierDone: player.courierDone,
      playTime: player.playTime,
      storyIndex: game.missions.storyIndex,
      completedStory: game.missions.completedStory,
      courierIndex: game.missions.courierIndex,
      time: game.time,
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
  const player = game.player;
  player.x = data.x;
  player.y = data.y;
  player.health = data.health;
  player.armor = data.armor;
  player.money = data.money;
  player.wanted = data.wanted;
  player.weapon = data.weapon || 'fists';
  player.ammo = data.ammo || { pistol: 60, smg: 120 };
  player.kills = data.kills || 0;
  player.carsStolen = data.carsStolen || 0;
  player.missionsDone = data.missionsDone || 0;
  player.courierDone = data.courierDone || 0;
  player.playTime = data.playTime || 0;
  game.missions.storyIndex = data.storyIndex || 0;
  game.missions.completedStory = !!data.completedStory;
  game.missions.courierIndex = data.courierIndex || 0;
  game.time = data.time || 0;
  game.camera.snapTo(data.x, data.y);
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    // Storage unavailable — nothing to clear.
  }
}
