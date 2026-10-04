/**
 * HTML5 Canvas Ambient Visualizer & Glass Raindrop Physics Engine
 * Renders user custom background illustration with realistic falling rain,
 * window glass raindrops, refractive highlights, and sliding drip physics.
 */

class Visualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.mode = 'custom_rain'; // 'custom_rain' | 'rain' | 'fire' | 'stars' | 'minimal'
        this.bgImage = new Image();
        this.bgImageLoaded = false;
        
        // Load default background illustration
        this.bgImage.src = 'assets/bg.jpg';
        this.bgImage.onload = () => {
            this.bgImageLoaded = true;
        };

        this.fallingRain = [];
        this.glassDrops = [];
        this.animationId = null;
        this.time = 0;

        this._resize();
        window.addEventListener('resize', () => this._resize());
    }

    _resize() {
        if (!this.canvas) return;
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
        this.initParticles();
    }

    setMode(mode) {
        this.mode = mode;
        this.initParticles();
    }

    initParticles() {
        this.fallingRain = [];
        this.glassDrops = [];

        // 1. Falling background rain streaks
        const streakCount = 140;
        for (let i = 0; i < streakCount; i++) {
            this.fallingRain.push({
                x: Math.random() * (this.width + 200) - 100,
                y: Math.random() * this.height,
                length: Math.random() * 35 + 20,
                speed: Math.random() * 15 + 12,
                opacity: Math.random() * 0.35 + 0.1,
                width: Math.random() * 1.8 + 0.6
            });
        }

        // 2. Glass raindrops (stuck on screen & sliding down)
        const dropCount = 60;
        for (let i = 0; i < dropCount; i++) {
            this.glassDrops.push(this._createGlassDrop());
        }
    }

    _createGlassDrop(x = null, y = null) {
        const radius = Math.random() * 3.5 + 1.5;
        return {
            x: x !== null ? x : Math.random() * this.width,
            y: y !== null ? y : Math.random() * this.height,
            r: radius,
            maxR: radius * (Math.random() * 2 + 1.8),
            velY: 0,
            isSliding: false,
            slideSpeed: Math.random() * 3 + 1.5,
            trail: [], // wet trail points left behind
            friction: Math.random() * 0.05 + 0.92,
            opacity: Math.random() * 0.5 + 0.4
        };
    }

    start() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        const loop = () => {
            this.update();
            this.draw();
            this.animationId = requestAnimationFrame(loop);
        };
        loop();
    }

    update() {
        this.time += 0.016;

        // Update Falling Rain Streaks
        this.fallingRain.forEach(p => {
            p.y += p.speed;
            p.x -= p.speed * 0.15; // slight angle
            if (p.y > this.height) {
                p.y = -p.length;
                p.x = Math.random() * (this.width + 200) - 100;
            }
        });

        // Update Glass Raindrops Physics
        if (this.mode === 'custom_rain' || this.mode === 'rain') {
            // Randomly spawn new condensation drops
            if (Math.random() < 0.3 && this.glassDrops.length < 120) {
                this.glassDrops.push(this._createGlassDrop(Math.random() * this.width, Math.random() * (this.height * 0.7)));
            }

            this.glassDrops.forEach((d, idx) => {
                // Grow drop slightly over time as rain hits
                if (d.r < d.maxR && !d.isSliding) {
                    d.r += 0.008;
                }

                // Trigger sliding if drop grows big enough or randomly
                if (!d.isSliding && (d.r > 4.2 || (Math.random() < 0.002 && d.r > 2.5))) {
                    d.isSliding = true;
                    d.velY = Math.random() * 1.5 + 0.8;
                }

                // Sliding motion physics
                if (d.isSliding) {
                    d.y += d.velY;
                    d.velY *= d.friction;

                    // Stutter drip effect (water droplet friction on glass)
                    if (d.velY < 0.3 && Math.random() < 0.2) {
                        d.velY = Math.random() * 2.5 + 1.2;
                    }

                    // Leave thin wet trail behind
                    if (Math.random() < 0.6) {
                        d.trail.push({
                            x: d.x + (Math.random() - 0.5) * 0.8,
                            y: d.y - d.r,
                            r: Math.max(0.6, d.r * 0.35),
                            opacity: 0.6
                        });
                        if (d.trail.length > 25) d.trail.shift();
                    }

                    // Shrink as it leaves water behind
                    d.r -= 0.003;
                }

                // Fade trail points
                d.trail.forEach(t => {
                    t.opacity -= 0.003;
                });
                d.trail = d.trail.filter(t => t.opacity > 0.05);

                // Reset drop if offscreen or shrunk away
                if (d.y > this.height + 20 || d.r < 0.8) {
                    this.glassDrops[idx] = this._createGlassDrop();
                }
            });
        }
    }

    draw() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.width, this.height);

        // 1. Draw Background Image or Default Gradients
        if ((this.mode === 'custom_rain' || this.mode === 'rain') && this.bgImageLoaded) {
            this._drawCoverImage(this.bgImage);
            
            // Soft dark/mist overlay for contrast and UI readability
            this.ctx.fillStyle = 'rgba(5, 12, 20, 0.35)';
            this.ctx.fillRect(0, 0, this.width, this.height);
        } else if (this.mode === 'fire') {
            const bgGrad = this.ctx.createRadialGradient(
                this.width / 2, this.height, 50,
                this.width / 2, this.height / 2, this.width * 0.8
            );
            bgGrad.addColorStop(0, '#2c1205');
            bgGrad.addColorStop(0.6, '#120803');
            bgGrad.addColorStop(1, '#050201');
            this.ctx.fillStyle = bgGrad;
            this.ctx.fillRect(0, 0, this.width, this.height);
        } else if (this.mode === 'stars') {
            const bgGrad = this.ctx.createLinearGradient(0, 0, this.width, this.height);
            bgGrad.addColorStop(0, '#060812');
            bgGrad.addColorStop(1, '#020306');
            this.ctx.fillStyle = bgGrad;
            this.ctx.fillRect(0, 0, this.width, this.height);
        } else {
            const grad = this.ctx.createLinearGradient(0, 0, this.width, this.height);
            grad.addColorStop(0, '#0a0d14');
            grad.addColorStop(1, '#05070a');
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        // 2. Draw Falling Rain Streaks
        if (this.mode === 'custom_rain' || this.mode === 'rain') {
            this.ctx.strokeStyle = 'rgba(210, 235, 255, 0.38)';
            this.ctx.lineCap = 'round';

            this.fallingRain.forEach(p => {
                this.ctx.lineWidth = p.width;
                this.ctx.beginPath();
                this.ctx.moveTo(p.x, p.y);
                this.ctx.lineTo(p.x - p.length * 0.15, p.y + p.length);
                this.ctx.stroke();
            });

            // 3. Draw Glass Water Trails & Raindrops
            this.glassDrops.forEach(d => {
                // Draw trails left on glass
                d.trail.forEach(t => {
                    this.ctx.beginPath();
                    this.ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
                    this.ctx.fillStyle = `rgba(220, 240, 255, ${t.opacity * 0.4})`;
                    this.ctx.fill();
                });

                // Draw realistic 3D glass raindrop
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);

                // Water refraction drop gradient
                const dropGrad = this.ctx.createRadialGradient(
                    d.x - d.r * 0.3, d.y - d.r * 0.3, d.r * 0.1,
                    d.x, d.y, d.r
                );
                dropGrad.addColorStop(0, `rgba(255, 255, 255, ${d.opacity * 0.95})`);
                dropGrad.addColorStop(0.5, `rgba(180, 220, 255, ${d.opacity * 0.4})`);
                dropGrad.addColorStop(0.85, `rgba(30, 60, 90, ${d.opacity * 0.6})`);
                dropGrad.addColorStop(1, `rgba(10, 20, 35, ${d.opacity * 0.8})`);

                this.ctx.fillStyle = dropGrad;
                this.ctx.shadowBlur = 4;
                this.ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
                this.ctx.fill();

                // Bright top-left specular highlight dot
                this.ctx.beginPath();
                this.ctx.arc(d.x - d.r * 0.35, d.y - d.r * 0.35, d.r * 0.25, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(255, 255, 255, ${d.opacity})`;
                this.ctx.fill();

                this.ctx.restore();
            });
        }
    }

    _drawCoverImage(img) {
        const imgRatio = img.width / img.height;
        const canvasRatio = this.width / this.height;
        let renderW, renderH, offsetX, offsetY;

        if (canvasRatio > imgRatio) {
            renderW = this.width;
            renderH = this.width / imgRatio;
            offsetX = 0;
            offsetY = (this.height - renderH) / 2;
        } else {
            renderW = this.height * imgRatio;
            renderH = this.height;
            offsetX = (this.width - renderW) / 2;
            offsetY = 0;
        }

        this.ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
    }
}

window.Visualizer = Visualizer;
