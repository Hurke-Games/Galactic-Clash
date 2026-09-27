import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Star,
  Planet,
  FactionConfig,
  FactionId,
  GameSettings,
  GameStats,
  ShipRadarMarker,
  KeyBindings,
} from './types/game';
import { generateGalaxy } from './utils/galaxyGenerator';
import { sound } from './utils/audio';
import { loadKeyBindings, saveKeyBindings } from './utils/controls';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { NewGameModal } from './components/NewGameModal';
import { SettingsModal } from './components/SettingsModal';
import { GameOverModal } from './components/GameOverModal';
import { Minimap } from './components/Minimap';
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  RotateCcw,
  Shield,
  Crosshair,
  Zap,
  Globe,
  Radio,
  ExternalLink,
  Sliders,
  Terminal,
  Compass,
} from 'lucide-react';

export default function App() {
  const [keyBindings, setKeyBindings] = useState<KeyBindings>(() => loadKeyBindings());
  const [settings, setSettings] = useState<GameSettings>({
    starCount: 6,
    aiPlayerCount: 3,
    aiAggression: 'balanced',
    soundEnabled: true,
    showMinimap: true,
    keyBindings: loadKeyBindings(),
  });

  // Website mode vs full-window arcade mode
  const [isWebsiteMode, setIsWebsiteMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('fullscreen') === 'true') return false;
      return true; // Default to website mode with game embedded
    }
    return true;
  });

  const [factions, setFactions] = useState<FactionConfig[]>([]);
  const [stars, setStars] = useState<Star[]>([]);
  const [planets, setPlanets] = useState<Planet[]>([]);
  const [playerHp, setPlayerHp] = useState<number>(5);
  const [maxPlayerHp, setMaxPlayerHp] = useState<number>(5);
  const [playerBoost, setPlayerBoost] = useState<number>(100);
  const [maxPlayerBoost, setMaxPlayerBoost] = useState<number>(100);
  const [playerBuffs, setPlayerBuffs] = useState<{
    shieldHp: number;
    maxShieldHp: number;
    hasDoubleDamage: boolean;
    hasHomingRockets: boolean;
  }>({
    shieldHp: 0,
    maxShieldHp: 0,
    hasDoubleDamage: false,
    hasHomingRockets: false,
  });

  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [winnerFactionId, setWinnerFactionId] = useState<FactionId>('player');

  const [stats, setStats] = useState<GameStats>({
    elapsedTime: 0,
    shotsFired: 0,
    buildingsDestroyed: 0,
    shipsDestroyed: 0,
    planetsClaimed: 1,
  });

  const shipsRadarRef = useRef<ShipRadarMarker[]>([]);

  // Toggle fullscreen via 'F' shortcut
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        setIsWebsiteMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Manage body scrolling depending on mode
  useEffect(() => {
    if (isWebsiteMode) {
      document.body.classList.remove('overflow-hidden');
      document.body.classList.add('overflow-y-auto');
    } else {
      document.body.classList.remove('overflow-y-auto');
      document.body.classList.add('overflow-hidden');
    }
  }, [isWebsiteMode]);

  const handleUpdateKeyBindings = useCallback((newBindings: KeyBindings) => {
    setKeyBindings(newBindings);
    saveKeyBindings(newBindings);
    setSettings((prev) => ({ ...prev, keyBindings: newBindings }));
  }, []);

  // Track start & reset
  const initGame = useCallback((cfg: GameSettings) => {
    const factionList: FactionConfig[] = [
      {
        id: 'player',
        name: 'Terran Vanguard',
        isHuman: true,
        color: '#38bdf8', // Cyan
        accentColor: '#0284c7',
        glowColor: 'rgba(56, 189, 248, 0.4)',
        shipColor: '#38bdf8',
      },
    ];

    const botColors = [
      {
        id: 'bot_1' as FactionId,
        name: 'Crimson Syndicate',
        color: '#f43f5e', // Crimson Red
        accentColor: '#be123c',
        glowColor: 'rgba(244, 63, 94, 0.4)',
        shipColor: '#f43f5e',
      },
      {
        id: 'bot_2' as FactionId,
        name: 'Verdant Dominion',
        color: '#10b981', // Emerald Green
        accentColor: '#047857',
        glowColor: 'rgba(16, 185, 129, 0.4)',
        shipColor: '#10b981',
      },
      {
        id: 'bot_3' as FactionId,
        name: 'Void Enclave',
        color: '#a855f7', // Purple
        accentColor: '#7e22ce',
        glowColor: 'rgba(168, 85, 247, 0.4)',
        shipColor: '#a855f7',
      },
    ];

    for (let i = 0; i < cfg.aiPlayerCount; i++) {
      const b = botColors[i];
      const style = cfg.aiStyles?.[i] || cfg.aiAggression || 'balanced';
      factionList.push({
        ...b,
        isHuman: false,
        aggression: style,
      });
    }

    setFactions(factionList);

    // Generate Galaxy
    const { stars: newStars } = generateGalaxy(cfg.starCount, factionList);
    setStars(newStars);

    // Flatten all planets
    const allPlanets: Planet[] = [];
    newStars.forEach((s) => s.planets.forEach((p) => allPlanets.push(p)));
    setPlanets(allPlanets);

    // Reset stats
    setStats({
      elapsedTime: 0,
      shotsFired: 0,
      buildingsDestroyed: 0,
      shipsDestroyed: 0,
      planetsClaimed: 1,
    });
    setPlayerHp(5);
    setMaxPlayerHp(5);
    setIsGameOver(false);
    setIsPaused(false);
    setIsNewGameModalOpen(false);
    sound.enabled = cfg.soundEnabled;
  }, []);

  // Initialize on mount
  useEffect(() => {
    initGame(settings);
  }, [initGame, settings]);

  const handleUpdateStats = useCallback((delta: Partial<GameStats>) => {
    setStats((prev) => ({
      ...prev,
      elapsedTime: prev.elapsedTime + (delta.elapsedTime || 0),
      shotsFired: prev.shotsFired + (delta.shotsFired || 0),
      buildingsDestroyed: prev.buildingsDestroyed + (delta.buildingsDestroyed || 0),
      shipsDestroyed: prev.shipsDestroyed + (delta.shipsDestroyed || 0),
      planetsClaimed: prev.planetsClaimed + (delta.planetsClaimed || 0),
    }));
  }, []);

  const handleGameOver = useCallback((winnerId: FactionId) => {
    setWinnerFactionId(winnerId);
    setIsGameOver(true);
    if (winnerId === 'player') {
      sound.playVictory();
    } else {
      sound.playExplosion(true);
    }
  }, []);

  const handlePlayerHpChange = useCallback((hp: number, maxHp: number) => {
    setPlayerHp(hp);
    setMaxPlayerHp(maxHp);
  }, []);

  const handlePlanetsChange = useCallback((newPlanets: Planet[]) => {
    setPlanets(newPlanets);
  }, []);

  const handleToggleSound = useCallback(() => {
    const next = !settings.soundEnabled;
    sound.enabled = next;
    setSettings((s) => ({ ...s, soundEnabled: next }));
  }, [settings.soundEnabled]);

  const handleTogglePause = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

  const handlePlayerBoostChange = useCallback((boost: number, maxBoost: number) => {
    setPlayerBoost(boost);
    setMaxPlayerBoost(maxBoost);
  }, []);

  const handlePlayerBuffsChange = useCallback(
    (buffs: {
      shieldHp: number;
      maxShieldHp: number;
      hasDoubleDamage: boolean;
      hasHomingRockets: boolean;
    }) => {
      setPlayerBuffs(buffs);
    },
    []
  );

  const handleTouchAction = (action: 'thrust' | 'reverse' | 'left' | 'right' | 'shoot' | 'land' | 'boost', isDown: boolean) => {
    const codeMap = {
      thrust: 'KeyW',
      reverse: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      shoot: 'Space',
      land: 'KeyL',
      boost: 'ControlLeft',
    };
    const code = codeMap[action];
    const eventType = isDown ? 'keydown' : 'keyup';
    window.dispatchEvent(
      new KeyboardEvent(eventType, {
        code,
        key: action === 'boost' ? 'Control' : undefined,
        ctrlKey: action === 'boost' && isDown,
      })
    );
  };

  // Reusable game canvas viewport
  const renderGameCanvasView = (isEmbedded: boolean) => (
    <div className={`relative w-full ${isEmbedded ? 'h-full' : 'h-screen'} overflow-hidden bg-slate-950 font-sans select-none`}>
      {/* 2D Canvas Engine */}
      {stars.length > 0 && factions.length > 0 && (
        <GameCanvas
          stars={stars}
          factions={factions}
          settings={settings}
          onUpdateStats={handleUpdateStats}
          onGameOver={handleGameOver}
          onPlayerHpChange={handlePlayerHpChange}
          onPlayerBoostChange={handlePlayerBoostChange}
          onPlayerBuffsChange={handlePlayerBuffsChange}
          onPlanetsChange={handlePlanetsChange}
          isPaused={isPaused || isGameOver || isNewGameModalOpen || isSettingsModalOpen}
          shipsRadarRef={shipsRadarRef}
          keyBindings={keyBindings}
        />
      )}

      {/* Main HUD */}
      {factions.length > 0 && (
        <HUD
          playerHp={playerHp}
          maxPlayerHp={maxPlayerHp}
          playerBoost={playerBoost}
          maxPlayerBoost={maxPlayerBoost}
          playerBuffs={playerBuffs}
          factions={factions}
          planets={planets}
          stats={stats}
          soundEnabled={settings.soundEnabled}
          isPaused={isPaused}
          onToggleSound={handleToggleSound}
          onTogglePause={handleTogglePause}
          onNewGameClick={() => setIsNewGameModalOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          keyBindings={keyBindings}
        />
      )}

      {/* Tactical Radar Minimap */}
      {settings.showMinimap && stars.length > 0 && (
        <Minimap
          stars={stars}
          planets={planets}
          factions={factions}
          shipsRadarRef={shipsRadarRef}
        />
      )}

      {/* Touch / On-Screen Controls for mobile / touchpads */}
      <div className="md:hidden pointer-events-auto absolute bottom-24 left-4 flex flex-col gap-2 z-20">
        <div className="flex gap-2">
          <button
            onTouchStart={() => handleTouchAction('left', true)}
            onTouchEnd={() => handleTouchAction('left', false)}
            onMouseDown={() => handleTouchAction('left', true)}
            onMouseUp={() => handleTouchAction('left', false)}
            className="w-12 h-12 rounded-xl bg-slate-900/80 border border-slate-700 active:bg-cyan-500 active:text-slate-950 text-white font-bold text-lg flex items-center justify-center shadow-lg"
          >
            ←
          </button>
          <button
            onTouchStart={() => handleTouchAction('thrust', true)}
            onTouchEnd={() => handleTouchAction('thrust', false)}
            onMouseDown={() => handleTouchAction('thrust', true)}
            onMouseUp={() => handleTouchAction('thrust', false)}
            className="w-12 h-12 rounded-xl bg-slate-900/80 border border-slate-700 active:bg-cyan-500 active:text-slate-950 text-white font-bold text-lg flex items-center justify-center shadow-lg"
          >
            ▲
          </button>
          <button
            onTouchStart={() => handleTouchAction('right', true)}
            onTouchEnd={() => handleTouchAction('right', false)}
            onMouseDown={() => handleTouchAction('right', true)}
            onMouseUp={() => handleTouchAction('right', false)}
            className="w-12 h-12 rounded-xl bg-slate-900/80 border border-slate-700 active:bg-cyan-500 active:text-slate-950 text-white font-bold text-lg flex items-center justify-center shadow-lg"
          >
            →
          </button>
        </div>
      </div>

      <div className="md:hidden pointer-events-auto absolute bottom-24 right-4 flex items-center gap-2 z-20">
        <button
          onTouchStart={() => handleTouchAction('boost', true)}
          onTouchEnd={() => handleTouchAction('boost', false)}
          onMouseDown={() => handleTouchAction('boost', true)}
          onMouseUp={() => handleTouchAction('boost', false)}
          className="w-12 h-14 rounded-2xl bg-amber-600 active:bg-amber-500 text-white font-bold text-xs flex flex-col items-center justify-center shadow-xl border border-amber-400"
        >
          <span>BOOST</span>
          <span className="text-[9px] opacity-85">2X</span>
        </button>
        <button
          onTouchStart={() => handleTouchAction('land', true)}
          onTouchEnd={() => handleTouchAction('land', false)}
          onMouseDown={() => handleTouchAction('land', true)}
          onMouseUp={() => handleTouchAction('land', false)}
          className="w-12 h-14 rounded-2xl bg-cyan-600 active:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center shadow-xl border border-cyan-400"
        >
          LAND
        </button>
        <button
          onTouchStart={() => handleTouchAction('shoot', true)}
          onTouchEnd={() => handleTouchAction('shoot', false)}
          onMouseDown={() => handleTouchAction('shoot', true)}
          onMouseUp={() => handleTouchAction('shoot', false)}
          className="w-14 h-14 rounded-2xl bg-rose-600 active:bg-rose-500 text-white font-bold text-sm flex items-center justify-center shadow-xl border border-rose-400"
        >
          FIRE
        </button>
      </div>
    </div>
  );

  return (
    <>
      {isWebsiteMode ? (
        /* ========================================================================= */
        /* WEBSITE MODE: High-Production Landing Page with Embedded Game Engine      */
        /* ========================================================================= */
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30">
          {/* Top Navbar */}
          <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-cyan-900/40 px-4 lg:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-sky-400 flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.5)] border border-cyan-300/40">
                <Compass className="w-5 h-5 text-slate-950 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold tracking-wider text-base lg:text-lg text-white">
                    GALACTIC<span className="text-cyan-400">CLASH</span>
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono tracking-widest bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    ONLINE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">Tactical 4X Real-Time Space Conquest</p>
              </div>
            </div>

            <div className="flex items-center gap-2 lg:gap-3">
              <button
                onClick={handleToggleSound}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
                title={settings.soundEnabled ? 'Mute Audio' : 'Enable Audio'}
              >
                {settings.soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
              </button>

              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
                title="Game Settings & Keybinds"
              >
                <Sliders className="w-4 h-4 text-slate-300" />
              </button>

              <button
                onClick={() => setIsNewGameModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 text-xs font-medium transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                <span>New Campaign</span>
              </button>

              <button
                onClick={() => setIsWebsiteMode(false)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-sky-500 hover:from-cyan-500 hover:to-sky-400 text-slate-950 font-bold text-xs tracking-wide shadow-[0_0_20px_rgba(56,189,248,0.35)] transition-all"
              >
                <Maximize2 className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>PLAY FULLSCREEN</span>
                <span className="hidden md:inline text-[10px] opacity-75 font-mono ml-0.5">[F]</span>
              </button>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 flex flex-col gap-8">
            {/* Quick Hero Banner */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest mb-1">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Sector Command Operational • Ready for Launch</span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-white">
                  Conquer Star Systems. Annihilate Hostile Fleets.
                </h1>
                <p className="text-slate-400 text-sm max-w-2xl mt-1">
                  Fly through procedurally generated solar systems, establish orbital defenses, command colony fleets, and dominate the galaxy against AI factions.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
                  WASD / Arrows = Flight
                </span>
                <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
                  Space = Fire
                </span>
                <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-cyan-400">
                  L = Land
                </span>
              </div>
            </div>

            {/* Embedded Game Viewport */}
            <div className="relative rounded-2xl border border-cyan-500/40 bg-slate-950 shadow-[0_0_50px_rgba(6,182,212,0.12)] overflow-hidden">
              {/* Cockpit Frame Header */}
              <div className="bg-slate-900/90 border-b border-cyan-900/40 px-4 py-2 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2 text-slate-300">
                  <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <span className="text-cyan-400 font-semibold">TACTICAL HUD VIEWPORT</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400 hidden sm:inline">PROCEED WITH WASD / SPACE</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400 hidden md:inline">Click inside canvas to control</span>
                  <button
                    onClick={() => setIsWebsiteMode(false)}
                    className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-xs font-semibold py-0.5 px-2 rounded bg-cyan-950/60 border border-cyan-500/30 hover:bg-cyan-900/60 transition-colors"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Expand [F]</span>
                  </button>
                </div>
              </div>

              {/* Game Viewport Container (75vh height) */}
              <div className="h-[74vh] min-h-[540px] max-h-[820px] w-full relative">
                {renderGameCanvasView(true)}
              </div>
            </div>

            {/* Field Manual / Tactical Intel Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Flight & Weapons */}
              <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/90 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
                  <Crosshair className="w-4 h-4" />
                  <span>FLIGHT & COMBAT MATRIX</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-2 leading-relaxed font-sans">
                  <li>
                    <strong className="text-white">WASD / Arrow Keys:</strong> Newtonian inertia physics. Tap reverse to decelerate or stabilize.
                  </li>
                  <li>
                    <strong className="text-white">Spacebar:</strong> Twin high-frequency plasma blasters with continuous firing.
                  </li>
                  <li>
                    <strong className="text-white">Left Control:</strong> Afterburner boost providing 2X top-speed surge (regenerates over time).
                  </li>
                  <li>
                    <strong className="text-white">Key [L]:</strong> Land on any planet when in proximity to colonize or repair.
                  </li>
                </ul>
              </div>

              {/* Card 2: Planetary Infrastructure */}
              <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/90 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <Globe className="w-4 h-4" />
                  <span>PLANETARY INFRASTRUCTURE</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-2 leading-relaxed font-sans">
                  <li>
                    <strong className="text-white">Shipyards:</strong> Automatically construct and deploy autonomous colony and assault fleets.
                  </li>
                  <li>
                    <strong className="text-white">Defense Turrets:</strong> Surface-to-orbit kinetic batteries that track and obliterate hostile invaders.
                  </li>
                  <li>
                    <strong className="text-white">Ore Refineries:</strong> Generate credits and synthesize energy shield / damage overchargers.
                  </li>
                  <li>
                    <strong className="text-white">Conquest:</strong> Destroy enemy orbital installations to convert the planet to your faction.
                  </li>
                </ul>
              </div>

              {/* Card 3: Factions & Lore */}
              <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/90 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
                  <Shield className="w-4 h-4" />
                  <span>RIVAL AI FACTIONS</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-1.5 rounded bg-slate-950/60 border border-cyan-900/40">
                    <span className="text-cyan-400 font-bold">Terran Vanguard (Player)</span>
                    <span className="text-[10px] text-slate-400 font-mono">Cyan Agility</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-slate-950/60 border border-rose-900/40">
                    <span className="text-rose-400 font-bold">Crimson Syndicate</span>
                    <span className="text-[10px] text-slate-400 font-mono">Aggressive Raiders</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-slate-950/60 border border-emerald-900/40">
                    <span className="text-emerald-400 font-bold">Verdant Dominion</span>
                    <span className="text-[10px] text-slate-400 font-mono">Rapid Expansion</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-slate-950/60 border border-purple-900/40">
                    <span className="text-purple-400 font-bold">Void Enclave</span>
                    <span className="text-[10px] text-slate-400 font-mono">Orbital Fortresses</span>
                  </div>
                </div>
              </div>
            </div>

            {/* GitHub Pages Deployment Info */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Direct GitHub Pages Deployment</h4>
                  <p className="text-xs text-slate-400">
                    Hosted at <code className="text-cyan-400 font-mono">https://hurke-games.github.io/Galactic-Clash/</code> with zero server dependencies.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="https://github.com/hurke-games/Galactic-Clash"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 border border-slate-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                  <span>GitHub Repository</span>
                </a>
              </div>
            </div>
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-800/80 py-6 px-4 text-center text-xs text-slate-500 font-mono">
            <p>Galactic Clash • Built by hurke-games • Real-time 4X Tactical Space Conquest</p>
            <p className="mt-1 text-[11px] text-slate-600">Pure Canvas 2D Vector Rendering • Synthesized Web Audio</p>
          </footer>
        </div>
      ) : (
        /* ========================================================================= */
        /* FULLSCREEN ARCADE MODE: Edge-to-Edge 100vw x 100vh Tactical Immersion     */
        /* ========================================================================= */
        <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
          {renderGameCanvasView(false)}

          {/* Floating Button to Switch back to Website View */}
          <button
            onClick={() => setIsWebsiteMode(true)}
            title="Exit Fullscreen & View Field Manual [F]"
            className="absolute top-3 right-3 z-40 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-cyan-500/40 backdrop-blur-md text-xs font-mono flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all"
          >
            <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Website View [F]</span>
          </button>
        </div>
      )}

      {/* Global Modals */}
      <NewGameModal
        isOpen={isNewGameModalOpen}
        onStartGame={(newCfg) => {
          setSettings(newCfg);
          initGame(newCfg);
        }}
        onClose={() => setIsNewGameModalOpen(false)}
        keyBindings={keyBindings}
        onUpdateKeyBindings={handleUpdateKeyBindings}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        keyBindings={keyBindings}
        onUpdateKeyBindings={handleUpdateKeyBindings}
      />

      <GameOverModal
        isOpen={isGameOver}
        winnerFactionId={winnerFactionId}
        factions={factions}
        stats={stats}
        onPlayAgain={() => initGame(settings)}
      />
    </>
  );
}
