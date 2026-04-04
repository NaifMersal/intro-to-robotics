// Standalone micro-simulation application logic.
// Manages internal state, UI updates, and navigation.

window.State = {
    pumpPressure: 50,
    valveOpenness: 100,
    flowRate: 0
};

const EXPLANATIONS = {};

function initMicro() {
    // Initialise UI Components
    if (window.WaterCircuitUI) {
        let title = "Controls";
        if (window.location.pathname.includes('pump')) title = "Controls (Pump)";
        else if (window.location.pathname.includes('valve')) title = "Controls (Valve)";
        else if (window.location.pathname.includes('wheel')) title = "Controls (Load)";
        
        window.WaterCircuitUI.injectControls('controls-placeholder', title);
    }

    const canvas = document.getElementById('simulationCanvas');
    const ctx = canvas.getContext('2d');
    
    // UI Elements
    const pumpSlider = document.getElementById('pumpSlider');
    const pumpValue = document.getElementById('pumpValue');
    const valveSlider = document.getElementById('valveSlider');
    const valveValue = document.getElementById('valveValue');
    const flowFill = document.getElementById('flowFill');
    const flowReadout = document.getElementById('flowReadout');

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (window.MicroRenderer && window.MicroRenderer.engine) {
            window.MicroRenderer.stop();
            window.MicroRenderer.start();
        }
    }
    window.addEventListener('resize', resize);
    resize();

    // Read initial state from URL
    const params = new URLSearchParams(window.location.search);
    if (params.has('p')) window.State.pumpPressure = parseInt(params.get('p'));
    if (params.has('v')) window.State.valveOpenness = parseInt(params.get('v'));

    // Initialize Sliders
    if (pumpSlider) pumpSlider.value = window.State.pumpPressure;
    if (valveSlider) valveSlider.value = window.State.valveOpenness;

    function calculatePhysics() {
        const resistance = 5 + ((100 - window.State.valveOpenness) * 2); 
        const voltage = window.State.pumpPressure;
        let rawFlow = (voltage / resistance) * 10;
        if (window.State.valveOpenness <= 2) rawFlow = 0;
        window.State.flowRate = rawFlow;
        updateUIMetrics();
    }

    function updateUIMetrics() {
        if (pumpValue) pumpValue.innerText = `${window.State.pumpPressure}%`;
        if (valveValue) {
            valveValue.innerText = window.State.valveOpenness <= 2 ? "Closed" : `${window.State.valveOpenness}%`;
        }

        if (flowFill) {
            const fillPercent = Math.min(100, Math.max(0, window.State.flowRate * 2.5));
            flowFill.style.width = `${fillPercent}%`;
            
            if (window.State.flowRate === 0) {
                flowReadout.innerText = "No Flow (Blocked/Off)";
                flowFill.style.background = "#f85149";
            } else if (window.State.flowRate < 10) {
                flowReadout.innerText = "Low Flow";
                flowFill.style.background = "#3fb950";
            } else if (window.State.flowRate < 30) {
                flowReadout.innerText = "Medium Flow";
                flowFill.style.background = "#38bdf8";
            } else {
                flowReadout.innerText = "High Flow";
                flowFill.style.background = "#818cf8";
            }
        }
    }

    // Event Listeners
    if (pumpSlider) {
        pumpSlider.addEventListener('input', (e) => {
            window.State.pumpPressure = parseInt(e.target.value);
            calculatePhysics();
        });
    }
    if (valveSlider) {
        valveSlider.addEventListener('input', (e) => {
            window.State.valveOpenness = parseInt(e.target.value);
            calculatePhysics();
        });
    }

    // Start simulation
    if (window.MicroRenderer) {
        window.MicroRenderer.start();
        calculatePhysics();
    }

    function animate(time) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (window.MicroRenderer) {
            window.MicroRenderer.step(time);
            window.MicroRenderer.draw(ctx, canvas, window.State);
        }
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
}

// Ensure Matter is ready before starting
if (window.Matter) {
    initMicro();
} else {
    window.addEventListener('load', () => {
        if (window.Matter) initMicro();
    });
}
