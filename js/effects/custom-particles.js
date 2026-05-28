class ParticleSystem {
    constructor() {
        this.container = document.getElementById('particle-layer');
        if (!this.container) return;

        this.targetDensity = 8;
        this.activeParticles = 0;
        this.assetPath = 'assets/images/10.png';
        this.recentZones = [];

        // Interactive rendering states
        this.mouseX = -1000;
        this.mouseY = -1000;
        this.activeNodes = [];

        this.initContextObserver();
        this.initMouseTracking();

        // Kick off the organic spawn sequence
        this.scheduleNextSpawn();
        this.renderLoop();
    }

    initContextObserver() {
        // Density modulation based on Section Layout
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.targetDensity = 8; // Hero zone expects a dense cinematic feel
                } else {
                    this.targetDensity = 4; // Scroll away heavy data areas expects clean reading layout
                }
            });
        }, { threshold: 0.1 });

        const hero = document.getElementById('hero');
        if (hero) observer.observe(hero);
    }

    initMouseTracking() {
        window.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        }, { passive: true });
    }

    renderLoop() {
        // High performance requestAnimationFrame loop injecting soft JS layout offsets
        
        // Pass 1: Read all necessary layout geometry entirely before any writes to prevent layout thrashing
        this.activeNodes.forEach(node => {
            node.rect = node.particle.getBoundingClientRect();
        });

        // Pass 2: Execute math and safely write all mapped variables
        this.activeNodes.forEach(node => {
            const rect = node.rect;
            
            // Bypass offscreen elements implicitly
            if (rect.top > window.innerHeight || rect.bottom < 0) return;

            const pX = rect.left + rect.width / 2;
            const pY = rect.top + rect.height / 2;

            const dx = this.mouseX - pX;
            const dy = this.mouseY - pY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 350) {
                // Apply a gentle, wider displacement field based on proximity curve
                const influence = Math.pow(Math.max(0, 350 - dist) / 350, 1.5);
                node.targetX = (dx * -0.04 * influence);
                node.targetY = (dy * -0.04 * influence);
            } else {
                node.targetX = 0;
                node.targetY = 0;
            }

            // Soft lerp curve snapping back to zero trajectory over time safely
            node.offsetX += (node.targetX - node.offsetX) * 0.05;
            node.offsetY += (node.targetY - node.offsetY) * 0.05;

            // Clamp max displacement to prevent snapping/erratic jitter mapping
            const limit = 40;
            node.offsetX = Math.max(-limit, Math.min(limit, node.offsetX));
            node.offsetY = Math.max(-limit, Math.min(limit, node.offsetY));

            // Force rendering payload natively
            node.wrapper.style.transform = `translate3d(${node.offsetX}px, ${node.offsetY}px, 0)`;
        });

        requestAnimationFrame(() => this.renderLoop());
    }

    scheduleNextSpawn() {
        const nextSpawnIn = Math.random() * 900 + 300;
        setTimeout(() => {
            this.spawnParticle();
            this.scheduleNextSpawn();
        }, nextSpawnIn);
    }

    spawnParticle() {
        if (document.hidden || this.activeParticles >= this.targetDensity) return;

        const wrapper = document.createElement('div');
        wrapper.classList.add('brand-particle-wrapper');
        
        const particle = document.createElement('img');
        particle.src = this.assetPath;
        particle.classList.add('brand-particle');

        // 3D Depth Generation (Far, Mid, Near)
        const depth = Math.random();
        let size, duration, maxOpacity;

        if (depth < 0.33) {
            size = Math.random() * 40 + 120;
            duration = Math.random() * 10 + 30;
            maxOpacity = Math.random() * 0.10 + 0.10; // 0.10 to 0.20
            wrapper.style.setProperty('--layer-z', '-2');
            wrapper.style.setProperty('--glow-blur', '4px');
            wrapper.style.setProperty('--glow-opacity', '0.2');
        } else if (depth < 0.66) {
            size = Math.random() * 40 + 160;
            duration = Math.random() * 10 + 20;
            maxOpacity = Math.random() * 0.15 + 0.20; // 0.20 to 0.35
            wrapper.style.setProperty('--layer-z', '-1');
            wrapper.style.setProperty('--glow-blur', '8px');
            wrapper.style.setProperty('--glow-opacity', '0.35');
        } else {
            size = Math.random() * 60 + 180; // Scaled down near layer
            duration = Math.random() * 5 + 15;
            maxOpacity = Math.random() * 0.15 + 0.35; // Clamped opacity
            wrapper.classList.add('near-layer');
            wrapper.style.setProperty('--layer-z', '1');
            wrapper.style.setProperty('--glow-blur', '16px');
            wrapper.style.setProperty('--glow-opacity', '0.5');
        }

        // Smart Horizontal Distribution (Dynamic Responsive Zones)
        const zoneWidthPx = 250;
        const totalZones = Math.max(3, Math.floor(window.innerWidth / zoneWidthPx));
        const zoneWidth = 100 / totalZones;
        let zone;
        do {
            zone = Math.floor(Math.random() * totalZones);
        } while (this.recentZones.includes(zone));

        this.recentZones.push(zone);
        const memorySize = Math.min(3, Math.floor(totalZones / 2));
        if (this.recentZones.length > memorySize) this.recentZones.shift();

        const startX = (zone * zoneWidth) + (Math.random() * (zoneWidth + 10) - 5); // Bleed across edges
        const endY = Math.random() * 30 + 70; // 70-100vh prevents hard visual floor

        const delay = Math.random() * 1;
        const driftX = (Math.random() - 0.5) * 120;
        const rotStart = Math.random() * 360;
        const rotEnd = rotStart + ((Math.random() - 0.5) * 200);

        // Append physics bindings
        wrapper.style.setProperty('--size', `${size}px`);
        wrapper.style.setProperty('--start-x', `${startX}vw`);
        wrapper.style.setProperty('--duration', `${duration}s`);
        wrapper.style.setProperty('--delay', `${delay}s`);
        wrapper.style.setProperty('--max-opacity', maxOpacity);
        wrapper.style.setProperty('--drift-x', `${driftX}px`);
        wrapper.style.setProperty('--end-y', `${endY}vh`);
        wrapper.style.setProperty('--rot-start', `${rotStart}deg`);
        wrapper.style.setProperty('--rot-end', `${rotEnd}deg`);
        wrapper.style.setProperty('--scale-start', Math.random() * 0.3 + 0.7);
        wrapper.style.setProperty('--scale-end', Math.random() * 0.3 + 0.8);
        wrapper.style.setProperty('--asset-path', `url("${this.assetPath}")`);

        wrapper.appendChild(particle);
        this.container.appendChild(wrapper);
        this.activeParticles++;

        const nodeObj = { wrapper, particle, offsetX: 0, offsetY: 0, targetX: 0, targetY: 0 };
        this.activeNodes.push(nodeObj);

        const lifecycleMs = (duration + delay) * 1000 + 100;
        setTimeout(() => {
            if (this.container.contains(wrapper)) {
                this.container.removeChild(wrapper);
                this.activeParticles--;
                this.activeNodes = this.activeNodes.filter(n => n.wrapper !== wrapper);
            }
        }, lifecycleMs);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new ParticleSystem());
} else {
    new ParticleSystem();
}
