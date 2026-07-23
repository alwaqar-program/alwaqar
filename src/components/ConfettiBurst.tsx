import { useEffect, useRef } from 'react';

// قصاصات احتفالية خفيفة بلا مكتبات — تتساقط من أعلى الصفحة ثم تتلاشى تلقائيًا.
// الألوان من هوية النظام (تركوازي/ذهبي/عاجي) وتظهر بوضوح على الخلفية الفاتحة.
const COLORS = ['#045E63', '#0E8388', '#C9A96A', '#B08D4F', '#E9D8AF'];
const DURATION_MS = 5500;

interface Piece {
  x: number; y: number; vx: number; vy: number;
  rot: number; vr: number; w: number; h: number;
  color: string; sway: number; phase: number;
}

export default function ConfettiBurst() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const pieces: Piece[] = [];
    for (let i = 0; i < 170; i++) {
      pieces.push({
        x: Math.random() * window.innerWidth * dpr,
        y: (-20 - Math.random() * window.innerHeight * 0.3) * dpr,
        vx: (Math.random() - 0.5) * 1.6 * dpr,
        vy: (2 + Math.random() * 2.5) * dpr,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.25,
        w: (5 + Math.random() * 6) * dpr,
        h: (8 + Math.random() * 8) * dpr,
        color: COLORS[i % COLORS.length],
        sway: (0.4 + Math.random() * 1.2) * dpr,
        phase: Math.random() * Math.PI * 2,
      });
    }

    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const elapsed = t - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // تلاشٍ تدريجي في الثانية الأخيرة
      ctx.globalAlpha =
        elapsed > DURATION_MS - 1000 ? Math.max(0, (DURATION_MS - elapsed) / 1000) : 1;
      for (const p of pieces) {
        p.x += p.vx + Math.sin(t / 400 + p.phase) * p.sway * 0.3;
        p.y += p.vy;
        p.rot += p.vr;
        // إعادة التدوير من الأعلى ما دام المؤثر مستمرًا (يتوقف قبيل التلاشي)
        if (p.y > canvas.height + 20 && elapsed < DURATION_MS - 1500) {
          p.y = -20 * dpr;
          p.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        // تذبذب العرض يعطي إيحاء دوران الورقة حول محورها
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.sin(t / 300 + p.phase)));
        ctx.restore();
      }
      if (elapsed < DURATION_MS) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50 h-full w-full print:hidden"
      aria-hidden="true"
    />
  );
}
