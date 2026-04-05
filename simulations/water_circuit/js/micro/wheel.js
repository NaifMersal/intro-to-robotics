// Wheel Micro-Simulation
(function () {
    const WheelSim = Object.assign({}, window.MicroRenderer, {
        wheelBody: null,
        nozzle: [],
        shroud: null,
        subSteps: 8, // Ultra-precision for high-speed streaks
        rpm: 0,
        smoothedRpm: 0,

        start: function () {
            this.initEngine();
            const canvas = document.getElementById('simulationCanvas');
            this.setupCommonScene(canvas.width, canvas.height);

            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            const wheelY = cy;

            this.createWheelBody(cx, wheelY);
            this.createNozzle(cx, cy);

            Matter.Body.setInertia(this.wheelBody, this.wheelBody.inertia * 0.45);

            this.activeMode = 'micro-wheel';

            Matter.Events.on(this.engine, 'beforeUpdate', () => {
                this.applyWheelForce(canvas.width, canvas.height / 2);
                this.applyFluidCohesion(); // NEW: Surface Tension / Cohesion
                this.wrapAndTurbulateParticles(canvas.width, canvas.height / 2);
                this.tuneParticlePhysics();
                this.updateStats();
            });
        },

        updateStats: function () {
            // Convert angular velocity to RPM (multiplied for visual scale)
            const currentRpm = Math.abs(this.wheelBody.angularVelocity * 60 / (Math.PI * 2)) * 12;
            this.smoothedRpm = this.smoothedRpm * 0.9 + currentRpm * 0.1;
            this.rpm = Math.round(this.smoothedRpm);
        },

        applyFluidCohesion: function () {
            const particles = this.particles;
            const radius = this.PARTICLE_RADIUS;
            const threshold = radius * 2.8;
            const thresholdSq = threshold * threshold;
            const cohesionMag = 0.00018; // Surface Tension strength

            // Spatial optimization: Sort by X
            const sorted = [...particles].sort((a, b) => a.position.x - b.position.x);

            for (let i = 0; i < sorted.length; i++) {
                const p1 = sorted[i];
                for (let j = i + 1; j < sorted.length; j++) {
                    const p2 = sorted[j];
                    const dx = p2.position.x - p1.position.x;
                    if (dx > threshold) break;

                    const dy = p2.position.y - p1.position.y;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < thresholdSq && distSq > 1) {
                        const dist = Math.sqrt(distSq);
                        const force = (threshold - dist) * cohesionMag;
                        const fx = (dx / dist) * force;
                        const fy = (dy / dist) * force;

                        Matter.Body.applyForce(p1, p1.position, { x: fx, y: fy });
                        Matter.Body.applyForce(p2, p2.position, { x: -fx, y: -fy });
                    }
                }
            }
        },

        wrapAndTurbulateParticles: function (w, pipeY) {
            this.wrapParticles(w, pipeY);
            const cx = w / 2;
            for (const p of this.particles) {
                if (p.position.x > cx + 50 && p.position.x < cx + 250) {
                    const jitter = (Math.random() - 0.5) * 1.5;
                    Matter.Body.applyForce(p, p.position, { x: 0, y: jitter * 0.0002 });
                }
            }
        },

        createNozzle: function (cx, cy) {
            const { Bodies, Composite } = Matter;
            const nozzleOptions = { isStatic: true, collisionFilter: { category: 0x0002 } };

            const walls = [];
            const segments = 8;
            const nozzleWidth = 140;
            const entryY = 85;
            const exitYTop = 65;    // Narrowed for High-Velocity Jet
            const exitYBottom = 5; // Narrowed for High-Velocity Jet

            for (let i = 0; i < segments; i++) {
                const t = i / (segments - 1);
                const x = cx - 230 + t * nozzleWidth;
                const topWallY = cy - (entryY - t * (entryY - exitYTop));
                walls.push(Bodies.rectangle(x, topWallY, 25, 12, { ...nozzleOptions, angle: Math.PI / 12 }));
                const bottomWallY = cy + (entryY - t * (entryY + exitYBottom));
                walls.push(Bodies.rectangle(x, bottomWallY, 25, 12, { ...nozzleOptions, angle: -Math.PI / 8 }));
            }

            // Sleek Curved Baffle (Integrated Shroud)
            const shroudVertices = [
                { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 15 }, { x: 25, y: 45 }, { x: 0, y: 45 }
            ];
            this.shroud = Bodies.fromVertices(cx - 75, cy + 68, [shroudVertices], { ...nozzleOptions });

            this.nozzle = walls;
            Composite.add(this.engine.world, [...this.nozzle, this.shroud]);
        },

        createWheelBody: function (cx, wheelY) {
            const { Bodies, Body, Composite, Constraint } = Matter;
            const NUM_BLADES = 6;
            const INNER_RADIUS = 35;
            const BLADE_LENGTH = 55;
            const BLADE_WIDTH_BASE = 8;
            const BLADE_WIDTH_TIP = 32; // Slightly wider for Pelton tips

            const parts = [];
            parts.push(Bodies.circle(cx, wheelY, INNER_RADIUS, {}));

            for (let i = 0; i < NUM_BLADES; i++) {
                const baseAngle = (i / NUM_BLADES) * Math.PI * 2;
                const vertices = [];
                const res = 12; // Higher resolution for tip curvature
                
                for (let j = 0; j <= res; j++) {
                    const t = j / res;
                    const r = INNER_RADIUS + t * BLADE_LENGTH;
                    const sweep = t * t * 0.85;
                    const width = BLADE_WIDTH_BASE + t * (BLADE_WIDTH_TIP - BLADE_WIDTH_BASE);
                    
                    // Pelton-Style "Tip Lip" curve at the end (t > 0.9)
                    const lipOffset = t > 0.9 ? (t - 0.9) * 50 : 0;
                    const angle = baseAngle + sweep + (lipOffset / 180 * Math.PI);
                    
                    vertices.push({
                        x: cx + Math.cos(angle) * r + Math.cos(angle + Math.PI / 2) * (width / 2),
                        y: wheelY + Math.sin(angle) * r + Math.sin(angle + Math.PI / 2) * (width / 2)
                    });
                }
                for (let j = res; j >= 0; j--) {
                    const t = j / res;
                    const r = INNER_RADIUS + t * BLADE_LENGTH;
                    const sweep = t * t * 0.85;
                    const width = BLADE_WIDTH_BASE + t * (BLADE_WIDTH_TIP - BLADE_WIDTH_BASE);
                    const lipOffset = t > 0.9 ? (t - 0.9) * 50 : 0;
                    const angle = baseAngle + sweep + (lipOffset / 180 * Math.PI);
                    
                    vertices.push({
                        x: cx + Math.cos(angle) * r - Math.cos(angle + Math.PI / 2) * (width / 2),
                        y: wheelY + Math.sin(angle) * r - Math.sin(angle + Math.PI / 2) * (width / 2)
                    });
                }
                const blade = Bodies.fromVertices(cx, wheelY, [vertices], {
                    density: 0.025,
                    frictionAir: 0.005,
                    friction: 0.25
                });
                if (blade) parts.push(blade);
            }

            const wheelBody = Body.create({
                parts,
                isStatic: false,
                density: 0.02,
                frictionAir: 0.005,
                friction: 0.25,
                collisionFilter: { category: 0x0004, mask: 0x0001 },
            });

            Body.setPosition(wheelBody, { x: cx, y: wheelY });
            const pin = Constraint.create({
                pointA: { x: cx, y: wheelY },
                bodyB: wheelBody,
                pointB: { x: 0, y: 0 },
                stiffness: 1,
                length: 0,
            });
            Composite.add(this.engine.world, [wheelBody, pin]);
            this.wheelBody = wheelBody;
        },

        tuneParticlePhysics: function () {
            for (const p of this.particles) {
                p.restitution = 0.45;
                p.density = 0.0045;
                p.friction = 0;
            }
        },

        applyWheelForce: function (w, pipeY) {
            const pressure = State.pumpPressure;
            const valveScale = State.valveOpenness / 100;
            const maxSpeed = pressure * 0.25 * valveScale; // Increased speed ceiling
            const baseForceMag = (pressure * 0.00085 * valveScale) / this.subSteps; // High-impulse jet
            for (const p of this.particles) {
                if (baseForceMag > 0) Matter.Body.applyForce(p, p.position, { x: baseForceMag, y: 0 });
                const speed = Math.sqrt(p.velocity.x ** 2 + p.velocity.y ** 2);
                if (speed > maxSpeed) {
                    const s = maxSpeed / speed;
                    Matter.Body.setVelocity(p, { x: p.velocity.x * s, y: p.velocity.y * s });
                }
            }
        },

        draw: function (ctx, canvas, state) {
            this.drawBackground(ctx, canvas);
            this.drawPipe(ctx, canvas);
            this.drawHousing(ctx, canvas);
            this.drawParticles(ctx, canvas);
            this.drawNozzle(ctx);
            this.drawWheel(ctx, this.wheelBody.position.x, this.wheelBody.position.y);
            this.drawHUD(ctx, canvas);
        },

        drawHUD: function (ctx, canvas) {
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;

            ctx.save();
            ctx.translate(cx + 80, cy - 84);

            // Glassmorphic Technical HUD
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(0, 0, 110, 48, 10);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#bae6fd';
            ctx.font = '10px "Inter", sans-serif';
            ctx.fillText('TURBINE STATE', 8, 16);
            ctx.font = 'bold 16px "Inter", monospace';
            ctx.fillStyle = '#38bdf8';
            ctx.fillText(`${this.rpm} RPM`, 8, 36);

            ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
            ctx.beginPath();
            ctx.moveTo(8, 21);
            ctx.lineTo(102, 21);
            ctx.stroke();

            ctx.restore();
        },

        drawHousing: function (ctx, canvas) {
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, 110, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(15, 52, 96, 0.4)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([15, 10]);
            ctx.stroke();
            ctx.restore();
        },

        drawNozzle: function (ctx) {
            ctx.save();
            ctx.fillStyle = 'rgba(30, 58, 138, 0.9)';
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 1;
            for (const block of this.nozzle) {
                const pos = block.position;
                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.rotate(block.angle);
                ctx.beginPath();
                ctx.roundRect(-12, -4, 24, 8, 2);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }
            if (this.shroud) {
                const pos = this.shroud.position;
                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.rotate(this.shroud.angle);
                ctx.fillStyle = '#1e293b';
                ctx.beginPath();
                ctx.roundRect(-30, -22, 60, 45, 8);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }
            ctx.restore();
        },

        drawWheel: function (ctx, x, y) {
            const speed = Math.abs(this.wheelBody.angularVelocity);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(this.wheelBody.angle);

            const NUM_BLADES = 6;
            const INNER_RADIUS = 35;
            const BLADE_LENGTH = 55;
            const BLADE_WIDTH_BASE = 8;
            const BLADE_WIDTH_TIP = 32;

            for (let i = 0; i < NUM_BLADES; i++) {
                const baseAngle = (i / NUM_BLADES) * Math.PI * 2;

                // High-Speed Motion Blur Arcs
                if (speed > 0.05) {
                    ctx.save();
                    ctx.rotate(baseAngle);
                    ctx.beginPath();
                    const streakLen = speed * 1800;
                    ctx.arc(0, 0, INNER_RADIUS + BLADE_LENGTH + 6, -streakLen / 1000, 0, false);
                    ctx.strokeStyle = `rgba(56, 189, 248, ${Math.min(0.35, speed * 2)})`;
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    ctx.restore();
                }

                ctx.beginPath();
                const res = 16;
                for (let j = 0; j <= res; j++) {
                    const t = j / res;
                    const r = INNER_RADIUS + t * BLADE_LENGTH;
                    const sweep = t * t * 0.85;
                    const width = BLADE_WIDTH_BASE + t * (BLADE_WIDTH_TIP - BLADE_WIDTH_BASE);
                    const lipOffset = t > 0.9 ? (t - 0.9) * 50 : 0;
                    const angle = baseAngle + sweep + (lipOffset / 180 * Math.PI);
                    const px = Math.cos(angle) * r + Math.cos(angle + Math.PI / 2) * (width / 2);
                    const py = Math.sin(angle) * r + Math.sin(angle + Math.PI / 2) * (width / 2);
                    if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                for (let j = res; j >= 0; j--) {
                    const t = j / res;
                    const r = INNER_RADIUS + t * BLADE_LENGTH;
                    const sweep = t * t * 0.85;
                    const width = BLADE_WIDTH_BASE + t * (BLADE_WIDTH_TIP - BLADE_WIDTH_BASE);
                    const lipOffset = t > 0.9 ? (t - 0.9) * 50 : 0;
                    const angle = baseAngle + sweep + (lipOffset / 180 * Math.PI);
                    const px = Math.cos(angle) * r - Math.cos(angle + Math.PI / 2) * (width / 2);
                    const py = Math.sin(angle) * r - Math.sin(angle + Math.PI / 2) * (width / 2);
                    ctx.lineTo(px, py);
                }
                ctx.closePath();

                const grad = ctx.createLinearGradient(0, 0, Math.cos(baseAngle) * 90, Math.sin(baseAngle) * 90);
                grad.addColorStop(0, '#0369a1');
                grad.addColorStop(0.6, '#0ea5e9');
                grad.addColorStop(1, '#bae6fd');
                ctx.fillStyle = grad;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 1;
                ctx.stroke();
                
                // Impact Spark/Glow at Tip Pocket
                if (speed > 0.08) {
                    ctx.save();
                    const tipAngle = baseAngle + 0.85 + (0.1 * 50 / 180 * Math.PI);
                    const tx = Math.cos(tipAngle) * (INNER_RADIUS + BLADE_LENGTH);
                    const ty = Math.sin(tipAngle) * (INNER_RADIUS + BLADE_LENGTH);
                    ctx.translate(tx, ty);
                    ctx.shadowBlur = 12 * speed;
                    ctx.shadowColor = '#38bdf8';
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath(); ctx.arc(0, 0, 3 * speed, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                }
            }

            const hubGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 42);
            hubGrad.addColorStop(0, '#334155'); hubGrad.addColorStop(0.5, '#1e293b'); hubGrad.addColorStop(1, '#0f172a');
            ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI * 2); ctx.fillStyle = hubGrad; ctx.fill();
            ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 4; ctx.stroke();
            ctx.shadowBlur = 45; ctx.shadowColor = '#38bdf8';
            ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fillStyle = '#f0f9ff'; ctx.fill();

            ctx.restore();
        },

    });

    window.MicroRenderer = WheelSim;
})();
