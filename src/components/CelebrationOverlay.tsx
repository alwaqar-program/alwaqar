import { useEffect, useRef } from 'react';

// ألعاب نارية خفيفة بلا مكتبات: انفجارات دورية بألوان الهوية ثم تتوقف تلقائيًا.
const COLORS = ['#045E63', '#0E8388', '#C9A96A', '#E3C88F', '#FFFFFF'];
const DURATION_MS = 6500;

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
}

export default function CelebrationOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = [];
    const burst = () => {
      const cx = canvas.width * (0.15 + Math.random() * 0.7);
      const cy = canvas.height * (0.15 + Math.random() * 0.4);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const count = 50 + Math.floor(Math.random() * 30);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2;
        const speed = 2 + Math.random() * 4.5;
        const maxLife = 55 + Math.random() * 35;
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: maxLife, maxLife,
          color: Math.random() < 0.25 ? COLORS[Math.floor(Math.random() * COLORS.length)] : color,
          size: 1.5 + Math.random() * 2,
        });
      }
    };

    const started = Date.now();
    burst();
    const interval = window.setInterval(() => {
      if (Date.now() - started < DURATION_MS - 1200) burst();
    }, 650);

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06; // جاذبية
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.life -= 1;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (Date.now() - started < DURATION_MS || particles.length > 0) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.clearInterval(interval);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50 print:hidden"
      aria-hidden="true"
    />
  );
}
