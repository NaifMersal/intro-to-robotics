// Wheel Micro-Simulation
(function() {
    const WheelSim = Object.assign({}, window.MicroRenderer, {
        wheelAngle: 0,
        wheelAngularVelocity: 0,

        start: function() {
            this.initEngine();
            const canvas = document.getElementById('simulationCanvas');
            this.setupCommonScene(canvas.width, canvas.height);
            this.wheelAngle = 0;
            this.wheelAngularVelocity = 0;
            this.activeMode = 'micro-wheel';

            Matter.Events.on(this.engine, 'beforeUpdate', () => {
                this.applyWheelForce(canvas.width, canvas.height / 2);
                this.applyWheelDrag(canvas.width, canvas.height / 2);
                this.wrapParticles(canvas.width, canvas.height / 2);
            });
        },

        applyWheelForce: function(w, pipeY) {
            const pressure = State.pumpPressure;
            const valveScale = State.valveOpenness / 100;
            const maxSpeed = pressure * 0.05 * valveScale;
            const baseForceMag = (pressure * 0.00015 * valveScale) / this.subSteps;

            for (const p of this.particles) {
                if (baseForceMag > 0) {
                    Matter.Body.applyForce(p, p.position, { x: baseForceMag, y: 0 });
                }
                // Always enforce cap so particles decelerate when pump/valve off
                const speed = Math.sqrt(p.velocity.x ** 2 + p.velocity.y ** 2);
                if (speed > maxSpeed) {
                    const s = maxSpeed / speed;
                    Matter.Body.setVelocity(p, { x: p.velocity.x * s, y: p.velocity.y * s });
                }
            }
        },

        applyWheelDrag: function(w, pipeY) {
            // Wheel paddles extract energy from particles passing through the wheel zone
            const cx = w / 2;
            const WHEEL_RADIUS = 75;
            for (const p of this.particles) {
                const dx = p.position.x - cx;
                const dy = p.position.y - pipeY;
                if (dx * dx + dy * dy < WHEEL_RADIUS * WHEEL_RADIUS) {
                    const drag = (p.velocity.x * 0.000008) / this.subSteps;
                    Matter.Body.applyForce(p, p.position, { x: -drag, y: 0 });
                }
            }
        },

        draw: function(ctx, canvas, state) {
            // Compute avg vx of particles inside wheel zone (once per render frame)
            let totalVx = 0, count = 0;
            const cx = canvas.width / 2, cy = canvas.height / 2;
            const WHEEL_RADIUS = 75;
            for (const p of this.particles) {
                const dx = p.position.x - cx;
                const dy = p.position.y - cy;
                if (dx * dx + dy * dy < WHEEL_RADIUS * WHEEL_RADIUS) {
                    totalVx += p.velocity.x;
                    count++;
                }
            }
            const avgVx = count > 0 ? totalVx / count : 0;

            // Smooth angular velocity toward target — gives realistic rotational inertia
            const targetOmega = avgVx * 0.012;
            this.wheelAngularVelocity = this.wheelAngularVelocity * 0.92 + targetOmega * 0.08;
            this.wheelAngle += this.wheelAngularVelocity;

            this.drawBackground(ctx, canvas);
            this.drawPipe(ctx, canvas);
            this.drawParticles(ctx, canvas);
            this.drawWheel(ctx, canvas.width / 2, canvas.height / 2);
        },

        drawWheel: function(ctx, x, y) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(this.wheelAngle);

            ctx.beginPath();
            ctx.arc(0, 0, 75, 0, Math.PI * 2);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 8;
            ctx.stroke();

            ctx.fillStyle = '#0284c7';
            for (let i = 0; i < 8; i++) {
                ctx.fillRect(20, -5, 55, 10);
                ctx.rotate((Math.PI * 2) / 8);
            }

            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.fillStyle = '#0ea5e9';
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#bae6fd';
            ctx.stroke();
            ctx.restore();
        }
    });

    window.MicroRenderer = WheelSim;
})();
