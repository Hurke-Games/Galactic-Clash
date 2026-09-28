import React from 'react';
import {
  Planet,
  FactionConfig,
  GameStats,
  KeyBindings,
} from '../types/game';
import {
  Shield,
  Zap,
  Rocket,
  Flame,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Settings,
} from 'lucide-react';
import { formatKeyCode } from '../utils/controls';

interface HUDProps {
  playerHp: number;
  maxPlayerHp: number;
  playerBoost?: number;
  maxPlayerBoost?: number;
  playerBuffs?: {
    shieldHp: number;
    maxShieldHp: number;
    hasDoubleDamage: boolean;
    hasHomingRockets: boolean;
  };
  factions: FactionConfig[];
  planets: Planet[];
  stats: GameStats;
  soundEnabled: boolean;
  isPaused: boolean;
  onToggleSound: () => void;
  onTogglePause: () => void;
  onNewGameClick: () => void;
  onOpenSettings?: () => void;
  keyBindings?: KeyBindings;
}

export const HUD: React.FC<HUDProps> = ({
  playerHp,
  maxPlayerHp,
  playerBoost = 100,
  maxPlayerBoost = 100,
  playerBuffs = { shieldHp: 0, maxShieldHp: 0, hasDoubleDamage: false, hasHomingRockets: false },
  factions,
  planets,
  stats,
  soundEnabled,
  isPaused,
  onToggleSound,
  onTogglePause,
  onNewGameClick,
  onOpenSettings,
  keyBindings,
}) => {
  // Count planets per faction
  const factionPlanetCounts = factions.map((f) => {
    const count = planets.filter((p) => p.ownerId === f.id).length;
    return { ...f, count };
  });

  const totalPlanets = planets.length;
  const neutralPlanets = planets.filter((p) => p.ownerId === null).length;

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 z-10 select-none">
      {/* Top Header: 3-Zone Clean Top Bar Contract */}
      <header className="pointer-events-auto flex items-center justify-between px-5 py-3 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800/80 shadow-2xl">
        {/* Zone 1: Wordmark */}
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight text-white font-['Outfit']">
            Galactic Clash
          </span>
          <span className="hidden sm:inline text-xs text-slate-400">
            Tactical Space Dominion
          </span>
        </div>

        {/* Zone 2: Galaxy Territorial Control Bar */}
        <div className="hidden md:flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-3">
            {factionPlanetCounts.map((f) => (
              <div key={f.id} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shadow-sm"
                  style={{ backgroundColor: f.color }}
                />
                <span className="text-slate-300 font-sans">{f.name}:</span>
                <span className="font-mono tabular-nums text-white font-semibold">
                  {f.count}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-slate-600" />
              <span>Unoccupied:</span>
              <span className="font-mono tabular-nums">{neutralPlanets}</span>
            </div>
          </div>
        </div>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border border-slate-800 text-xs font-medium whitespace-nowrap cursor-pointer"
              title="Settings & Key Bindings"
            >
              <Settings className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          )}
          <button
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
            className="p-2 rounded-lg bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border border-slate-850 cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
          </button>
          <button
            onClick={onTogglePause}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 text-slate-200 hover:text-white hover:bg-slate-800 transition-colors border border-slate-800 text-xs font-medium whitespace-nowrap cursor-pointer"
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
          <button
            onClick={onNewGameClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition-colors shadow-sm whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Game</span>
          </button>
        </div>
      </header>

      {/* Bottom Area: Controls, Player Ship Hull Meter, Combat Stats */}
      <div className="pointer-events-auto flex flex-col md:flex-row items-end md:items-center justify-between gap-3">
        {/* Left: Player Ship Health & Thrust Boost Meter */}
        <div className="p-3.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800/80 shadow-2xl flex flex-wrap sm:flex-nowrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Ship Hull
              </div>
              <div className="text-sm font-bold text-white font-mono tabular-nums">
                {playerHp} / {maxPlayerHp} HP
              </div>
            </div>
          </div>

          {/* 5 Health Pips */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: maxPlayerHp }).map((_, i) => (
              <div
                key={i}
                className={`w-3.5 h-6 rounded-sm transition-all duration-200 ${
                  i < playerHp
                    ? 'bg-cyan-400 shadow-sm shadow-cyan-400/50'
                    : 'bg-slate-800 border border-slate-700/50'
                }`}
              />
            ))}
          </div>

          <div className="hidden sm:block h-7 w-px bg-slate-800" />

          {/* Thrust Boost Bar */}
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${playerBoost > 15 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-900 text-slate-500'}`}>
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                <span>Thrust Boost</span>
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] font-bold border border-amber-500/30">
                  SHIFT · 2X
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-24 sm:w-28 h-2.5 rounded-full bg-slate-900 border border-slate-700/80 overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-amber-500 via-orange-400 to-cyan-400 shadow-sm shadow-amber-400/50"
                    style={{ width: `${Math.max(0, Math.min(100, (playerBoost / maxPlayerBoost) * 100))}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-white font-mono tabular-nums">
                  {Math.round((playerBoost / maxPlayerBoost) * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Active Buffs (Shield / 2x Damage / Homing Rockets) */}
          {(playerBuffs.shieldHp > 0 || playerBuffs.hasDoubleDamage || playerBuffs.hasHomingRockets) && (
            <>
              <div className="hidden sm:block h-7 w-px bg-slate-800" />
              <div className="flex items-center gap-2 flex-wrap">
                {playerBuffs.shieldHp > 0 && (
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-sky-950/80 border border-sky-500/40 text-sky-300">
                    <Shield className="w-4 h-4 text-sky-400 animate-pulse" />
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-sky-400/80 font-bold">
                        Shield
                      </div>
                      <div className="text-xs font-bold font-mono text-sky-200">
                        {Math.ceil(playerBuffs.shieldHp)}/25 HP
                      </div>
                    </div>
                  </div>
                )}
                {playerBuffs.hasDoubleDamage && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-950/80 border border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/20">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold font-mono">2X DMG</span>
                  </div>
                )}
                {playerBuffs.hasHomingRockets && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-950/80 border border-rose-500/50 text-rose-300 shadow-sm shadow-rose-500/20">
                    <Rocket className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-bold font-mono">ROCKETS</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Center: Controls Pill Guide */}
        <div className="hidden lg:flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-xs text-slate-300 shadow-xl">
          <div className="flex items-center gap-1 font-mono text-cyan-300 font-semibold">
            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700">
              {keyBindings?.thrust?.map((k) => formatKeyCode(k)).join(' / ') || 'W / ↑'}
            </span>
            <span className="text-slate-400 ml-1">Thrust</span>
          </div>
          <span className="text-slate-600">·</span>
          <div className="flex items-center gap-1 font-mono text-amber-300 font-semibold">
            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-amber-600/60 shadow-sm shadow-amber-500/20">
              SHIFT
            </span>
            <span className="text-slate-400 ml-1">2x Boost</span>
          </div>
          <span className="text-slate-600">·</span>
          <div className="flex items-center gap-1 font-mono text-cyan-300 font-semibold">
            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700">
              {keyBindings?.land?.map((k) => formatKeyCode(k)).join(' / ') || 'S / ↓ / L'}
            </span>
            <span className="text-slate-400 ml-1">Land</span>
          </div>
          <span className="text-slate-600">·</span>
          <div className="flex items-center gap-1 font-mono text-cyan-300 font-semibold">
            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700">
              Space / Mouse L
            </span>
            <span className="text-slate-400 ml-1">Fire</span>
          </div>
          <span className="text-slate-600">·</span>
          <div className="text-slate-400">
            Scroll: <span className="text-cyan-300 font-mono">Zoom</span>
          </div>
        </div>

        {/* Right: Quick Combat Stats */}
        <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-xs text-slate-300 shadow-xl">
          <div>
            <span className="text-slate-500">Shots: </span>
            <strong className="text-white font-mono tabular-nums">{stats.shotsFired}</strong>
          </div>
          <span className="text-slate-700">·</span>
          <div>
            <span className="text-slate-500">Kills: </span>
            <strong className="text-rose-400 font-mono tabular-nums">{stats.shipsDestroyed}</strong>
          </div>
          <span className="text-slate-700">·</span>
          <div>
            <span className="text-slate-500">Buildings Defeated: </span>
            <strong className="text-amber-400 font-mono tabular-nums">{stats.buildingsDestroyed}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
