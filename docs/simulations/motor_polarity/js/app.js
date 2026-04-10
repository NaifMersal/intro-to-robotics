const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
const swapBtn = document.getElementById('swapBtn');
const pinAVal = document.getElementById('pinA');
const pinBVal = document.getElementById('pinB');
const dirVal = document.getElementById('direction');

let width, height;
let state = {
    polarity: 1, // 1: Standard, -1: Swapped
    rotation: 0,
    motorSpeed: 0.1,
    particles: []
};

// Colors
const COLORS = {
    pos: '#ef4444',
    neg: '#3b82f6',
    accent: '#00C9A7',
    wire: '#1e293b',
    battery: '#334155'
};

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    spawnParticles();
}

function spawnParticles() {
    state.particles = [];
    for (let i = 0; i < 40; i++) {
        state.particles.push({
            t: i / 40, // 0 to 1 along the path
            speed: 0.005 + Math.random() * 0.002
        });
    }
}

function updateUI() {
    if (state.polarity === 1) {
        pinAVal.textContent = "Positive (+)";
        pinBVal.textContent = "Negative (-)";
        pinAVal.style.color = COLORS.pos;
        pinBVal.style.color = COLORS.neg;
        dirVal.textContent = "Clockwise (CW)";
    } else {
        pinAVal.textContent = "Negative (-)";
        pinBVal.textContent = "Positive (+)";
        pinAVal.style.color = COLORS.neg;
        pinBVal.style.color = COLORS.pos;
        dirVal.textContent = "Counter-Clockwise (CCW)";
    }
}

swapBtn.addEventListener('click', () => {
    state.polarity *= -1;
    updateUI();
});

function drawBattery(x, y) {
    ctx.save();
    ctx.translate(x, y);
    
    // Body
    ctx.fillStyle = COLORS.battery;
    ctx.fillRect(-40, -60, 80, 120);
    
    // Cap
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-15, -70, 30, 10);
    
    // Labels
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Inter';
    ctx.textAlign = 'center';
    ctx.fillText("BATT", 0, 10);
    
    // Terminals
    ctx.fillStyle = state.polarity === 1 ? COLORS.pos : COLORS.neg;
    ctx.beginPath();
    ctx.arc(-20, -50, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(state.polarity === 1 ? "+" : "-", -20, -75);

    ctx.fillStyle = state.polarity === 1 ? COLORS.neg : COLORS.pos;
    ctx.beginPath();
    ctx.arc(20, -50, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(state.polarity === 1 ? "-" : "+", 20, -75);
    
    ctx.restore();
}

function drawMotor(x, y, rotation) {
    ctx.save();
    ctx.translate(x, y);
    
    // Outer Case
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Spinning part
    ctx.rotate(rotation);
    
    // Fins or markers
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(-2, -60, 4, 120);
    ctx.fillRect(-60, -2, 120, 4);
    
    // Center logic
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.restore();
    
    // Label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Inter';
    ctx.textAlign = 'center';
    ctx.fillText("DC MOTOR", x, y + 90);
}

function getPathPoint(t) {
    // Define a rectangular path
    // cx, cy of screen
    const cx = (width - 320) / 2;
    const cy = height / 2;
    const w = 400;
    const h = 250;
    
    // Path: Bottom (Left->Right) -> Right (Bottom->Up) -> Top (Right->Left) -> Left (Up->Down)
    // Actually let's make it simpler:
    // P1: (-200, 100) -> P2: (200, 100) -> P3: (200, -100) -> P4: (-200, -100) -> P1
    
    const p1 = {x: cx - 200, y: cy + 125};
    const p2 = {x: cx + 200, y: cy + 125};
    const p3 = {x: cx + 200, y: cy - 125};
    const p4 = {x: cx - 200, y: cy - 125};
    
    if (t < 0.25) {
        let f = t / 0.25;
        return {x: p1.x + (p2.x - p1.x) * f, y: p1.y + (p2.y - p1.y) * f};
    } else if (t < 0.5) {
        let f = (t - 0.25) / 0.25;
        return {x: p2.x + (p3.x - p2.x) * f, y: p2.y + (p3.y - p2.y) * f};
    } else if (t < 0.75) {
        let f = (t - 0.5) / 0.25;
        return {x: p3.x + (p4.x - p3.x) * f, y: p3.y + (p4.y - p3.y) * f};
    } else {
        let f = (t - 0.75) / 0.25;
        return {x: p4.x + (p1.x - p4.x) * f, y: p4.y + (p1.y - p4.y) * f};
    }
}

function animate() {
    ctx.clearRect(0, 0, width, height);
    
    const cx = (width - 320) / 2;
    const cy = height / 2;

    // Draw Wires
    ctx.beginPath();
    const p1 = getPathPoint(0);
    ctx.moveTo(p1.x, p1.y);
    for (let t = 0.01; t <= 1; t += 0.01) {
        const pt = getPathPoint(t);
        ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = COLORS.wire;
    ctx.lineWidth = 12;
    ctx.stroke();

    // Draw Motor and Battery
    drawBattery(cx, cy + 125);
    drawMotor(cx, cy - 125, state.rotation);
    
    // Update State
    state.rotation += state.motorSpeed * state.polarity;
    
    // Particles
    state.particles.forEach(p => {
        // Move particle based on polarity
        p.t += p.speed * state.polarity;
        if (p.t > 1) p.t -= 1;
        if (p.t < 0) p.t += 1;
        
        const pos = getPathPoint(p.t);
        
        // Glow effect
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = state.polarity === 1 ? COLORS.pos : COLORS.neg;
        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    requestAnimationFrame(animate);
}

window.addEventListener('resize', resize);
resize();
updateUI();
animate();
