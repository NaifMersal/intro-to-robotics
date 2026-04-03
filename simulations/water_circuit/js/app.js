// Application State & Main Loop Setup (Macro View)
const State = {
    pumpPressure: 50,    // 0 - 100
    valveOpenness: 100,  // 0 - 100
    flowRate: 0,         // Calculated
    activeView: 'macro'
};

// Initialise UI Components
if (window.WaterCircuitUI) {
    window.WaterCircuitUI.injectControls('controls-placeholder', 'Controls');
}

const EXPLANATIONS = {
    'macro': "This is the macro view. Observe how overall pressure (voltage) and resistance (valve restriction) affect the continuous flow (current) of water around the closed loop."
};

// Canvas Setup
const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// UI Elements
const pumpSlider = document.getElementById('pumpSlider');
const pumpValue = document.getElementById('pumpValue');
const valveSlider = document.getElementById('valveSlider');
const valveValue = document.getElementById('valveValue');
const flowFill = document.getElementById('flowFill');
const flowReadout = document.getElementById('flowReadout');
const explanationText = document.getElementById('explanationText');
const viewBtns = document.querySelectorAll('.view-btn');

// Initial State from URL (for returning from micro views)
const params = new URLSearchParams(window.location.search);
if (params.has('p')) State.pumpPressure = parseInt(params.get('p'));
if (params.has('v')) State.valveOpenness = parseInt(params.get('v'));
if (pumpSlider) pumpSlider.value = State.pumpPressure;
if (valveSlider) valveSlider.value = State.valveOpenness;

function calculatePhysics() {
    const resistance = 5 + ((100 - State.valveOpenness) * 2); 
    const voltage = State.pumpPressure;
    let rawFlow = (voltage / resistance) * 10;
    if (State.valveOpenness <= 2) rawFlow = 0;
    State.flowRate = rawFlow;
    updateUIMetrics();
}

function updateUIMetrics() {
    if (pumpValue) pumpValue.innerText = `${State.pumpPressure}%`;
    if (valveValue) {
        valveValue.innerText = State.valveOpenness <= 2 ? "Closed" : `${State.valveOpenness}%`;
    }

    if (flowFill) {
        const fillPercent = Math.min(100, Math.max(0, State.flowRate * 2.5));
        flowFill.style.width = `${fillPercent}%`;
        
        if (State.flowRate === 0) {
            flowReadout.innerText = "No Flow (Blocked/Off)";
            flowFill.style.background = "#f85149";
        } else if (State.flowRate < 10) {
            flowReadout.innerText = "Low Flow";
            flowFill.style.background = "#3fb950";
        } else if (State.flowRate < 30) {
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
        State.pumpPressure = parseInt(e.target.value);
        calculatePhysics();
    });
}
if (valveSlider) {
    valveSlider.addEventListener('input', (e) => {
        State.valveOpenness = parseInt(e.target.value);
        calculatePhysics();
    });
}

// View Toggle Logic (Now Page Navigation)
function updateViewMode(viewMode) {
    if (viewMode === 'macro') return;

    // Navigate to standalone page
    const simName = viewMode.replace('micro-', '');
    window.location.href = `micro/${simName}.html?p=${State.pumpPressure}&v=${State.valveOpenness}`;
}

viewBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const viewMode = e.currentTarget.getAttribute('data-view');
        updateViewMode(viewMode);
    });
});

// Main Animation Loop
function animate(currentTime) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (State.activeView === 'macro') {
        MacroRenderer.draw(ctx, canvas, State);
    }
    requestAnimationFrame(animate);
}

// Initial Calc and Start
calculatePhysics();
requestAnimationFrame(animate);
