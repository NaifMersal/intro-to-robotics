const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
const in1Btn = document.getElementById('in1Btn');
const in2Btn = document.getElementById('in2Btn');
const path1Val = document.getElementById('path1State');
const path2Val = document.getElementById('path2State');
const motorStatusVal = document.getElementById('motorStatus');
const obsText = document.getElementById('obsText');

let width, height;
const state = {
    in1: 0,
    in2: 0,
    rotation: 0,
    motorSpeed: 0,
    targetSpeed: 0,
    flybackTimer: 0,
    lastSpinDir: 0,
    flowPhase: 0
};

const COLORS = {
    pos: '#ef4444',
    neg: '#3b82f6',
    accent: '#00C9A7',
    wire: '#1e293b',
    battery: '#334155',
    diode: '#64748b',
    diodeGlow: '#f59e0b',
    warn: '#f59e0b',
    textSecondary: '#94a3b8',
    in1: '#22d3ee',
    in2: '#a855f7'
};

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}

function updateUI() {
    in1Btn.textContent = state.in1 ? "IN1: HIGH" : "IN1: LOW";
    in2Btn.textContent = state.in2 ? "IN2: HIGH" : "IN2: LOW";
    in1Btn.className = state.in1 ? "toggle-btn active" : "toggle-btn";
    in2Btn.className = state.in2 ? "toggle-btn active" : "toggle-btn";

    if (state.in1 && !state.in2) {
        path1Val.textContent = "ON";
        path1Val.style.color = COLORS.accent;
        path2Val.textContent = "OFF";
        path2Val.style.color = COLORS.textSecondary;
        motorStatusVal.textContent = "Spinning CW";
        motorStatusVal.style.color = COLORS.accent;
        obsText.innerHTML = "<strong>Forward:</strong> Q1 and Q4 are ON. Current flows Left to Right through the motor.";
    } else if (!state.in1 && state.in2) {
        path1Val.textContent = "OFF";
        path1Val.style.color = COLORS.textSecondary;
        path2Val.textContent = "ON";
        path2Val.style.color = COLORS.accent;
        motorStatusVal.textContent = "Spinning CCW";
        motorStatusVal.style.color = COLORS.accent;
        obsText.innerHTML = "<strong>Reverse:</strong> Q3 and Q2 are ON. Current flows Right to Left through the motor.";
    } else if (state.in1 && state.in2) {
        path1Val.textContent = "OFF";
        path2Val.textContent = "OFF";
        path1Val.style.color = COLORS.textSecondary;
        path2Val.style.color = COLORS.textSecondary;
        motorStatusVal.textContent = "Braking";
        motorStatusVal.style.color = COLORS.warn;
        obsText.innerHTML = "<strong>Brake:</strong> Q2 and Q4 ON — both motor terminals tied to GND. Residual motor EMF circulates through the short and dissipates as heat.";
    } else {
        path1Val.textContent = "OFF";
        path2Val.textContent = "OFF";
        path1Val.style.color = COLORS.textSecondary;
        path2Val.style.color = COLORS.textSecondary;
        if (Math.abs(state.motorSpeed) > 0.01) {
            motorStatusVal.textContent = "Coasting / Flyback";
            motorStatusVal.style.color = COLORS.diodeGlow;
            obsText.innerHTML = "<strong>Flyback:</strong> Motor inductance keeps current flowing! Diodes channel the spike back through the battery.";
        } else {
            motorStatusVal.textContent = "Stopped";
            motorStatusVal.style.color = COLORS.textSecondary;
            obsText.innerHTML = "<strong>Experiment:</strong> Toggle IN1 or IN2 to HIGH to turn on the MOSFET pairs and see how electricity flows through the motor!";
        }
    }
}

function handleInput() {
    const fwd = state.in1 && !state.in2;
    const rev = !state.in1 && state.in2;
    const goingOff = !state.in1 && !state.in2;

    let newTarget = 0;
    if (fwd) newTarget = 0.2;
    else if (rev) newTarget = -0.2;

    const motorWasMoving = Math.abs(state.motorSpeed) > 0.01;
    if (goingOff && motorWasMoving) {
        state.flybackTimer = 90;
        state.lastSpinDir = state.motorSpeed > 0 ? 1 : -1;
    }
    if (fwd || rev || (state.in1 && state.in2)) {
        state.flybackTimer = 0;
    }

    state.targetSpeed = newTarget;
    updateUI();
}

in1Btn.addEventListener('click', () => { state.in1 = 1 - state.in1; handleInput(); });
in2Btn.addEventListener('click', () => { state.in2 = 1 - state.in2; handleInput(); });

function drawComponent(x, y, label, isActive) {
    ctx.fillStyle = isActive ? COLORS.accent : '#1e293b';
    ctx.strokeStyle = isActive ? '#fff' : '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - 20, y - 20, 40, 40, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 5);
}

function drawGateStub(mosfetX, mosfetY, dir, controlLabel, controlColor, isActive) {
    // dir: 'r' (gate to the right of MOSFET) or 'l' (gate to the left)
    const sign = dir === 'r' ? 1 : -1;
    const sx = mosfetX + sign * 20;
    const sy = mosfetY;
    const ex = mosfetX + sign * 50;
    const ey = mosfetY;

    ctx.save();
    ctx.strokeStyle = isActive ? controlColor : '#475569';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.restore();

    const bx = ex + sign * 19;
    const by = ey;

    ctx.fillStyle = isActive ? controlColor : '#1e293b';
    ctx.strokeStyle = isActive ? '#fff' : controlColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bx - 19, by - 10, 38, 20, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isActive ? '#000' : controlColor;
    ctx.font = 'bold 11px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(controlLabel, bx, by + 4);
}

function drawDiode(x, y, isFlyback, label) {
    ctx.save();
    ctx.translate(x, y);
    if (isFlyback) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLORS.diodeGlow;
    }
    ctx.fillStyle = isFlyback ? COLORS.diodeGlow : '#1e293b';
    ctx.strokeStyle = isFlyback ? COLORS.diodeGlow : '#475569';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(10, 10);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.lineTo(10, -10);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = isFlyback ? COLORS.diodeGlow : COLORS.textSecondary;
    ctx.font = 'bold 11px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 28);
}

function drawMotor(x, y, rotation) {
    ctx.save();
    ctx.translate(x, y);

    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.rotate(rotation);

    // Asymmetric rotor: one bold fin + offset indicator dot
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(-3, -38, 6, 76);

    ctx.beginPath();
    ctx.arc(22, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText("M", x, y - 50);
}

function drawBattery(x, y) {
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = COLORS.battery;
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.fillRect(-22, -28, 44, 56);
    ctx.strokeRect(-22, -28, 44, 56);

    ctx.strokeStyle = COLORS.pos;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(0, -35);
    ctx.stroke();
    ctx.fillStyle = COLORS.pos;
    ctx.beginPath(); ctx.arc(0, -35, 4, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = COLORS.neg;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 28);
    ctx.lineTo(0, 35);
    ctx.stroke();
    ctx.fillStyle = COLORS.neg;
    ctx.beginPath(); ctx.arc(0, 35, 4, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = COLORS.pos;
    ctx.font = 'bold 16px Inter';
    ctx.textAlign = 'center';
    ctx.fillText("+", -32, -18);
    ctx.fillStyle = COLORS.neg;
    ctx.fillText("−", -32, 24);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Inter';
    ctx.fillText("Vbat", 0, 4);

    ctx.restore();
}

function drawParticlesAlong(points, count, phase, color) {
    const lens = [0];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const dx = points[i + 1].x - points[i].x;
        const dy = points[i + 1].y - points[i].y;
        total += Math.sqrt(dx * dx + dy * dy);
        lens.push(total);
    }
    if (total === 0) return;

    ctx.fillStyle = color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;

    for (let p = 0; p < count; p++) {
        const t = (phase + p / count) % 1;
        const target = t * total;
        let i = 0;
        while (i < lens.length - 2 && lens[i + 1] < target) i++;
        const segLen = lens[i + 1] - lens[i];
        const f = segLen === 0 ? 0 : (target - lens[i]) / segLen;
        const x = points[i].x + (points[i + 1].x - points[i].x) * f;
        const y = points[i].y + (points[i + 1].y - points[i].y) * f;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;
}

function animate() {
    ctx.clearRect(0, 0, width, height);

    const cx = (width - 320) / 2;
    const cy = height / 2;

    const gw = 180;
    const gh = 120;
    const dOff = 60;

    const batX = cx - gw - 110;
    const batY = cy;
    const batPosY = batY - 35;
    const batNegY = batY + 35;

    const topRailY = cy - gh;
    const botRailY = cy + gh;
    const leftColX = cx - gw;
    const rightColX = cx + gw;

    // ===== Power wires =====
    ctx.beginPath();
    ctx.strokeStyle = COLORS.wire;
    ctx.lineWidth = 4;

    // Battery + → top rail (left side)
    ctx.moveTo(batX, batPosY);
    ctx.lineTo(batX, topRailY);
    ctx.lineTo(leftColX, topRailY);
    // Battery − → bottom rail (left side)
    ctx.moveTo(batX, batNegY);
    ctx.lineTo(batX, botRailY);
    ctx.lineTo(leftColX, botRailY);
    // Top rail across
    ctx.moveTo(leftColX, topRailY);
    ctx.lineTo(rightColX, topRailY);
    // Bottom rail across
    ctx.moveTo(leftColX, botRailY);
    ctx.lineTo(rightColX, botRailY);
    // Left column (through Q1, Q2)
    ctx.moveTo(leftColX, topRailY);
    ctx.lineTo(leftColX, botRailY);
    // Right column (through Q3, Q4)
    ctx.moveTo(rightColX, topRailY);
    ctx.lineTo(rightColX, botRailY);
    // Motor cross branch
    ctx.moveTo(leftColX, cy);
    ctx.lineTo(rightColX, cy);

    // Diode parallel detours
    ctx.moveTo(leftColX, cy - gh + 20); ctx.lineTo(leftColX - dOff, cy - gh + 20); ctx.lineTo(leftColX - dOff, cy - 20); ctx.lineTo(leftColX, cy - 20);
    ctx.moveTo(leftColX, cy + 20); ctx.lineTo(leftColX - dOff, cy + 20); ctx.lineTo(leftColX - dOff, cy + gh - 20); ctx.lineTo(leftColX, cy + gh - 20);
    ctx.moveTo(rightColX, cy - gh + 20); ctx.lineTo(rightColX + dOff, cy - gh + 20); ctx.lineTo(rightColX + dOff, cy - 20); ctx.lineTo(rightColX, cy - 20);
    ctx.moveTo(rightColX, cy + 20); ctx.lineTo(rightColX + dOff, cy + 20); ctx.lineTo(rightColX + dOff, cy + gh - 20); ctx.lineTo(rightColX, cy + gh - 20);

    ctx.stroke();

    // ===== Logic =====
    const fwd = !!(state.in1 && !state.in2);
    const rev = !!(!state.in1 && state.in2);
    const brake = !!(state.in1 && state.in2);

    const q1On = fwd;
    const q4On = fwd || brake;
    const q3On = rev;
    const q2On = rev || brake;

    const isFlybackCW = state.flybackTimer > 0 && state.lastSpinDir === 1;
    const isFlybackCCW = state.flybackTimer > 0 && state.lastSpinDir === -1;

    // ===== Diodes =====
    drawDiode(leftColX - dOff, cy - gh / 2, isFlybackCCW, "D1");
    drawDiode(leftColX - dOff, cy + gh / 2, isFlybackCW, "D2");
    drawDiode(rightColX + dOff, cy - gh / 2, isFlybackCW, "D3");
    drawDiode(rightColX + dOff, cy + gh / 2, isFlybackCCW, "D4");

    // ===== MOSFETs =====
    drawComponent(leftColX, cy - gh / 2, "Q1", q1On);
    drawComponent(leftColX, cy + gh / 2, "Q2", q2On);
    drawComponent(rightColX, cy - gh / 2, "Q3", q3On);
    drawComponent(rightColX, cy + gh / 2, "Q4", q4On);

    // ===== Gate signals =====
    // IN1 controls Q1 (top-left) and Q4 (bottom-right)
    drawGateStub(leftColX, cy - gh / 2, 'r', 'IN1', COLORS.in1, state.in1);
    drawGateStub(rightColX, cy + gh / 2, 'l', 'IN1', COLORS.in1, state.in1);
    // IN2 controls Q3 (top-right) and Q2 (bottom-left)
    drawGateStub(rightColX, cy - gh / 2, 'l', 'IN2', COLORS.in2, state.in2);
    drawGateStub(leftColX, cy + gh / 2, 'r', 'IN2', COLORS.in2, state.in2);

    // ===== Battery =====
    drawBattery(batX, batY);

    // ===== Motor physics =====
    const prevFlyback = state.flybackTimer;
    const prevMoving = Math.abs(state.motorSpeed) > 0.01;

    state.motorSpeed += (state.targetSpeed - state.motorSpeed) * 0.05;
    if (brake) state.motorSpeed *= 0.93;
    if (state.flybackTimer > 0) {
        state.motorSpeed *= 0.97;
        state.flybackTimer--;
    }
    state.rotation += state.motorSpeed;
    drawMotor(cx, cy, state.rotation);

    const nowMoving = Math.abs(state.motorSpeed) > 0.01;
    if ((prevFlyback > 0 && state.flybackTimer === 0) ||
        (prevMoving && !nowMoving && !fwd && !rev && !brake)) {
        updateUI();
    }

    // ===== Particle flow phase =====
    if (fwd || rev) {
        state.flowPhase += Math.abs(state.motorSpeed) * 1.5;
    } else if (brake && Math.abs(state.motorSpeed) > 0.01) {
        state.flowPhase += Math.abs(state.motorSpeed) * 1.5;
    } else if (state.flybackTimer > 0) {
        state.flowPhase += 0.012;
    }
    state.flowPhase = ((state.flowPhase % 1) + 1) % 1;

    const numParticles = 10;

    // Forward path: Bat+ → top rail → Q1 → motor (L→R) → Q4 → bottom rail → Bat−
    if (fwd) {
        const fwdPath = [
            { x: batX, y: batPosY },
            { x: batX, y: topRailY },
            { x: leftColX, y: topRailY },
            { x: leftColX, y: cy - gh / 2 },
            { x: leftColX, y: cy },
            { x: rightColX, y: cy },
            { x: rightColX, y: cy + gh / 2 },
            { x: rightColX, y: botRailY },
            { x: batX, y: botRailY },
            { x: batX, y: batNegY }
        ];
        drawParticlesAlong(fwdPath, numParticles, state.flowPhase, COLORS.pos);
    }

    // Reverse path: Bat+ → top rail → Q3 → motor (R→L) → Q2 → bottom rail → Bat−
    if (rev) {
        const revPath = [
            { x: batX, y: batPosY },
            { x: batX, y: topRailY },
            { x: rightColX, y: topRailY },
            { x: rightColX, y: cy - gh / 2 },
            { x: rightColX, y: cy },
            { x: leftColX, y: cy },
            { x: leftColX, y: cy + gh / 2 },
            { x: leftColX, y: botRailY },
            { x: batX, y: botRailY },
            { x: batX, y: batNegY }
        ];
        drawParticlesAlong(revPath, numParticles, state.flowPhase, COLORS.neg);
    }

    // Brake circulation: motor EMF drives current through Q2/Q4 short to GND
    if (brake && Math.abs(state.motorSpeed) > 0.01) {
        const cw = state.motorSpeed > 0;
        const brakePath = cw ? [
            { x: rightColX, y: cy },
            { x: rightColX, y: cy + gh / 2 },
            { x: rightColX, y: botRailY },
            { x: leftColX, y: botRailY },
            { x: leftColX, y: cy + gh / 2 },
            { x: leftColX, y: cy },
            { x: rightColX, y: cy }
        ] : [
            { x: leftColX, y: cy },
            { x: leftColX, y: cy + gh / 2 },
            { x: leftColX, y: botRailY },
            { x: rightColX, y: botRailY },
            { x: rightColX, y: cy + gh / 2 },
            { x: rightColX, y: cy },
            { x: leftColX, y: cy }
        ];
        drawParticlesAlong(brakePath, 8, state.flowPhase, COLORS.warn);
    }

    // Flyback CW: motor was spinning CW → inductance pushes current
    // motor-R → D3 → top rail → Bat+ → Bat− → bottom rail → D2 → motor-L → through motor → motor-R
    if (isFlybackCW) {
        const fbPath = [
            { x: rightColX, y: cy },
            { x: rightColX, y: cy - 20 },
            { x: rightColX + dOff, y: cy - 20 },
            { x: rightColX + dOff, y: cy - gh / 2 },
            { x: rightColX + dOff, y: cy - gh + 20 },
            { x: rightColX, y: cy - gh + 20 },
            { x: rightColX, y: topRailY },
            { x: batX, y: topRailY },
            { x: batX, y: batPosY },
            { x: batX, y: batNegY },
            { x: batX, y: botRailY },
            { x: leftColX, y: botRailY },
            { x: leftColX, y: cy + gh - 20 },
            { x: leftColX - dOff, y: cy + gh - 20 },
            { x: leftColX - dOff, y: cy + gh / 2 },
            { x: leftColX - dOff, y: cy + 20 },
            { x: leftColX, y: cy + 20 },
            { x: leftColX, y: cy },
            { x: rightColX, y: cy }
        ];
        drawParticlesAlong(fbPath, numParticles, state.flowPhase, COLORS.diodeGlow);
    }

    // Flyback CCW: mirror — motor-L → D1 → top rail → battery → bottom rail → D4 → motor-R → through motor → motor-L
    if (isFlybackCCW) {
        const fbPath = [
            { x: leftColX, y: cy },
            { x: leftColX, y: cy - 20 },
            { x: leftColX - dOff, y: cy - 20 },
            { x: leftColX - dOff, y: cy - gh / 2 },
            { x: leftColX - dOff, y: cy - gh + 20 },
            { x: leftColX, y: cy - gh + 20 },
            { x: leftColX, y: topRailY },
            { x: batX, y: topRailY },
            { x: batX, y: batPosY },
            { x: batX, y: batNegY },
            { x: batX, y: botRailY },
            { x: rightColX, y: botRailY },
            { x: rightColX, y: cy + gh - 20 },
            { x: rightColX + dOff, y: cy + gh - 20 },
            { x: rightColX + dOff, y: cy + gh / 2 },
            { x: rightColX + dOff, y: cy + 20 },
            { x: rightColX, y: cy + 20 },
            { x: rightColX, y: cy },
            { x: leftColX, y: cy }
        ];
        drawParticlesAlong(fbPath, numParticles, state.flowPhase, COLORS.diodeGlow);
    }

    requestAnimationFrame(animate);
}

window.addEventListener('resize', resize);
resize();
updateUI();
animate();
