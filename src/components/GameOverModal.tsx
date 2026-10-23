import React from 'react';
import { FactionId, FactionConfig, GameStats, ShipClass } from '../types/game';
import { Trophy, Skull, RotateCcw, Target, Shield, Globe, Rocket, Zap, Sparkles } from 'lucide-react';
import { SHIP_CLASS_DEFS } from '../utils/shipProgression';

interface GameOverModalProps {
  isOpen: boolean;
  winnerFactionId: FactionId;
  factions: FactionConfig[];
  stats: GameStats;
  onPlayAgain: () => void;
  unlockedShipClass?: ShipClass | null;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  winnerFactionId,
  factions,
  stats,
  onPlayAgain,
  unlockedShipClass,
}) => {
  if (!isOpen) return null;

  const isPlayerWinner = winnerFactionId === 'player';
  const winner = factions.find((f) => f.id === winnerFactionId);
  const unlockedDef = unlockedShipClass ? SHIP_CLASS_DEFS[unlockedShipClass] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 md:p-8 shadow-2xl text-center">
        {/* Glow */}
        <div
          className={`absolute top-0 left-1/2 -translate-x-1/2 -mt-12 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
            isPlayerWinner ? 'bg-cyan-500/20' : 'bg-rose-500/20'
          }`}
        />

        {/* Icon */}
        <div className="inline-flex p-4 rounded-2xl mb-4 bg-slate-800/80 border border-slate-700 shadow-xl">
          {isPlayerWinner ? (
            <Trophy className="w-10 h-10 text-amber-400 animate-bounce" />
          ) : (
            <Skull className="w-10 h-10 text-rose-400" />
          )}
        </div>

        {/* Title */}
        <h2 className="text-2xl font-black text-white font-['Outfit'] tracking-tight">
          {isPlayerWinner ? 'GALAXY DOMINION ACHIEVED' : 'MISSION FAILED'}
        </h2>
        <p className="text-xs text-slate-400 mt-1 mb-5">
          {isPlayerWinner
            ? 'All rival factions have been neutralized. You are the last commander standing!'
            : `The galaxy has fallen to ${winner?.name || 'enemy rivals'}. Your fleet was eliminated.`}
        </p>

        {/* Newly Unlocked Ship Class Banner */}
        {isPlayerWinner && unlockedDef && (
          <div className="mb-5 p-3.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-cyan-500/20 to-purple-500/20 border border-cyan-400/60 shadow-lg text-left animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
              <span>NEW SHIP CLASS UNLOCKED!</span>
            </div>
            <div className="text-white font-black text-sm flex items-center gap-1.5">
              <Rocket className="w-4 h-4 text-cyan-400" />
              <span>{unlockedDef.codename} ({unlockedDef.name})</span>
            </div>
            <div className="text-[11px] text-cyan-200 mt-0.5">
              Role: <span className="font-semibold">{unlockedDef.role}</span> • Special: <span className="font-bold text-amber-300">{unlockedDef.specialName}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Now selectable in the New Campaign ship hangar!
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6 text-left">
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Planets Claimed</span>
            </div>
            <div className="text-lg font-bold font-mono text-white tabular-nums">
              {stats.planetsClaimed}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Target className="w-3.5 h-3.5 text-rose-400" />
              <span>Ships Destroyed</span>
            </div>
            <div className="text-lg font-bold font-mono text-white tabular-nums">
              {stats.shipsDestroyed}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Buildings Razed</span>
            </div>
            <div className="text-lg font-bold font-mono text-white tabular-nums">
              {stats.buildingsDestroyed}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
              <span>Shots Fired</span>
            </div>
            <div className="text-lg font-bold font-mono text-white tabular-nums">
              {stats.shotsFired}
            </div>
          </div>
        </div>

        {/* Play Again button */}
        <button
          onClick={onPlayAgain}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/25 active:scale-95 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Play Again</span>
        </button>
      </div>
    </div>
  );
};
