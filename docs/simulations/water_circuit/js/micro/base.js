// MicroView Base (Matter.js)
// Shared physics engine and pipe rendering for all micro-simulations.

const MicroBase = {
    engine: null,
    render: null,
    runner: null,
    activeMode: null,
    particles: [],
    lastTime: null,
    subSteps: 4,

    // Pipe geometry constants
    SIM_WIDTH: 1200,      // Total physics simulation area (provides a hidden reservoir)
    VISIBLE_WIDTH: 800,   // Visually rendered area
    PIPE_THICKNESS: 200,
    WALL_VISUAL: 40,
    PARTICLE_RADIUS: 9,
    PARTICLE_COUNT: 650,

    initEngine: function() {
        if (!window.Matter) {
            console.error("Matter.js not loaded!");
            return;
        }
        const { Engine, Runner } = Matter;
        this.engine = Engine.create();
        this.engine.world.gravity.y = 0;
        this.engine.world.gravity.x = 0;
        this.engine.positionIterations = 60;
        this.engine.velocityIterations = 60;
        this.engine.constraintIterations = 20;

        this.runner = Runner.create();
        this.lastTime = null;
        this.particles = [];
    },

    stop: function() {
        if (this.runner) Matter.Runner.stop(this.runner);
        if (this.engine) {
            Matter.World.clear(this.engine.world);
            Matter.Engine.clear(this.engine);
        }
        this.engine = null;
        this.runner = null;
        this.particles = [];
        this.activeMode = null;
        this.lastTime = null;
    },

    step: function(currentTime) {
        if (!this.engine) return;
        if (this.lastTime === null) { this.lastTime = currentTime; return; }
        const delta = Math.min(currentTime - this.lastTime, 32);
        this.lastTime = currentTime;
        const subDelta = delta / this.subSteps;
        for (let i = 0; i < this.subSteps; i++) {
            Matter.Engine.update(this.engine, subDelta);
        }
    },

    setupCommonScene: function(w, h) {
        const { Bodies, Composite } = Matter;
        const wallOptions = { isStatic: true, render: { fillStyle: '#142640' }, friction: 1, restitution: 0.2 };
        const pipeY = h / 2;
        const pt = this.PIPE_THICKNESS;
        const wv = this.WALL_VISUAL;

        const innerTop = pipeY - pt / 2 + wv / 2;
        const innerBottom = pipeY + pt / 2 - wv / 2;

        const wallThick = 400;
        const topWall = Bodies.rectangle(w / 2, innerTop - wallThick / 2, w + 400, wallThick, wallOptions);
        const bottomWall = Bodies.rectangle(w / 2, innerBottom + wallThick / 2, w + 400, wallThick, wallOptions);
        Composite.add(this.engine.world, [topWall, bottomWall]);

        this.spawnInitialParticles(w, pipeY);
    },

    spawnInitialParticles: function(w, pipeY) {
        const { Bodies, Composite } = Matter;
        const pt = this.PIPE_THICKNESS;
        const wv = this.WALL_VISUAL;
        const innerTop = pipeY - pt / 2 + wv / 2;
        const innerBottom = pipeY + pt / 2 - wv / 2;
        const r = this.PARTICLE_RADIUS;

        const simLeft = w / 2 - this.SIM_WIDTH / 2;
        const usableTop = innerTop + r + 2;
        const usableBottom = innerBottom - r - 2;
        const usableHeight = usableBottom - usableTop;

        const spacing = r * 2.2;
        const cols = Math.floor(this.SIM_WIDTH / spacing);
        const rows = Math.floor(usableHeight / spacing);
        const totalSlots = cols * rows;

        const count = Math.min(this.PARTICLE_COUNT, totalSlots);
        const slots = Array.from({length: totalSlots}, (_, i) => i);
        for (let i = slots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [slots[i], slots[j]] = [slots[j], slots[i]];
        }
        const chosen = slots.slice(0, count);

        for (const slot of chosen) {
            const col = slot % cols;
            const row = Math.floor(slot / cols);
            const px = simLeft + (col + 0.5) * spacing;
            const py = usableTop + (row + 0.5) * spacing;

            const p = Bodies.circle(px, py, r, {
                restitution: 0.05,
                friction: 0,
                frictionStatic: 0,
                frictionAir: 0.0005,
                density: 0.001,
                render: { fillStyle: '#ffffff' }
            });
            this.particles.push(p);
            Composite.add(this.engine.world, p);
        }
    },

    wrapParticles: function(w, pipeY) {
        const r = this.PARTICLE_RADIUS;
        const simLeft = w / 2 - this.SIM_WIDTH / 2;
        const simRight = w / 2 + this.SIM_WIDTH / 2;

        const rightWrapTrigger = simRight + Math.max(20, r * 2);
        const leftWrapTarget = simLeft - Math.max(10, r);
        const wrapDistance = rightWrapTrigger - leftWrapTarget;

        for (const p of this.particles) {
            if (p.position.x > rightWrapTrigger) {
                Matter.Body.translate(p, { x: -wrapDistance, y: 0 });
            } else if (p.position.x < simLeft - 50) {
                Matter.Body.translate(p, { x: wrapDistance, y: 0 });
            }

            const pt = this.PIPE_THICKNESS;
            const wv = this.WALL_VISUAL;
            const innerTop = pipeY - pt / 2 + wv / 2 + r + 1;
            const innerBottom = pipeY + pt / 2 - wv / 2 - r - 1;
            
            if (p.position.y < innerTop) {
                Matter.Body.setPosition(p, { x: p.position.x, y: innerTop });
                Matter.Body.setVelocity(p, { x: p.velocity.x, y: 0 });
            } else if (p.position.y > innerBottom) {
                Matter.Body.setPosition(p, { x: p.position.x, y: innerBottom });
                Matter.Body.setVelocity(p, { x: p.velocity.x, y: 0 });
            }
        }
    },

    drawBackground: function(ctx, canvas) {
        // Shared background rendering
        const bg = ctx.createRadialGradient(
            canvas.width * 0.45, canvas.height * 0.4, 0,
            canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.85
        );
        bg.addColorStop(0, '#0f3460');
        bg.addColorStop(0.6, '#0a1e3d');
        bg.addColorStop(1, '#040e1a');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Grid
        ctx.strokeStyle = 'rgba(56,189,248,0.035)';
        ctx.lineWidth = 1;
        const gs = 50;
        for (let gx = 0; gx < canvas.width; gx += gs) {
            ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height); ctx.stroke();
        }
        for (let gy = 0; gy < canvas.height; gy += gs) {
            ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvas.width, gy); ctx.stroke();
        }
    },

    drawPipe: function(ctx, canvas) {
        const pipeY = canvas.height / 2;
        const pt = this.PIPE_THICKNESS;
        const wv = this.WALL_VISUAL;
        const innerTop = pipeY - pt / 2 + wv / 2;
        const innerBottom = pipeY + pt / 2 - wv / 2;

        const tg = ctx.createLinearGradient(0, innerTop - wv / 2, 0, innerTop + wv / 2);
        tg.addColorStop(0, '#1a3050'); tg.addColorStop(0.5, '#243e5c'); tg.addColorStop(1, '#1a3050');
        ctx.fillStyle = tg;
        ctx.fillRect(0, innerTop - wv / 2, canvas.width, wv);
        ctx.strokeStyle = '#3a5a80'; ctx.lineWidth = 2;
        ctx.strokeRect(0, innerTop - wv / 2, canvas.width, wv);

        const bg2 = ctx.createLinearGradient(0, innerBottom - wv / 2, 0, innerBottom + wv / 2);
        bg2.addColorStop(0, '#1a3050'); bg2.addColorStop(0.5, '#243e5c'); bg2.addColorStop(1, '#1a3050');
        ctx.fillStyle = bg2;
        ctx.fillRect(0, innerBottom - wv / 2, canvas.width, wv);
        ctx.strokeStyle = '#3a5a80'; ctx.lineWidth = 2;
        ctx.strokeRect(0, innerBottom - wv / 2, canvas.width, wv);

        // Interior fill
        ctx.fillStyle = 'rgba(21,101,192,0.15)';
        ctx.fillRect(0, innerTop + wv / 2, canvas.width, innerBottom - innerTop - wv);
    },

    drawParticles: function(ctx, canvas) {
        const pipeY = canvas.height / 2;
        const pt = this.PIPE_THICKNESS;
        const wv = this.WALL_VISUAL;
        const innerTop = pipeY - pt / 2 + wv / 2;
        const innerBottom = pipeY + pt / 2 - wv / 2;
        const visLeft = canvas.width / 2 - this.VISIBLE_WIDTH / 2;
        const visRight = canvas.width / 2 + this.VISIBLE_WIDTH / 2;

        ctx.save();
        ctx.beginPath();
        ctx.rect(visLeft, innerTop + wv / 2, this.VISIBLE_WIDTH, innerBottom - innerTop - wv);
        ctx.clip();
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(200,230,255,0.5)';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        for (let p of this.particles) {
            ctx.moveTo(p.position.x + p.circleRadius, p.position.y);
            ctx.arc(p.position.x, p.position.y, p.circleRadius, 0, 2 * Math.PI);
        }
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();

        // Edge fades
        ctx.save();
        const gradL = ctx.createLinearGradient(visLeft, 0, visLeft + 80, 0);
        gradL.addColorStop(0, '#0a1e3d');
        gradL.addColorStop(1, 'rgba(10,30,61,0)');
        ctx.fillStyle = gradL;
        ctx.fillRect(visLeft, innerTop + wv / 2, 80, innerBottom - innerTop - wv);

        const gradR = ctx.createLinearGradient(visRight - 80, 0, visRight, 0);
        gradR.addColorStop(0, 'rgba(10,30,61,0)');
        gradR.addColorStop(1, '#0a1e3d');
        ctx.fillStyle = gradR;
        ctx.fillRect(visRight - 80, innerTop + wv / 2, 80, innerBottom - innerTop - wv);
        ctx.restore();
    }
};

window.MicroRenderer = MicroBase;
