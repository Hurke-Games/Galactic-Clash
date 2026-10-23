import React, { useState, useEffect } from 'react';
import { GameSettings, AIAggression, KeyBindings, ShipClass } from '../types/game';
import { KeyBindingsEditor } from './KeyBindingsEditor';
import {
  Rocket,
  Play,
  Settings,
  CheckCircle,
  Sliders,
  Volume2,
  VolumeX,
  Map,
  Lock,
  Unlock,
  Shield,
  Zap,
  Radio,
  Crosshair,
  Flame,
  Check,
} from 'lucide-react';
import { SHIP_CLASS_DEFS, getShipUnlocks, ShipUnlocks } from '../utils/shipProgression';

interface NewGameModalProps {
  isOpen: boolean;
  onStartGame: (settings: GameSettings) => void;
  onClose?: () => void;
  keyBindings: KeyBindings;
  onUpdateKeyBindings: (bindings: KeyBindings) => void;
  initialPlayerShipClass?: ShipClass;
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

const ALL_SHIP_CLASSES: ShipClass[] = ['standard', 'interceptor', 'commander', 'heavy_frigate'];

export const NewGameModal: React.FC<NewGameModalProps> = ({
  isOpen,
  onStartGame,
  onClose,
  keyBindings,
  onUpdateKeyBindings,
  initialPlayerShipClass = 'standard',
}) => {
  const [activeTab, setActiveTab] = useState<'ships' | 'galaxy' | 'controls'>('ships');
  const [unlocks, setUnlocks] = useState<ShipUnlocks>(() => getShipUnlocks());
  const [playerShipClass, setPlayerShipClass] = useState<ShipClass>(initialPlayerShipClass);
  const [allowedAiShipClasses, setAllowedAiShipClasses] = useState<ShipClass[]>([
    'standard',
    'interceptor',
    'commander',
    'heavy_frigate',
  ]);

  const [starCount, setStarCount] = useState<number>(6); // 4 to 8
  const [aiPlayerCount, setAiPlayerCount] = useState<number>(3); // 1 to 3
  const [aiStyles, setAiStyles] = useState<AIAggression[]>([
    'aggressive',
    'expansionist',
    'berserker',
  ]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showMinimap, setShowMinimap] = useState<boolean>(true);

  // Refresh unlocks each time modal opens
  useEffect(() => {
    if (isOpen) {
      const current = getShipUnlocks();
      setUnlocks(current);
      // Ensure playerShipClass is unlocked
      if (!current[playerShipClass]) {
        setPlayerShipClass('standard');
      }
    }
  }, [isOpen, playerShipClass]);

  if (!isOpen) return null;

  const handleToggleAiShipClass = (cls: ShipClass) => {
    setAllowedAiShipClasses((prev) => {
      if (prev.includes(cls)) {
        if (prev.length <= 1) return prev; // Keep at least one
        return prev.filter((c) => c !== cls);
      }
      return [...prev, cls];
    });
  };

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
      playerShipClass,
      allowedAiShipClasses,
    });
  };

  const getSpecialIcon = (cls: ShipClass) => {
    switch (cls) {
      case 'interceptor':
        return <Zap className="w-3.5 h-3.5 text-cyan-400" />;
      case 'commander':
        return <Radio className="w-3.5 h-3.5 text-blue-400" />;
      case 'heavy_frigate':
        return <Flame className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Crosshair className="w-3.5 h-3.5 text-sky-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-7 shadow-2xl overflow-y-auto">
        {/* Subtle accent glow */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Rocket className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white font-['Outfit'] tracking-tight">
              Galactic Clash: Campaign Setup
            </h2>
            <p className="text-xs text-slate-400">
              Select your flagship class, customize computer fleet pool, and configure sector parameters
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 mb-5 gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('ships')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'ships'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>Ship Classes & Fleet</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('galaxy')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'galaxy'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Galaxy Setup</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('controls')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'controls'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Controls & Radar</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ========================================================================= */}
          {/* TAB 1: SHIP CLASSES & AI ROSTER                                           */}
          {/* ========================================================================= */}
          {activeTab === 'ships' && (
            <div className="space-y-6">
              {/* Player Ship Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <span>Command Flagship (Player Ship)</span>
                    <span className="text-[10px] text-cyan-400 font-mono normal-case">
                      (Win a campaign to unlock each tier)
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ALL_SHIP_CLASSES.map((cls) => {
                    const def = SHIP_CLASS_DEFS[cls];
                    const isUnlocked = unlocks[cls];
                    const isSelected = playerShipClass === cls;

                    return (
                      <div
                        key={cls}
                        onClick={() => {
                          if (isUnlocked) setPlayerShipClass(cls);
                        }}
                        className={`relative rounded-xl p-3.5 border transition-all ${
                          !isUnlocked
                            ? 'bg-slate-950/50 border-slate-800/80 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-gradient-to-b from-cyan-950/60 to-slate-900 border-cyan-400 shadow-lg shadow-cyan-500/15 cursor-pointer ring-1 ring-cyan-400/50'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 cursor-pointer hover:bg-slate-900/60'
                        }`}
                      >
                        {/* Header: Name, Badge, Lock status */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-white">{def.codename}</span>
                              <span className="text-[10px] text-slate-400">({def.name})</span>
                            </div>
                            <div className="text-[10px] font-semibold text-cyan-400 tracking-wide uppercase">
                              {def.role}
                            </div>
                          </div>

                          <div>
                            {isUnlocked ? (
                              isSelected ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500 text-slate-950">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  ACTIVE
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-500/30">
                                  <Unlock className="w-2.5 h-2.5" />
                                  READY
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-amber-400 bg-amber-950/50 border border-amber-500/30">
                                <Lock className="w-2.5 h-2.5" />
                                LOCKED
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-[11px] text-slate-300 leading-snug mb-2.5">
                          {def.description}
                        </p>

                        {/* Specs Mini-Grid */}
                        <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono bg-slate-900/80 p-2 rounded-lg border border-slate-800/80 mb-2.5">
                          <div>
                            <span className="text-slate-500 block text-[9px]">HULL</span>
                            <span className="text-white font-bold">{def.hull} HP</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px]">SPEED</span>
                            <span className="text-cyan-300 font-bold">{def.speedRating}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px]">WEAPON</span>
                            <span className="text-slate-300 truncate block" title={def.weaponName}>
                              {def.weaponName}
                            </span>
                          </div>
                        </div>

                        {/* Special Ability Box */}
                        <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-800/30 text-[10px] leading-tight">
                          <div className="flex items-center gap-1 font-bold text-cyan-300 mb-0.5">
                            {getSpecialIcon(cls)}
                            <span>Special: {def.specialName}</span>
                            {def.specialCooldown > 0 && (
                              <span className="ml-auto text-cyan-400/80 font-mono text-[9px]">
                                {def.specialCooldown}s CD
                              </span>
                            )}
                          </div>
                          <div className="text-slate-400 text-[10px]">{def.specialDescription}</div>
                        </div>

                        {/* Lock Warning if not unlocked */}
                        {!isUnlocked && (
                          <div className="mt-2.5 pt-2 border-t border-amber-900/40 flex items-center gap-1.5 text-[10px] text-amber-300 font-semibold">
                            <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>{def.unlockCondition}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Computer Players Allowed Ship Types */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Rival Computer Ship Types Pool
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Check which ship types AI players are allowed to be assigned. Each bot picks randomly from your checked pool.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/30">
                    {allowedAiShipClasses.length} Types Allowed
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ALL_SHIP_CLASSES.map((cls) => {
                    const def = SHIP_CLASS_DEFS[cls];
                    const isChecked = allowedAiShipClasses.includes(cls);

                    return (
                      <label
                        key={cls}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200'
                            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:bg-slate-850'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleAiShipClass(cls)}
                          className="w-3.5 h-3.5 rounded text-cyan-500 bg-slate-900 border-slate-700 focus:ring-cyan-500 focus:ring-offset-slate-950 accent-cyan-500 cursor-pointer"
                        />
                        <div className="truncate">
                          <span className="block truncate">{def.codename}</span>
                          <span className="text-[9px] text-slate-500 font-mono block">
                            {cls === 'heavy_frigate' ? 'Flak/Beam' : cls === 'interceptor' ? 'EMP/Rapid' : cls === 'commander' ? 'Drones' : 'Balanced'}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: GALAXY SETUP                                                       */}
          {/* ========================================================================= */}
          {activeTab === 'galaxy' && (
            <div className="space-y-5">
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
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
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
                    Computer Rival Doctrines ({aiPlayerCount} Active)
                  </label>
                  <span className="text-[11px] text-cyan-400 font-mono">
                    Select doctrine per rival
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
                  Strategic Directives:
                </div>
                <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-1">
                  <li>Head for unoccupied space worlds and press <strong>S</strong>, <strong>↓</strong>, or <strong>L</strong> to land and claim territory.</li>
                  <li>Claimed worlds dispatch colony ships that auto-pathfind across space to construct Base, Production Hub, Lab, & Comms Center.</li>
                  <li>Trigger your ship class Special Ability with <strong>E</strong>, <strong>Q</strong>, or <strong>Right Click</strong>!</li>
                </ul>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: CONTROLS & RADAR                                                   */}
          {/* ========================================================================= */}
          {activeTab === 'controls' && (
            <div className="space-y-4">
              {/* Audio & Radar Toggles */}
              <div className="grid grid-cols-2 gap-2.5 pb-2">
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
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
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
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
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span>Flagship:</span>
              <span className="font-bold text-cyan-400">
                {SHIP_CLASS_DEFS[playerShipClass].codename}
              </span>
            </div>

            <div className="flex items-center gap-3">
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
                <span>Launch Campaign</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
