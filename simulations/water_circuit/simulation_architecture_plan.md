# Water Circuit Simulation: Architecture & Implementation Plan

This document outlines the desired visual and technical behavior for the interactive Water-Circuit Simulation. The primary goal is to provide a physically accurate representation of water flow acting as a pedagogical bridge to electrical circuits.

## 1. Core Objectives (What We Want to See)

Based on course requirements and physical realism, the simulation must adhere to the following principles:
- **Physical Bounding:** Fluid must strictly stay inside pipes. Metal and solid objects (like the pump housing and valve) must physically obstruct and cover the fluid, visually preventing "water passing through metal."
- **Contiguous Fluid Flow:** At a macroscopic level, water does not look like scattered particles; it looks like a continuous, smooth substance moving together.
- **Interactive Particle Collisions:** At a microscopic level, students need to see *why* resistance reduces flow. They must be able to toggle a view to see individual particles (molecules) physically slamming into the restricted valve opening, causing traffic jams and back-pressure.

## 2. Rendering Pipeline: Strict Layering (Z-Index)

To solve the issue of water rendering over solid objects, the HTML5 Canvas draw loop must follow a strict painter's algorithm:

1. **Layer 1: The Pipe Background**
   - Renders the thick, dark grey loops outlining the pipeline boundaries.
2. **Layer 2: The Fluid**
   - Renders the water (either smooth flow lines or physics-based particles, depending on the active view mode).
3. **Layer 3: The Solid Machinery (Foreground)**
   - **Pump Casing & Impeller**: Drawn over the left pipe.
   - **Valve Body & Plunger**: Drawn over the top pipe. The plunger drops into the pipe channel based on user slider input.
   - **Water Wheel**: Drawn over the right pipe.

By rendering the machinery *last*, it naturally occludes the fluid passing beneath it, perfectly maintaining physical illusion.

## 3. Dual-Mode Display Architecture

To balance performance and visual clarity, the app utilizes a "Toggle View" mechanic in the UI, allowing the user to switch seamlessly between two rendering engines. 

### Mode A: Macro View (Smooth Water)
*The default view for understanding the macroscopic loop.*

- **Visual Concept:** The entire pipe loop is filled with a solid, semi-transparent blue path.
- **Flow Animation:** Instead of moving individual dots, an animated texture (or changing `lineDashOffset`) slides along the middle of the pipe. This visually communicates speed without breaking the illusion of continuous fluid.
- **Physics Behavior:** Highly performant math calculates `Flow Rate = Pump Pressure / Resistance`. The calculated Flow Rate drives the speed of the sliding flow lines, the spinning pump impeller, and the spinning water wheel.

### Mode B: Component Inspection Views (Micro Physics)
*Activated via three UI toggle buttons: "Inspect Pump", "Inspect Valve", and "Inspect Wheel".*

- **Visual Concept:** The global macro loop dims, and the camera zooms in heavily on the selected component. The smooth water fades out, and individual rigid bodies (Water Molecules) appear in that localized area.
- **Engine:** Powered by a lightweight 2D physics engine (**Matter.js**).
- **Mechanics per Component:**
  - **The Valve (Variable Resistor):** 
    - Particles are pushed from left to right.
    - The moving Valve Plunger acts as a static rigid body.
    - As the valve closes, particles physically bounce off it, squeeze through the gap, and bunch up on the left (demonstrating back-pressure and resistance).
  - **The Pump (Battery/Voltage):**
    - The pump impeller is modeled as a spinning physical body.
    - As it spins, the blades physically strike and catch the resting water particles, throwing/pushing them into the pipe with force (demonstrating voltage acting as an electromagnetic push).
  - **The Water Wheel (Motor/LED Load):**
    - The wheel and its blades are modeled as a dynamic physical body on a central axle.
    - Fast-moving water particles flying down the pipe slam into the blades, physically transferring their kinetic energy and momentum to the wheel, causing it to spin (demonstrating work done by current).
## 4. UI Controls & Interactions

The overlaying HTML UI will contain:
- **Valve Control:** A slider from 100% (Open) to 0% (Closed).
- **Pump Pressure:** A slider to simulate higher voltage.
- **View Toggle Button:** Swaps the canvas between Mode A (Macro Smooth) and Mode B (Micro Collisions).
- **Metrics Readout:** Real-time text display of Flow Rate (Current).

## 5. Technology Stack
- **HTML5/CSS:** UI layers and layouts.
- **Vanilla JavaScript:** Core logic, state management, and the `canvas.getContext('2d')` draw loop.
- **Matter.js:** Loaded via CDN specifically to handle rigid-body collisions in Mode B without jitter.
