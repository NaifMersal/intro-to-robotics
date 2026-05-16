const State = {
    topo: 'parallel',
    mode: 'water',
    voltage: 50,
    r1: 50,
    r2: 50,
    rTotal: 0,
    iTotal: 0,
    i1: 0,
    i2: 0,
    mouse: { x: -1000, y: -1000 }
};

const dom = {
    tabs: document.querySelectorAll('.tab-btn'),
    modeBtns: document.querySelectorAll('.mode-btn'),
    pSlider: document.getElementById('pumpSlider'),
    v1Slider: document.getElementById('v1Slider'),
    v2Slider: document.getElementById('v2Slider'),
    // Labels
    pumpLabel: document.getElementById('pumpLabel'),
    v1Label: document.getElementById('v1Label'),
    v2Label: document.getElementById('v2Label'),
    rTotalLabel: document.getElementById('rTotalLabel'),
    iTotalLabel: document.getElementById('iTotalLabel'),
    i1Label: document.getElementById('i1Label'),
    i2Label: document.getElementById('i2Label'),
    // Metrics
    rTotal: document.getElementById('rTotal'),
    iTotal: document.getElementById('iTotal'),
    i1: document.getElementById('i1'),
    i2: document.getElementById('i2'),
    // Overlay
    uiLayer: document.getElementById('ui-layer'),
    uiToggle: document.getElementById('uiToggle'),
    obsText: document.getElementById('observationText'),
    // Probe
    probeTooltip: document.getElementById('probe-tooltip'),
    pvLabel: document.getElementById('p-v-label'),
    pvVal: document.getElementById('p-v-val'),
    piLabel: document.getElementById('p-i-label'),
    piVal: document.getElementById('p-i-val')
};

// URL Params support
const params = new URLSearchParams(window.location.search);
if (params.has('topo')) {
    State.topo = params.get('topo');
    dom.tabs.forEach(t => t.classList.toggle('active', t.dataset.topo === State.topo));
}
if (params.has('mode')) {
    State.mode = params.get('mode');
    dom.modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === State.mode));
}

function updateLabels() {
    const isWater = State.mode === 'water';
    dom.pumpLabel.innerText = isWater ? "Pump (psi)" : "Battery (V)";
    dom.v1Label.innerText = isWater ? "Valve 1 (R)" : "Resistor 1 (Ω)";
    dom.v2Label.innerText = isWater ? "Valve 2 (R)" : "Resistor 2 (Ω)";
    dom.rTotalLabel.innerText = isWater ? "Total Friction" : "Eq. Resistance";
    dom.iTotalLabel.innerText = isWater ? "Total Flow (Q)" : "Total Current (I)";
    dom.i1Label.innerText = isWater ? "B1 Flow" : "B1 Current";
    dom.i2Label.innerText = isWater ? "B2 Flow" : "B2 Current";
    
    // Probe labels
    dom.pvLabel.innerText = isWater ? "Pressure:" : "Potential:";
    dom.piLabel.innerText = isWater ? "Flow:" : "Current:";
}

function calc() {
    let R1 = State.r1;
    let R2 = State.r2;
    let baseR = 5; 
    let V = State.voltage;

    if (State.topo === 'series') {
        if (R1 >= 100 || R2 >= 100) {
            State.rTotal = Infinity; State.iTotal = 0; State.i1 = 0; State.i2 = 0;
        } else {
            State.rTotal = R1 + R2 + baseR;
            State.iTotal = V / State.rTotal;
            State.i1 = State.iTotal; State.i2 = State.iTotal;
        }
    } else {
        if (R1 >= 100 && R2 >= 100) {
            State.rTotal = Infinity; State.iTotal = 0; State.i1 = 0; State.i2 = 0;
        } else if (R1 >= 100) {
            State.rTotal = R2 + baseR; State.iTotal = V / State.rTotal; State.i1 = 0; State.i2 = State.iTotal;
        } else if (R2 >= 100) {
            State.rTotal = R1 + baseR; State.iTotal = V / State.rTotal; State.i1 = State.iTotal; State.i2 = 0;
        } else {
            let rp = (R1 * R2) / (R1 + R2);
            State.rTotal = rp + baseR;
            State.iTotal = V / State.rTotal;
            let vrp = State.iTotal * rp;
            State.i1 = vrp / R1;
            State.i2 = vrp / R2;
        }
    }

    const isWater = State.mode === 'water';
    const rUnit = isWater ? " R" : " Ω";
    const iUnit = isWater ? " L/s" : " mA";
    const iMult = isWater ? 10 : 1000;

    dom.rTotal.innerText = (State.rTotal === Infinity ? "∞" : State.rTotal.toFixed(1)) + rUnit;
    dom.iTotal.innerText = (State.iTotal * iMult).toFixed(isWater ? 1 : 0) + iUnit;
    
    if (State.topo === 'series') {
        dom.i1.innerText = "Same"; dom.i2.innerText = "Same";
        dom.obsText.innerHTML = isWater ? 
            "In Series, valves are in a row. Friction <em>adds up</em>, reducing total flow." :
            "In Series, current must pass through every resistor. Total resistance is the <em>sum</em> of all parts.";
    } else {
        dom.i1.innerText = (State.i1 * iMult).toFixed(isWater ? 1 : 0) + iUnit;
        dom.i2.innerText = (State.i2 * iMult).toFixed(isWater ? 1 : 0) + iUnit;
        dom.obsText.innerHTML = isWater ?
            "In Parallel, adding branches <em>increases</em> paths, reducing total friction." :
            "In Parallel, adding more resistors <em>decreases</em> total resistance because charges have more paths to follow.";
    }
}

// Mouse Tracking for Probe
window.addEventListener('mousemove', e => {
    State.mouse.x = e.clientX;
    State.mouse.y = e.clientY;
});

dom.modeBtns.forEach(b => b.addEventListener('click', e => {
    dom.modeBtns.forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    State.mode = e.target.getAttribute('data-mode');
    updateLabels();
    calc();
}));

dom.tabs.forEach(t => t.addEventListener('click', (e) => {
    dom.tabs.forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    State.topo = e.target.getAttribute('data-topo');
    if(window.Renderer) window.Renderer.spawnParticles();
    calc();
}));

dom.pSlider.addEventListener('input', e => { State.voltage = +e.target.value; calc(); });
dom.v1Slider.addEventListener('input', e => { State.r1 = +e.target.value; calc(); });
dom.v2Slider.addEventListener('input', e => { State.r2 = +e.target.value; calc(); });

dom.uiToggle.addEventListener('click', () => {
    dom.uiLayer.classList.toggle('collapsed');
});

updateLabels();
calc();


// Animation loop startup
if (window.Renderer) {
    Renderer.init(document.getElementById('simCanvas'));
    requestAnimationFrame(function loop(time) {
        Renderer.draw(time, State);
        requestAnimationFrame(loop);
    });
}
