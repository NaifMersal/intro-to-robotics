// Motor Micro-Simulation (Electromagnetic Edition)
(function() {
    const MotorSim = Object.assign({}, window.MicroRenderer, {
        wheelAngle: 0,
        wheelAngularVelocity: 0,
        
        // Override base constants for "Electrons"
        PARTICLE_RADIUS: 4,
        PARTICLE_COUNT: 450,
        
        start: function() {
            // Apply overrides BEFORE init
            this.initEngine();
            const canvas = document.getElementById('simulationCanvas');
            this.setupCommonScene(canvas.width, canvas.height);
            this.wheelAngle = 0;
            this.wheelAngularVelocity = 0;
            this.activeMode = 'micro-motor';

            Matter.Events.on(this.engine, 'beforeUpdate', () => {
                this.applyMotorForce(canvas.width, canvas.height / 2);
                this.wrapParticles(canvas.width, canvas.height / 2);
            });
        },

        applyMotorForce: function(w, pipeY) {
            const pressure = State.pumpPressure;
            const valveScale = State.valveOpenness / 100;
            const maxSpeed = pressure * 0.08 * valveScale;
            // Electrons move faster and have less drag
            const baseForceMag = (pressure * 0.00018 * valveScale) / this.subSteps;

            for (const p of this.particles) {
                if (baseForceMag > 0) {
                    Matter.Body.applyForce(p, p.position, { x: baseForceMag, y: 0 });
                }
                const speed = Math.sqrt(p.velocity.x ** 2 + p.velocity.y ** 2);
                if (speed > maxSpeed) {
                    const s = maxSpeed / speed;
                    Matter.Body.setVelocity(p, { x: p.velocity.x * s, y: p.velocity.y * s });
                }
            }
        },

        draw: function(ctx, canvas, state) {
            // Compute average velocity of particles near the motor armature
            let totalVx = 0, count = 0;
            const cx = canvas.width / 2, cy = canvas.height / 2;
            const INTERACTION_RADIUS = 120;
            
            for (const p of this.particles) {
                const dx = p.position.x - cx;
                const dy = p.position.y - cy;
                if (dx * dx + dy * dy < INTERACTION_RADIUS * INTERACTION_RADIUS) {
                    totalVx += p.velocity.x;
                    count++;
                }
            }
            const avgVx = count > 0 ? totalVx / count : 0;

            // Rotation physics: particles "push" the magnetic field
            const targetOmega = avgVx * 0.015;
            this.wheelAngularVelocity = this.wheelAngularVelocity * 0.95 + targetOmega * 0.05;
            this.wheelAngle += this.wheelAngularVelocity;

            this.drawBackground(ctx, canvas);
            this.drawPipe(ctx, canvas);
            this.drawElectrons(ctx, canvas);
            this.drawMagneticTurbine(ctx, canvas.width / 2, canvas.height / 2);
        },

        drawElectrons: function(ctx, canvas) {
            // Override particle drawing for glowing electrons
            const visLeft = canvas.width / 2 - this.VISIBLE_WIDTH / 2;
            const visRight = canvas.width / 2 + this.VISIBLE_WIDTH / 2;

            ctx.save();
            ctx.beginPath();
            ctx.rect(visLeft, 0, this.VISIBLE_WIDTH, canvas.height);
            ctx.clip();
            
            for (let p of this.particles) {
                const radius = this.PARTICLE_RADIUS + 1;
                ctx.save();
                
                // Glow
                ctx.shadowBlur = radius * 1.5;
                ctx.shadowColor = 'rgba(255, 215, 0, 0.4)';
                
                // Body
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath();
                ctx.arc(p.position.x, p.position.y, radius, 0, Math.PI * 2);
                ctx.fill();
                
                // Minus sign
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#0f172a';
                ctx.font = `bold ${Math.max(8, radius * 1.4)}px Inter`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('-', p.position.x, p.position.y);
                
                ctx.restore();
            }
            ctx.restore();
        },

        drawMagneticTurbine: function(ctx, x, y) {
            const ARM_LENGTH = 80;
            const ARM_WIDTH = 35;

            // Background Stator Glow
            const statorGlow = ctx.createRadialGradient(x, y, 50, x, y, 150);
            statorGlow.addColorStop(0, 'rgba(56, 189, 248, 0.1)');
            statorGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
            ctx.fillStyle = statorGlow;
            ctx.beginPath();
            ctx.arc(x, y, 150, 0, Math.PI * 2);
            ctx.fill();

            // Central Armature
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(this.wheelAngle);

            // Red Pole (North)
            ctx.fillStyle = '#ef4444'; // Red-500
            ctx.beginPath();
            ctx.roundRect(-ARM_WIDTH/2, -ARM_LENGTH, ARM_WIDTH, ARM_LENGTH, [10, 10, 0, 0]);
            ctx.fill();
            
            // North Label
            ctx.fillStyle = 'white';
            ctx.font = '800 14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('N', 0, -ARM_LENGTH + 20);

            // Blue Pole (South)
            ctx.fillStyle = '#3b82f6'; // Blue-500
            ctx.beginPath();
            ctx.roundRect(-ARM_WIDTH/2, 0, ARM_WIDTH, ARM_LENGTH, [0, 0, 10, 10]);
            ctx.fill();

            // South Label
            ctx.fillStyle = 'white';
            ctx.fillText('S', 0, ARM_LENGTH - 10);

            // Center Bolt/Axle
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.fillStyle = '#94a3b8';
            ctx.fill();
            ctx.strokeStyle = '#f1f5f9';
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.restore();
        }
    });

    window.MicroRenderer = MotorSim;
})();
