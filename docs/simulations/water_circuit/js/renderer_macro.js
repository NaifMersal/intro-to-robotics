// MacroView Renderer — Premium Water Circuit Visualization
// Rounded-corner pipe loop with animated white flow particles,
// detailed pump / valve / wheel components, blueprint background.

const MacroRenderer = {
    particles: [],
    NUM_PARTICLES: 70,
    initialized: false,

    // ── Initialise flow particles ──────────────────────────────
    init() {
        this.particles = [];
        for (let i = 0; i < this.NUM_PARTICLES; i++) {
            this.particles.push({
                t: i / this.NUM_PARTICLES,
                size: 1.5 + Math.random() * 2,
                alpha: 0.55 + Math.random() * 0.45,
                glow: 4 + Math.random() * 4,
            });
        }
        this.initialized = true;
    },

    // ── Layout (responsive to canvas size) ─────────────────────
    getLayout(canvas) {
        const padL = 80, padR = 330, padT = 130, padB = 100;
        const aW = Math.max(canvas.width - padL - padR, 300);
        const aH = Math.max(canvas.height - padT - padB, 200);
        const w = Math.min(aW, 820);
        const h = Math.min(aH, 500);
        const cx = padL + aW / 2;
        const cy = padT + aH / 2;
        const x = cx - w / 2, y = cy - h / 2;
        const r = 44;
        const seg = {
            top: w - 2 * r, right: h - 2 * r,
            bot: w - 2 * r, left: h - 2 * r,
            arc: Math.PI * r / 2,
        };
        seg.total = seg.top + seg.right + seg.bot + seg.left + 4 * seg.arc;
        return { x, y, w, h, r, cx, cy, seg };
    },

    // ── Point on rounded-rect path (t 0→1 clockwise) ──────────
    pointAt(t, L) {
        t = ((t % 1) + 1) % 1;
        let d = t * L.seg.total;
        const { x, y, w, h, r, seg } = L;

        // top →
        if (d < seg.top) return { x: x + r + d, y };
        d -= seg.top;
        // arc TR ↓
        if (d < seg.arc) {
            const a = -Math.PI / 2 + (d / seg.arc) * (Math.PI / 2);
            return { x: x + w - r + Math.cos(a) * r, y: y + r + Math.sin(a) * r };
        }
        d -= seg.arc;
        // right ↓
        if (d < seg.right) return { x: x + w, y: y + r + d };
        d -= seg.right;
        // arc BR ←
        if (d < seg.arc) {
            const a = (d / seg.arc) * (Math.PI / 2);
            return { x: x + w - r + Math.cos(a) * r, y: y + h - r + Math.sin(a) * r };
        }
        d -= seg.arc;
        // bottom ←
        if (d < seg.bot) return { x: x + w - r - d, y: y + h };
        d -= seg.bot;
        // arc BL ↑
        if (d < seg.arc) {
            const a = Math.PI / 2 + (d / seg.arc) * (Math.PI / 2);
            return { x: x + r + Math.cos(a) * r, y: y + h - r + Math.sin(a) * r };
        }
        d -= seg.arc;
        // left ↑
        if (d < seg.left) return { x, y: y + h - r - d };
        d -= seg.left;
        // arc TL →
        const a = Math.PI + (d / seg.arc) * (Math.PI / 2);
        return { x: x + r + Math.cos(a) * r, y: y + r + Math.sin(a) * r };
    },

    // ── Trace rounded-rect path onto ctx ───────────────────────
    tracePipe(ctx, L) {
        const { x, y, w, h, r } = L;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
        ctx.lineTo(x + w, y + h - r);
        ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
        ctx.lineTo(x + r, y + h);
        ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
        ctx.lineTo(x, y + r);
        ctx.arc(x + r, y + r, r, Math.PI, -Math.PI / 2);
        ctx.closePath();
    },

    // ── Pill-shaped label ──────────────────────────────────────
    pill(ctx, text, px, py) {
        ctx.font = '600 11px Inter';
        const tw = ctx.measureText(text).width;
        const pw = tw + 22, ph = 22, pr = ph / 2;
        const lx = px - pw / 2, ly = py - ph / 2;
        ctx.fillStyle = 'rgba(4,20,40,0.85)';
        ctx.beginPath();
        ctx.moveTo(lx + pr, ly);
        ctx.lineTo(lx + pw - pr, ly);
        ctx.arc(lx + pw - pr, ly + pr, pr, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(lx + pr, ly + ph);
        ctx.arc(lx + pr, ly + pr, pr, Math.PI / 2, -Math.PI / 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(148,163,184,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, px, py);
    },

    // ════════════════════════════════════════════════════════════
    //  MAIN DRAW
    // ════════════════════════════════════════════════════════════
    startTime: null,

    draw(ctx, canvas, state) {
        if (!this.initialized) this.init();
        if (this.startTime === null) this.startTime = Date.now();
        const t = (Date.now() - this.startTime) / 1000;
        const L = this.getLayout(canvas);

        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        this.drawBg(ctx, canvas);
        this.drawPipes(ctx, L);
        this.drawFlow(ctx, L, state);
        this.drawPump(ctx, L, state, t);
        this.drawValve(ctx, L, state, t);
        this.drawWheel(ctx, L, state, t);
        this.drawLabels(ctx, L);
        this.posButtons(L, state);
    },

    // ── Background ─────────────────────────────────────────────
    drawBg(ctx, c) {
        const g = ctx.createRadialGradient(c.width * .45, c.height * .4, 0,
            c.width * .5, c.height * .5, c.width * .85);
        g.addColorStop(0, '#0f3460');
        g.addColorStop(0.6, '#0a1e3d');
        g.addColorStop(1, '#040e1a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, c.width, c.height);
        // grid
        ctx.strokeStyle = 'rgba(56,189,248,0.035)';
        ctx.lineWidth = 1;
        const s = 50;
        for (let x = 0; x < c.width; x += s) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke(); }
        for (let y = 0; y < c.height; y += s) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke(); }
    },

    // ── Pipes ──────────────────────────────────────────────────
    drawPipes(ctx, L) {
        // Outer metal
        this.tracePipe(ctx, L);
        ctx.lineWidth = 56; ctx.strokeStyle = '#142640'; ctx.stroke();
        // Inner shadow
        this.tracePipe(ctx, L);
        ctx.lineWidth = 48; ctx.strokeStyle = '#0d1d35'; ctx.stroke();
        // Water fill
        this.tracePipe(ctx, L);
        ctx.lineWidth = 40;
        const g = ctx.createLinearGradient(L.x, L.y, L.x + L.w, L.y + L.h);
        g.addColorStop(0, '#1565c0'); g.addColorStop(.5, '#1976d2'); g.addColorStop(1, '#1e88e5');
        ctx.strokeStyle = g; ctx.stroke();
        // Glass highlight
        this.tracePipe(ctx, L);
        ctx.lineWidth = 30; ctx.strokeStyle = 'rgba(33,150,243,0.18)'; ctx.stroke();
    },

    // ── Flow particles ─────────────────────────────────────────
    drawFlow(ctx, L, state) {
        const spd = Math.min(state.flowRate, 120) * 0.00025;
        for (const p of this.particles) p.t = (p.t + spd) % 1;

        // Glow layer
        for (const p of this.particles) {
            if (state.flowRate === 0) continue;
            const pt = this.pointAt(p.t, L);
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, p.glow, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${p.alpha * 0.12})`;
            ctx.fill();
        }
        // Core
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(255,255,255,0.7)';
        for (const p of this.particles) {
            const pt = this.pointAt(p.t, L);
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${state.flowRate === 0 ? 0.15 : p.alpha})`;
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.restore();
    },

    // ── Pump (top-left corner) ─────────────────────────────────
    drawPump(ctx, L, state, t) {
        const px = L.x, py = L.y;
        const rpm = state.flowRate * 0.06;

        // Housing
        ctx.beginPath(); ctx.arc(px, py, 48, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(px - 8, py - 8, 4, px, py, 48);
        g.addColorStop(0, '#5a7294'); g.addColorStop(.6, '#2c4060'); g.addColorStop(1, '#1a2e4a');
        ctx.fillStyle = g; ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#7a9cc6'; ctx.stroke();

        // Inner ring
        ctx.beginPath(); ctx.arc(px, py, 38, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(100,160,220,0.25)'; ctx.lineWidth = 1; ctx.stroke();

        // Impeller
        ctx.save(); ctx.translate(px, py); ctx.rotate(t * rpm);
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(8, -3);
            ctx.quadraticCurveTo(20, -13, 35, -4);
            ctx.lineTo(35, 4);
            ctx.quadraticCurveTo(20, 13, 8, 3);
            ctx.closePath();
            ctx.fillStyle = i === 0 ? '#bae6fd' : '#7dd3fc'; ctx.fill();
            ctx.strokeStyle = 'rgba(125,211,252,0.4)'; ctx.lineWidth = 1; ctx.stroke();
        }
        // Hub
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fillStyle = '#4a6a8a'; ctx.fill();
        ctx.strokeStyle = '#7a9cc6'; ctx.lineWidth = 2; ctx.stroke();
        // Rotation indicator dot
        ctx.beginPath(); ctx.arc(22, 0, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#e0f2fe'; ctx.fill();
        ctx.restore();

        // Glow
        if (state.pumpPressure > 0) {
            ctx.beginPath(); ctx.arc(px, py, 53, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(56,189,248,${0.2 + 0.15 * Math.sin(t * 3)})`;
            ctx.lineWidth = 2.5; ctx.shadowBlur = 14; ctx.shadowColor = 'rgba(56,189,248,0.4)';
            ctx.stroke(); ctx.shadowBlur = 0;
        }
    },

    // ── Valve (top-right corner) ───────────────────────────────
    drawValve(ctx, L, state, t) {
        const vx = L.x + L.w, vy = L.y, s = 42;

        // Housing (rounded rect)
        const hx = vx - s, hy = vy - s, hw = s * 2, hh = s * 2, cr = 8;
        ctx.beginPath();
        ctx.moveTo(hx + cr, hy);
        ctx.lineTo(hx + hw - cr, hy);
        ctx.arc(hx + hw - cr, hy + cr, cr, -Math.PI / 2, 0);
        ctx.lineTo(hx + hw, hy + hh - cr);
        ctx.arc(hx + hw - cr, hy + hh - cr, cr, 0, Math.PI / 2);
        ctx.lineTo(hx + cr, hy + hh);
        ctx.arc(hx + cr, hy + hh - cr, cr, Math.PI / 2, Math.PI);
        ctx.lineTo(hx, hy + cr);
        ctx.arc(hx + cr, hy + cr, cr, Math.PI, -Math.PI / 2);
        ctx.closePath();
        const vg = ctx.createLinearGradient(hx, hy, hx + hw, hy + hh);
        vg.addColorStop(0, '#3a506b'); vg.addColorStop(1, '#1a2e4a');
        ctx.fillStyle = vg; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#7a9cc6'; ctx.stroke();

        // Pipe channel inside
        const cw = 28, ch = s * 2 - 14;
        ctx.fillStyle = '#1565c0';
        ctx.fillRect(vx - cw / 2, vy - ch / 2, cw, ch);

        // Gate / plunger
        const maxDrop = ch;
        const drop = maxDrop * ((100 - state.valveOpenness) / 100);
        let gc;
        if (state.valveOpenness > 60) gc = '#4ade80';
        else if (state.valveOpenness > 20) gc = '#fb923c';
        else gc = '#f87171';

        if (drop > 1) {
            ctx.fillStyle = gc;
            ctx.fillRect(vx - cw / 2 - 2, vy - ch / 2, cw + 4, drop);
            // Gate handle on top
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(vx - 6, vy - ch / 2 - 8, 12, 10);
        }

        // Status glow
        const glowC = state.valveOpenness > 50 ? '56,189,248' : state.valveOpenness > 10 ? '251,146,60' : '248,113,113';
        ctx.beginPath(); ctx.arc(vx, vy, s + 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${glowC},${0.15 + 0.1 * Math.sin(t * 2)})`;
        ctx.lineWidth = 2; ctx.stroke();
    },

    // ── Water Wheel / Load (bottom-center) ─────────────────────
    drawWheel(ctx, L, state, t) {
        const wx = L.cx, wy = L.y + L.h;
        const spin = t * state.flowRate * 0.01;

        // Outer rim
        ctx.beginPath(); ctx.arc(wx, wy, 48, 0, Math.PI * 2);
        ctx.fillStyle = '#0f1f35'; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = '#3a5a80'; ctx.stroke();

        // Gear teeth
        for (let i = 0; i < 18; i++) {
            const a = (i / 18) * Math.PI * 2;
            ctx.save(); ctx.translate(wx, wy); ctx.rotate(a);
            ctx.fillStyle = '#3a5a80';
            ctx.fillRect(44, -2.5, 7, 5);
            ctx.restore();
        }

        // Inner rim
        ctx.beginPath(); ctx.arc(wx, wy, 40, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(100,160,220,0.2)'; ctx.lineWidth = 1; ctx.stroke();

        // Paddles
        ctx.save(); ctx.translate(wx, wy); ctx.rotate(spin);
        for (let i = 0; i < 6; i++) {
            ctx.rotate(Math.PI / 3);
            ctx.fillStyle = i === 0 ? '#93c5fd' : '#7a9cc6';
            ctx.fillRect(7, -2.5, 28, 5);
            ctx.fillStyle = i === 0 ? '#bfdbfe' : '#94b8db';
            ctx.fillRect(31, -5, 5, 10);
        }
        // Hub
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fillStyle = '#4a6a8a'; ctx.fill();
        ctx.strokeStyle = '#7a9cc6'; ctx.lineWidth = 2; ctx.stroke();
        // Rotation indicator dot
        ctx.beginPath(); ctx.arc(22, 0, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#e0f2fe'; ctx.fill();
        ctx.restore();

        // Work glow (warm amber when spinning)
        if (state.flowRate > 0) {
            ctx.beginPath(); ctx.arc(wx, wy, 54, 0, Math.PI * 2);
            const a = Math.min(0.4, state.flowRate * 0.008);
            ctx.strokeStyle = `rgba(251,191,36,${a})`; ctx.lineWidth = 3;
            ctx.shadowBlur = 12; ctx.shadowColor = `rgba(251,191,36,${a * 0.6})`;
            ctx.stroke(); ctx.shadowBlur = 0;
        }
    },

    // ── Labels ─────────────────────────────────────────────────
    drawLabels(ctx, L) {
        this.pill(ctx, 'PUMP  (VOLTAGE)', L.x, L.y - 58);
        this.pill(ctx, 'VALVE  (RESISTANCE)', L.x + L.w, L.y - 58);
        this.pill(ctx, 'LOAD  (WORK BY CURRENT)', L.cx, L.y + L.h + 58);
    },

    // ── Position floating buttons ──────────────────────────────
    posButtons(L, state) {
        if (state.activeView !== 'macro') return;
        const bp = document.getElementById('btnPump');
        const bv = document.getElementById('btnValve');
        const bw = document.getElementById('btnWheel');
        if (!bp) return;
        bp.style.left = `${L.x + 70}px`; bp.style.top = `${L.y + 72}px`;
        bv.style.left = `${L.x + L.w}px`; bv.style.top = `${L.y + 72}px`;
        bw.style.left = `${L.cx}px`; bw.style.top = `${L.y + L.h - 72}px`;
    },
};
