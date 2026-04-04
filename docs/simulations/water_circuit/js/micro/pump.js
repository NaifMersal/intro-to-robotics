// Pump Micro-Simulation
(function () {
    const PumpSim = Object.assign({}, window.MicroRenderer, {
        turbinePos: null,
        turbineAngle: 0,
        PARTICLE_COUNT: 650,
        PARTICLE_RADIUS: 7,

        start: function () {
            this.initEngine();
            const canvas = document.getElementById('simulationCanvas');
            const w = canvas.width;
            const h = canvas.height;
            const pipeY = h / 2;
            this.setupCommonScene(w, h);
            this.activeMode = 'micro-pump';

            this.turbinePos = { x: w / 2, y: pipeY };
            this.turbineAngle = 0;

            Matter.Events.on(this.engine, 'beforeUpdate', () => {
                this.driveTurbine(w, pipeY);
                this.wrapParticles(w, pipeY);
            });
        },

        driveTurbine: function (w, pipeY) {
            const pressure = State.pumpPressure;
            const valveFactor = State.valveOpenness / 100;
            // Speed cap scales with valve: closed valve (0) → maxSpeed 0 → particles stop
            const maxSpeed = pressure * 0.05 * valveFactor;
            const applyForces = pressure > 0 && valveFactor > 0;

            const cx = this.turbinePos.x;
            const cy = this.turbinePos.y;
            const PUMP_ZONE = 140;
            const zoneForce = (pressure * 0.000025 * valveFactor) / this.subSteps;
            const bgForce   = (pressure * 0.000008 * valveFactor) / this.subSteps;

            for (const p of this.particles) {
                if (applyForces) {
                    const dx = p.position.x - cx;
                    const dy = p.position.y - cy;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    let fx, fy;
                    if (dist < PUMP_ZONE) {
                        // Pump zone: strong axial force + clockwise swirl for realism
                        const swirlMag = zoneForce * 0.30;
                        const swirlFx = dist > 2 ? (dy / dist) * swirlMag : 0;
                        const swirlFy = dist > 2 ? (-dx / dist) * swirlMag : 0;
                        fx = zoneForce + swirlFx;
                        fy = swirlFy;
                    } else {
                        // Background pressure keeps flow moving through the rest of the pipe
                        fx = bgForce;
                        fy = 0;
                    }

                    Matter.Body.applyForce(p, p.position, { x: fx, y: fy });
                }

                // Speed cap — enforced even when not applying forces so particles decelerate
                const speed = Math.sqrt(p.velocity.x * p.velocity.x + p.velocity.y * p.velocity.y);
                if (speed > maxSpeed) {
                    const s = maxSpeed / speed;
                    Matter.Body.setVelocity(p, { x: p.velocity.x * s, y: p.velocity.y * s });
                }
            }
        },

        draw: function (ctx, canvas, state) {
            // Advance turbine angle once per render frame (not per physics sub-step)
            this.turbineAngle = (this.turbineAngle || 0) + (State.pumpPressure * 0.003 * (State.valveOpenness / 100));
            this.drawBackground(ctx, canvas);
            this.drawPipe(ctx, canvas);
            this.drawTurbine(ctx, canvas);
            this.drawParticles(ctx, canvas);
        },

        drawTurbine: function (ctx, canvas) {
            if (!this.turbinePos) return;

            const cx = this.turbinePos.x;
            const cy = canvas.height / 2;
            const pt = this.PIPE_THICKNESS;
            const wv = this.WALL_VISUAL;
            const innerTop    = cy - pt / 2 + wv / 2;
            const innerBottom = cy + pt / 2 - wv / 2;

            ctx.save();
            ctx.beginPath();
            ctx.rect(0, innerTop - wv / 2, canvas.width, (innerBottom + wv / 2) - (innerTop - wv / 2));
            ctx.clip();

            ctx.translate(cx, cy);
            ctx.rotate(this.turbineAngle);

            const bladeGrad = ctx.createLinearGradient(-80, -80, 80, 80);
            bladeGrad.addColorStop(0, '#7c8fa3');
            bladeGrad.addColorStop(0.5, '#94a3b8');
            bladeGrad.addColorStop(1, '#64748b');
            ctx.fillStyle = bladeGrad;
            ctx.strokeStyle = '#3a5a80';
            ctx.lineWidth = 2;

            for (let i = 0; i < 4; i++) {
                ctx.save();
                ctx.rotate((Math.PI / 2) * i);
                ctx.fillRect(14, -7, 70, 14);
                ctx.strokeRect(14, -7, 70, 14);
                ctx.restore();
            }

            // Hub
            const hubGrad = ctx.createRadialGradient(-4, -4, 0, 0, 0, 14);
            hubGrad.addColorStop(0, '#cbd5e1');
            hubGrad.addColorStop(1, '#64748b');
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fillStyle = hubGrad;
            ctx.fill();
            ctx.strokeStyle = '#3a5a80';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Glow ring
            ctx.shadowBlur = 15;
            ctx.shadowColor = 'rgba(56,189,248,0.3)';
            ctx.beginPath();
            ctx.arc(0, 0, 16, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(56,189,248,0.15)';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.restore();
        }
    });

    window.MicroRenderer = PumpSim;
})();
