import React, { useState } from 'react';
import { GameSettings, AIAggression, KeyBindings } from '../types/game';
import { KeyBindingsEditor } from './KeyBindingsEditor';
import { Rocket, Play, Settings, CheckCircle, Sliders, Volume2, VolumeX, Map } from 'lucide-react';

interface NewGameModalProps {
  isOpen: boolean;
  onStartGame: (settings: GameSettings) => void;
  onClose?: () => void;
  keyBindings: KeyBindings;
  onUpdateKeyBindings: (bindings: KeyBindings) => void;
}

const RIVAL_PROFILES = [
  {
    name: 'Crimson Syndicate',
    color: '#f43f5e',
    accent: 'text-rose-400',
    border: 'border-rose-500/30',
    bgBadge: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    defaultStyle: 'aggressive' as AIAggression,
  },
  {
    name: 'Verdant Dominion',
    color: '#10b981',
    accent: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bgBadge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    defaultStyle: 'expansionist' as AIAggression,
  },
  {
    name: 'Void Enclave',
    color: '#a855f7',
    accent: 'text-purple-400',
    border: 'border-purple-500/30',
    bgBadge: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
    defaultStyle: 'berserker' as AIAggression,
  },
];

const AI_STYLES: { id: AIAggression; label: string; desc: string }[] = [
  { id: 'balanced', label: 'Balanced', desc: 'Tactical expansion & defense' },
  { id: 'aggressive', label: 'Aggressive', desc: 'Raids enemy buildings & outposts' },
  { id: 'berserker', label: 'Berserker', desc: 'Relentless ship hunting & dogfighting' },
  { id: 'expansionist', label: 'Expansionist', desc: 'Rushes to claim uncolonized space worlds' },
  { id: 'passive', label: 'Defender', desc: 'Guards home territory & retreats to heal' },
];

export const NewGameModal: React.FC<NewGameModalProps> = ({
  isOpen,
  onStartGame,
  onClose,
  keyBindings,
  onUpdateKeyBindings,
}) => {
  const [activeTab, setActiveTab] = useState<'galaxy' | 'controls'>('galaxy');
  const [starCount, setStarCount] = useState<number>(6); // 4 to 8
  const [aiPlayerCount, setAiPlayerCount] = useState<number>(3); // 1 to 3
  const [aiStyles, setAiStyles] = useState<AIAggression[]>([
    'aggressive',
    'expansionist',
    'berserker',
  ]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showMinimap, setShowMinimap] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartGame({
      starCount,
      aiPlayerCount,
      aiAggression: aiStyles[0] || 'balanced',
      aiStyles,
      soundEnabled,
      showMinimap,
      keyBindings,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-800 p-6 md:p-8 shadow-2xl overflow-y-auto">
        {/* Subtle accent glow */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Rocket className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white font-['Outfit'] tracking-tight">
              Galactic Clash
            </h2>
            <p className="text-xs text-slate-400">
              Configure galaxy parameters, flight controls & key bindings
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 mb-5 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('galaxy')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'galaxy'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Galaxy Setup</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('controls')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'controls'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Key Bindings & Settings</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {activeTab === 'galaxy' ? (
            <>
              {/* Star Count Slider (4 to 8) */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Galaxy Stars (4 to 8)
                  </label>
                  <span className="font-mono text-cyan-400 font-bold text-sm">
                    {starCount} Systems
                  </span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="8"
                  step="1"
                  value={starCount}
                  onChange={(e) => setStarCount(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Each star generates 1 to 4 orbiting planets spaced across the galaxy.
                </p>
              </div>

              {/* AI Player Count (1 to 3) */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Computer Rivals (1 to 3 AI)
                  </label>
                  <span className="font-mono text-cyan-400 font-bold text-sm">
                    {aiPlayerCount} Rivals
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((count) => (
                    <button
                      type="button"
                      key={count}
                      onClick={() => setAiPlayerCount(count)}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all border ${
                        aiPlayerCount === count
                          ? 'bg-cyan-600 text-white border-cyan-500 shadow-sm'
                          : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white'
                      }`}
                    >
                      {count === 1 ? '1 Rival' : `${count} Rivals`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Configure Rival Styles Individually */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Computer Rival Styles ({aiPlayerCount} Active)
                  </label>
                  <span className="text-[11px] text-cyan-400 font-mono">
                    Select style per rival
                  </span>
                </div>

                <div className="space-y-2.5">
                  {Array.from({ length: aiPlayerCount }).map((_, idx) => {
                    const rival = RIVAL_PROFILES[idx];
                    const currentStyle = aiStyles[idx] || rival.defaultStyle;

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl bg-slate-950/70 border ${rival.border} space-y-2 transition-all`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shadow-sm"
                              style={{ backgroundColor: rival.color }}
                            />
                            <span className="text-xs font-bold text-white font-['Outfit']">
                              Rival {idx + 1}: {rival.name}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${rival.bgBadge}`}
                          >
                            {AI_STYLES.find((s) => s.id === currentStyle)?.label}
                          </span>
                        </div>

                        {/* Style selection buttons */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                          {AI_STYLES.map((style) => (
                            <button
                              type="button"
                              key={style.id}
                              onClick={() => {
                                const updated = [...aiStyles];
                                updated[idx] = style.id;
                                setAiStyles(updated);
                              }}
                              className={`py-1.5 px-2 rounded-lg text-left transition-all border cursor-pointer ${
                                currentStyle === style.id
                                  ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-sm'
                                  : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                              }`}
                            >
                              <div className="text-[11px] font-bold truncate">{style.label}</div>
                              <div className="text-[9px] text-slate-400 truncate leading-tight mt-0.5">
                                {style.desc}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rules Summary Box */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-1.5 leading-relaxed">
                <div className="font-semibold text-white flex items-center gap-1.5 text-xs">
                  <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />
                  Strategic Objectives:
                </div>
                <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-1">
                  <li>Each ship starts on the edge of their owned world. Head for unoccupied space worlds and press <strong>S</strong>, <strong>↓</strong>, or <strong>L</strong> to land and claim them.</li>
                  <li>Claimed worlds dispatch colony ships that auto-pathfind across space to construct Base, Production Hub, Lab, & Comms Center.</li>
                  <li>Target enemy worlds with gunfire to destroy buildings and eliminate rival outposts.</li>
                  <li>As long as you have at least one planet with a base, you will respawn on it.</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {/* Audio & Radar Toggles inside settings tab */}
              <div className="grid grid-cols-2 gap-2.5 pb-2">
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    soundEnabled
                      ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  )}
                  <span>Sound: {soundEnabled ? 'Enabled' : 'Muted'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowMinimap(!showMinimap)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    showMinimap
                      ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Map className="w-4 h-4 text-cyan-400" />
                  <span>Galaxy Radar: {showMinimap ? 'Visible' : 'Hidden'}</span>
                </button>
              </div>

              {/* Key Bindings Editor */}
              <KeyBindingsEditor bindings={keyBindings} onChange={onUpdateKeyBindings} />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition-colors hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="flex items-center justify-center gap-2 px-7 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-300 text-slate-950 font-bold text-sm tracking-wide transition-all shadow-xl shadow-cyan-500/25 active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Start Game</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

