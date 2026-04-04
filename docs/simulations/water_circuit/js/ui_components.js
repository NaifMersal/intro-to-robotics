// Shared UI Components for Water Circuit Simulation
// This file centralizes the control panel HTML to avoid redundancy.

const WaterCircuitUI = {
    /**
     * Injects the standard control panel into a specified container.
     * @param {string} containerId - The ID of the placeholder div.
     * @param {string} title - The title for the controls panel.
     */
    injectControls: function(containerId, title = "Controls") {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`UI Injection Error: Container #${containerId} not found.`);
            return;
        }

        container.innerHTML = `
            <div class="glass-panel control-panel right">
                <h2>${title}</h2>
                
                <div class="control-group">
                    <label for="pumpSlider">Pump Pressure (Voltage - V)</label>
                    <div class="slider-wrapper">
                        <input type="range" id="pumpSlider" min="0" max="100" value="50">
                        <span id="pumpValue" class="value-readout">50%</span>
                    </div>
                </div>

                <div class="control-group">
                    <label for="valveSlider">Valve Openness (1 / Resistance)</label>
                    <div class="slider-wrapper">
                        <input type="range" id="valveSlider" min="0" max="100" value="100">
                        <span id="valveValue" class="value-readout">100%</span>
                    </div>
                </div>

                <div class="metrics-dashboard">
                    <h3>Calculated Flow Rate (Current - I)</h3>
                    <div class="flow-meter">
                        <div id="flowFill" class="flow-fill"></div>
                    </div>
                    <div id="flowReadout" class="readout-large">High Flow</div>
                </div>
            </div>
        `;
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WaterCircuitUI;
} else {
    window.WaterCircuitUI = WaterCircuitUI;
}
