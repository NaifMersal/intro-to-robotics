window.Renderer = {
    canvas: null, ctx: null,
    w: 0, h: 0,
    particles: [],

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
                lateralOffset: (Math.random() - 0.5) * 24 // +/- 12px random spread across pipe width
            });
        }
    },

    getLayout() {
        let cx = this.w / 2;
        let cy = this.h / 2;
        let shiftX = -70; // shift left to accommodate right UI
        
        // Define outer rectangular pipe framework
        let x1 = cx - 350 + shiftX;
        let x2 = cx + 300 + shiftX; 
        let y1 = cy - 200; // Top Branch (Parallel) or Top pipe (Series)
        let y2 = cy + 0;   // Mid Branch (Parallel)
        let y3 = cy + 200; // Bottom pipe returning to Pump
        
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

    drawPipeTrace(pts, width, color) {
        let ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for(let i=1; i<pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.stroke();
    },

    draw(time, state) {
        let ctx = this.ctx;
        ctx.clearRect(0,0,this.w,this.h);

        let L = this.getLayout();

        // 1. Path Definitions
        // Flow is CLOCKWISE: Pump at (x1, y3).
        // Series loop
        let R_series = [
            {x: L.x1, y: L.y3}, {x: L.x1, y: L.y1}, 
            {x: L.x2, y: L.y1}, {x: L.x2, y: L.y3}, {x: L.x1, y: L.y3}
        ];
        
        // Parallel struct
        let R_main = [ {x: L.x1, y: L.y3}, {x: L.x1, y: L.y2} ]; // pump up to split
        let R_top = [ {x: L.x1, y: L.y2}, {x: L.x1, y: L.y1}, {x: L.x2, y: L.y1}, {x: L.x2, y: L.y2} ]; // upper branch
        let R_mid = [ {x: L.x1, y: L.y2}, {x: L.x2, y: L.y2} ]; // middle branch
        let R_ret = [ {x: L.x2, y: L.y2}, {x: L.x2, y: L.y3}, {x: L.x1, y: L.y3} ]; // join, then down and back left

        let lens = {
            series: this.distArr(R_series), main: this.distArr(R_main),
            top: this.distArr(R_top), mid: this.distArr(R_mid), ret: this.distArr(R_ret)
        };
        let R = { series: R_series, main: R_main, top: R_top, mid: R_mid, ret: R_ret };

        // 2. Draw Pipes (Outer border + Inner cavity)
        if (state.topo === 'series') {
            this.drawPipeTrace(R_series, 54, '#1e293b'); // border
            this.drawPipeTrace(R_series, 46, '#020617'); // cavity
        } else {
            this.drawPipeTrace(R_main, 54, '#1e293b');
            this.drawPipeTrace(R_top, 54, '#1e293b');
            this.drawPipeTrace(R_mid, 54, '#1e293b');
            this.drawPipeTrace(R_ret, 54, '#1e293b');
            
            this.drawPipeTrace(R_main, 46, '#020617');
            this.drawPipeTrace(R_top, 46, '#020617');
            this.drawPipeTrace(R_mid, 46, '#020617');
            this.drawPipeTrace(R_ret, 46, '#020617');
        }

        // 3. Draw Particles (Molecules)
        ctx.fillStyle = '#60a5fa'; // nice blue dots
        for(let p of this.particles) {
            let spd = state.iTotal * 8 * p.speedOffset; 

            if (state.topo === 'series') {
                p.dist += spd;
                p.dist %= lens.series;
                let pos = this.ptOnArr(R.series, p.dist, p.lateralOffset);
                ctx.beginPath(); ctx.arc(pos.x, pos.y, 4, 0, Math.PI*2); ctx.fill();
            } else {
                // Parallel
                let flowSpd = spd;
                if (p.path === 'top') flowSpd = state.i1 * 8 * p.speedOffset;
                else if (p.path === 'mid') flowSpd = state.i2 * 8 * p.speedOffset;
                
                p.dist += flowSpd;

                let l_main = lens.main;
                let l_branch = p.path === 'top' ? lens.top : lens.mid;
                let l_ret = lens.ret;
                let totalL = l_main + l_branch + l_ret;

                // Loop around
                if (p.dist >= totalL) {
                    p.dist %= totalL;
                    p.path = 'main'; 
                }

                // Node split logic (KCL)
                if (p.path === 'main' && p.dist >= l_main) {
                    let totalI = state.i1 + state.i2; 
                    if (totalI <= 0.001) {
                         p.path = Math.random() > 0.5 ? 'top' : 'mid';
                    } else {
                         let r = Math.random();
                         p.path = (r < (state.i1 / totalI)) ? 'top' : 'mid';
                    }
                }

                let d = p.dist;
                let pos;
                if (d < l_main) {
                    pos = this.ptOnArr(R.main, d, p.lateralOffset);
                } else if (d < l_main + l_branch) {
                    pos = this.ptOnArr(R[p.path], d - l_main, p.lateralOffset);
                } else {
                    pos = this.ptOnArr(R.ret, d - l_main - l_branch, p.lateralOffset);
                }
                ctx.beginPath(); ctx.arc(pos.x, pos.y, 4, 0, Math.PI*2); ctx.fill();
            }
        }

        // 4. Draw Components
        if (state.topo === 'series') {
            this.drawValve(ctx, { x: L.x1 + (L.x2 - L.x1)*0.3, y: L.y1 }, state.r1, "Valve 1", state.topo);
            this.drawValve(ctx, { x: L.x1 + (L.x2 - L.x1)*0.7, y: L.y1 }, state.r2, "Valve 2", state.topo);
        } else {
            this.drawValve(ctx, { x: L.cx_mid, y: L.y1 }, state.r1, "Valve 1", state.topo);
            this.drawValve(ctx, { x: L.cx_mid, y: L.y2 }, state.r2, "Valve 2", state.topo);
        }

        this.drawPump(ctx, {x: L.x1, y: L.y3 }, state.voltage);
    },

    drawValve(ctx, pos, R, label, topo) {
        ctx.save();
        ctx.fillStyle = '#0f172a'; 
        ctx.fillRect(pos.x - 22, pos.y - 35, 44, 70);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.strokeRect(pos.x - 22, pos.y - 35, 44, 70);
        
        let closedness = R / 100;
        ctx.fillStyle = '#ef4444'; 
        // Visual gate dropping
        let h = 66 * closedness;
        ctx.fillRect(pos.x - 20, pos.y - 33, 40, h); 
        
        // Handle
        ctx.fillStyle = '#64748b';
        ctx.fillRect(pos.x - 10, pos.y - 45 - (1-closedness)*10, 20, 10);
        
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(label, pos.x, pos.y - 60);
        ctx.restore();
    },

    drawPump(ctx, pos, V) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 50, 0, Math.PI*2);
        ctx.fillStyle = '#2563eb';
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#93c5fd';
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Inter';
        ctx.textAlign = 'center';
        ctx.fillText("PUMP", pos.x, pos.y);
        ctx.font = 'bold 14px Inter';
        ctx.fillStyle = '#fef08a';
        ctx.fillText(V+"V", pos.x, pos.y + 22);
        ctx.restore();
    }
};
