const COLL_D_MIN   = 10;   // px: min center-to-center separation along pipe
const COLL_K_DIST  = 0.15; // along-pipe spring stiffness
const COLL_LAT_MIN = 8;    // px: min lateral separation
const COLL_K_LAT   = 0.20; // lateral spring stiffness
const VALVE_ZONE_HALF = 60;      // px: half-width of constriction zone around valve
const VALVE_MIN_SPEED_FRAC = 0.05; // minimum speed fraction at max resistance

window.Renderer = {
    canvas: null, ctx: null,
    w: 0, h: 0,
    particles: [],
    valvePressure: [0, 0],  // smoothed pressure signal for each valve (0–1)

    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        window.addEventListener('resize', this.resize.bind(this));
        this.resize();
        this.spawnParticles();
    },

    resize() {
        this.w = this.canvas.width = window.innerWidth;
        this.h = this.canvas.height = window.innerHeight;
    },

    spawnParticles() {
        this.particles = [];
        for(let i=0; i<600; i++) {
            this.particles.push({
                dist: Math.random() * 3000,
                path: 'main', // 'main', 'top', 'mid'
                speedOffset: 0.8 + Math.random()*0.4,
                lateralOffset: (Math.random() - 0.5) * 24, // +/- 12px random spread across pipe width
                density: COLL_D_MIN  // starts neutral (used for color)
            });
        }
    },

    getLayout() {
        let cx = this.w / 2;
        let cy = this.h / 2;
        let shiftX = 0; 
        let shiftY = -25; // shift up to clear bottom dashboard

        // Define outer rectangular pipe framework
        let x1 = cx - 350 + shiftX;
        let x2 = cx + 300 + shiftX;
        let y1 = cy - 180 + shiftY; // Top Branch (Parallel) or Top pipe (Series)
        let y2 = cy + 0 + shiftY;   // Mid Branch (Parallel)
        let y3 = cy + 180 + shiftY; // Bottom pipe returning to Pump

        let cx_mid = (x1 + x2) / 2;

        return {cx, cy, cx_mid, x1, x2, y1, y2, y3};
    },

    distArr(arr) {
        let d = 0;
        for(let i=0; i<arr.length-1; i++) d += Math.hypot(arr[i+1].x - arr[i].x, arr[i+1].y - arr[i].y);
        return d;
    },

    ptOnArr(arr, dist, lat) {
        for(let i=0; i<arr.length-1; i++) {
            let dx = arr[i+1].x - arr[i].x; let dy = arr[i+1].y - arr[i].y;
            let seg = Math.hypot(dx,dy);
            if (dist <= seg || i === arr.length-2) {
                let rDist = Math.max(0, Math.min(dist, seg));
                let ux = dx/seg; let uy = dy/seg;
                return {
                    x: arr[i].x + ux*rDist - uy*lat,
                    y: arr[i].y + uy*rDist + ux*lat
                };
            }
            dist -= seg;
        }
        return arr[arr.length-1];
    },

    valveSpeedFactor(dist, barrierDist, closedness) {
        if (closedness <= 0) return 1.0;
        let delta = Math.abs(dist - barrierDist);
        if (delta >= VALVE_ZONE_HALF) return 1.0;
        let proximity = 1 - (delta / VALVE_ZONE_HALF);
        let reduction = closedness * proximity;
        return 1 - reduction * (1 - VALVE_MIN_SPEED_FRAC);
    },

    // Resolve soft-body collisions between particles on the same pipe segment.
    // Operates in 1D (along dist) with a secondary lateral push.
    resolveCollisions(lens, topo) {
        let groups = {};

        // Classify each particle into a segment and compute its local dist within that segment
        for (let p of this.particles) {
            let key, local;
            if (topo === 'series') {
                key = 'series';
                local = p.dist;
            } else {
                let d = p.dist;
                if (d < lens.main) {
                    key = 'main';
                    local = d;
                } else {
                    let branchLen = (p.path === 'top') ? lens.top : lens.mid;
                    if (d < lens.main + branchLen) {
                        key = p.path; // 'top' or 'mid'
                        local = d - lens.main;
                    } else {
                        key = 'ret';
                        local = d - lens.main - branchLen;
                    }
                }
            }
            if (!groups[key]) groups[key] = [];
            groups[key].push({ p, local });
        }

        // For each segment group, sort by local dist and resolve adjacent collisions
        for (let key in groups) {
            let g = groups[key];
            g.sort((a, b) => a.local - b.local);

            let segLen = (topo === 'series') ? lens.series : (lens[key] || lens.ret);

            for (let i = 0; i < g.length; i++) {
                let a = g[i];
                let b = g[(i + 1) % g.length];

                let gap;
                if (i < g.length - 1) {
                    gap = b.local - a.local;
                } else {
                    // Wrap-around: last particle and first particle
                    gap = (segLen - a.local) + g[0].local;
                }

                // Store density on the particle (gap to nearest forward neighbour)
                a.p.density = gap;

                // Along-pipe soft repulsion
                if (gap < COLL_D_MIN) {
                    let force = COLL_K_DIST * (COLL_D_MIN - gap);
                    if (i < g.length - 1) {
                        a.p.dist -= force;
                        b.p.dist += force;
                    } else {
                        // wrap-around pair: push last back, first forward
                        a.p.dist -= force;
                        g[0].p.dist += force;
                    }

                    // Lateral soft repulsion when particles are close along pipe
                    let pa = a.p, pb = (i < g.length - 1) ? b.p : g[0].p;
                    let latDiff = pb.lateralOffset - pa.lateralOffset;
                    let latGap = Math.abs(latDiff);
                    if (latGap < COLL_LAT_MIN) {
                        let latForce = COLL_K_LAT * (COLL_LAT_MIN - latGap);
                        let sign = latDiff >= 0 ? 1 : -1;
                        pa.lateralOffset -= sign * latForce;
                        pb.lateralOffset += sign * latForce;
                        pa.lateralOffset = Math.max(-12, Math.min(12, pa.lateralOffset));
                        pb.lateralOffset = Math.max(-12, Math.min(12, pb.lateralOffset));
                    }
                }
            }
        }
    },

    // Compute smoothed pressure for each valve.
    // Uses a blend of electrical pressure (voltage drop) and local particle density.
    computeValvePressure(lens, topo, state, L) {
        // --- Electrical pressure (physics-based) ---
        let elec1 = 0, elec2 = 0;
        let totalV = state.voltage;
        if (totalV > 0.001) {
            if (topo === 'series') {
                // Voltage drop across each valve ÷ total supply voltage
                elec1 = Math.min(1, (state.iTotal * state.r1) / totalV);
                elec2 = Math.min(1, (state.iTotal * state.r2) / totalV);
            } else {
                // Both parallel branches share the same voltage drop
                let rp = (state.r1 * state.r2) / (state.r1 + state.r2 + 0.001);
                let vAcrossParallel = state.iTotal * rp;
                elec1 = elec2 = Math.min(1, vAcrossParallel / totalV);
            }
        }

        // --- Particle density signal (collision-based) ---
        let sum1 = 0, count1 = 0, sum2 = 0, count2 = 0;

        if (topo === 'series') {
            // Valve positions along the series path:
            // seg1 = left pipe (y3→y1), seg2 = top pipe (x1→x2)
            let seg1 = L.y3 - L.y1;
            let seg2 = L.x2 - L.x1;
            let vd1 = seg1 + 0.3 * seg2;  // valve 1 dist
            let vd2 = seg1 + 0.7 * seg2;  // valve 2 dist
            let win = 100;                  // ±100px window upstream of each valve
            for (let p of this.particles) {
                if (Math.abs(p.dist - vd1) < win) { sum1 += p.density; count1++; }
                if (Math.abs(p.dist - vd2) < win) { sum2 += p.density; count2++; }
            }
        } else {
            // Parallel: use all particles currently on each branch
            for (let p of this.particles) {
                let d = p.dist;
                if (p.path === 'top' && d >= lens.main && d < lens.main + lens.top) {
                    sum1 += p.density; count1++;
                } else if (p.path === 'mid' && d >= lens.main && d < lens.main + lens.mid) {
                    sum2 += p.density; count2++;
                }
            }
        }

        let densityP1 = count1 > 0 ? Math.max(0, 1 - (sum1 / count1) / COLL_D_MIN) : 0;
        let densityP2 = count2 > 0 ? Math.max(0, 1 - (sum2 / count2) / COLL_D_MIN) : 0;

        // Blend: 65% electrical (stable), 35% particle density (shows collision activity)
        let target1 = Math.min(1, 0.65 * elec1 + 0.35 * densityP1);
        let target2 = Math.min(1, 0.65 * elec2 + 0.35 * densityP2);

        // Exponential smoothing — slow attack (0.04), medium decay (0.03) for stable glow
        const ATTACK = 0.04;
        const DECAY  = 0.03;
        this.valvePressure[0] += (target1 > this.valvePressure[0] ? ATTACK : DECAY) * (target1 - this.valvePressure[0]);
        this.valvePressure[1] += (target2 > this.valvePressure[1] ? ATTACK : DECAY) * (target2 - this.valvePressure[1]);
    },

    drawPipeTrace(pts, width, color) {
        let ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for(let i=1; i<pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'butt';
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.stroke();
    },

    draw(time, state) {
        let ctx = this.ctx;
        ctx.clearRect(0,0,this.w,this.h);

        let L = this.getLayout();
        const isWater = state.mode === 'water';

        // 1. Path Definitions
        let R_series = [
            {x: L.x1, y: L.y3}, {x: L.x1, y: L.y1},
            {x: L.x2, y: L.y1}, {x: L.x2, y: L.y3}, {x: L.x1, y: L.y3}
        ];
        let R_main = [ {x: L.x1, y: L.y3}, {x: L.x1, y: L.y2} ]; 
        let R_top = [ {x: L.x1, y: L.y2}, {x: L.x1, y: L.y1}, {x: L.x2, y: L.y1}, {x: L.x2, y: L.y2} ]; 
        let R_mid = [ {x: L.x1, y: L.y2}, {x: L.x2, y: L.y2} ]; 
        let R_ret = [ {x: L.x2, y: L.y2}, {x: L.x2, y: L.y3}, {x: L.x1, y: L.y3} ]; 

        let lens = {
            series: this.distArr(R_series), main: this.distArr(R_main),
            top: this.distArr(R_top), mid: this.distArr(R_mid), ret: this.distArr(R_ret)
        };
        let R = { series: R_series, main: R_main, top: R_top, mid: R_mid, ret: R_ret };

        // 2. Draw Pipes
        const pipeColor = isWater ? '#1e293b' : '#2d3748';
        const cavityColor = '#020617';
        const paths = (state.topo === 'series') ? [R_series] : [R_main, R_top, R_mid, R_ret];
        const junctions = (state.topo === 'series') ? [] : [ {x: L.x1, y: L.y2}, {x: L.x2, y: L.y2} ];

        // 1. Draw all borders
        paths.forEach(path => this.drawPipeTrace(path, 54, pipeColor));
        // 2. Fill border junctions
        junctions.forEach(j => {
            this.ctx.fillStyle = pipeColor;
            this.ctx.beginPath(); this.ctx.arc(j.x, j.y, 27, 0, Math.PI*2); this.ctx.fill();
        });
        // 3. Draw all cavities
        paths.forEach(path => this.drawPipeTrace(path, 46, cavityColor));
        // 4. Fill cavity junctions (Radius 27 to fully mask junction borders)
        junctions.forEach(j => {
            this.ctx.fillStyle = cavityColor;
            this.ctx.beginPath(); this.ctx.arc(j.x, j.y, 27, 0, Math.PI*2); this.ctx.fill();
        });

        let barriers;
        if (state.topo === 'series') {
            let seg1 = L.y3 - L.y1;
            let seg2 = L.x2 - L.x1;
            barriers = { vd1: seg1 + 0.3 * seg2, vd2: seg1 + 0.7 * seg2 };
        } else {
            let localVd_top = (L.y2 - L.y1) + 0.5 * (L.x2 - L.x1);
            let localVd_mid = 0.5 * (L.x2 - L.x1);
            barriers = { vd_top: lens.main + localVd_top, vd_mid: lens.main + localVd_mid };
        }

        // 3. Update Particles
        for(let p of this.particles) {
            let spd = state.iTotal * 8 * p.speedOffset;

            if (state.topo === 'series') {
                let vf1 = this.valveSpeedFactor(p.dist, barriers.vd1, state.r1 / 100);
                let vf2 = this.valveSpeedFactor(p.dist, barriers.vd2, state.r2 / 100);
                p.dist += spd * Math.min(vf1, vf2);
                p.dist %= lens.series;
            } else {
                let flowSpd = spd;
                if (p.path === 'top') {
                    let vf = this.valveSpeedFactor(p.dist, barriers.vd_top, state.r1 / 100);
                    flowSpd = state.i1 * 8 * p.speedOffset * vf;
                } else if (p.path === 'mid') {
                    let vf = this.valveSpeedFactor(p.dist, barriers.vd_mid, state.r2 / 100);
                    flowSpd = state.i2 * 8 * p.speedOffset * vf;
                }
                p.dist += flowSpd;
                let l_main = lens.main, l_branch = p.path === 'top' ? lens.top : lens.mid, l_ret = lens.ret;
                let totalL = l_main + l_branch + l_ret;
                if (p.dist >= totalL) { p.dist %= totalL; p.path = 'main'; }
                if (p.path === 'main' && p.dist >= l_main) {
                    let totalI = state.i1 + state.i2;
                    p.path = (totalI <= 0.001) ? (Math.random() > 0.5 ? 'top' : 'mid') : (Math.random() < (state.i1 / totalI) ? 'top' : 'mid');
                }
            }
        }

        this.resolveCollisions(lens, state.topo);
        this.computeValvePressure(lens, state.topo, state, L);

        // 4. Draw Particles
        const coldCol = isWater ? [96, 165, 250] : [77, 211, 252]; // blue vs light-blue
        const hotCol  = isWater ? [249, 115, 22] : [0, 201, 167];  // orange vs teal
        
        for(let p of this.particles) {
            let pos;
            if (state.topo === 'series') {
                pos = this.ptOnArr(R.series, p.dist, p.lateralOffset);
            } else {
                let l_main = lens.main, l_branch = p.path === 'top' ? lens.top : lens.mid;
                let d = p.dist;
                if (d < l_main) pos = this.ptOnArr(R.main, d, p.lateralOffset);
                else if (d < l_main + l_branch) pos = this.ptOnArr(R[p.path], d - l_main, p.lateralOffset);
                else pos = this.ptOnArr(R.ret, d - l_main - l_branch, p.lateralOffset);
            }

            let t = Math.max(0, Math.min(1, 1 - (p.density / COLL_D_MIN)));
            let rc = Math.round(coldCol[0] + t * (hotCol[0] - coldCol[0]));
            let gc = Math.round(coldCol[1] + t * (hotCol[1] - coldCol[1]));
            let bc = Math.round(coldCol[2] + t * (hotCol[2] - coldCol[2]));
            ctx.fillStyle = `rgb(${rc},${gc},${bc})`;
            ctx.beginPath(); ctx.arc(pos.x, pos.y, 4, 0, Math.PI*2); ctx.fill();
        }

        // 5. Draw Components
        if (state.topo === 'series') {
            this.drawValve(ctx, { x: L.x1 + (L.x2 - L.x1)*0.3, y: L.y1 }, state.r1, isWater ? "Valve 1" : "R1", this.valvePressure[0], state.mode);
            this.drawValve(ctx, { x: L.x1 + (L.x2 - L.x1)*0.7, y: L.y1 }, state.r2, isWater ? "Valve 2" : "R2", this.valvePressure[1], state.mode);
        } else {
            this.drawValve(ctx, { x: L.cx_mid, y: L.y1 }, state.r1, isWater ? "Valve 1" : "R1", this.valvePressure[0], state.mode);
            this.drawValve(ctx, { x: L.cx_mid, y: L.y2 }, state.r2, isWater ? "Valve 2" : "R2", this.valvePressure[1], state.mode);
        }

        this.drawPump(ctx, {x: L.x1, y: L.y3 }, state.voltage, state.mode);

        // 6. Draw KVL Potential Bar (Electric Series only)
        if (state.topo === 'series' && !isWater) {
            this.drawPotentialBar(state, L);
        }

        // 7. Probe logic
        this.handleProbe(state, L, R, lens);
    },

    drawPotentialBar(state, L) {
        let ctx = this.ctx;
        let bx = L.x2 + 80, by = L.y1, bw = 60, bh = L.y3 - L.y1;
        
        // Background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
        roundRect(ctx, bx, by, bw, bh, 8); ctx.fill();
        
        let v1Drop = state.iTotal * state.r1;
        let v2Drop = state.iTotal * state.r2;
        let vSupply = state.voltage;
        
        let h1 = bh * (v1Drop / (vSupply || 1));
        let h2 = bh * (v2Drop / (vSupply || 1));
        
        ctx.fillStyle = '#00C9A7bb';
        roundRect(ctx, bx, by, bw, h1, [8,8,0,0]); ctx.fill();
        ctx.fillStyle = '#0ea5e9bb';
        roundRect(ctx, bx, by + h1, bw, h2, [0,0,8,8]); ctx.fill();

        ctx.fillStyle = '#94a3b8'; ctx.font = '800 10px Inter'; ctx.textAlign = 'center';
        ctx.fillText("POTENTIAL", bx + bw/2, by - 25);
        ctx.fillText("DROPS", bx + bw/2, by - 12);
        
        ctx.fillStyle = '#00C9A7'; ctx.textAlign = 'left';
        ctx.fillText(`V1: ${v1Drop.toFixed(1)}V`, bx + bw + 10, by + h1/2 + 5);
        ctx.fillStyle = '#0ea5e9';
        ctx.fillText(`V2: ${v2Drop.toFixed(1)}V`, bx + bw + 10, by + h1 + h2/2 + 5);
    },

    handleProbe(state, L, paths, lens) {
        let candidate = null;
        const mx = state.mouse.x, my = state.mouse.y;
        const THR = 25;

        // Check each pipe segment
        const list = (state.topo === 'series') ? [ {p: paths.series, i: state.iTotal, type: 'series'} ] : 
            [ {p: paths.main, i: state.iTotal, type: 'main'}, {p: paths.top, i: state.i1, type: 'top'}, {p: paths.mid, i: state.i2, type: 'mid'}, {p: paths.ret, i: state.iTotal, type: 'ret'} ];

        for(let entry of list) {
            for(let i=0; i<entry.p.length-1; i++) {
                let a = entry.p[i], b = entry.p[i+1];
                let d = distToSeg(mx, my, a.x, a.y, b.x, b.y);
                if (d < THR) {
                    candidate = { entry, seg: i, dist: d };
                    break;
                }
            }
            if (candidate) break;
        }

        const tooltip = document.getElementById('probe-tooltip');
        if (candidate) {
            tooltip.style.display = 'block';
            tooltip.style.left = (mx + 20) + 'px';
            tooltip.style.top = (my - 40) + 'px';
            
            // Calculate representative voltage/pressure
            // In series, voltage drops linearly through components
            let valV = state.voltage; 
            if (state.topo === 'series') {
                // Approximate voltage drop across segments for the demo
                let seg = candidate.seg;
                if (seg === 1) valV = state.voltage * 0.9;
                else if (seg === 2) valV = state.voltage * 0.5;
                else if (seg === 3) valV = state.voltage * 0.1;
                else valV = 0;
            }

            const isWater = state.mode === 'water';
            document.getElementById('p-v-val').innerText = (isWater ? (valV*2).toFixed(1) + " psi" : valV.toFixed(1) + " V");
            document.getElementById('p-i-val').innerText = (candidate.entry.i * (isWater ? 10 : 1000)).toFixed(isWater ? 1 : 0) + (isWater ? " L/s" : " mA");

            // Highlight pipe
            this.ctx.strokeStyle = isWater ? 'rgba(59, 130, 246, 0.4)' : 'rgba(0, 201, 167, 0.4)';
            this.ctx.lineWidth = 12;
            let a = candidate.entry.p[candidate.seg], b = candidate.entry.p[candidate.seg+1];
            this.ctx.beginPath(); this.ctx.moveTo(a.x, a.y); this.ctx.lineTo(b.x, b.y); this.ctx.stroke();
        } else {
            tooltip.style.display = 'none';
        }
    },

    drawValve(ctx, pos, R, label, pressure, mode) {
        ctx.save();
        const isWater = mode === 'water';
        if (pressure > 0.02) {
            ctx.shadowBlur  = pressure * 45;
            ctx.shadowColor = isWater ? `rgba(249,115,22,${0.4 + pressure * 0.6})` : `rgba(0,201,167,${0.4 + pressure * 0.6})`;
        }
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(pos.x - 22, pos.y - 35, 44, 70);
        let bR = isWater ? Math.round(148 + pressure * (249 - 148)) : Math.round(148 + pressure * (0 - 148));
        let bG = isWater ? Math.round(163 + pressure * (115 - 163)) : Math.round(163 + pressure * (201 - 163));
        let bB = isWater ? Math.round(184 + pressure * (22  - 184)) : Math.round(184 + pressure * (167 - 184));
        ctx.strokeStyle = `rgb(${bR},${bG},${bB})`;
        ctx.lineWidth = 2 + pressure * 2.5;
        ctx.shadowBlur = 0;
        ctx.strokeRect(pos.x - 22, pos.y - 35, 44, 70);

        if (isWater) {
            // Water valve: gate fill that drops proportional to resistance
            ctx.fillStyle = '#ef4444';
            let h = 66 * (R / 100);
            ctx.fillRect(pos.x - 20, pos.y - 33, 40, h);
            // Handle rod
            ctx.fillStyle = '#64748b';
            ctx.fillRect(pos.x - 10, pos.y - 45 - (1-(R/100))*10, 20, 10);
        } else {
            // Electric resistor: IEEE zigzag symbol + resistance fill bar
            // Fill bar at bottom showing R level
            ctx.fillStyle = `rgba(245,158,11,${0.15 + (R/100)*0.25})`;
            ctx.fillRect(pos.x - 20, pos.y - 33, 40, 66);
            // Zigzag resistor body (horizontal, centered on pipe)
            const zW = 36, zA = 7, zSegs = 8;
            const xStart = pos.x - zW / 2, xEnd = pos.x + zW / 2;
            ctx.beginPath();
            ctx.moveTo(xStart, pos.y);
            for (let i = 0; i < zSegs; i++) {
                let xMid = xStart + (i + 0.5) * zW / zSegs;
                let xNext = xStart + (i + 1) * zW / zSegs;
                ctx.lineTo(xMid, pos.y + (i % 2 === 0 ? -zA : zA));
                ctx.lineTo(xNext, pos.y);
            }
            ctx.strokeStyle = `rgba(245,158,11,${0.7 + pressure * 0.3})`;
            ctx.lineWidth = 2;
            ctx.lineJoin = 'miter';
            ctx.stroke();
            // R value inside body
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 10px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(`${R}\u03a9`, pos.x, pos.y + 26);
        }

        ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 13px Inter'; ctx.textAlign = 'center';
        ctx.fillText(label, pos.x, pos.y - 60);
        if (pressure > 0.08) {
            let alpha = Math.min(1, (pressure - 0.08) / 0.2);
            ctx.fillStyle = isWater ? `rgba(249,115,22,${alpha})` : `rgba(0, 201, 167, ${alpha})`;
            ctx.font = `bold 10px Inter`;
            ctx.fillText(isWater ? `▲ FLOW LOGIC` : `▲ POTENTIAL DROP`, pos.x, pos.y + 50);
        }
        ctx.restore();
    },

    drawPump(ctx, pos, V, mode) {
        ctx.save();
        const isWater = mode === 'water';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 50, 0, Math.PI*2);
        ctx.fillStyle = isWater ? '#2563eb' : '#0f172a';
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = isWater ? '#93c5fd' : '#00C9A7';
        ctx.stroke();

        if (isWater) {
            ctx.fillStyle = '#ffffff'; ctx.font = '800 16px Inter'; ctx.textAlign = 'center';
            ctx.fillText("PUMP", pos.x, pos.y - 4);
            ctx.font = 'bold 13px Inter'; ctx.fillStyle = '#fef08a';
            ctx.fillText((V*2)+" psi", pos.x, pos.y + 16);
        } else {
            // Battery symbol: alternating long/short horizontal lines
            const cx = pos.x, cy = pos.y - 10;
            const cells = 3, cellGap = 10;
            const totalW = (cells - 1) * cellGap;
            for (let i = 0; i < cells; i++) {
                let x = cx - totalW / 2 + i * cellGap;
                let isLong = i % 2 === 0;
                ctx.beginPath();
                ctx.moveTo(x, cy - (isLong ? 14 : 8));
                ctx.lineTo(x, cy + (isLong ? 14 : 8));
                ctx.strokeStyle = isLong ? '#00C9A7' : '#64748b';
                ctx.lineWidth = isLong ? 4 : 2;
                ctx.stroke();
            }
            // + and - labels
            ctx.fillStyle = '#00C9A7'; ctx.font = 'bold 11px Inter'; ctx.textAlign = 'center';
            ctx.fillText('+', cx + totalW / 2 + 10, cy + 5);
            ctx.fillStyle = '#64748b';
            ctx.fillText('\u2212', cx - totalW / 2 - 10, cy + 5);
            // Voltage label
            ctx.fillStyle = '#00C9A7'; ctx.font = 'bold 13px Inter'; ctx.textAlign = 'center';
            ctx.fillText(V+"V", cx, cy + 34);
        }
        ctx.restore();
    }
};

function roundRect(ctx, x, y, width, height, radius) {
    if (typeof radius === 'undefined') radius = 5;
    if (typeof radius === 'number') radius = {tl: radius, tr: radius, br: radius, bl: radius};
    else {
        var defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
        for (var key in defaultRadius) radius[key] = radius[key] || defaultRadius[key];
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
}

function distToSeg(px, py, x1, y1, x2, y2) {
    let dx = x2 - x1, dy = y2 - y1;
    let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1);
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

