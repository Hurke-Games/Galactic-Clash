import React from 'react';
import { FactionId, FactionConfig, GameStats } from '../types/game';
import { Trophy, Skull, RotateCcw, Target, Shield, Globe } from 'lucide-react';

interface GameOverModalProps {
  isOpen: boolean;
  winnerFactionId: FactionId;
  factions: FactionConfig[];
  stats: GameStats;
  onPlayAgain: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  winnerFactionId,
  factions,
  stats,
  onPlayAgain,
}) => {
  if (!isOpen) return null;

  const isPlayerWinner = winnerFactionId === 'player';
  const winner = factions.find((f) => f.id === winnerFactionId);

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
        <p className="text-xs text-slate-400 mt-1 mb-6">
          {isPlayerWinner
            ? 'All rival factions have been neutralized. You are the last commander standing!'
            : `The galaxy has fallen to ${winner?.name || 'enemy rivals'}. Your fleet was eliminated.`}
        </p>

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
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/25 active:scale-95"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Play Again</span>
        </button>
      </div>
    </div>
  );
};
