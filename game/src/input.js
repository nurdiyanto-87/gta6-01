// San Cielo Heat — keyboard and mouse state, with edge-triggered presses
// so menus and actions can tell "just pressed" from "held down".

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.clicked = false;
    this.wheel = 0;

    window.addEventListener('keydown', (event) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (!event.repeat) this.pressed.add(key);
      this.down.add(key);
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      this.down.delete(key);
    });
    canvas.addEventListener('mousemove', (event) => {
      this.mouseX = event.clientX;
      this.mouseY = event.clientY;
    });
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        this.mouseDown = true;
        this.clicked = true;
      }
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('wheel', (event) => {
      this.wheel += Math.sign(event.deltaY);
      event.preventDefault();
    }, { passive: false });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  isDown(key) {
    return this.down.has(key);
  }

  wasPressed(key) {
    return this.pressed.has(key);
  }

  // Movement axes: x = right, y = down, each in [-1, 1].
  axes() {
    let x = 0;
    let y = 0;
    if (this.isDown('a') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('d') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('w') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('s') || this.isDown('ArrowDown')) y += 1;
    return { x, y };
  }

  endFrame() {
    this.pressed.clear();
    this.clicked = false;
    this.wheel = 0;
  }
}
