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

  const handleUpdateKeyBindings = useCallback((newBindings: KeyBindings) => {
    setKeyBindings(newBindings);
    saveKeyBindings(newBindings);
    setSettings((prev) => ({ ...prev, keyBindings: newBindings }));
  }, []);

  // Track start & reset
  const initGame = useCallback((cfg: GameSettings) => {
    // Generate Factions
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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
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

      {/* New Game Setup Modal */}
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

      {/* In-Game Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        keyBindings={keyBindings}
        onUpdateKeyBindings={handleUpdateKeyBindings}
      />

      {/* Game Over Screen */}
      <GameOverModal
        isOpen={isGameOver}
        winnerFactionId={winnerFactionId}
        factions={factions}
        stats={stats}
        onPlayAgain={() => initGame(settings)}
      />
    </div>
  );
}
