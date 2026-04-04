// Valve Micro-Simulation
(function() {
    const ValveSim = Object.assign({}, window.MicroRenderer, {
        valveBody: null,

        start: function() {
            this.initEngine();
            const canvas = document.getElementById('simulationCanvas');
            const h = canvas.height;
            const w = canvas.width;
            const pipeY = h / 2;
            const pt = this.PIPE_THICKNESS;
            const wv = this.WALL_VISUAL;
            
            this.setupCommonScene(w, h);
            this.activeMode = 'micro-valve';

            const innerTop = pipeY - pt / 2 + wv / 2;
            const innerBottom = pipeY + pt / 2 - wv / 2;
            const interiorGap = innerBottom - innerTop;
            const valveH = interiorGap + 40;
            const valveWidth = 80;

            const initY = pipeY - pt / 2 - valveH / 2 - 10;
            this.valveBody = Matter.Bodies.rectangle(w / 2, initY, valveWidth, valveH, {
                isStatic: true, friction: 1, restitution: 0
            });
            Matter.Composite.add(this.engine.world, [this.valveBody]);

            Matter.Events.on(this.engine, 'beforeUpdate', () => {
                this.handleValveLogic(w, h);
                this.applyValveForce(w, h);
                this.wrapParticles(w, h / 2);
            });
        },

        handleValveLogic: function(w, h) {
            if (!this.valveBody) return;
            const openness = State.valveOpenness;
            const pipeY = h / 2;
            const pt = this.PIPE_THICKNESS;
            const interiorGap = (pipeY + pt / 2 - this.WALL_VISUAL / 2) - (pipeY - pt / 2 + this.WALL_VISUAL / 2);
            const valveH = interiorGap + 40;

            const closedY = pipeY;
            const openY = pipeY - pt / 2 - valveH / 2 - 10;
            const t = (100 - openness) / 100;
            const valveY = openY + (closedY - openY) * t;

            Matter.Body.setPosition(this.valveBody, { x: w / 2, y: valveY });
        },

        applyValveForce: function(w, h) {
            const valveScale = Math.max(0.05, State.valveOpenness / 100);
            const baseForceMag = (State.pumpPressure * 0.00015 * valveScale) / this.subSteps;
            if (baseForceMag <= 0) return;

            const INLET_BOOST = 2.0;
            const INLET_RADIUS = 200;
            const valveX = w / 2;
            const simLeft = w / 2 - this.SIM_WIDTH / 2;
            const openFraction = State.valveOpenness / 100;

            for (const p of this.particles) {
                let forceMag = 0;
                if (openFraction >= 0.95) {
                    forceMag = baseForceMag;
                } else {
                    const inletCenter = simLeft + INLET_RADIUS;
                    const valveDeadZone = valveX - 120 * (1 - openFraction);
                    if (p.position.x < inletCenter + INLET_RADIUS) {
                        forceMag = baseForceMag * INLET_BOOST;
                    } else if (p.position.x < valveDeadZone) {
                        forceMag = baseForceMag;
                    } else if (p.position.x >= valveX) {
                        forceMag = baseForceMag * openFraction;
                    }
                }

                if (forceMag > 0) {
                    Matter.Body.applyForce(p, p.position, { x: forceMag, y: 0 });
                }

                const maxSpeed = 2 + State.pumpPressure * 0.03;
                const speed = Math.sqrt(p.velocity.x ** 2 + p.velocity.y ** 2);
                if (speed > maxSpeed) {
                    const scale = maxSpeed / speed;
                    Matter.Body.setVelocity(p, { x: p.velocity.x * scale, y: p.velocity.y * scale });
                }
            }
        },

        draw: function(ctx, canvas, state) {
            const pipeY = canvas.height / 2;
            const pt = this.PIPE_THICKNESS;
            const wv = this.WALL_VISUAL;
            const innerTop = pipeY - pt / 2 + wv / 2;
            const innerBottom = pipeY + pt / 2 - wv / 2;

            this.drawBackground(ctx, canvas);
            this.drawPipe(ctx, canvas);
            this.drawValve(ctx, canvas, innerTop, innerBottom);
            this.drawParticles(ctx, canvas);
        },

        drawValve: function(ctx, canvas, innerTop, innerBottom) {
            if (!this.valveBody) return;
            const b = this.valveBody;
            const wv = this.WALL_VISUAL;

            ctx.save();
            ctx.beginPath();
            ctx.rect(0, innerTop - wv / 2, canvas.width, (innerBottom + wv / 2) - (innerTop - wv / 2));
            ctx.clip();

            ctx.beginPath();
            ctx.moveTo(b.vertices[0].x, b.vertices[0].y);
            for (let j = 1; j < b.vertices.length; j++) {
                ctx.lineTo(b.vertices[j].x, b.vertices[j].y);
            }
            ctx.closePath();

            let gc;
            if (State.valveOpenness > 60) gc = '#4ade80';
            else if (State.valveOpenness > 20) gc = '#fb923c';
            else gc = '#f87171';

            ctx.fillStyle = gc;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.stroke();

            const stemX = b.position.x;
            const stemTop = innerTop - wv;
            const stemBottom = b.position.y - (b.bounds.max.y - b.bounds.min.y) / 2;
            if (stemBottom < innerTop) {
                ctx.beginPath();
                ctx.moveTo(stemX - 4, stemTop);
                ctx.lineTo(stemX + 4, stemTop);
                ctx.lineTo(stemX + 4, stemBottom);
                ctx.lineTo(stemX - 4, stemBottom);
                ctx.closePath();
                ctx.fillStyle = '#94a3b8';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.stroke();
            }
            ctx.restore();

            const railW = 14;
            const railH = wv;
            const valveX = b.position.x;
            const topRailGrad = ctx.createLinearGradient(0, innerTop - wv / 2, 0, innerTop + wv / 2);
            topRailGrad.addColorStop(0, '#0f2035'); topRailGrad.addColorStop(1, '#1a3555');
            ctx.fillStyle = topRailGrad;
            ctx.fillRect(valveX - railW / 2, innerTop - wv / 2, railW, railH);
            ctx.strokeRect(valveX - railW / 2, innerTop - wv / 2, railW, railH);
            ctx.fillRect(valveX - railW / 2, innerBottom - wv / 2, railW, railH);
            ctx.strokeRect(valveX - railW / 2, innerBottom - wv / 2, railW, railH);
        }
    });

    window.MicroRenderer = ValveSim;
})();
