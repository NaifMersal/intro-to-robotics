// Light Bulb Micro-Simulation
(function () {
    const LightBulbSim = Object.assign({}, window.MicroRenderer, {
        PARTICLE_COUNT: 350,
        PARTICLE_RADIUS: 7.5,
        filamentHeat: 0,

        start: function () {
            this.initEngine();
            const canvas = document.getElementById('simulationCanvas');
            const w = canvas.width;
            const h = canvas.height;
            const pipeY = h / 2;
            
            this.setupFilamentScene(w, h);
            this.activeMode = 'micro-lightbulb';

            Matter.Events.on(this.engine, 'beforeUpdate', () => {
                this.applyFlowAndFriction(w, pipeY);
                this.wrapParticles(w, pipeY);
            });
        },

        setupFilamentScene: function(w, h) {
            const { Bodies, Composite } = Matter;
            const wallOptions = { isStatic: true, friction: 0.05, restitution: 0.1 };
            const pipeY = h / 2;
            const pt = this.PIPE_THICKNESS;
            const wv = this.WALL_VISUAL;

            // Main walls (far away to act as boundaries)
            const wallThick = 400;
            const innerTop = pipeY - pt / 2 + wv / 2;
            const innerBottom = pipeY + pt / 2 - wv / 2;

            const topWall = Bodies.rectangle(w / 2, innerTop - wallThick / 2, w + 800, wallThick, wallOptions);
            const bottomWall = Bodies.rectangle(w / 2, innerBottom + wallThick / 2, w + 800, wallThick, wallOptions);
            Composite.add(this.engine.world, [topWall, bottomWall]);

            // Filament constriction (narrowing in middle with bumps)
            const midX = w / 2;
            const filamentWidth = 350;
            const steps = 8;
            const stepW = filamentWidth / steps;

            for (let i = 0; i < steps; i++) {
                const x = (midX - filamentWidth/2) + i * stepW + stepW/2;
                // Height of blocks (alternate 30/60 for zigzag)
                // Total inner height is ~160, so 30+60=90 leaves 70px gap.
                const topH = (i % 2 === 0) ? 30 : 60;
                const botH = (i % 2 === 0) ? 60 : 30;
                
                // Physics blocks aligned with VISUALS
                // Rectangle center Y is innerTop + height/2 or innerBottom - height/2
                const tb = Bodies.rectangle(x, innerTop + topH/2, stepW, topH, wallOptions);
                const bb = Bodies.rectangle(x, innerBottom - botH/2, stepW, botH, wallOptions);
                Composite.add(this.engine.world, [tb, bb]);
            }

            this.spawnInitialParticles(w, pipeY);
        },

        applyFlowAndFriction: function (w, pipeY) {
            const pressure = State.pumpPressure;
            const valveFactor = State.valveOpenness / 100;
            // Higher speed and force to handle constriction bottlenecks
            const maxSpeed = (2.0 + pressure * 0.15) * valveFactor;
            const baseForce = (pressure * 0.000025 * valveFactor) / this.subSteps;

            const midX = w / 2;
            const filamentRange = 150;
            let totalHeatAccum = 0;

            for (const p of this.particles) {
                // Apply flow force
                Matter.Body.applyForce(p, p.position, { x: baseForce, y: 0 });

                // Friction/Heat logic
                const inFilament = Math.abs(p.position.x - midX) < filamentRange;
                if (!p.heat) p.heat = 0;

                // Heat up if moving fast in the narrow section
                if (inFilament && pressure > 5) {
                    const speed = Math.sqrt(p.velocity.x * p.velocity.x + p.velocity.y * p.velocity.y);
                    p.heat += 0.02 * (speed / 3) * valveFactor;
                } else {
                    p.heat *= 0.94; // Cooling down outside filament
                }
                
                p.heat = Math.min(1.2, p.heat);
                totalHeatAccum += p.heat;

                // Speed cap
                const speed = Math.sqrt(p.velocity.x * p.velocity.x + p.velocity.y * p.velocity.y);
                if (speed > maxSpeed) {
                    const s = maxSpeed / speed;
                    Matter.Body.setVelocity(p, { x: p.velocity.x * s, y: p.velocity.y * s });
                }
            }
            
            // Average heat for global glow
            this.filamentHeat = (totalHeatAccum / this.particles.length) * 4;
        },

        draw: function (ctx, canvas, state) {
            this.drawBackground(ctx, canvas);
            this.drawPipe(ctx, canvas);
            this.drawFilamentVisuals(ctx, canvas);
            this.drawFilamentGlow(ctx, canvas);
            this.drawParticles(ctx, canvas);
        },

        drawFilamentVisuals: function(ctx, canvas) {
            const midX = canvas.width / 2;
            const pipeY = canvas.height / 2;
            const pt = this.PIPE_THICKNESS;
            const filamentWidth = 350;
            const innerTop = pipeY - pt / 2 + this.WALL_VISUAL / 2;
            const innerBottom = pipeY + pt / 2 - this.WALL_VISUAL / 2;

            ctx.save();
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#334155';
            ctx.fillStyle = '#1e293b';

            // Draw the "constriction" blocks
            const steps = 8;
            const stepW = filamentWidth / steps;
            for (let i = 0; i < steps; i++) {
                const x = (midX - filamentWidth/2) + i * stepW;
                const topH = (i % 2 === 0) ? 30 : 60;
                const botH = (i % 2 === 0) ? 60 : 30;

                ctx.fillRect(x, innerTop, stepW, topH);
                ctx.strokeRect(x, innerTop, stepW, topH);
                ctx.fillRect(x, innerBottom - botH, stepW, botH);
                ctx.strokeRect(x, innerBottom - botH, stepW, botH);
            }
            ctx.restore();
        },

        drawFilamentGlow: function(ctx, canvas) {
            const h = Math.min(1, this.filamentHeat);
            if (h < 0.05) return;

            const midX = canvas.width / 2;
            const midY = canvas.height / 2;

            ctx.save();
            // Intense core glow
            ctx.shadowBlur = 60 * h;
            ctx.shadowColor = `rgba(255, ${150 + 100 * h}, 50, ${0.4 * h})`;
            
            const grad = ctx.createLinearGradient(midX - 150, 0, midX + 150, 0);
            grad.addColorStop(0, 'rgba(255,200,100,0)');
            grad.addColorStop(0.5, `rgba(255, ${200 + 55 * h}, ${150 + 105 * h}, ${0.8 * h})`);
            grad.addColorStop(1, 'rgba(255,200,100,0)');

            ctx.fillStyle = grad;
            ctx.fillRect(midX - 180, midY - 60 * h, 360, 120 * h);
            ctx.restore();
        },

        drawParticles: function(ctx, canvas) {
            const visLeft = canvas.width / 2 - this.VISIBLE_WIDTH / 2;
            const visRight = canvas.width / 2 + this.VISIBLE_WIDTH / 2;
            const pipeY = canvas.height / 2;
            const pt = this.PIPE_THICKNESS;
            const innerTop = pipeY - pt/2 + this.WALL_VISUAL/2;
            const innerBottom = pipeY + pt/2 - this.WALL_VISUAL/2;

            ctx.save();
            ctx.beginPath();
            ctx.rect(visLeft, innerTop, this.VISIBLE_WIDTH, innerBottom - innerTop);
            ctx.clip();

            for (let p of this.particles) {
                const heat = Math.min(1, p.heat || 0);
                
                // Base blue-white
                let r = 180, g = 220, b = 255;
                
                if (heat > 0) {
                    // Shift to yellow/white-hot
                    r = Math.floor(180 + (255 - 180) * heat);
                    g = Math.floor(220 + (255 - 220) * heat);
                    b = Math.floor(255 + (200 - 255) * heat);
                }

                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                if (heat > 0.3) {
                    ctx.shadowBlur = 8 * heat;
                    ctx.shadowColor = `rgba(255, 200, 0, ${heat})`;
                }

                ctx.beginPath();
                ctx.arc(p.position.x, p.position.y, p.circleRadius, 0, 2 * Math.PI);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
            ctx.restore();
        }
    });

    window.MicroRenderer = LightBulbSim;
})();
