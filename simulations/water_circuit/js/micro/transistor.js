// Transistor Micro-Simulation
(function () {
    const TransistorSim = Object.assign({}, window.MicroRenderer, {
        PARTICLE_COUNT: 350,
        PARTICLE_RADIUS: 7,
        gateBody: null,
        gateSpring: null,

        start: function () {
            this.initEngine();
            const canvas = document.getElementById('simulationCanvas');
            const w = canvas.width;
            const h = canvas.height;
            const pipeY = h / 2;

            this.setupTransistorScene(w, h);
            this.activeMode = 'micro-transistor';

            Matter.Events.on(this.engine, 'beforeUpdate', () => {
                this.applyTransistorForces(w, h);
                this.wrapTransistorParticles(w, h);
            });
        },

        setupTransistorScene: function(w, h) {
            const { Bodies, Composite, Constraint } = Matter;
            const wallOptions = { isStatic: true, friction: 0, restitution: 0.1 };
            const pipeY = h / 2;
            const pt = this.PIPE_THICKNESS;
            const wv = this.WALL_VISUAL;

            // Main Horizontal Pipe (Collector -> Emitter)
            // Left Entry (Collector)
            const wallThick = 400;
            const topWall = Bodies.rectangle(w / 2, pipeY - pt/2 + wv/2 - wallThick / 2, w + 800, wallThick, wallOptions);
            const bottomWall = Bodies.rectangle(w / 2, pipeY + pt/2 - wv/2 + wallThick / 2, w + 800, wallThick, wallOptions);
            Composite.add(this.engine.world, [topWall, bottomWall]);

            // Base Pipe (Vertical - Top center)
            const baseWidth = 100;
            const baseLeft = Bodies.rectangle(w/2 - baseWidth/2 - 20, 0, 40, pipeY, wallOptions);
            const baseRight = Bodies.rectangle(w/2 + baseWidth/2 + 20, 0, 40, pipeY, wallOptions);
            Composite.add(this.engine.world, [baseLeft, baseRight]);

            // The Gate (Sliding plunger)
            // It blocks the horizontal flow when high (spring pulled)
            // Base flow hits the top cap and pushes it DOWN to open the horizontal channel.
            this.gateBody = Bodies.rectangle(w/2, pipeY - 30, 80, 140, {
                restitution: 0,
                friction: 0.05,
                density: 0.3,
                frictionAir: 0.08
            });

            // Target position is high (blocking)
            this.gateSpring = Constraint.create({
                pointA: { x: w/2, y: pipeY - 180 },
                bodyB: this.gateBody,
                bodyB: this.gateBody,
                pointB: { x: 0, y: -60 },
                stiffness: 0.006,
                damping: 0.1
            });
            
            Composite.add(this.engine.world, [this.gateBody, this.gateSpring]);

            this.spawnInitialParticles(w, h);
        },

        applyTransistorForces: function(w, h) {
            const pressure = State.pumpPressure;
            const valveFactor = State.valveOpenness / 100;
            const pipeY = h / 2;

            // Collector force (always pushing)
            const colForce = (pressure * 0.000018 * valveFactor) / this.subSteps;
            
            // Base force (pushing down from base pipe)
            // Base flow is "pulsed" or controlled by some fraction of pressure for logic demo
            const baseForce = (pressure * 0.000035 * valveFactor) / this.subSteps;

            const maxSpeed = (1.5 + pressure * 0.1) * valveFactor;

            for (const p of this.particles) {
                // If particle is in the vertical Base pipe
                if (p.position.y < pipeY - 20 && Math.abs(p.position.x - w/2) < 60) {
                    Matter.Body.applyForce(p, p.position, { x: 0, y: baseForce });
                    p.isBaseFlow = true;
                } else {
                    Matter.Body.applyForce(p, p.position, { x: colForce, y: 0 });
                    p.isBaseFlow = false;
                }

                // Speed cap
                const speedSq = p.velocity.x * p.velocity.x + p.velocity.y * p.velocity.y;
                if (speedSq > maxSpeed * maxSpeed) {
                    const s = maxSpeed / Math.sqrt(speedSq);
                    Matter.Body.setVelocity(p, { x: p.velocity.x * s, y: p.velocity.y * s });
                }
            }
        },

        wrapTransistorParticles: function(w, h) {
            const pipeY = h / 2;
            for (const p of this.particles) {
                // Horizontal wrap
                if (p.position.x > w + 100) {
                    Matter.Body.setPosition(p, { x: -50, y: pipeY + (Math.random() - 0.5) * 100 });
                    Matter.Body.setVelocity(p, { x: 1, y: 0 });
                }
                
                // Vertical wrap (Base flow)
                if (p.position.y > pipeY + 120 && Math.abs(p.position.x - w/2) < 100) {
                    // Base particles disappear after hitting gate and teleport back to top
                    // Or they just join the main flow. 
                    // Let's teleport them back to top to maintain "Base" pipe density.
                    Matter.Body.setPosition(p, { x: w/2 + (Math.random() - 0.5) * 60, y: -50 });
                }
            }
        },

        draw: function (ctx, canvas, state) {
            this.drawBackground(ctx, canvas);
            this.drawPipe(ctx, canvas);
            this.drawBasePipe(ctx, canvas);
            this.drawGate(ctx, canvas);
            this.drawParticles(ctx, canvas);
        },

        drawBasePipe: function(ctx, canvas) {
            const pipeY = canvas.height / 2;
            const w = canvas.width;
            const midX = w / 2;
            const baseWidth = 100;
            const wv = this.WALL_VISUAL;

            ctx.save();
            ctx.fillStyle = 'rgba(21,101,192,0.2)';
            ctx.fillRect(midX - baseWidth/2, 0, baseWidth, pipeY);

            // Base pipe walls
            const grad = ctx.createLinearGradient(midX - baseWidth/2 - wv/2, 0, midX - baseWidth/2 + wv/2, 0);
            grad.addColorStop(0, '#1a3050'); grad.addColorStop(0.5, '#243e5c'); grad.addColorStop(1, '#1a3050');
            ctx.fillStyle = grad;
            ctx.fillRect(midX - baseWidth/2 - wv/2, 0, wv, pipeY);
            
            const grad2 = ctx.createLinearGradient(midX + baseWidth/2 - wv/2, 0, midX + baseWidth/2 + wv/2, 0);
            grad2.addColorStop(0, '#1a3050'); grad2.addColorStop(0.5, '#243e5c'); grad2.addColorStop(1, '#1a3050');
            ctx.fillStyle = grad2;
            ctx.fillRect(midX + baseWidth/2 - wv/2, 0, wv, pipeY);
            ctx.restore();
        },

        drawGate: function(ctx, canvas) {
            if (!this.gateBody) return;
            const pos = this.gateBody.position;
            const angle = this.gateBody.angle;
            
            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(angle);

            // The gate block
            const grad = ctx.createLinearGradient(-40, -70, 40, 70);
            grad.addColorStop(0, '#7c8fa3');
            grad.addColorStop(0.5, '#cbd5e1');
            grad.addColorStop(1, '#64748b');
            ctx.fillStyle = grad;
            ctx.strokeStyle = '#3a5a80';
            ctx.lineWidth = 3;
            ctx.fillRect(-40, -70, 80, 140);
            ctx.strokeRect(-40, -70, 80, 140);

            // Cap on top where flow hits
            ctx.fillStyle = '#475569';
            ctx.fillRect(-50, -70, 100, 15);
            ctx.strokeRect(-50, -70, 100, 15);

            ctx.restore();
        },

        drawParticles: function(ctx, canvas) {
            const visLeft = canvas.width / 2 - this.VISIBLE_WIDTH / 2;
            const visRight = canvas.width / 2 + this.VISIBLE_WIDTH / 2;

            ctx.save();
            // No clipping for T-shape, or special clipping
            // Just let them flow
            
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'rgba(56,189,248,0.4)';
            
            for (let p of this.particles) {
                // Different colors for Base vs Collector?
                if (p.isBaseFlow) {
                    ctx.fillStyle = '#7dd3fc'; // Lighter cyan for base
                } else {
                    ctx.fillStyle = '#ffffff';
                }
                
                ctx.beginPath();
                ctx.arc(p.position.x, p.position.y, p.circleRadius, 0, 2 * Math.PI);
                ctx.fill();
            }
            ctx.restore();
        }
    });

    window.MicroRenderer = TransistorSim;
})();
