// Solmar Heat — saving and loading.
// Progress lives in localStorage: money, missions, weapons, stats and where
// Leo was standing. Saving happens after every job and at the safehouse, and
// the title screen offers Continue when a save exists.

const SAVE_KEY = 'solmar-heat-save-v1';

export const SaveGame = {
  hasSave() {
    try {
      return window.localStorage.getItem(SAVE_KEY) !== null;
    } catch (e) {
      return false;
    }
  },

  save(state) {
    try {
      const p = state.player;
      const data = {
        version: 1,
        savedAt: Date.now(),
        money: Math.floor(p.money),
        health: Math.floor(p.health),
        armor: Math.floor(p.armor),
        x: Math.floor(p.x),
        y: Math.floor(p.y),
        weapon: p.weapon,
        weapons: p.weapons,
        unlocked: p.unlocked,
        missionsCompleted: state.missions.completed,
        storyComplete: !!state.storyComplete,
        stats: state.stats,
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  },

  load(state) {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      const p = state.player;
      p.money = data.money;
      p.health = data.health;
      p.armor = data.armor;
      p.x = data.x;
      p.y = data.y;
      p.weapon = data.weapon;
      p.weapons = data.weapons;
      p.unlocked = data.unlocked;
      state.missions.completed = data.missionsCompleted || 0;
      state.storyComplete = !!data.storyComplete;
      Object.assign(state.stats, data.stats || {});
      return true;
    } catch (e) {
      return false;
    }
  },

  clear() {
    try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  },
};
