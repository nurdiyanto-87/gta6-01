// San Cielo Heat — every sprite is drawn in code: top-down cars, people,
// buildings, trees and props. No image assets anywhere.

export function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// Draw a car pointing along `angle` (0 = east). def: {len, wid, kind, roof}.
export function drawVehicle(ctx, x, y, angle, def, color, opts) {
  opts = opts || {};
  const len = def.len;
  const wid = def.wid;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Soft shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  roundRectPath(ctx, -len / 2 + 2, -wid / 2 + 3, len, wid, 8);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#1c1c22';
  const wheelW = Math.max(6, len * 0.14);
  const wheelH = Math.max(4, wid * 0.16);
  const wx = len * 0.3;
  for (const sx of [-wx, wx]) {
    for (const sy of [-wid / 2 - 1, wid / 2 - wheelH + 1]) {
      ctx.fillRect(sx - wheelW / 2, sy, wheelW, wheelH);
    }
  }
  // Body.
  ctx.fillStyle = color;
  roundRectPath(ctx, -len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  ctx.strokeStyle = shade(color, -46);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Hood and trunk shading.
  ctx.fillStyle = shade(color, 18);
  roundRectPath(ctx, len * 0.18, -wid / 2 + 3, len * 0.3, wid - 6, 5);
  ctx.fill();
  // Cabin / windshield.
  const roofLen = len * (def.roof || 0.42);
  const roofWid = wid * 0.78;
  ctx.fillStyle = opts.broken ? '#3a3f46' : '#9fc6d8';
  roundRectPath(ctx, -roofLen * 0.55, -roofWid / 2, roofLen, roofWid, 5);
  ctx.fill();
  ctx.strokeStyle = shade(color, -30);
  ctx.stroke();
  // Headlights and taillights.
  ctx.fillStyle = '#fff6c9';
  ctx.fillRect(len / 2 - 3, -wid / 2 + 4, 3, 7);
  ctx.fillRect(len / 2 - 3, wid / 2 - 11, 3, 7);
  ctx.fillStyle = '#d23b2e';
  ctx.fillRect(-len / 2, -wid / 2 + 4, 3, 7);
  ctx.fillRect(-len / 2, wid / 2 - 11, 3, 7);
  if (def.kind === 'police') {
    // Light bar, flashing with the passed phase.
    const phase = opts.flash || 0;
    ctx.fillStyle = phase < 0.5 ? '#ff3b30' : '#4b8ad9';
    ctx.fillRect(-6, -wid / 2 + 3, 12, 7);
    ctx.fillStyle = phase < 0.5 ? '#4b8ad9' : '#ff3b30';
    ctx.fillRect(-6, wid / 2 - 10, 12, 7);
    ctx.fillStyle = '#f2f2f2';
    ctx.font = 'bold 9px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCPD', 0, -wid / 2 + 16);
  }
  if (def.kind === 'taxi') {
    ctx.fillStyle = '#222';
    ctx.fillRect(-5, -5, 10, 10);
    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 8px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (def.kind === 'truck' || def.kind === 'van') {
    ctx.fillStyle = shade(color, -20);
    ctx.fillRect(-len / 2 + 6, -wid / 2 + 4, len * 0.42, wid - 8);
    ctx.strokeStyle = shade(color, -50);
    ctx.strokeRect(-len / 2 + 6, -wid / 2 + 4, len * 0.42, wid - 8);
  }
  // Damage: smoke-darkened hood and cracked look.
  if (opts.damage && opts.damage > 0.45) {
    ctx.fillStyle = 'rgba(30,30,30,' + (0.25 + 0.3 * opts.damage) + ')';
    roundRectPath(ctx, len * 0.1, -wid / 2 + 2, len * 0.4, wid - 4, 5);
    ctx.fill();
  }
  ctx.restore();
}

// Draw a person: a body circle, shoulders and a head, with a walk bob.
export function drawPerson(ctx, x, y, angle, look, walkPhase, opts) {
  opts = opts || {};
  const bob = Math.sin(walkPhase || 0) * 1.6;
  ctx.save();
  ctx.translate(x, y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs (two small offsets perpendicular to facing).
  const px = Math.cos(angle + Math.PI / 2);
  const py = Math.sin(angle + Math.PI / 2);
  const step = Math.sin(walkPhase || 0) * 4;
  ctx.fillStyle = look.pants || '#3a4a6b';
  ctx.beginPath();
  ctx.arc(px * 4 + Math.cos(angle) * step, py * 4 + Math.sin(angle) * step, 3.4, 0, Math.PI * 2);
  ctx.arc(-px * 4 - Math.cos(angle) * step, -py * 4 - Math.sin(angle) * step, 3.4, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = look.shirt || '#c95f4b';
  ctx.beginPath();
  ctx.arc(0, bob * 0.4, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Arms reaching forward when aiming a weapon.
  if (opts.aiming) {
    ctx.strokeStyle = look.shirt || '#c95f4b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * 15, Math.sin(angle) * 15);
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.fillRect(Math.cos(angle) * 13 - 3, Math.sin(angle) * 13 - 2, 8, 4);
  }
  // Head.
  ctx.fillStyle = look.skin || '#e8b98d';
  ctx.beginPath();
  ctx.arc(Math.cos(angle) * 2, Math.sin(angle) * 2 + bob * 0.4, 5.5, 0, Math.PI * 2);
  ctx.fill();
  if (look.hat) {
    ctx.fillStyle = look.hat;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 2, Math.sin(angle) * 2 + bob * 0.4, 6.5, Math.PI, Math.PI * 2);
    ctx.fill();
  }
  if (opts.star) {
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 10px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('*', 0, -13);
  }
  ctx.restore();
}

// Draw a building footprint with a roof, edge highlight and windows.
export function drawBuilding(ctx, b, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = shade(b.roof, -40);
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  // Roof inset.
  ctx.strokeStyle = shade(b.roof, 22);
  ctx.lineWidth = 1;
  ctx.strokeRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
  if (b.kind === 'tower' || b.kind === 'hotel') {
    // Glass stripes.
    ctx.fillStyle = b.glass || '#86b8cc';
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(2, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i + j) % 2 === 0) continue;
        ctx.fillRect(b.x + 10 + i * ((b.w - 20) / cols), b.y + 10 + j * ((b.h - 20) / rows), (b.w - 20) / cols - 5, (b.h - 20) / rows - 5);
      }
    }
  }
  if (b.kind === 'shop' && b.awning) {
    ctx.fillStyle = b.awning;
    ctx.fillRect(b.x, b.y + b.h - 8, b.w, 8);
  }
  if (b.kind === 'house') {
    // Pitched roof ridge.
    ctx.strokeStyle = shade(b.roof, -55);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x + 6, b.y + b.h / 2);
    ctx.lineTo(b.x + b.w - 6, b.y + b.h / 2);
    ctx.stroke();
    ctx.fillStyle = '#b0593f';
    ctx.fillRect(b.x + b.w - 16, b.y + 8, 8, 8);
  }
  if (b.label) {
    ctx.fillStyle = 'rgba(40,32,24,0.75)';
    ctx.font = 'bold 11px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 4);
  }
  ctx.restore();
}

export function drawTree(ctx, t, time) {
  ctx.save();
  ctx.translate(t.x, t.y);
  const sway = Math.sin(time * 0.8 + t.x * 0.01) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(3, 4, t.r * 0.9, t.r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (t.kind === 'palm') {
    ctx.strokeStyle = '#8a6b4a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(sway, -8, sway * 2, -14);
    ctx.stroke();
    ctx.strokeStyle = '#5ea347';
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(sway * 2, -14);
      ctx.quadraticCurveTo(sway * 2 + Math.cos(a) * 10, -14 + Math.sin(a) * 10 - 4, sway * 2 + Math.cos(a) * 17, -14 + Math.sin(a) * 17 + 3);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#7a5a38';
    ctx.fillRect(-2, -2, 4, 6);
    ctx.fillStyle = t.color || '#4e8b40';
    ctx.beginPath();
    ctx.arc(sway, -8, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(t.color || '#4e8b40', 20);
    ctx.beginPath();
    ctx.arc(sway - 3, -11, t.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawLamp(ctx, lamp) {
  ctx.fillStyle = '#3c3c44';
  ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

export function drawProp(ctx, prop) {
  ctx.save();
  ctx.translate(prop.x, prop.y);
  if (prop.kind === 'crate') {
    ctx.fillStyle = '#b08d55';
    ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 2;
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.beginPath();
    ctx.moveTo(-9, -9);
    ctx.lineTo(9, 9);
    ctx.moveTo(9, -9);
    ctx.lineTo(-9, 9);
    ctx.stroke();
  } else if (prop.kind === 'barrel') {
    ctx.fillStyle = prop.color || '#c2573f';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(-2, -2, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (prop.kind === 'bench') {
    ctx.fillStyle = '#8a6b4a';
    ctx.fillRect(-14, -5, 28, 10);
    ctx.fillStyle = '#6d5439';
    ctx.fillRect(-14, -5, 28, 3);
  } else if (prop.kind === 'fountain') {
    ctx.fillStyle = '#7fb8c9';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d8d2c2';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#eaf7f8';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (prop.kind === 'crane') {
    ctx.strokeStyle = '#d98a2b';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.lineTo(0, -30);
    ctx.lineTo(34, -30);
    ctx.moveTo(0, -30);
    ctx.lineTo(-16, -30);
    ctx.stroke();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, -30);
    ctx.lineTo(30, -8);
    ctx.stroke();
    ctx.fillStyle = '#8a8a8a';
    ctx.fillRect(24, -8, 12, 10);
  } else if (prop.kind === 'buoy') {
    ctx.fillStyle = '#e05a3a';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawWantedStar(ctx, x, y, r, filled, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  if (filled) {
    const pulse = 0.85 + 0.15 * Math.sin(time * 5);
    ctx.fillStyle = '#ffd94d';
    ctx.globalAlpha = pulse;
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}
