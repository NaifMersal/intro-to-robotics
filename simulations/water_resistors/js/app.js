const State = {
    topo: 'parallel', // default parallel as requested by sketch
    voltage: 50,
    r1: 50,
    r2: 50,
    rTotal: 0,
    iTotal: 0,
    i1: 0, // flow through branch 1
    i2: 0  // flow through branch 2
};

const dom = {
    tabs: document.querySelectorAll('.tab-btn'),
    pSlider: document.getElementById('pumpSlider'),
    v1Slider: document.getElementById('v1Slider'),
    v2Slider: document.getElementById('v2Slider'),
    rTotal: document.getElementById('rTotal'),
    iTotal: document.getElementById('iTotal'),
    i1: document.getElementById('i1'),
    i2: document.getElementById('i2')
};

function calc() {
    let R1 = State.r1;
    let R2 = State.r2;
    
    // add small base resistance so flow doesn't go infinite
    let baseR = 5; 
    let V = State.voltage;

    if (State.topo === 'series') {
        State.rTotal = R1 + R2 + baseR;
        State.iTotal = V / State.rTotal;
        State.i1 = State.iTotal;
        State.i2 = State.iTotal;
    } else {
        // Parallel
        let rp = (R1 * R2) / (R1 + R2);
        State.rTotal = rp + baseR;
        State.iTotal = V / State.rTotal;
        
        let vrp = State.iTotal * rp; // Voltage drop across parallel branches
        if (rp === 0) vrp = 0;
        
        State.i1 = vrp / R1;
        State.i2 = vrp / R2;

        if (State.iTotal === 0) { State.i1 = 0; State.i2 = 0; }
    }

    dom.rTotal.innerText = State.rTotal.toFixed(1) + " Ω";
    dom.iTotal.innerText = (State.iTotal * 10).toFixed(1) + " L/s";
    
    if (State.topo === 'series') {
        dom.i1.innerText = "Same";
        dom.i2.innerText = "Same";
    } else {
        dom.i1.innerText = (State.i1 * 10).toFixed(1) + " L/s";
        dom.i2.innerText = (State.i2 * 10).toFixed(1) + " L/s";
    }
}

dom.tabs.forEach(t => t.addEventListener('click', (e) => {
    dom.tabs.forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    State.topo = e.target.getAttribute('data-topo');
    // If switching topology, reset particles to be safe
    if(window.Renderer) window.Renderer.spawnParticles();
    calc();
}));

dom.pSlider.addEventListener('input', e => { State.voltage = +e.target.value; calc(); });
dom.v1Slider.addEventListener('input', e => { State.r1 = +e.target.value; calc(); });
dom.v2Slider.addEventListener('input', e => { State.r2 = +e.target.value; calc(); });

calc();

// Animation loop startup
if (window.Renderer) {
    Renderer.init(document.getElementById('simCanvas'));
    requestAnimationFrame(function loop(time) {
        Renderer.draw(time, State);
        requestAnimationFrame(loop);
    });
}
