import React, { useRef, useEffect } from 'react';
import { Star, Planet, FactionConfig, ShipRadarMarker } from '../types/game';

interface MinimapProps {
  stars: Star[];
  planets: Planet[];
  factions: FactionConfig[];
  shipsRadarRef?: React.MutableRefObject<ShipRadarMarker[]>;
  onClose?: () => void;
}

export const Minimap: React.FC<MinimapProps> = ({ stars, planets, factions, shipsRadarRef }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sweepAngleRef = useRef<number>(0);

  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Galaxy bounds (scaled 150% to match the 6300x5400 galaxy)
      const worldSize = 7200;
      const scale = (w - 24) / worldSize;

      // Deep space tactical radar background
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, w, h);

      // Radar grid coordinates
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      const gridSpacing = 32;
      for (let x = 0; x <= w; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Range rings
      [0.28, 0.55, 0.85].forEach((ratio) => {
        ctx.beginPath();
        ctx.arc(cx, cy, (w / 2 - 12) * ratio, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Axis crosshairs
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.beginPath();
      ctx.moveTo(cx, 8);
      ctx.lineTo(cx, h - 8);
      ctx.moveTo(8, cy);
      ctx.lineTo(w - 8, cy);
      ctx.stroke();

      // Rotating radar sweep beam
      sweepAngleRef.current = (sweepAngleRef.current + 0.035) % (Math.PI * 2);
      const sweepAngle = sweepAngleRef.current;
      const sweepRadius = w * 0.65;

      const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sweepRadius);
      sweepGrad.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
      sweepGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, sweepRadius, sweepAngle - 0.45, sweepAngle);
      ctx.closePath();
      ctx.fillStyle = sweepGrad;
      ctx.fill();
      ctx.restore();

      // -------------------------------------------------------------
      // 1. DRAW STARS: ALL STARS ARE YELLOW REGARDLESS OF IN-GAME COLOR
      // -------------------------------------------------------------
      stars.forEach((star) => {
        const sx = cx + star.x * scale;
        const sy = cy + star.y * scale;

        // Radiant yellow corona
        ctx.beginPath();
        ctx.arc(sx, sy, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.3)';
        ctx.fill();

        // Bright yellow star core
        ctx.beginPath();
        ctx.arc(sx, sy, 3.8, 0, Math.PI * 2);
        ctx.fillStyle = '#facc15'; // Vibrant radiant yellow
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Subtle 4-point solar glint
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx - 6, sy);
        ctx.lineTo(sx + 6, sy);
        ctx.moveTo(sx, sy - 6);
        ctx.lineTo(sx, sy + 6);
        ctx.stroke();
      });

      // -------------------------------------------------------------
      // 2. DRAW PLANETS: In their faction colors with orbital indicators
      // -------------------------------------------------------------
      planets.forEach((planet) => {
        const px = cx + planet.x * scale;
        const py = cy + planet.y * scale;
        const faction = factions.find((f) => f.id === planet.ownerId);

        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = faction ? faction.color : '#64748b';
        ctx.fill();

        if (faction) {
          ctx.beginPath();
          ctx.arc(px, py, 4.5, 0, Math.PI * 2);
          ctx.strokeStyle = faction.color;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      });

      // -------------------------------------------------------------
      // 2b. DRAW COLONY SHIPS: Very small dot in owner's color once they leave a planet
      // -------------------------------------------------------------
      planets.forEach((planet) => {
        planet.colonyShips.forEach((cs) => {
          if (cs.state === 'traveling') {
            const csx = cx + cs.x * scale;
            const csy = cy + cs.y * scale;
            const csFaction = factions.find((f) => f.id === cs.ownerId);
            const dotColor = csFaction ? csFaction.color : '#38bdf8';

            ctx.save();
            ctx.beginPath();
            ctx.arc(csx, csy, 2.2, 0, Math.PI * 2);
            ctx.fillStyle = dotColor;
            ctx.shadowColor = dotColor;
            ctx.shadowBlur = 5;
            ctx.fill();

            // Tiny white core for visibility
            ctx.beginPath();
            ctx.arc(csx, csy, 0.9, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
          }
        });
      });

      // -------------------------------------------------------------
      // 3. TRACK PLAYERS' LOCATIONS IN REAL TIME
      // -------------------------------------------------------------
      if (shipsRadarRef && shipsRadarRef.current) {
        const now = Date.now();
        const pulseCycle = (now % 1000) / 1000; // 0 to 1

        shipsRadarRef.current.forEach((ship) => {
          if (ship.isDead) return;

          const sx = cx + ship.x * scale;
          const sy = cy + ship.y * scale;
          const faction = factions.find((f) => f.id === ship.ownerId);
          const isPlayer = ship.ownerId === 'player';
          const markerColor = isPlayer ? '#38bdf8' : (faction?.color || '#f43f5e');

          ctx.save();
          ctx.translate(sx, sy);

          if (isPlayer) {
            // Animated radar ping ring around human player
            const pulseRadius = 5 + pulseCycle * 14;
            ctx.beginPath();
            ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(56, 189, 248, ${1 - pulseCycle})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Heading pointer triangle
            ctx.rotate(ship.angle);
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(-5, -4.5);
            ctx.lineTo(-2, 0);
            ctx.lineTo(-5, 4.5);
            ctx.closePath();
            ctx.fillStyle = '#38bdf8';
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;

            // Center glowing dot
            ctx.beginPath();
            ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          } else {
            // Computer player marker
            // Directional arrow
            ctx.rotate(ship.angle);
            ctx.beginPath();
            ctx.moveTo(6, 0);
            ctx.lineTo(-4, -3.5);
            ctx.lineTo(-1.5, 0);
            ctx.lineTo(-4, 3.5);
            ctx.closePath();
            ctx.fillStyle = markerColor;
            ctx.fill();

            // Outer detection ring
            ctx.rotate(-ship.angle);
            ctx.beginPath();
            ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
            ctx.strokeStyle = markerColor;
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          ctx.restore();
        });
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [stars, planets, factions, shipsRadarRef]);

  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 z-20 p-2.5 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-slate-800 shadow-2xl">
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1.5 px-1 font-['Outfit']">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
          <span className="tracking-wide uppercase text-white font-bold">Galaxy Radar</span>
        </div>
        <span className="text-[10px] text-cyan-400 font-mono tracking-tight font-medium">
          LIVE TRACKING
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={200}
        height={200}
        className="block rounded-xl bg-slate-950 border border-slate-800/80 shadow-inner"
      />
      {/* Quick radar legend */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 px-1 font-mono">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-400 shadow-sm" />
          <span>Star</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm" />
          <span>You</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-400 shadow-sm" />
          <span>Rivals</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm" />
          <span>Colony</span>
        </div>
      </div>
    </div>
  );
};
