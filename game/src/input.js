// Solmar Heat — keyboard and mouse input.
// One object owns every key and button; the game asks it questions each frame
// instead of listening to events all over the place.

export const Input = {
  down: new Set(), // codes currently held
  pressed: new Set(), // codes pressed since the last frame
  mouseX: 0,
  mouseY: 0, // mouse in canvas pixels
  mouseDown: false,
  mousePressed: false, // left button pressed since the last frame
  mouseReleased: false,
  wheel: 0,

  init(canvas) {
    const prevent = new Set([
      'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab',
    ]);
    window.addEventListener('keydown', (e) => {
      if (prevent.has(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.down.add(e.code);
        this.pressed.add(e.code);
      }
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mousePressed = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouseDown = false;
        this.mouseReleased = true;
      }
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheel += Math.sign(e.deltaY);
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  // Call once at the end of each frame to clear the edge-triggered sets.
  endFrame() {
    this.pressed.clear();
    this.mousePressed = false;
    this.mouseReleased = false;
    this.wheel = 0;
  },

  isDown(code) { return this.down.has(code); },
  wasPressed(code) { return this.pressed.has(code); },
  anyPressed(codes) { return codes.some((c) => this.pressed.has(c)); },

  // WASD / arrows as a normalised -1..1 movement vector.
  moveVector() {
    let x = 0, y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) { x *= 0.7071; y *= 0.7071; }
    return { x, y };
  },
};
