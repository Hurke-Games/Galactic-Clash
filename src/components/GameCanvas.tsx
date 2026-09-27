import React, { useEffect, useRef, useCallback } from 'react';
import {
  Star,
  Planet,
  Ship,
  Projectile,
  Particle,
  Explosion,
  FactionConfig,
  FactionId,
  GameSettings,
  GameStats,
  ShipRadarMarker,
  ColonyShip,
  KeyBindings,
  DEFAULT_KEY_BINDINGS,
} from '../types/game';
import { distance, angleBetween, getBuildingWorldPos, shortestAngleDiff } from '../utils/physics';
import { updateAIShip } from '../utils/aiController';
import { sound } from '../utils/audio';
import { matchesBinding, formatKeyCode } from '../utils/controls';

interface GameCanvasProps {
  stars: Star[];
  factions: FactionConfig[];
  settings: GameSettings;
  onUpdateStats: (stats: Partial<GameStats>) => void;
  onGameOver: (winnerFactionId: FactionId) => void;
  onPlayerHpChange: (hp: number, maxHp: number) => void;
  onPlayerBoostChange?: (boost: number, maxBoost: number) => void;
  onPlayerBuffsChange?: (buffs: {
    shieldHp: number;
    maxShieldHp: number;
    hasDoubleDamage: boolean;
    hasHomingRockets: boolean;
  }) => void;
  onPlanetsChange: (planets: Planet[]) => void;
  isPaused: boolean;
  shipsRadarRef?: React.MutableRefObject<ShipRadarMarker[]>;
  keyBindings?: KeyBindings;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  stars,
  factions,
  settings,
  onUpdateStats,
  onGameOver,
  onPlayerHpChange,
  onPlayerBoostChange,
  onPlayerBuffsChange,
  onPlanetsChange,
  isPaused,
  shipsRadarRef,
  keyBindings,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const keyBindingsRef = useRef<KeyBindings>(keyBindings || settings.keyBindings || DEFAULT_KEY_BINDINGS);
  useEffect(() => {
    keyBindingsRef.current = keyBindings || settings.keyBindings || DEFAULT_KEY_BINDINGS;
  }, [keyBindings, settings.keyBindings]);

  // Store callback props in refs to avoid triggering re-runs of useEffect
  const onPlayerHpChangeRef = useRef(onPlayerHpChange);
  const onPlayerBoostChangeRef = useRef(onPlayerBoostChange);
  const onPlayerBuffsChangeRef = useRef(onPlayerBuffsChange);
  const onUpdateStatsRef = useRef(onUpdateStats);
  const onGameOverRef = useRef(onGameOver);
  const onPlanetsChangeRef = useRef(onPlanetsChange);

  useEffect(() => {
    onPlayerHpChangeRef.current = onPlayerHpChange;
    onPlayerBoostChangeRef.current = onPlayerBoostChange;
    onPlayerBuffsChangeRef.current = onPlayerBuffsChange;
    onUpdateStatsRef.current = onUpdateStats;
    onGameOverRef.current = onGameOver;
    onPlanetsChangeRef.current = onPlanetsChange;
  });

  const floatingTextsRef = useRef<{ id: string; x: number; y: number; text: string; color: string; alpha: number; lifespan: number }[]>([]);

  // Keyboard input states
  const keysRef = useRef<{
    thrust: boolean;
    reverse: boolean;
    left: boolean;
    right: boolean;
    shoot: boolean;
    land: boolean;
    boost: boolean;
  }>({
    thrust: false,
    reverse: false,
    left: false,
    right: false,
    shoot: false,
    land: false,
    boost: false,
  });

  // Camera state
  const cameraRef = useRef<{
    x: number;
    y: number;
    zoom: number;
    targetZoom: number;
  }>({
    x: 0,
    y: 0,
    zoom: 0.85,
    targetZoom: 0.85,
  });

  // Game entities state refs
  const shipsRef = useRef<Ship[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const starsRef = useRef<Star[]>(stars);
  const shootKeyWasPressedRef = useRef<boolean>(false);
  const landKeyWasPressedRef = useRef<boolean>(false);
  const gameOverTriggeredRef = useRef<boolean>(false);
  const lastPlanetsReportTimeRef = useRef<number>(0);

  // Nearby planet that player can land on (for HUD prompt)
  const playerLandablePlanetRef = useRef<Planet | null>(null);

  // Flattened planets for quick lookup
  const getAllPlanets = useCallback((): Planet[] => {
    const list: Planet[] = [];
    for (const s of starsRef.current) {
      for (const p of s.planets) {
        list.push(p);
      }
    }
    return list;
  }, []);

  // Initialize ships on the edge of the world they own in 'landed' state
  // Only runs when stars change (new game)
  useEffect(() => {
    starsRef.current = stars;
    const initialShips: Ship[] = [];
    const allPlanets = getAllPlanets();

    factions.forEach((faction, idx) => {
      const homePlanet = allPlanets.find((p) => p.ownerId === faction.id);
      const spawnAngle = (idx * Math.PI) / 2 + Math.PI / 4;
      const startX = homePlanet
        ? homePlanet.x + Math.cos(spawnAngle) * (homePlanet.radius + 6)
        : 0;
      const startY = homePlanet
        ? homePlanet.y + Math.sin(spawnAngle) * (homePlanet.radius + 6)
        : 0;

      initialShips.push({
        id: `ship_${faction.id}`,
        ownerId: faction.id,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        angle: spawnAngle, // facing outward into space
        thrusting: false,
        hp: 5,
        maxHp: 5,
        fireCooldown: 0,
        respawnTimer: 0,
        isDead: false,
        lastLandedPlanetId: homePlanet ? homePlanet.id : null,
        kills: 0,
        deaths: 0,
        planetsColonized: homePlanet ? 1 : 0,
        boost: 100,
        maxBoost: 100,
        boosting: false,
        shieldHp: 0,
        maxShieldHp: 0,
        hasDoubleDamage: false,
        hasHomingRockets: false,
        flightState: 'landed',
        landedPlanetId: homePlanet ? homePlanet.id : null,
        surfaceAngle: spawnAngle,
        transitionProgress: 0,
        aiLaunchTimer: 0.6 + idx * 0.4, // Bots launch staggered within 0.6s to 1.8s
        homeStarId: homePlanet ? homePlanet.starId : null,
      });
    });

    shipsRef.current = initialShips;
    projectilesRef.current = [];
    particlesRef.current = [];
    explosionsRef.current = [];
    gameOverTriggeredRef.current = false;

    // Center camera on player
    const playerShip = initialShips.find((s) => s.ownerId === 'player');
    if (playerShip) {
      cameraRef.current.x = playerShip.x;
      cameraRef.current.y = playerShip.y;
      onPlayerHpChangeRef.current(playerShip.hp, playerShip.maxHp);
      if (onPlayerBoostChangeRef.current) {
        onPlayerBoostChangeRef.current(playerShip.boost, playerShip.maxBoost);
      }
      if (onPlayerBuffsChangeRef.current) {
        onPlayerBuffsChangeRef.current({
          shieldHp: playerShip.shieldHp,
          maxShieldHp: playerShip.maxShieldHp,
          hasDoubleDamage: playerShip.hasDoubleDamage,
          hasHomingRockets: playerShip.hasHomingRockets,
        });
      }
    }
  }, [stars, factions, getAllPlanets]);

  // Keyboard handlers: Dynamic bindings with S, Down Arrow, and L for landing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const bindings = keyBindingsRef.current;
      const isUp = matchesBinding(e, bindings.thrust);
      const isDown = matchesBinding(e, bindings.reverse);
      const isLeft = matchesBinding(e, bindings.turnLeft);
      const isRight = matchesBinding(e, bindings.turnRight);
      const isShoot = matchesBinding(e, bindings.shoot) || e.code === 'KeyF' || e.code === 'Space';
      const isLand = matchesBinding(e, bindings.land);

      if (isUp) keysRef.current.thrust = true;
      if (isDown) keysRef.current.reverse = true;
      if (isLeft) keysRef.current.left = true;
      if (isRight) keysRef.current.right = true;
      if (isShoot) {
        keysRef.current.shoot = true;
      }
      if (isLand) {
        if (!landKeyWasPressedRef.current) {
          keysRef.current.land = true;
        }
        landKeyWasPressedRef.current = true;
      }
      if (e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight' || e.ctrlKey) {
        keysRef.current.boost = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const bindings = keyBindingsRef.current;
      const isUp = matchesBinding(e, bindings.thrust);
      const isDown = matchesBinding(e, bindings.reverse);
      const isLeft = matchesBinding(e, bindings.turnLeft);
      const isRight = matchesBinding(e, bindings.turnRight);
      const isShoot = matchesBinding(e, bindings.shoot) || e.code === 'KeyF' || e.code === 'Space';
      const isLand = matchesBinding(e, bindings.land);

      if (isUp) keysRef.current.thrust = false;
      if (isDown) keysRef.current.reverse = false;
      if (isLeft) keysRef.current.left = false;
      if (isRight) keysRef.current.right = false;
      if (isShoot) {
        keysRef.current.shoot = false;
        shootKeyWasPressedRef.current = false;
      }
      if (isLand) {
        keysRef.current.land = false;
        landKeyWasPressedRef.current = false;
      }
      if (e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
        keysRef.current.boost = false;
      }
    };

    const handleBlur = () => {
      keysRef.current = {
        thrust: false,
        reverse: false,
        left: false,
        right: false,
        shoot: false,
        land: false,
        boost: false,
      };
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomDelta = e.deltaY < 0 ? 0.1 : -0.1;
      cameraRef.current.targetZoom = Math.max(0.35, Math.min(1.4, cameraRef.current.targetZoom + zoomDelta));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      if (canvas) {
        canvas.removeEventListener('wheel', handleWheel);
      }
    };
  }, []);

  // Helper to spawn explosion
  const createExplosion = (x: number, y: number, color: string, radius: number = 28, heavy: boolean = false) => {
    explosionsRef.current.push({
      id: Math.random().toString(),
      x,
      y,
      radius: 4,
      maxRadius: radius,
      color,
      duration: 0.45,
      elapsed: 0,
    });

    const count = heavy ? 25 : 12;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * (heavy ? 180 : 100);
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 2 + Math.random() * (heavy ? 4 : 2.5),
        alpha: 1,
        decay: 1.2 + Math.random() * 0.8,
        lifespan: 0,
      });
    }

    sound.playExplosion(heavy);
  };

  // Helper to add floating combat and buff text
  const addFloatingText = (x: number, y: number, text: string, color: string) => {
    floatingTextsRef.current.push({
      id: `toast_${Date.now()}_${Math.random()}`,
      x,
      y,
      text,
      color,
      alpha: 1,
      lifespan: 2.2,
    });
  };

  // Buff roll helper with exact probabilities:
  // - 50% chance: no upgrade
  // - 10% chance: a shield with 25 hp
  // - 10% chance: double damage
  // - 10% chance: homing rockets
  // - 10% chance: homing rockets and double damage
  // - 10% chance: a shield, homing rockets, and double damage
  const rollShipBuff = (ship: Ship, reason: 'death' | 'colonized_landing') => {
    const roll = Math.random();
    let buffLabel = '';
    let isBuff = false;

    if (roll < 0.50) {
      // 50% chance: No upgrade
      ship.shieldHp = 0;
      ship.maxShieldHp = 0;
      ship.hasDoubleDamage = false;
      ship.hasHomingRockets = false;
      buffLabel = 'No upgrade (50%)';
      isBuff = false;
    } else if (roll < 0.60) {
      // 10% chance: a shield with 25 hp
      ship.shieldHp = 25;
      ship.maxShieldHp = 25;
      ship.hasDoubleDamage = false;
      ship.hasHomingRockets = false;
      buffLabel = '🛡️ +25 HP SHIELD';
      isBuff = true;
    } else if (roll < 0.70) {
      // 10% chance: double damage
      ship.shieldHp = 0;
      ship.maxShieldHp = 0;
      ship.hasDoubleDamage = true;
      ship.hasHomingRockets = false;
      buffLabel = '⚡ 2X DOUBLE DAMAGE';
      isBuff = true;
    } else if (roll < 0.80) {
      // 10% chance: homing rockets
      ship.shieldHp = 0;
      ship.maxShieldHp = 0;
      ship.hasDoubleDamage = false;
      ship.hasHomingRockets = true;
      buffLabel = '🚀 HOMING ROCKETS';
      isBuff = true;
    } else if (roll < 0.90) {
      // 10% chance: homing rockets and double damage
      ship.shieldHp = 0;
      ship.maxShieldHp = 0;
      ship.hasDoubleDamage = true;
      ship.hasHomingRockets = true;
      buffLabel = '🚀⚡ ROCKETS + 2X DAMAGE';
      isBuff = true;
    } else {
      // 10% chance: a shield, homing rockets, and double damage
      ship.shieldHp = 25;
      ship.maxShieldHp = 25;
      ship.hasDoubleDamage = true;
      ship.hasHomingRockets = true;
      buffLabel = '🌟 SHIELD + ROCKETS + 2X DAMAGE!';
      isBuff = true;
    }

    if (ship.ownerId === 'player') {
      if (onPlayerBuffsChangeRef.current) {
        onPlayerBuffsChangeRef.current({
          shieldHp: ship.shieldHp,
          maxShieldHp: ship.maxShieldHp,
          hasDoubleDamage: ship.hasDoubleDamage,
          hasHomingRockets: ship.hasHomingRockets,
        });
      }

      if (isBuff) {
        sound.playPowerup(roll >= 0.90);
        addFloatingText(ship.x, ship.y - 28, buffLabel, '#38bdf8');
      } else {
        addFloatingText(ship.x, ship.y - 28, 'No upgrade (50%)', '#94a3b8');
      }
    } else if (isBuff) {
      // Show tag over bot ship
      addFloatingText(ship.x, ship.y - 28, buffLabel, '#c084fc');
    }
  };

  // Helper to find the best candidate hostile target for homing rockets:
  // Targets installations on a planet (buildings), space stations, colony ships, and enemy ships!
  const findNearestHomingTarget = (
    fromX: number,
    fromY: number,
    fromAngle: number,
    ownerId: FactionId,
    allPlanets: Planet[],
    maxRange: number = 1300
  ): {
    type: 'ship' | 'building' | 'space_station' | 'colony_ship';
    id: string;
    planetId?: string;
    x: number;
    y: number;
  } | null => {
    let bestTarget: {
      type: 'ship' | 'building' | 'space_station' | 'colony_ship';
      id: string;
      planetId?: string;
      x: number;
      y: number;
    } | null = null;
    let bestScore = Infinity;

    // 1. Hostile Ships
    for (const s of shipsRef.current) {
      if (!s.isDead && s.ownerId !== ownerId) {
        const d = distance(fromX, fromY, s.x, s.y);
        if (d < maxRange) {
          const toAngle = angleBetween(fromX, fromY, s.x, s.y);
          const angleDiff = Math.abs(shortestAngleDiff(fromAngle, toAngle));
          const score = d * (1.0 + 0.35 * (angleDiff / Math.PI));
          if (score < bestScore) {
            bestScore = score;
            bestTarget = { type: 'ship', id: s.id, x: s.x, y: s.y };
          }
        }
      }
    }

    // 2. Hostile Planet Installations & Buildings
    for (const p of allPlanets) {
      if (p.ownerId && p.ownerId !== ownerId) {
        for (const bld of p.buildings) {
          if (bld.hp > 0) {
            const bPos = getBuildingWorldPos(p.x, p.y, p.radius, bld.angleOnPlanet);
            const d = distance(fromX, fromY, bPos.x, bPos.y);
            if (d < maxRange) {
              const toAngle = angleBetween(fromX, fromY, bPos.x, bPos.y);
              const angleDiff = Math.abs(shortestAngleDiff(fromAngle, toAngle));
              const score = d * (1.0 + 0.35 * (angleDiff / Math.PI));
              if (score < bestScore) {
                bestScore = score;
                bestTarget = { type: 'building', id: bld.id, planetId: p.id, x: bPos.x, y: bPos.y };
              }
            }
          }
        }
      }

      // 3. Hostile Space Stations
      if (p.spaceStation && p.spaceStation.ownerId !== ownerId && p.spaceStation.hp > 0) {
        const st = p.spaceStation;
        const stX = p.x + Math.cos(st.angle) * st.distance;
        const stY = p.y + Math.sin(st.angle) * st.distance;
        const d = distance(fromX, fromY, stX, stY);
        if (d < maxRange) {
          const toAngle = angleBetween(fromX, fromY, stX, stY);
          const angleDiff = Math.abs(shortestAngleDiff(fromAngle, toAngle));
          const score = d * (1.0 + 0.35 * (angleDiff / Math.PI));
          if (score < bestScore) {
            bestScore = score;
            bestTarget = { type: 'space_station', id: st.id, planetId: p.id, x: stX, y: stY };
          }
        }
      }

      // 4. Hostile Colony Ships
      for (const cs of p.colonyShips) {
        if (cs.ownerId !== ownerId && cs.hp > 0) {
          const d = distance(fromX, fromY, cs.x, cs.y);
          if (d < maxRange) {
            const toAngle = angleBetween(fromX, fromY, cs.x, cs.y);
            const angleDiff = Math.abs(shortestAngleDiff(fromAngle, toAngle));
            const score = d * (1.0 + 0.35 * (angleDiff / Math.PI));
            if (score < bestScore) {
              bestScore = score;
              bestTarget = { type: 'colony_ship', id: cs.id, planetId: p.id, x: cs.x, y: cs.y };
            }
          }
        }
      }
    }

    return bestTarget;
  };

  // Helper to locate active position of a homing missile's current target
  const getHomingTargetPosition = (
    proj: Projectile,
    allPlanets: Planet[]
  ): { x: number; y: number } | null => {
    if (!proj.homingTargetId || !proj.homingTargetType) return null;

    if (proj.homingTargetType === 'ship') {
      const s = shipsRef.current.find((ship) => ship.id === proj.homingTargetId && !ship.isDead);
      if (s && s.ownerId !== proj.ownerId) {
        return { x: s.x, y: s.y };
      }
    } else if (proj.homingTargetType === 'building') {
      const p = allPlanets.find((planet) => planet.id === proj.homingPlanetId);
      if (p && p.ownerId && p.ownerId !== proj.ownerId) {
        const bld = p.buildings.find((b) => b.id === proj.homingTargetId && b.hp > 0);
        if (bld) {
          return getBuildingWorldPos(p.x, p.y, p.radius, bld.angleOnPlanet);
        }
      }
    } else if (proj.homingTargetType === 'space_station') {
      const p = allPlanets.find((planet) => planet.id === proj.homingPlanetId);
      if (p && p.spaceStation && p.spaceStation.ownerId !== proj.ownerId && p.spaceStation.hp > 0) {
        const st = p.spaceStation;
        return {
          x: p.x + Math.cos(st.angle) * st.distance,
          y: p.y + Math.sin(st.angle) * st.distance,
        };
      }
    } else if (proj.homingTargetType === 'colony_ship') {
      for (const p of allPlanets) {
        const cs = p.colonyShips.find((c) => c.id === proj.homingTargetId && c.hp > 0);
        if (cs && cs.ownerId !== proj.ownerId) {
          return { x: cs.x, y: cs.y };
        }
      }
    }

    return null;
  };

  // Helper to spawn ship projectile straight out the front (with Double Damage & Homing Rockets)
  const fireShipProjectile = (ship: Ship, faction: FactionConfig) => {
    const noseDist = 9; // Scaled for half-size ship
    const px = ship.x + Math.cos(ship.angle) * noseDist;
    const py = ship.y + Math.sin(ship.angle) * noseDist;
    const projSpeed = 260; // Half speed (was 520)

    const baseDamage = ship.hasDoubleDamage ? 2 : 1;
    const laserColor = ship.hasDoubleDamage ? '#f59e0b' : faction.shipColor;

    projectilesRef.current.push({
      id: `proj_${Math.random()}`,
      ownerId: ship.ownerId,
      sourceType: 'ship',
      x: px,
      y: py,
      vx: Math.cos(ship.angle) * projSpeed + ship.vx * 0.25,
      vy: Math.sin(ship.angle) * projSpeed + ship.vy * 0.25,
      angle: ship.angle,
      color: laserColor,
      damage: baseDamage,
      lifespan: 3.2,
      radius: ship.hasDoubleDamage ? 3.5 : 2.5,
    });

    // If ship has Homing Rockets buff:
    if (ship.hasHomingRockets) {
      const allPlanets = getAllPlanets();
      // Target installations on a planet including space stations, colony ships, and enemy ships!
      const target = findNearestHomingTarget(px, py, ship.angle, ship.ownerId, allPlanets, 1400);

      const rocketDamage = ship.hasDoubleDamage ? 4 : 2;
      const rocketAngle = ship.angle + (Math.random() - 0.5) * 0.2;
      const rocketSpeed = 290;

      projectilesRef.current.push({
        id: `rocket_${Math.random()}`,
        ownerId: ship.ownerId,
        sourceType: 'ship',
        x: px,
        y: py,
        vx: Math.cos(rocketAngle) * rocketSpeed + ship.vx * 0.2,
        vy: Math.sin(rocketAngle) * rocketSpeed + ship.vy * 0.2,
        angle: rocketAngle,
        color: '#f97316',
        damage: rocketDamage,
        lifespan: 4.5,
        radius: 3.5,
        isHomingRocket: true,
        homingTargetType: target ? target.type : undefined,
        homingTargetId: target ? target.id : null,
        homingPlanetId: target?.planetId || null,
      });

      sound.playRocketLaunch();
    }

    sound.playLaser(ship.ownerId === 'player' ? 1.0 : 0.85);
    onUpdateStatsRef.current({ shotsFired: 1 });
  };

  // 4 shots from Base defense
  const fireBaseTurrets = (planet: Planet, targetEnemy: Ship) => {
    const faction = factions.find((f) => f.id === planet.ownerId);
    const color = faction?.color || '#38bdf8';
    const projSpeed = 210; // Half speed (was 420)

    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const tx = planet.x + Math.cos(angle) * (planet.radius + 6);
      const ty = planet.y + Math.sin(angle) * (planet.radius + 6);
      const toTarget = angleBetween(tx, ty, targetEnemy.x, targetEnemy.y);

      projectilesRef.current.push({
        id: `turret_${planet.id}_${i}_${Math.random()}`,
        ownerId: planet.ownerId!,
        sourceType: 'base_turret',
        x: tx,
        y: ty,
        vx: Math.cos(toTarget) * projSpeed,
        vy: Math.sin(toTarget) * projSpeed,
        angle: toTarget,
        color,
        damage: 1,
        lifespan: 3.6, // Extended lifespan at half speed
        radius: 2.5,
      });
    }

    sound.playTurretLaser();
  };

  // Space Station defense (4 shots: 2 close on one end, 2 on the other)
  const fireSpaceStation = (planet: Planet, targetEnemy: Ship) => {
    if (!planet.spaceStation) return;
    const station = planet.spaceStation;
    const faction = factions.find((f) => f.id === station.ownerId);
    const color = faction?.color || '#38bdf8';
    const projSpeed = 215; // Half speed (was 430)

    const stX = planet.x + Math.cos(station.angle) * station.distance;
    const stY = planet.y + Math.sin(station.angle) * station.distance;
    const stationHeading = station.angle + Math.PI / 2;

    const halfLength = 16;
    const barrelSpread = 4;

    const endAx = stX + Math.cos(stationHeading) * halfLength;
    const endAy = stY + Math.sin(stationHeading) * halfLength;
    const perpA = stationHeading + Math.PI / 2;

    const endBx = stX - Math.cos(stationHeading) * halfLength;
    const endBy = stY - Math.sin(stationHeading) * halfLength;

    [-1, 1].forEach((sign) => {
      const sx = endAx + Math.cos(perpA) * (sign * barrelSpread);
      const sy = endAy + Math.sin(perpA) * (sign * barrelSpread);
      const toTarget = angleBetween(sx, sy, targetEnemy.x, targetEnemy.y);

      projectilesRef.current.push({
        id: `st_A_${Math.random()}`,
        ownerId: station.ownerId,
        sourceType: 'space_station',
        x: sx,
        y: sy,
        vx: Math.cos(toTarget) * projSpeed,
        vy: Math.sin(toTarget) * projSpeed,
        angle: toTarget,
        color,
        damage: 1,
        lifespan: 3.6, // Extended lifespan at half speed
        radius: 2.5,
      });
    });

    [-1, 1].forEach((sign) => {
      const sx = endBx + Math.cos(perpA) * (sign * barrelSpread);
      const sy = endBy + Math.sin(perpA) * (sign * barrelSpread);
      const toTarget = angleBetween(sx, sy, targetEnemy.x, targetEnemy.y);

      projectilesRef.current.push({
        id: `st_B_${Math.random()}`,
        ownerId: station.ownerId,
        sourceType: 'space_station',
        x: sx,
        y: sy,
        vx: Math.cos(toTarget) * projSpeed,
        vy: Math.sin(toTarget) * projSpeed,
        angle: toTarget,
        color,
        damage: 1,
        lifespan: 3.6, // Extended lifespan at half speed
        radius: 2.5,
      });
    });

    sound.playTurretLaser();
  };

  // Colony ship defense (2 heavy defensive shots from outrigger turrets)
  const fireColonyShip = (colony: { x: number; y: number; ownerId: FactionId }, targetEnemy: Ship) => {
    const faction = factions.find((f) => f.id === colony.ownerId);
    const color = faction?.color || '#38bdf8';
    const projSpeed = 220; // Half speed (was 440)
    const toTarget = angleBetween(colony.x, colony.y, targetEnemy.x, targetEnemy.y);
    const perp = toTarget + Math.PI / 2;
    const spread = 8.5; // Scaled for half-width colony ship hull

    [-1, 1].forEach((sign) => {
      const sx = colony.x + Math.cos(perp) * (sign * spread);
      const sy = colony.y + Math.sin(perp) * (sign * spread);

      projectilesRef.current.push({
        id: `col_${Math.random()}`,
        ownerId: colony.ownerId,
        sourceType: 'colony_ship',
        x: sx,
        y: sy,
        vx: Math.cos(toTarget) * projSpeed,
        vy: Math.sin(toTarget) * projSpeed,
        angle: toTarget,
        color,
        damage: 1,
        lifespan: 3.6,
        radius: 2.5,
      });
    });

    sound.playLaser(0.9);
  };

  // Helper to find a home planet for a faction
  const getFactionHomePlanet = (factionId: FactionId, originPlanetId: string | undefined, allPlanets: Planet[]): Planet | undefined => {
    if (originPlanetId) {
      const origin = allPlanets.find((p) => p.id === originPlanetId && p.ownerId === factionId);
      if (origin) return origin;
    }
    const withBase = allPlanets.find(
      (p) => p.ownerId === factionId && p.buildings.some((b) => b.type === 'base' && b.hp > 0)
    );
    if (withBase) return withBase;
    return allPlanets.find((p) => p.ownerId === factionId);
  };

  // Helper to count how many colony ships are currently in orbit around a specific planet
  const getOrbitingCountAtPlanet = (planetId: string, allPlanets: Planet[]): number => {
    let count = 0;
    allPlanets.forEach((p) => {
      p.colonyShips.forEach((cs) => {
        const orbitId = cs.orbitPlanetId || cs.originPlanetId;
        if (cs.state === 'orbiting' && orbitId === planetId) {
          count++;
        }
      });
    });
    return count;
  };

  // Helper to find an empty/incomplete world marked with the faction's color that needs colonization
  const findNeedyPlanetForFaction = (
    factionId: FactionId,
    excludePlanetId: string | undefined,
    allPlanets: Planet[]
  ): Planet | undefined => {
    return allPlanets.find((p) => {
      if (p.ownerId !== factionId) return false;
      if (excludePlanetId && p.id === excludePlanetId) return false;
      const buildingCount = p.buildings.filter((b) => b.hp > 0).length;
      if (buildingCount >= 4) return false;

      // Check if another colony ship of this faction is already traveling to or building at this planet
      const alreadyTargeted = allPlanets.some((otherP) =>
        otherP.colonyShips.some(
          (cs) =>
            cs.ownerId === factionId &&
            cs.targetPlanetId === p.id &&
            (cs.state === 'traveling' || cs.state === 'building')
        )
      );
      return !alreadyTargeted;
    });
  };

  // Reroutes any other color's colony ships away from a planet when claimed/landed on
  const rerouteForeignColonyShipsFromPlanet = (
    planetId: string,
    planetOwnerId: FactionId,
    allPlanets: Planet[]
  ) => {
    allPlanets.forEach((p) => {
      p.colonyShips.forEach((cs) => {
        if (cs.ownerId !== planetOwnerId) {
          const isAtOrHeadingTo =
            cs.targetPlanetId === planetId ||
            (cs.state === 'building' && cs.targetPlanetId === planetId) ||
            (cs.state === 'orbiting' && (cs.orbitPlanetId || cs.originPlanetId) === planetId);

          if (isAtOrHeadingTo) {
            // Find another option for their player marked with their own color
            const otherOption = findNeedyPlanetForFaction(cs.ownerId, planetId, allPlanets);
            if (otherOption) {
              cs.state = 'traveling';
              cs.targetPlanetId = otherOption.id;
              cs.buildProgress = 0;
            } else {
              // No other option for their player: go home!
              const homePlanet = getFactionHomePlanet(cs.ownerId, cs.originPlanetId, allPlanets);
              cs.state = 'traveling';
              cs.targetPlanetId = homePlanet ? homePlanet.id : cs.originPlanetId;
              cs.buildProgress = 0;
            }
          }
        }
      });
    });
  };

  // Helper to continuously and autonomously detect empty worlds of the same faction color and colonize them
  const updateColonyShipsAutonomousBehavior = (allPlanets: Planet[]) => {
    factions.forEach((faction) => {
      // 1. Gather all colony ships owned by this faction
      const factionShips: ColonyShip[] = [];
      allPlanets.forEach((p) => {
        p.colonyShips.forEach((cs) => {
          if (cs.ownerId === faction.id) {
            factionShips.push(cs);
          }
        });
      });

      // 2. Planets marked with this player's color ONLY
      const ownedPlanets = allPlanets.filter((p) => p.ownerId === faction.id);

      // 3. Worlds that are empty / need colonization (fewer than 4 buildings) of this faction's color
      const emptyPlanets = ownedPlanets.filter(
        (p) => p.buildings.filter((b) => b.hp > 0).length < 4
      );

      // 4. Strict check on currently traveling / building ships:
      // If a ship is targeting or building on a planet that is NOT this faction's color, abort immediately!
      factionShips.forEach((cs) => {
        if ((cs.state === 'traveling' || cs.state === 'building') && cs.targetPlanetId) {
          const targetP = allPlanets.find((p) => p.id === cs.targetPlanetId);
          if (!targetP || targetP.ownerId !== faction.id) {
            const otherOption = findNeedyPlanetForFaction(faction.id, targetP?.id, allPlanets);
            if (otherOption) {
              cs.state = 'traveling';
              cs.targetPlanetId = otherOption.id;
              cs.buildProgress = 0;
            } else {
              const homePlanet = getFactionHomePlanet(faction.id, cs.originPlanetId, allPlanets);
              cs.state = 'traveling';
              cs.targetPlanetId = homePlanet ? homePlanet.id : cs.originPlanetId;
              cs.buildProgress = 0;
            }
          }
        }
      });

      // 5. Track targeted planets
      const targetedPlanetIds = new Set<string>();
      factionShips.forEach((cs) => {
        if (
          (cs.state === 'traveling' || cs.state === 'building') &&
          cs.targetPlanetId &&
          cs.targetPlanetId !== cs.originPlanetId
        ) {
          const targetP = allPlanets.find((p) => p.id === cs.targetPlanetId);
          if (targetP && targetP.ownerId === faction.id) {
            targetedPlanetIds.add(cs.targetPlanetId);
          }
        }
      });

      const needyPlanets = emptyPlanets.filter((p) => !targetedPlanetIds.has(p.id));

      // 6. Available colony ships to dispatch (orbiting or currently returning home)
      const availableShips = factionShips.filter(
        (cs) =>
          cs.state === 'orbiting' ||
          (cs.state === 'traveling' && cs.targetPlanetId === cs.originPlanetId)
      );

      // Always try to colonize empty worlds of the player's color
      for (const emptyPlanet of needyPlanets) {
        if (availableShips.length === 0) break;

        // Choose closest available colony ship
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let i = 0; i < availableShips.length; i++) {
          const cs = availableShips[i];
          const d = distance(cs.x, cs.y, emptyPlanet.x, emptyPlanet.y);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }

        if (bestIdx !== -1) {
          const [ship] = availableShips.splice(bestIdx, 1);
          ship.state = 'traveling';
          ship.targetPlanetId = emptyPlanet.id;
          ship.buildProgress = 0;
          targetedPlanetIds.add(emptyPlanet.id);
        }
      }

      // 7. "make it so they go to their home world if there is no empty world marked with the players respective color."
      if (emptyPlanets.length === 0) {
        factionShips.forEach((cs) => {
          const homePlanet = getFactionHomePlanet(faction.id, cs.originPlanetId, allPlanets);
          if (!homePlanet) return;

          // If currently orbiting a non-home world, or traveling somewhere other than home
          if (cs.state === 'orbiting') {
            const currentOrbitId = cs.orbitPlanetId || cs.originPlanetId;
            if (currentOrbitId !== homePlanet.id) {
              cs.state = 'traveling';
              cs.targetPlanetId = homePlanet.id;
              cs.buildProgress = 0;
            }
          } else if (cs.state === 'traveling' && cs.targetPlanetId !== homePlanet.id) {
            cs.targetPlanetId = homePlanet.id;
            cs.buildProgress = 0;
          }
        });
      }
    });
  };

  // Helper called on planet claim
  const dispatchColonyShipsToPlanet = (targetPlanet: Planet, ownerId: FactionId) => {
    const allPlanets = getAllPlanets();
    rerouteForeignColonyShipsFromPlanet(targetPlanet.id, ownerId, allPlanets);
    updateColonyShipsAutonomousBehavior(allPlanets);
  };

  // Main 60 FPS Game Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameId = requestAnimationFrame(loop);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationFrameId = requestAnimationFrame(loop);
        return;
      }

      const targetW = canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth;
      const targetH = canvas.parentElement ? canvas.parentElement.clientHeight : window.innerHeight;
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW || window.innerWidth;
        canvas.height = targetH || window.innerHeight;
      }

      if (!isPaused) {
        const allPlanets = getAllPlanets();

        // -------------------------------------------------------------
        // 1. UPDATE ORBITS (Planets around stars)
        // -------------------------------------------------------------
        starsRef.current.forEach((star) => {
          star.pulsePhase += dt * 1.5;
          star.planets.forEach((planet) => {
            planet.orbitAngle += planet.orbitSpeed * dt * 0.7;
            planet.x = star.x + Math.cos(planet.orbitAngle) * planet.orbitRadius;
            planet.y = star.y + Math.sin(planet.orbitAngle) * planet.orbitRadius;

            // Space station orbit
            if (planet.spaceStation) {
              planet.spaceStation.angle += planet.spaceStation.orbitSpeed * dt * 2.5;
            }

            // Colony ships orbit / travel / build
            planet.colonyShips.forEach((cs) => {
              if (cs.state === 'orbiting') {
                const orbitPlanet = allPlanets.find((p) => p.id === (cs.orbitPlanetId || cs.originPlanetId)) || planet;
                cs.orbitAngle += cs.orbitSpeed * dt * 2.0;
                cs.x = orbitPlanet.x + Math.cos(cs.orbitAngle) * cs.orbitDistance;
                cs.y = orbitPlanet.y + Math.sin(cs.orbitAngle) * cs.orbitDistance;
                cs.angle = cs.orbitAngle + Math.PI / 2;
              } else if (cs.state === 'traveling' && cs.targetPlanetId) {
                const targetPlanet = allPlanets.find((p) => p.id === cs.targetPlanetId);
                if (targetPlanet) {
                  const d = distance(cs.x, cs.y, targetPlanet.x, targetPlanet.y);
                  const travelAngle = angleBetween(cs.x, cs.y, targetPlanet.x, targetPlanet.y);
                  cs.angle = travelAngle;
                  const speed = 12; // Exactly 1/10th speed (was 120)
                  cs.vx = Math.cos(travelAngle) * speed;
                  cs.vy = Math.sin(travelAngle) * speed;
                  cs.x += cs.vx * dt;
                  cs.y += cs.vy * dt;

                  if (Math.random() < 0.45) {
                    particlesRef.current.push({
                      x: cs.x - Math.cos(cs.angle) * 26,
                      y: cs.y - Math.sin(cs.angle) * 26,
                      vx: -Math.cos(cs.angle) * 24 + (Math.random() - 0.5) * 12,
                      vy: -Math.sin(cs.angle) * 24 + (Math.random() - 0.5) * 12,
                      color: '#38bdf8',
                      size: 2.8,
                      alpha: 0.9,
                      decay: 2.0,
                      lifespan: 0,
                    });
                  }

                  if (d < targetPlanet.radius + 45) {
                    // Check if targetPlanet is still our color!
                    if (targetPlanet.ownerId !== cs.ownerId) {
                      // Abort! Another color took this planet or it is not our color.
                      // Go to another option for our player or go home!
                      const otherOption = findNeedyPlanetForFaction(cs.ownerId, targetPlanet.id, allPlanets);
                      if (otherOption) {
                        cs.state = 'traveling';
                        cs.targetPlanetId = otherOption.id;
                        cs.buildProgress = 0;
                      } else {
                        const homePlanet = getFactionHomePlanet(cs.ownerId, cs.originPlanetId, allPlanets);
                        cs.state = 'traveling';
                        cs.targetPlanetId = homePlanet ? homePlanet.id : cs.originPlanetId;
                        cs.buildProgress = 0;
                      }
                    } else {
                      const isTargetComplete = targetPlanet.buildings.filter((b) => b.hp > 0).length >= 4;
                      if (isTargetComplete) {
                        // Returned home or target already complete
                        cs.state = 'orbiting';
                        cs.orbitPlanetId = targetPlanet.id;
                        cs.targetPlanetId = undefined;
                        cs.orbitAngle = Math.random() * Math.PI * 2;
                        const orbitingCount = getOrbitingCountAtPlanet(targetPlanet.id, allPlanets);
                        cs.orbitDistance = targetPlanet.radius + 48 + (orbitingCount % 2) * 16;
                        sound.playLanding();
                      } else {
                        // Begin planetary colonization
                        cs.state = 'building';
                        cs.buildProgress = 0;
                        cs.orbitPlanetId = targetPlanet.id;
                      }
                    }
                  }
                }
              } else if (cs.state === 'building' && cs.targetPlanetId) {
                const targetPlanet = allPlanets.find((p) => p.id === cs.targetPlanetId);
                // Must be our own color! If another faction claimed or landed on it, abort immediately!
                if (!targetPlanet || targetPlanet.ownerId !== cs.ownerId) {
                  const otherOption = findNeedyPlanetForFaction(cs.ownerId, targetPlanet?.id, allPlanets);
                  if (otherOption) {
                    cs.state = 'traveling';
                    cs.targetPlanetId = otherOption.id;
                    cs.buildProgress = 0;
                  } else {
                    const homePlanet = getFactionHomePlanet(cs.ownerId, cs.originPlanetId, allPlanets);
                    cs.state = 'traveling';
                    cs.targetPlanetId = homePlanet ? homePlanet.id : cs.originPlanetId;
                    cs.buildProgress = 0;
                  }
                } else {
                  cs.x = targetPlanet.x + targetPlanet.radius + 32;
                  cs.y = targetPlanet.y;
                  cs.angle = Math.PI; // Face towards planet center
                  cs.buildProgress = (cs.buildProgress || 0) + dt * 10;

                  // Golden construction sparks towards planet
                  if (Math.random() < 0.35) {
                    particlesRef.current.push({
                      x: cs.x - 10 + (Math.random() - 0.5) * 10,
                      y: cs.y + (Math.random() - 0.5) * 10,
                      vx: -40 - Math.random() * 30,
                      vy: (Math.random() - 0.5) * 20,
                      color: '#fbbf24',
                      size: 2,
                      alpha: 1,
                      decay: 3.5,
                      lifespan: 0,
                    });
                  }

                  // 1. Base (20%)
                  if (cs.buildProgress >= 20 && !targetPlanet.buildings.some((b) => b.type === 'base' && b.hp > 0)) {
                    const existing = targetPlanet.buildings.find((b) => b.type === 'base');
                    if (existing) {
                      existing.hp = existing.maxHp;
                    } else {
                      targetPlanet.buildings.push({
                        id: `bld_base_${Math.random()}`,
                        type: 'base',
                        name: 'Planetary Base',
                        maxHp: 20,
                        hp: 20,
                        angleOnPlanet: 0,
                        width: 22,
                        height: 18,
                      });
                    }
                  }
                  // 2. Production Hub (45%)
                  else if (cs.buildProgress >= 45 && !targetPlanet.buildings.some((b) => b.type === 'production_hub' && b.hp > 0)) {
                    const existing = targetPlanet.buildings.find((b) => b.type === 'production_hub');
                    if (existing) {
                      existing.hp = existing.maxHp;
                    } else {
                      targetPlanet.buildings.push({
                        id: `bld_hub_${Math.random()}`,
                        type: 'production_hub',
                        name: 'Production Hub',
                        maxHp: 10,
                        hp: 10,
                        angleOnPlanet: Math.PI / 2,
                        width: 22,
                        height: 18,
                      });
                    }
                  }
                  // 3. Lab (70%)
                  else if (cs.buildProgress >= 70 && !targetPlanet.buildings.some((b) => b.type === 'lab' && b.hp > 0)) {
                    const existing = targetPlanet.buildings.find((b) => b.type === 'lab');
                    if (existing) {
                      existing.hp = existing.maxHp;
                    } else {
                      targetPlanet.buildings.push({
                        id: `bld_lab_${Math.random()}`,
                        type: 'lab',
                        name: 'Research Lab',
                        maxHp: 10,
                        hp: 10,
                        angleOnPlanet: Math.PI,
                        width: 22,
                        height: 18,
                      });
                    }
                  }
                  // 4. Comms Center (95%)
                  else if (cs.buildProgress >= 95 && !targetPlanet.buildings.some((b) => b.type === 'comms_center' && b.hp > 0)) {
                    const existing = targetPlanet.buildings.find((b) => b.type === 'comms_center');
                    if (existing) {
                      existing.hp = existing.maxHp;
                    } else {
                      targetPlanet.buildings.push({
                        id: `bld_comms_${Math.random()}`,
                        type: 'comms_center',
                        name: 'Comms Center',
                        maxHp: 10,
                        hp: 10,
                        angleOnPlanet: (3 * Math.PI) / 2,
                        width: 22,
                        height: 18,
                      });
                    }
                  }

                  if (cs.buildProgress >= 100) {
                    sound.playLanding();
                    cs.orbitPlanetId = targetPlanet.id;

                    // Check if another empty planet of this faction needs colonization
                    const nextNeedy = findNeedyPlanetForFaction(cs.ownerId, targetPlanet.id, allPlanets);

                    if (nextNeedy) {
                      cs.state = 'traveling';
                      cs.targetPlanetId = nextNeedy.id;
                      cs.buildProgress = 0;
                    } else {
                      // Whenever there is no new worlds to colonize, return home
                      const homePlanet = getFactionHomePlanet(cs.ownerId, cs.originPlanetId, allPlanets);
                      cs.state = 'traveling';
                      cs.targetPlanetId = homePlanet ? homePlanet.id : cs.originPlanetId;
                      cs.buildProgress = 0;
                    }
                  }
                }
              }
            });
          });
        });

        // Autonomous colony ships detection: constantly look for empty worlds of player's color
        updateColonyShipsAutonomousBehavior(allPlanets);

        // Throttle reporting planets to App to avoid React re-render churn
        if (currentTime - lastPlanetsReportTimeRef.current > 1000) {
          lastPlanetsReportTimeRef.current = currentTime;
          onPlanetsChangeRef.current(allPlanets);
        }

        // -------------------------------------------------------------
        // 2. PRODUCTION HUB REBUILD & PRODUCTION QUEUE (~30s)
        // -------------------------------------------------------------
        allPlanets.forEach((planet) => {
          if (!planet.ownerId) return;

          const hasProductionHub = planet.buildings.some((b) => b.type === 'production_hub' && b.hp > 0);

          if (hasProductionHub) {
            const missingTypes: ('base' | 'production_hub' | 'lab' | 'comms_center')[] = [];
            const buildingMap = new Map(planet.buildings.map((b) => [b.type, b]));

            (['base', 'lab', 'comms_center'] as const).forEach((t) => {
              const b = buildingMap.get(t);
              if (!b || b.hp <= 0) {
                missingTypes.push(t);
              }
            });

            if (missingTypes.length > 0) {
              const targetToRebuild = missingTypes[0];
              if (!planet.productionQueue || planet.productionQueue.buildingType !== targetToRebuild) {
                planet.productionQueue = {
                  target: 'building',
                  buildingType: targetToRebuild,
                  duration: 30,
                  progress: 0,
                };
              } else {
                planet.productionQueue.progress += dt;
                if (planet.productionQueue.progress >= planet.productionQueue.duration) {
                  const b = planet.buildings.find((item) => item.type === targetToRebuild);
                  if (b) {
                    b.hp = b.maxHp;
                  } else {
                    const angleMap = { base: 0, production_hub: Math.PI / 2, lab: Math.PI, comms_center: (3 * Math.PI) / 2 };
                    const nameMap = { base: 'Planetary Base', production_hub: 'Production Hub', lab: 'Research Lab', comms_center: 'Comms Center' };
                    planet.buildings.push({
                      id: `bld_${targetToRebuild}_${Math.random()}`,
                      type: targetToRebuild,
                      name: nameMap[targetToRebuild],
                      maxHp: targetToRebuild === 'base' ? 20 : 10,
                      hp: targetToRebuild === 'base' ? 20 : 10,
                      angleOnPlanet: angleMap[targetToRebuild],
                      width: 22,
                      height: 18,
                    });
                  }
                  planet.productionQueue = null;
                }
              }
            } else if (!planet.spaceStation) {
              if (!planet.productionQueue || planet.productionQueue.target !== 'station') {
                planet.productionQueue = {
                  target: 'station',
                  duration: 30,
                  progress: 0,
                };
              } else {
                planet.productionQueue.progress += dt;
                if (planet.productionQueue.progress >= planet.productionQueue.duration) {
                  planet.spaceStation = {
                    id: `station_${planet.id}`,
                    ownerId: planet.ownerId,
                    angle: Math.random() * Math.PI * 2,
                    distance: planet.radius * 1.85,
                    orbitSpeed: 0.012,
                    hp: 30,
                    maxHp: 30,
                    fireCooldown: 0,
                  };
                  planet.productionQueue = null;
                }
              }
            } else if (planet.buildings.some((b) => b.type === 'production_hub' && b.hp > 0)) {
              // Each world will cap out once they have two colony ships in orbit
              const orbitingCount = getOrbitingCountAtPlanet(planet.id, allPlanets);
              if (orbitingCount < 2) {
                if (!planet.productionQueue || planet.productionQueue.target !== 'colony_ship') {
                  planet.productionQueue = {
                    target: 'colony_ship',
                    duration: 12, // 12 seconds prompt construction
                    progress: 0,
                  };
                } else {
                  planet.productionQueue.progress += dt;
                  if (planet.productionQueue.progress >= planet.productionQueue.duration) {
                    planet.colonyShips.push({
                      id: `colony_${planet.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                      ownerId: planet.ownerId,
                      originPlanetId: planet.id,
                      orbitPlanetId: planet.id,
                      x: planet.x + planet.radius + 48,
                      y: planet.y,
                      vx: 0,
                      vy: 0,
                      angle: 0,
                      state: 'orbiting',
                      orbitAngle: Math.random() * Math.PI * 2,
                      orbitDistance: planet.radius + 48 + orbitingCount * 18,
                      orbitSpeed: 0.010,
                      hp: 5, // Exactly 5 HP (dies in 5 shots!)
                      maxHp: 5,
                      fireCooldown: 0,
                    });
                    planet.productionQueue = null;
                  }
                }
              } else {
                // Capped out at 2 in orbit!
                planet.productionQueue = null;
              }
            } else {
              planet.productionQueue = null;
            }
          } else {
            planet.productionQueue = null;
          }
        });

        // -------------------------------------------------------------
        // 3. DEFENSE SYSTEMS & FIRING LOGIC
        // -------------------------------------------------------------
        allPlanets.forEach((planet) => {
          if (!planet.ownerId) return;

          const enemyShips = shipsRef.current.filter(
            (s) => s.ownerId !== planet.ownerId && !s.isDead && s.flightState !== 'landed'
          );

          // Turret / Base defense
          const hasBase = planet.buildings.some((b) => b.type === 'base' && b.hp > 0);
          if (hasBase) {
            planet.turretFireCooldown = Math.max(0, planet.turretFireCooldown - dt);
            if (planet.turretFireCooldown <= 0) {
              let closestEnemy: Ship | null = null;
              let minD = 550;
              for (const es of enemyShips) {
                const d = distance(planet.x, planet.y, es.x, es.y);
                if (d < minD) {
                  minD = d;
                  closestEnemy = es;
                }
              }

              if (closestEnemy) {
                fireBaseTurrets(planet, closestEnemy);
                planet.turretFireCooldown = 2.4;
              }
            }
          }

          // Space Station defense
          if (planet.spaceStation) {
            planet.spaceStation.fireCooldown = Math.max(0, planet.spaceStation.fireCooldown - dt);
            if (planet.spaceStation.fireCooldown <= 0) {
              const stX = planet.x + Math.cos(planet.spaceStation.angle) * planet.spaceStation.distance;
              const stY = planet.y + Math.sin(planet.spaceStation.angle) * planet.spaceStation.distance;

              let closestEnemy: Ship | null = null;
              let minD = 520;
              for (const es of enemyShips) {
                const d = distance(stX, stY, es.x, es.y);
                if (d < minD) {
                  minD = d;
                  closestEnemy = es;
                }
              }

              if (closestEnemy) {
                fireSpaceStation(planet, closestEnemy);
                planet.spaceStation.fireCooldown = 2.2;
              }
            }
          }

          // Colony Ships defense
          planet.colonyShips.forEach((cs) => {
            cs.fireCooldown = Math.max(0, cs.fireCooldown - dt);
            if (cs.fireCooldown <= 0) {
              let closestEnemy: Ship | null = null;
              let minD = 480;
              for (const es of enemyShips) {
                const d = distance(cs.x, cs.y, es.x, es.y);
                if (d < minD) {
                  minD = d;
                  closestEnemy = es;
                }
              }

              if (closestEnemy) {
                fireColonyShip(cs, closestEnemy);
                cs.fireCooldown = 2.0;
              }
            }
          });
        });

        // -------------------------------------------------------------
        // 4. SHIPS UPDATE: LIFTOFF, FREE SPACE FLIGHT, & LANDING
        // -------------------------------------------------------------
        let detectedLandablePlanet: Planet | null = null;

        shipsRef.current.forEach((ship) => {
          const faction = factions.find((f) => f.id === ship.ownerId)!;

          // RESPAWN HANDLING
          if (ship.isDead) {
            const basesOwned = allPlanets.filter(
              (p) => p.ownerId === ship.ownerId && p.buildings.some((b) => b.type === 'base' && b.hp > 0)
            );

            if (basesOwned.length === 0) {
              return; // Eliminated!
            }

            ship.respawnTimer -= dt;
            if (ship.respawnTimer <= 0) {
              let respawnPlanet: Planet = basesOwned[0];
              if (ship.lastLandedPlanetId) {
                const lastLanded = basesOwned.find((p) => p.id === ship.lastLandedPlanetId);
                if (lastLanded) respawnPlanet = lastLanded;
              }

              ship.isDead = false;
              ship.hp = ship.maxHp;
              ship.boost = ship.maxBoost;
              ship.boosting = false;
              ship.flightState = 'landed';
              ship.landedPlanetId = respawnPlanet.id;
              ship.surfaceAngle = Math.random() * Math.PI * 2;
              ship.transitionProgress = 0;
              ship.aiLaunchTimer = 1.0;
              ship.x = respawnPlanet.x + Math.cos(ship.surfaceAngle) * (respawnPlanet.radius + 6);
              ship.y = respawnPlanet.y + Math.sin(ship.surfaceAngle) * (respawnPlanet.radius + 6);
              ship.angle = ship.surfaceAngle;
              ship.vx = 0;
              ship.vy = 0;
              createExplosion(ship.x, ship.y, faction.color, 24, false);

              // Roll buff after dying (50% none, 10% shield 25hp, 10% 2x dmg, 10% rockets, 10% rockets+2x, 10% shield+rockets+2x)
              rollShipBuff(ship, 'death');

              if (ship.ownerId === 'player') {
                onPlayerHpChangeRef.current(ship.hp, ship.maxHp);
                if (onPlayerBoostChangeRef.current) {
                  onPlayerBoostChangeRef.current(ship.boost, ship.maxBoost);
                }
              }
            }
            return;
          }

          // A. LANDED STATE: Ship sits on planet surface, waiting for W or Up arrow to blast off
          if (ship.flightState === 'landed') {
            const dockedPlanet = allPlanets.find((p) => p.id === ship.landedPlanetId);
            if (dockedPlanet) {
              ship.x = dockedPlanet.x + Math.cos(ship.surfaceAngle) * (dockedPlanet.radius + 6);
              ship.y = dockedPlanet.y + Math.sin(ship.surfaceAngle) * (dockedPlanet.radius + 6);
              ship.angle = ship.surfaceAngle;
              ship.vx = 0;
              ship.vy = 0;

              // Automatic hull repair while docked (Quick heal on colonized worlds)
              if (ship.hp < ship.maxHp) {
                const isColonized =
                  dockedPlanet.ownerId === ship.ownerId &&
                  dockedPlanet.buildings.some((b) => b.hp > 0);
                const healSpeed = isColonized ? 7.5 : 1.5; // Rapid repair (~0.65s full restore) on colonized worlds
                ship.hp = Math.min(ship.maxHp, ship.hp + dt * healSpeed);

                if (ship.ownerId === 'player') {
                  onPlayerHpChangeRef.current(Math.round(ship.hp), ship.maxHp);
                }

                // Green nanite repair particles on colonized worlds
                if (isColonized && Math.random() < 0.45) {
                  particlesRef.current.push({
                    x: ship.x + (Math.random() - 0.5) * 16,
                    y: ship.y + (Math.random() - 0.5) * 16,
                    vx: (Math.random() - 0.5) * 24,
                    vy: (Math.random() - 0.5) * 24,
                    color: '#10b981',
                    size: 2,
                    alpha: 1,
                    decay: 2.8,
                    lifespan: 0,
                  });
                }
              }
            }

            // Firing while landed (defending the planet from the surface)
            ship.fireCooldown = Math.max(0, ship.fireCooldown - dt);

            // HUMAN LIFTOFF: Press W or Up Arrow to blast off into space
            if (faction.isHuman) {
              if (keysRef.current.shoot && ship.fireCooldown <= 0) {
                fireShipProjectile(ship, faction);
                ship.fireCooldown = 0.22; // Tripled rate of fire when holding F or Space (~0.22s cooldown)
              }

              if (keysRef.current.thrust) {
                ship.flightState = 'launching';
                ship.transitionProgress = 0;
                sound.playLaser(0.65);
              }
            } else {
              // AI can also shoot back if enemies fly overhead
              const nearbyOpponent = shipsRef.current.find(
                (s) => !s.isDead && s.ownerId !== ship.ownerId && distance(ship.x, ship.y, s.x, s.y) < 320
              );
              if (nearbyOpponent && ship.fireCooldown <= 0) {
                fireShipProjectile(ship, faction);
                ship.fireCooldown = 0.67;
              }

              // AI LIFTOFF: Automatic countdown
              const { decision } = updateAIShip(ship, faction, allPlanets, shipsRef.current, dt);
              if (decision.launch) {
                ship.flightState = 'launching';
                ship.transitionProgress = 0;
              }
            }
            return;
          }

          // B. LAUNCHING ANIMATION: Thrusters ignite, ship shoots outward away from planet
          if (ship.flightState === 'launching') {
            const dockedPlanet = allPlanets.find((p) => p.id === ship.landedPlanetId);
            ship.transitionProgress += dt * 3.5; // ~0.28s snappy launch

            const planetRadius = dockedPlanet ? dockedPlanet.radius : 40;
            const planetX = dockedPlanet ? dockedPlanet.x : ship.x;
            const planetY = dockedPlanet ? dockedPlanet.y : ship.y;

            const altitude = planetRadius + 6 + ship.transitionProgress * 42;
            ship.x = planetX + Math.cos(ship.surfaceAngle) * altitude;
            ship.y = planetY + Math.sin(ship.surfaceAngle) * altitude;
            ship.angle = ship.surfaceAngle; // Points directly outward into space

            // Big plume of rocket exhaust particles on the planet surface
            for (let i = 0; i < 4; i++) {
              particlesRef.current.push({
                x: ship.x - Math.cos(ship.angle) * 7,
                y: ship.y - Math.sin(ship.angle) * 7,
                vx: -Math.cos(ship.angle) * 55 + (Math.random() - 0.5) * 25,
                vy: -Math.sin(ship.angle) * 55 + (Math.random() - 0.5) * 25,
                color: Math.random() < 0.6 ? '#f59e0b' : '#38bdf8',
                size: 2.5,
                alpha: 1,
                decay: 3.2,
                lifespan: 0,
              });
            }

            if (ship.transitionProgress >= 1) {
              // Fully in open-space flight!
              const launchedFromPlanetId = ship.landedPlanetId;
              ship.flightState = 'flying';
              ship.landedPlanetId = null;
              const launchSpeed = 240; // Half speed (was 480)
              ship.vx = Math.cos(ship.angle) * launchSpeed;
              ship.vy = Math.sin(ship.angle) * launchSpeed;

              // Anti-relanding cooldown: prevent AI from immediately turning around to re-dock on the same planet
              if (ship.ownerId !== 'player' && launchedFromPlanetId) {
                ship.planetLandingCooldownId = launchedFromPlanetId;
                ship.planetLandingCooldown = 6.0;
              }
            }
            return;
          }

          // C. LANDING ANIMATION: Ship glides into position, fires retro-thrusters, touches down
          if (ship.flightState === 'landing') {
            const targetPlanet = allPlanets.find((p) => p.id === ship.landedPlanetId);
            ship.transitionProgress += dt * 2.2; // ~0.45s smooth touchdown

            if (targetPlanet) {
              const startDist = targetPlanet.radius + 45;
              const endDist = targetPlanet.radius + 6;
              const currentDist = startDist - (startDist - endDist) * Math.min(1, ship.transitionProgress);

              ship.x = targetPlanet.x + Math.cos(ship.surfaceAngle) * currentDist;
              ship.y = targetPlanet.y + Math.sin(ship.surfaceAngle) * currentDist;

              // Smoothly align facing outward
              const angleDiff = shortestAngleDiff(ship.angle, ship.surfaceAngle);
              ship.angle += angleDiff * Math.min(1, dt * 10);

              // Retro landing sparks
              particlesRef.current.push({
                x: ship.x,
                y: ship.y,
                vx: (Math.random() - 0.5) * 35,
                vy: (Math.random() - 0.5) * 35,
                color: '#38bdf8',
                size: 2,
                alpha: 0.9,
                decay: 3.0,
                lifespan: 0,
              });

              if (ship.transitionProgress >= 1) {
                // TOUCHDOWN!
                ship.flightState = 'landed';
                ship.vx = 0;
                ship.vy = 0;
                ship.angle = ship.surfaceAngle;
                sound.playLanding();

                // Roll buff if landing on an already colonized planet (has active buildings)
                const wasAlreadyColonized = targetPlanet.buildings.some((b) => b.hp > 0);
                if (wasAlreadyColonized) {
                  rollShipBuff(ship, 'colonized_landing');
                }

                // AI Relanding Detection & Combat Switch:
                // "the computers sometimes end up landing and relanding over and over on the same planet. They all need to switch to fighting if this happens."
                if (ship.ownerId !== 'player') {
                  if (ship.recentLandingPlanetId === targetPlanet.id) {
                    ship.samePlanetLandingCount = (ship.samePlanetLandingCount || 1) + 1;
                  } else {
                    ship.recentLandingPlanetId = targetPlanet.id;
                    ship.samePlanetLandingCount = 1;
                  }

                  const otherEnemyComputersNear = shipsRef.current.filter(
                    (s) =>
                      !s.isDead &&
                      s.ownerId !== 'player' &&
                      s.ownerId !== ship.ownerId &&
                      (s.landedPlanetId === targetPlanet.id ||
                        distance(s.x, s.y, targetPlanet.x, targetPlanet.y) < 550)
                  );

                  // If computer lands and relands over and over on the same planet (2+ times), or enemies contest:
                  const shouldSwitchToFighting =
                    ship.samePlanetLandingCount >= 2 || otherEnemyComputersNear.length > 0;

                  if (shouldSwitchToFighting) {
                    // ALL computers on or near this planet immediately switch to fighting!
                    shipsRef.current.forEach((s) => {
                      if (s.ownerId !== 'player' && !s.isDead) {
                        const distToP = distance(s.x, s.y, targetPlanet.x, targetPlanet.y);
                        if (distToP < 750 || s.landedPlanetId === targetPlanet.id) {
                          s.forceFightTimer = 25; // 25s of locked combat mode
                          s.planetLandingCooldownId = targetPlanet.id;
                          s.planetLandingCooldown = 15; // Stop relanding on this planet
                          s.samePlanetLandingCount = 0;
                          if (s.flightState === 'landed') {
                            s.aiLaunchTimer = 0.15; // Launch immediately to fight!
                          }
                        }
                      }
                    });

                    addFloatingText(
                      targetPlanet.x,
                      targetPlanet.y - targetPlanet.radius - 22,
                      '⚔️ RELANDING DETECTED: SWITCHING TO FIGHTING!',
                      '#ef4444'
                    );
                  }
                }

                // Check if any opposing ship is currently staying landed on this planet
                const opposingLandedShips = shipsRef.current.filter(
                  (s) =>
                    !s.isDead &&
                    s.flightState === 'landed' &&
                    s.landedPlanetId === targetPlanet.id &&
                    s.id !== ship.id &&
                    s.ownerId !== ship.ownerId
                );

                // Check if targetPlanet has defending buildings of another faction
                const hasDefendingBuildings =
                  targetPlanet.ownerId !== null &&
                  targetPlanet.ownerId !== ship.ownerId &&
                  targetPlanet.buildings.some((b) => b.hp > 0);

                // Takeover rule: Whoever landed first keeps control!
                // If another ship is staying on the planet, it cannot be taken over until they are shot off first.
                if (
                  targetPlanet.ownerId !== ship.ownerId &&
                  opposingLandedShips.length === 0 &&
                  !hasDefendingBuildings
                ) {
                  targetPlanet.ownerId = ship.ownerId;
                  targetPlanet.lastLandedBy = ship.ownerId;
                  targetPlanet.buildings = [];
                  createExplosion(targetPlanet.x, targetPlanet.y, faction.color, targetPlanet.radius * 1.3, false);

                  if (ship.ownerId === 'player') {
                    onUpdateStatsRef.current({ planetsClaimed: 1 });
                  }
                  if (ship.aiExpansionistPhase === 'mark_planet') {
                    ship.aiExpansionistPhase = 'destroy_colony_ship';
                  }
                  dispatchColonyShipsToPlanet(targetPlanet, ship.ownerId);
                } else {
                  // Ensure no foreign colony ships are targeting this planet now that it is landed on
                  if (targetPlanet.ownerId) {
                    rerouteForeignColonyShipsFromPlanet(targetPlanet.id, targetPlanet.ownerId, allPlanets);
                  }
                }

                ship.lastLandedPlanetId = targetPlanet.id;
                ship.aiLaunchTimer = 1.5; // Bot will blast off again in 1.5s
              }
            } else {
              ship.flightState = 'flying';
            }
            return;
          }

          // D. OPEN SPACE FLIGHT (flightState === 'flying')
          if (faction.isHuman) {
            // Steering
            const turnRate = 4.0 * dt;
            if (keysRef.current.left) ship.angle -= turnRate;
            if (keysRef.current.right) ship.angle += turnRate;

            // Hyper-Thrust Boost with CTRL (Burns in 3s, Regens in 12s, 2x speed)
            const isHoldingCtrl = keysRef.current.boost;
            const canBoost = isHoldingCtrl && ship.boost > 0;
            ship.boosting = canBoost;

            if (ship.boosting) {
              // Takes ~3 seconds to burn completely when held
              ship.boost = Math.max(0, ship.boost - (ship.maxBoost / 3.0) * dt);
            } else {
              // Regens completely from zero in 12 seconds
              ship.boost = Math.min(ship.maxBoost, ship.boost + (ship.maxBoost / 12.0) * dt);
            }

            if (onPlayerBoostChangeRef.current) {
              onPlayerBoostChangeRef.current(ship.boost, ship.maxBoost);
            }

            // Forward thrust with W / Up Arrow or CTRL Boost (move twice as fast by holding CTRL)
            const baseThrust = 290;
            const isMovingForward = keysRef.current.thrust || ship.boosting;
            ship.thrusting = isMovingForward;

            if (isMovingForward) {
              const thrustMultiplier = ship.boosting ? 2.0 : 1.0;
              const thrustPower = baseThrust * thrustMultiplier;

              ship.vx += Math.cos(ship.angle) * thrustPower * dt;
              ship.vy += Math.sin(ship.angle) * thrustPower * dt;

              // Regular engine exhaust particles
              if (Math.random() < 0.7) {
                particlesRef.current.push({
                  x: ship.x - Math.cos(ship.angle) * 7,
                  y: ship.y - Math.sin(ship.angle) * 7,
                  vx: -Math.cos(ship.angle) * 45 + (Math.random() - 0.5) * 20,
                  vy: -Math.sin(ship.angle) * 45 + (Math.random() - 0.5) * 20,
                  color: ship.boosting ? '#38bdf8' : '#38bdf8',
                  size: 2,
                  alpha: 1,
                  decay: 3.0,
                  lifespan: 0,
                });
              }

              // Extra hyper-thrust exhaust particles when boosting
              if (ship.boosting) {
                for (let b = 0; b < 2; b++) {
                  particlesRef.current.push({
                    x: ship.x - Math.cos(ship.angle) * 8 + (Math.random() - 0.5) * 4,
                    y: ship.y - Math.sin(ship.angle) * 8 + (Math.random() - 0.5) * 4,
                    vx: -Math.cos(ship.angle) * 85 + (Math.random() - 0.5) * 25,
                    vy: -Math.sin(ship.angle) * 85 + (Math.random() - 0.5) * 25,
                    color: Math.random() < 0.4 ? '#ffffff' : Math.random() < 0.7 ? '#38bdf8' : '#60a5fa',
                    size: 2.5,
                    alpha: 1,
                    decay: 3.8,
                    lifespan: 0,
                  });
                }
              }
            }

            if (keysRef.current.reverse) {
              ship.vx *= 0.93;
              ship.vy *= 0.93;
            }

            // Smooth space inertia
            ship.vx *= 0.993;
            ship.vy *= 0.993;

            // Shooting: holding F or Space fires repeatedly at tripled rate (~0.22s cooldown)
            ship.fireCooldown = Math.max(0, ship.fireCooldown - dt);
            if (keysRef.current.shoot && ship.fireCooldown <= 0) {
              fireShipProjectile(ship, faction);
              ship.fireCooldown = 0.22;
            }

            // Check if player is near any planet for landing prompt
            for (const p of allPlanets) {
              const d = distance(ship.x, ship.y, p.x, p.y) - p.radius;
              if (d < 140) {
                detectedLandablePlanet = p;
                break;
              }
            }

            // HUMAN LANDING TRIGGER WITH 'L'
            if (keysRef.current.land) {
              keysRef.current.land = false;
              if (detectedLandablePlanet) {
                ship.flightState = 'landing';
                ship.landedPlanetId = detectedLandablePlanet.id;
                ship.surfaceAngle = angleBetween(
                  detectedLandablePlanet.x,
                  detectedLandablePlanet.y,
                  ship.x,
                  ship.y
                );
                ship.transitionProgress = 0;
              }
            }
          } else {
            // AI COMPUTER FLIGHT IN OPEN SPACE
            const { decision } = updateAIShip(ship, faction, allPlanets, shipsRef.current, dt);

            ship.angle = decision.steerAngle;

            const aiCanBoost = Boolean(decision.boost && ship.boost > 0);
            ship.boosting = aiCanBoost;

            if (ship.boosting) {
              ship.boost = Math.max(0, ship.boost - (ship.maxBoost / 3.0) * dt);
            } else {
              ship.boost = Math.min(ship.maxBoost, ship.boost + (ship.maxBoost / 12.0) * dt);
            }

            const aiMoving = decision.thrust || ship.boosting;
            ship.thrusting = aiMoving;

            if (aiMoving) {
              const baseAIThrust = 250;
              const thrustMultiplier = ship.boosting ? 2.0 : 1.0;
              const thrustPower = baseAIThrust * thrustMultiplier;

              ship.vx += Math.cos(ship.angle) * thrustPower * dt;
              ship.vy += Math.sin(ship.angle) * thrustPower * dt;

              if (Math.random() < 0.5) {
                particlesRef.current.push({
                  x: ship.x - Math.cos(ship.angle) * 7,
                  y: ship.y - Math.sin(ship.angle) * 7,
                  vx: -Math.cos(ship.angle) * 40 + (Math.random() - 0.5) * 15,
                  vy: -Math.sin(ship.angle) * 40 + (Math.random() - 0.5) * 15,
                  color: ship.boosting ? '#ffffff' : faction.color,
                  size: ship.boosting ? 2.4 : 1.8,
                  alpha: 0.9,
                  decay: 3.0,
                  lifespan: 0,
                });
              }
            }

            ship.vx *= 0.993;
            ship.vy *= 0.993;

            // AI Shooting: Rapid, regular weapon firing rate (~0.20s)
            ship.fireCooldown = Math.max(0, ship.fireCooldown - dt);
            if (decision.shoot && ship.fireCooldown <= 0) {
              fireShipProjectile(ship, faction);
              ship.fireCooldown = 0.20;
            }

            // AI Landing Trigger
            if (decision.landOnPlanet) {
              const p = decision.landOnPlanet;
              ship.flightState = 'landing';
              ship.landedPlanetId = p.id;
              ship.surfaceAngle = angleBetween(p.x, p.y, ship.x, ship.y);
              ship.transitionProgress = 0;
            }
          }

          // Move ship in space
          ship.x += ship.vx * dt;
          ship.y += ship.vy * dt;

          // Planetary Core Collision Protection in open flight (bounces gently off core if not landing)
          for (const planet of allPlanets) {
            const d = distance(ship.x, ship.y, planet.x, planet.y);
            if (d < planet.radius + 8) {
              const pushAngle = angleBetween(planet.x, planet.y, ship.x, ship.y);
              ship.x = planet.x + Math.cos(pushAngle) * (planet.radius + 8);
              ship.y = planet.y + Math.sin(pushAngle) * (planet.radius + 8);

              const outwardX = Math.cos(pushAngle);
              const outwardY = Math.sin(pushAngle);
              const inwardSpeed = ship.vx * outwardX + ship.vy * outwardY;
              if (inwardSpeed < 0) {
                ship.vx -= inwardSpeed * outwardX;
                ship.vy -= inwardSpeed * outwardY;
              }
            }
          }
        });

        if (shipsRadarRef) {
          shipsRadarRef.current = shipsRef.current.map((s) => ({
            id: s.id,
            ownerId: s.ownerId,
            x: s.x,
            y: s.y,
            angle: s.angle,
            isDead: s.isDead,
          }));
        }

        playerLandablePlanetRef.current = detectedLandablePlanet;

        // -------------------------------------------------------------
        // 5. PROJECTILES & COLLISION DETECTION
        // -------------------------------------------------------------
        const remainingProjectiles: Projectile[] = [];

        projectilesRef.current.forEach((proj) => {
          // Homing Rocket Guided Steering (Targets Installations, Space Stations, Colony Ships, and Enemy Ships)
          if (proj.isHomingRocket) {
            let targetPos = getHomingTargetPosition(proj, allPlanets);

            // Re-acquire nearest hostile entity if target lost or destroyed
            if (!targetPos) {
              const newTarget = findNearestHomingTarget(proj.x, proj.y, proj.angle, proj.ownerId, allPlanets, 1400);
              if (newTarget) {
                proj.homingTargetType = newTarget.type;
                proj.homingTargetId = newTarget.id;
                proj.homingPlanetId = newTarget.planetId || null;
                targetPos = { x: newTarget.x, y: newTarget.y };
              }
            }

            if (targetPos) {
              const desiredAngle = angleBetween(proj.x, proj.y, targetPos.x, targetPos.y);
              const angleDiff = shortestAngleDiff(proj.angle, desiredAngle);
              const turnRate = 5.2 * dt;
              proj.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate);

              const rocketSpeed = 310;
              proj.vx = Math.cos(proj.angle) * rocketSpeed;
              proj.vy = Math.sin(proj.angle) * rocketSpeed;
            }

            // Rocket smoke trail
            if (Math.random() < 0.65) {
              particlesRef.current.push({
                x: proj.x - Math.cos(proj.angle) * 5,
                y: proj.y - Math.sin(proj.angle) * 5,
                vx: -Math.cos(proj.angle) * 35 + (Math.random() - 0.5) * 15,
                vy: -Math.sin(proj.angle) * 35 + (Math.random() - 0.5) * 15,
                color: Math.random() < 0.5 ? '#f97316' : '#94a3b8',
                size: 2,
                alpha: 0.9,
                decay: 3.5,
                lifespan: 0,
              });
            }
          }

          proj.x += proj.vx * dt;
          proj.y += proj.vy * dt;
          proj.lifespan -= dt;

          if (proj.lifespan <= 0) return;

          let hit = false;

          // A. Collision with Ships
          for (const ship of shipsRef.current) {
            if (ship.isDead || ship.ownerId === proj.ownerId) continue;
            const d = distance(proj.x, proj.y, ship.x, ship.y);
            const hitDist = ship.flightState === 'landed' ? 12 : 8; // Slightly larger hitbox when docked to make shooting enemies off planets responsive
            if (d < hitDist) {
              hit = true;

              // Shield absorbs damage first! (25 HP shield)
              if (ship.shieldHp > 0) {
                const absorbed = Math.min(ship.shieldHp, proj.damage);
                ship.shieldHp -= absorbed;
                const leftover = proj.damage - absorbed;
                ship.hp -= leftover;

                // Cyan shield impact sparks
                for (let s = 0; s < 4; s++) {
                  particlesRef.current.push({
                    x: proj.x,
                    y: proj.y,
                    vx: (Math.random() - 0.5) * 60,
                    vy: (Math.random() - 0.5) * 60,
                    color: '#38bdf8',
                    size: 2,
                    alpha: 1,
                    decay: 4.0,
                    lifespan: 0,
                  });
                }
              } else {
                ship.hp -= proj.damage;
              }

              createExplosion(
                proj.x,
                proj.y,
                proj.isHomingRocket ? '#f97316' : proj.color,
                proj.isHomingRocket ? 18 : 12,
                Boolean(proj.isHomingRocket)
              );
              sound.playHit();

              if (ship.ownerId === 'player') {
                onPlayerHpChangeRef.current(Math.max(0, Math.round(ship.hp)), ship.maxHp);
                if (onPlayerBuffsChangeRef.current) {
                  onPlayerBuffsChangeRef.current({
                    shieldHp: ship.shieldHp,
                    maxShieldHp: ship.maxShieldHp,
                    hasDoubleDamage: ship.hasDoubleDamage,
                    hasHomingRockets: ship.hasHomingRockets,
                  });
                }
                if (ship.hp <= 2) sound.playAlarm();
              }

              if (ship.hp <= 0) {
                ship.isDead = true;
                ship.deaths++;
                ship.respawnTimer = 2.5;
                createExplosion(ship.x, ship.y, '#f43f5e', 42, true);

                // Balanced post-death defense trigger:
                // "When everything is colonized balanced will try to conquer but if they are being attacked, after they die they will defend before going back to conquer."
                const shipFaction = factions.find((f) => f.id === ship.ownerId);
                if (shipFaction?.aggression === 'balanced') {
                  const wasUnderAttack = allPlanets.some(
                    (p) => p.ownerId === ship.ownerId && p.lastAttackedTime && Date.now() - p.lastAttackedTime < 30000
                  );
                  if (wasUnderAttack) {
                    ship.aiDefendAfterDeath = true;
                    ship.aiDefendTimer = 25; // Prioritize defending for 25s upon respawn
                  }
                }

                const killerShip = shipsRef.current.find((s) => s.ownerId === proj.ownerId);
                if (killerShip) killerShip.kills++;

                if (proj.ownerId === 'player') {
                  onUpdateStatsRef.current({ shipsDestroyed: 1 });
                }
              }
              break;
            }
          }

          if (hit) return;

          // B. Collision with Planet Buildings (Installations)
          for (const planet of allPlanets) {
            if (planet.ownerId === proj.ownerId) continue;

            for (const bld of planet.buildings) {
              if (bld.hp <= 0) continue;
              const bPos = getBuildingWorldPos(planet.x, planet.y, planet.radius, bld.angleOnPlanet);
              const d = distance(proj.x, proj.y, bPos.x, bPos.y);
              const bldHitDist = proj.isHomingRocket ? 24 : 18;

              if (d < bldHitDist) {
                hit = true;
                bld.hp -= proj.damage;
                createExplosion(
                  proj.x,
                  proj.y,
                  proj.isHomingRocket ? '#f97316' : '#fbbf24',
                  proj.isHomingRocket ? 20 : 14,
                  Boolean(proj.isHomingRocket)
                );
                sound.playHit();

                planet.lastAttackedTime = Date.now();
                planet.lastAttackedBy = proj.ownerId;

                // Berserker grudge: If player attacks Berserker world, Berserker focuses on player in return
                if (proj.ownerId === 'player' && planet.ownerId) {
                  const berserkerShip = shipsRef.current.find((s) => s.ownerId === planet.ownerId);
                  const berserkerFaction = factions.find((f) => f.id === planet.ownerId);
                  if (berserkerFaction?.aggression === 'berserker' && berserkerShip) {
                    berserkerShip.aiGrudgeTarget = 'player';
                  }
                }

                if (bld.hp <= 0) {
                  createExplosion(bPos.x, bPos.y, '#f97316', 32, true);
                  if (proj.ownerId === 'player') {
                    onUpdateStatsRef.current({ buildingsDestroyed: 1 });
                  }
                }
                break;
              }
            }
            if (hit) break;

            // Space station collision
            if (planet.spaceStation && planet.spaceStation.ownerId !== proj.ownerId) {
              const st = planet.spaceStation;
              const stX = planet.x + Math.cos(st.angle) * st.distance;
              const stY = planet.y + Math.sin(st.angle) * st.distance;
              const stationHitDist = proj.isHomingRocket ? 28 : 22;
              if (distance(proj.x, proj.y, stX, stY) < stationHitDist) {
                hit = true;
                st.hp -= proj.damage;
                createExplosion(
                  proj.x,
                  proj.y,
                  proj.isHomingRocket ? '#f97316' : '#38bdf8',
                  proj.isHomingRocket ? 24 : 14,
                  Boolean(proj.isHomingRocket)
                );
                sound.playHit();

                planet.lastAttackedTime = Date.now();
                planet.lastAttackedBy = proj.ownerId;

                if (proj.ownerId === 'player' && planet.ownerId) {
                  const berserkerShip = shipsRef.current.find((s) => s.ownerId === planet.ownerId);
                  const berserkerFaction = factions.find((f) => f.id === planet.ownerId);
                  if (berserkerFaction?.aggression === 'berserker' && berserkerShip) {
                    berserkerShip.aiGrudgeTarget = 'player';
                  }
                }

                if (st.hp <= 0) {
                  createExplosion(stX, stY, '#ef4444', 36, true);
                  planet.spaceStation = null;
                }
                break;
              }
            }

            // Colony ships collision (scaled hitbox for half-width 4x length ark, dies to 5 shots!)
            for (let i = 0; i < planet.colonyShips.length; i++) {
              const cs = planet.colonyShips[i];
              const csHitDist = proj.isHomingRocket ? 24 : 18;
              if (cs.ownerId !== proj.ownerId && distance(proj.x, proj.y, cs.x, cs.y) < csHitDist) {
                hit = true;
                cs.hp -= proj.damage;
                createExplosion(
                  proj.x,
                  proj.y,
                  proj.isHomingRocket ? '#f97316' : '#10b981',
                  proj.isHomingRocket ? 22 : 15,
                  Boolean(proj.isHomingRocket)
                );
                sound.playHit();

                planet.lastAttackedTime = Date.now();
                planet.lastAttackedBy = proj.ownerId;

                if (proj.ownerId === 'player' && planet.ownerId) {
                  const berserkerShip = shipsRef.current.find((s) => s.ownerId === planet.ownerId);
                  const berserkerFaction = factions.find((f) => f.id === planet.ownerId);
                  if (berserkerFaction?.aggression === 'berserker' && berserkerShip) {
                    berserkerShip.aiGrudgeTarget = 'player';
                  }
                }

                if (cs.hp <= 0) {
                  createExplosion(cs.x, cs.y, '#ef4444', 38, true);
                  planet.colonyShips.splice(i, 1);

                  // Expansionist cycle: Destroyed a colony ship -> now mark a planet!
                  shipsRef.current.forEach((s) => {
                    const sFaction = factions.find((f) => f.id === s.ownerId);
                    if (sFaction?.aggression === 'expansionist') {
                      s.aiExpansionistPhase = 'mark_planet';
                    }
                  });
                }
                break;
              }
            }
            if (hit) break;
          }

          if (!hit) {
            remainingProjectiles.push(proj);
          }
        });

        projectilesRef.current = remainingProjectiles;

        // -------------------------------------------------------------
        // PLANET TAKEOVER / STAYING RESOLUTION:
        // "When a player or computer land on a planet if they stay on the planet another should not be able to take it over.
        // They can shoot them off it first. If two land then whoever landed first keeps control."
        // -------------------------------------------------------------
        allPlanets.forEach((planet) => {
          const landedOnPlanet = shipsRef.current.filter(
            (s) => !s.isDead && s.flightState === 'landed' && s.landedPlanetId === planet.id
          );

          if (landedOnPlanet.length > 0) {
            const ownerIsLanded = planet.ownerId
              ? landedOnPlanet.some((s) => s.ownerId === planet.ownerId)
              : false;

            const isCleared = planet.buildings.every((b) => b.hp <= 0);

            // If owner is not staying landed on the planet, and buildings are destroyed/none:
            if (!ownerIsLanded && isCleared) {
              // The landed occupant takes control (whoever landed first among the occupants)
              const firstOccupant = landedOnPlanet[0];
              if (planet.ownerId !== firstOccupant.ownerId) {
                const newOwnerFaction = factions.find((f) => f.id === firstOccupant.ownerId);
                planet.ownerId = firstOccupant.ownerId;
                planet.lastLandedBy = firstOccupant.ownerId;
                planet.buildings = [];
                createExplosion(planet.x, planet.y, newOwnerFaction?.color || '#38bdf8', planet.radius * 1.3, false);

                if (firstOccupant.ownerId === 'player') {
                  onUpdateStatsRef.current({ planetsClaimed: 1 });
                }
                if (firstOccupant.aiExpansionistPhase === 'mark_planet') {
                  firstOccupant.aiExpansionistPhase = 'destroy_colony_ship';
                }
                dispatchColonyShipsToPlanet(planet, firstOccupant.ownerId);
              }
            }
          }
        });

        // -------------------------------------------------------------
        // 6. PARTICLES & EXPLOSIONS
        // -------------------------------------------------------------
        particlesRef.current.forEach((p) => {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.alpha -= p.decay * dt;
        });
        particlesRef.current = particlesRef.current.filter((p) => p.alpha > 0);

        explosionsRef.current.forEach((ex) => {
          ex.elapsed += dt;
          ex.radius = (ex.elapsed / ex.duration) * ex.maxRadius;
        });
        explosionsRef.current = explosionsRef.current.filter((ex) => ex.elapsed < ex.duration);

        // -------------------------------------------------------------
        // 7. CAMERA INTERPOLATION (Follow Player in Space)
        // -------------------------------------------------------------
        const playerShip = shipsRef.current.find((s) => s.ownerId === 'player');
        if (playerShip && !playerShip.isDead) {
          const leadDist = 0.25;
          const targetCamX = playerShip.x + playerShip.vx * leadDist;
          const targetCamY = playerShip.y + playerShip.vy * leadDist;

          cameraRef.current.x += (targetCamX - cameraRef.current.x) * 0.08;
          cameraRef.current.y += (targetCamY - cameraRef.current.y) * 0.08;
        }
        cameraRef.current.zoom += (cameraRef.current.targetZoom - cameraRef.current.zoom) * 0.1;

        // -------------------------------------------------------------
        // 8. WIN / LOSE CONDITION
        // -------------------------------------------------------------
        if (!gameOverTriggeredRef.current) {
          const survivingFactions: FactionId[] = [];

          factions.forEach((f) => {
            const ship = shipsRef.current.find((s) => s.ownerId === f.id);
            const hasBase = allPlanets.some(
              (p) => p.ownerId === f.id && p.buildings.some((b) => b.type === 'base' && b.hp > 0)
            );

            if ((ship && !ship.isDead) || hasBase) {
              survivingFactions.push(f.id);
            }
          });

          if (survivingFactions.length === 1) {
            gameOverTriggeredRef.current = true;
            onGameOverRef.current(survivingFactions[0]);
          } else if (!survivingFactions.includes('player')) {
            gameOverTriggeredRef.current = true;
            onGameOverRef.current(survivingFactions[0] || 'bot_1');
          }
        }
      }

      // =============================================================
      // RENDER PASS (God view space map)
      // =============================================================
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const zoom = cameraRef.current.zoom;

      // Parallax starfield background
      ctx.save();
      const parallaxFactor = 0.15;
      const bgOffsetX = -(cameraRef.current.x * parallaxFactor) % 400;
      const bgOffsetY = -(cameraRef.current.y * parallaxFactor) % 400;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let x = -400; x < canvas.width + 400; x += 90) {
        for (let y = -400; y < canvas.height + 400; y += 90) {
          const px = x + bgOffsetX + ((x * 13) % 45);
          const py = y + bgOffsetY + ((y * 17) % 45);
          const size = (x + y) % 3 === 0 ? 1.5 : 1.0;
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(zoom, zoom);
      ctx.translate(-cameraRef.current.x, -cameraRef.current.y);

      // -------------------------------------------------------------
      // DRAW STARS & PLANET ORBITS
      // -------------------------------------------------------------
      starsRef.current.forEach((star) => {
        star.planets.forEach((planet) => {
          ctx.beginPath();
          ctx.arc(star.x, star.y, planet.orbitRadius, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
          ctx.lineWidth = 1 / zoom;
          ctx.stroke();
        });

        const glowRadius = star.radius * (1.8 + Math.sin(star.pulsePhase) * 0.08);
        const grad = ctx.createRadialGradient(star.x, star.y, star.radius * 0.3, star.x, star.y, glowRadius);
        grad.addColorStop(0, star.coreColor);
        grad.addColorStop(0.5, star.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.beginPath();
        ctx.arc(star.x, star.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = star.color;
        ctx.shadowColor = star.color;
        ctx.shadowBlur = 35;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.font = '500 13px Outfit, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.textAlign = 'center';
        ctx.fillText(star.name, star.x, star.y + star.radius + 24);
      });

      // -------------------------------------------------------------
      // DRAW PLANETS & SURFACE BUILDINGS
      // -------------------------------------------------------------
      getAllPlanets().forEach((planet) => {
        const faction = factions.find((f) => f.id === planet.ownerId);

        ctx.save();
        const auraColor = faction ? faction.glowColor : planet.atmosphereGlow;
        const auraGrad = ctx.createRadialGradient(
          planet.x,
          planet.y,
          planet.radius * 0.85,
          planet.x,
          planet.y,
          planet.radius * 1.35
        );
        auraGrad.addColorStop(0, auraColor);
        auraGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.beginPath();
        ctx.arc(planet.x, planet.y, planet.radius * 1.35, 0, Math.PI * 2);
        ctx.fillStyle = auraGrad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(planet.x, planet.y, planet.radius, 0, Math.PI * 2);
        ctx.fillStyle = planet.color;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(planet.x - planet.radius * 0.3, planet.y - planet.radius * 0.2, planet.radius * 0.35, 0, Math.PI * 2);
        ctx.arc(planet.x + planet.radius * 0.25, planet.y + planet.radius * 0.3, planet.radius * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = planet.surfaceDetailColor;
        ctx.fill();

        const shadeGrad = ctx.createLinearGradient(
          planet.x - planet.radius,
          planet.y - planet.radius,
          planet.x + planet.radius,
          planet.y + planet.radius
        );
        shadeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        shadeGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.25)');
        shadeGrad.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
        ctx.beginPath();
        ctx.arc(planet.x, planet.y, planet.radius, 0, Math.PI * 2);
        ctx.fillStyle = shadeGrad;
        ctx.fill();

        if (faction) {
          ctx.beginPath();
          ctx.arc(planet.x, planet.y, planet.radius + 3, 0, Math.PI * 2);
          ctx.strokeStyle = faction.color;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        // BUILDINGS ON PLANET SURFACE
        planet.buildings.forEach((bld) => {
          if (bld.hp <= 0) return;

          const bx = planet.x + Math.cos(bld.angleOnPlanet) * planet.radius;
          const by = planet.y + Math.sin(bld.angleOnPlanet) * planet.radius;

          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(bld.angleOnPlanet + Math.PI / 2);

          const bColor = faction ? faction.color : '#94a3b8';

          if (bld.type === 'base') {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-10, -12, 20, 14);
            ctx.fillStyle = bColor;
            ctx.beginPath();
            ctx.arc(0, -12, 6, Math.PI, 0);
            ctx.fill();
            ctx.strokeStyle = '#f8fafc';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, -12);
            ctx.lineTo(0, -20);
            ctx.stroke();
          } else if (bld.type === 'production_hub') {
            ctx.fillStyle = '#334155';
            ctx.fillRect(-9, -10, 18, 12);
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(-6, -14, 4, 6);
            ctx.fillRect(2, -14, 4, 6);
            ctx.fillStyle = bColor;
            ctx.fillRect(-7, -4, 14, 4);
          } else if (bld.type === 'lab') {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-8, -6, 16, 8);
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(0, -6, 7, Math.PI, 0);
            ctx.fill();
          } else if (bld.type === 'comms_center') {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-6, -6, 12, 8);
            ctx.strokeStyle = bColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, -12, 7, 0.2, Math.PI - 0.2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, -6);
            ctx.lineTo(0, -12);
            ctx.stroke();
          }

          const hpRatio = bld.hp / bld.maxHp;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(-11, -24, 22, 3);
          ctx.fillStyle = hpRatio > 0.5 ? '#10b981' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
          ctx.fillRect(-11, -24, 22 * hpRatio, 3);

          ctx.restore();
        });

        // 4 BASE DEFENSE TURRETS
        const hasBase = planet.buildings.some((b) => b.type === 'base' && b.hp > 0);
        if (hasBase && faction) {
          for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI) / 2;
            const tx = planet.x + Math.cos(angle) * (planet.radius + 2);
            const ty = planet.y + Math.sin(angle) * (planet.radius + 2);

            ctx.save();
            ctx.translate(tx, ty);
            ctx.rotate(angle + Math.PI / 2);
            ctx.fillStyle = faction.color;
            ctx.fillRect(-3, -5, 6, 6);
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(-1, -8, 2, 4);
            ctx.restore();
          }
        }

        // SPACE STATION
        if (planet.spaceStation && faction) {
          const st = planet.spaceStation;
          const stX = planet.x + Math.cos(st.angle) * st.distance;
          const stY = planet.y + Math.sin(st.angle) * st.distance;
          const stHeading = st.angle + Math.PI / 2;

          ctx.save();
          ctx.translate(stX, stY);
          ctx.rotate(stHeading);

          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-16, -6, 32, 12);
          ctx.fillStyle = faction.color;
          ctx.fillRect(-12, -4, 24, 8);

          ctx.fillStyle = '#0284c7';
          ctx.fillRect(-4, -14, 8, 8);
          ctx.fillRect(-4, 6, 8, 8);

          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(15, -4, 5, 2);
          ctx.fillRect(15, 2, 5, 2);
          ctx.fillRect(-20, -4, 5, 2);
          ctx.fillRect(-20, 2, 5, 2);

          const stHpRatio = st.hp / st.maxHp;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(-14, -18, 28, 3);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(-14, -18, 28 * stHpRatio, 3);

          ctx.restore();
        }

        // COLONY SHIPS (Redesigned 4x Interstellar Colony Ark)
        planet.colonyShips.forEach((cs) => {
          ctx.save();
          ctx.translate(cs.x, cs.y);
          ctx.rotate(cs.angle);

          const csFaction = factions.find((f) => f.id === cs.ownerId);
          const csColor = csFaction?.color || '#38bdf8';
          const csAccent = csFaction?.accentColor || '#67e8f9';

          // 1. Heavy Ion Thruster Glow (Stern)
          const engineGlow = ctx.createRadialGradient(-26, 0, 1, -26, 0, 11);
          engineGlow.addColorStop(0, cs.state === 'traveling' ? 'rgba(56, 189, 248, 0.9)' : 'rgba(56, 189, 248, 0.35)');
          engineGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = engineGlow;
          ctx.beginPath();
          ctx.arc(-26, 0, 11, 0, Math.PI * 2);
          ctx.fill();

          // 2. Heavy Outrigger Cargo Pontoons / Hull Framing (Half as wide)
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.4;

          // Upper port pontoon
          ctx.beginPath();
          ctx.roundRect(-24, -11, 42, 5, 2);
          ctx.fill();
          ctx.stroke();

          // Lower starboard pontoon
          ctx.beginPath();
          ctx.roundRect(-24, 6, 42, 5, 2);
          ctx.fill();
          ctx.stroke();

          // Connecting cross-struts
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-10, -6, 20, 12);
          ctx.fillRect(6, -6, 8, 12);

          // 3. Central Main Armored Hull Spine (Half as wide, full length)
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.moveTo(30, 0); // Forward bow wedge
          ctx.lineTo(20, -5.5);
          ctx.lineTo(-24, -5.5);
          ctx.lineTo(-28, -3);
          ctx.lineTo(-28, 3);
          ctx.lineTo(-24, 5.5);
          ctx.lineTo(20, 5.5);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = csColor;
          ctx.lineWidth = 1.4;
          ctx.stroke();

          // 4. Faction Colored Armored Bow Plates
          ctx.fillStyle = csColor;
          ctx.beginPath();
          ctx.moveTo(30, 0);
          ctx.lineTo(20, -4.5);
          ctx.lineTo(12, -4.5);
          ctx.lineTo(18, 0);
          ctx.lineTo(12, 4.5);
          ctx.lineTo(20, 4.5);
          ctx.closePath();
          ctx.fill();

          // 5. Four Modular Cylindrical Colony Habitation Pods (Base, Hub, Lab, Comms)
          const podCoords = [
            { x: -10, y: -8.5 },
            { x: 6, y: -8.5 },
            { x: -10, y: 8.5 },
            { x: 6, y: 8.5 },
          ];

          podCoords.forEach((p) => {
            // Pod cylinder
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.roundRect(p.x - 7, p.y - 2.5, 14, 5, 1.5);
            ctx.fill();
            ctx.strokeStyle = csColor;
            ctx.lineWidth = 0.9;
            ctx.stroke();

            // Glowing habitat windows
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(p.x - 4, p.y - 1, 3, 2);
            ctx.fillRect(p.x + 1, p.y - 1, 3, 2);
          });

          // 6. Central Spherical Pressurized Biosphere Dome
          const domeGrad = ctx.createRadialGradient(-2, -1, 1, -2, 0, 5);
          domeGrad.addColorStop(0, '#ffffff');
          domeGrad.addColorStop(0.3, csAccent);
          domeGrad.addColorStop(0.8, '#0369a1');
          domeGrad.addColorStop(1, '#0c4a6e');

          ctx.fillStyle = domeGrad;
          ctx.beginPath();
          ctx.arc(-2, 0, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Terraforming greenery glint inside dome
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(-1, 1, 1.8, 0, Math.PI * 2);
          ctx.fill();

          // 7. Quad Heavy Engine Nozzles at Stern
          ctx.fillStyle = '#475569';
          [-8.5, -3, 3, 8.5].forEach((ny) => {
            ctx.fillRect(-28, ny - 1.2, 4, 2.4);
            if (cs.state === 'traveling') {
              ctx.fillStyle = '#38bdf8';
              ctx.fillRect(-31, ny - 1, 3, 2);
              ctx.fillStyle = '#475569';
            }
          });

          // 8. Forward Sensor Array / Antenna Spike
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(30, 0);
          ctx.lineTo(36, 0);
          ctx.stroke();

          // Very small dot the color of the player who owns it for colony ships once they leave a planet
          if (cs.state === 'traveling') {
            ctx.save();
            ctx.beginPath();
            ctx.arc(37, 0, 2.8, 0, Math.PI * 2);
            ctx.fillStyle = csColor;
            ctx.shadowColor = csColor;
            ctx.shadowBlur = 7;
            ctx.fill();

            // Tiny crisp white core
            ctx.beginPath();
            ctx.arc(37, 0, 1.1, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
          }

          // Construction Laser Beam if building on planet
          if (cs.state === 'building') {
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#fbbf24';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.lineTo(50, 0);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          // Unrotate to render UI text and 5 Health Pips upright
          ctx.rotate(-cs.angle);

          // 9. 5 Health Pips (Dies to 5 shots!)
          const pipW = 5;
          const pipH = 3;
          const pipSpacing = 2;
          const totalPipW = 5 * pipW + 4 * pipSpacing;
          const startPx = -totalPipW / 2;

          for (let hpIdx = 0; hpIdx < 5; hpIdx++) {
            ctx.fillStyle = hpIdx < cs.hp ? '#10b981' : 'rgba(239, 68, 68, 0.4)';
            ctx.fillRect(startPx + hpIdx * (pipW + pipSpacing), -16, pipW, pipH);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(startPx + hpIdx * (pipW + pipSpacing), -16, pipW, pipH);
          }

          // Title & Status
          ctx.font = '700 9px Outfit, sans-serif';
          ctx.fillStyle = csColor;
          ctx.textAlign = 'center';

          let statusText = 'COLONY ARK';
          if (cs.state === 'building') {
            statusText = `COLONIZING (${Math.floor(cs.buildProgress || 0)}%)`;
          } else if (cs.state === 'traveling') {
            const targetP = getAllPlanets().find((p) => p.id === cs.targetPlanetId);
            if (cs.targetPlanetId === cs.originPlanetId) {
              statusText = 'RETURNING HOME';
            } else if (targetP) {
              statusText = `EN ROUTE: ${targetP.name}`;
            }
          }
          ctx.fillText(statusText, 0, -21);

          ctx.restore();
        });

        // Planet Name & Status Label
        ctx.font = '600 12px Plus Jakarta Sans, sans-serif';
        ctx.fillStyle = faction ? faction.color : 'rgba(255, 255, 255, 0.7)';
        ctx.textAlign = 'center';
        ctx.fillText(planet.name, planet.x, planet.y + planet.radius + 18);

        // Production text
        if (planet.productionQueue) {
          const queue = planet.productionQueue;
          const remainingSec = Math.max(0, Math.ceil(queue.duration - queue.progress));
          const label = queue.target === 'building'
            ? `Rebuilding ${queue.buildingType} (${remainingSec}s)`
            : queue.target === 'station'
            ? `Constructing Station (${remainingSec}s)`
            : `Building Colony Ship (${remainingSec}s)`;

          ctx.font = '500 10px JetBrains Mono, monospace';
          ctx.fillStyle = '#38bdf8';
          ctx.fillText(label, planet.x, planet.y + planet.radius + 32);
        }

        ctx.restore();
      });

      // -------------------------------------------------------------
      // DRAW SHIPS (Landed, Launching, Flying, Landing)
      // -------------------------------------------------------------
      shipsRef.current.forEach((ship) => {
        if (ship.isDead) return;

        const faction = factions.find((f) => f.id === ship.ownerId)!;

        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.rotate(ship.angle);

        // Ship Hull - Exactly half size (was 16x20, now 8x10)
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-6, -5);
        ctx.lineTo(-3.5, 0);
        ctx.lineTo(-6, 5);
        ctx.closePath();

        ctx.fillStyle = faction.shipColor;
        ctx.fill();
        ctx.strokeStyle = faction.accentColor;
        ctx.lineWidth = 1.3;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(1, 0, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Engine flame if thrusting, boosting, or launching (half size)
        if (ship.thrusting || ship.boosting || ship.flightState === 'launching') {
          if (ship.boosting) {
            // Hyper-thrust flame: twice as long, electric cyan/white
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.moveTo(-4, -2.5);
            ctx.lineTo(-20 - Math.random() * 8, 0);
            ctx.lineTo(-4, 2.5);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(-4, -1.2);
            ctx.lineTo(-13 - Math.random() * 4, 0);
            ctx.lineTo(-4, 1.2);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.moveTo(-4, -2);
            ctx.lineTo(-10 - Math.random() * 4, 0);
            ctx.lineTo(-4, 2);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.moveTo(-4, -1);
            ctx.lineTo(-7 - Math.random() * 2, 0);
            ctx.lineTo(-4, 1);
            ctx.closePath();
            ctx.fill();
          }
        }

        ctx.rotate(-ship.angle);

        // 25 HP Energy Shield Bubble
        if (ship.shieldHp > 0) {
          const shieldAlpha = Math.max(0.25, ship.shieldHp / 25);
          ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + 0.5 * shieldAlpha})`;
          ctx.fillStyle = `rgba(56, 189, 248, ${0.08 + 0.12 * shieldAlpha})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(0, 0, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Pulsing energy ring
          const pRing = (Date.now() % 800) / 800;
          ctx.strokeStyle = `rgba(125, 211, 252, ${0.3 * (1 - pRing)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, 14 + pRing * 3.5, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 5 Health Pips - Scaled to fit half-size ship
        const pipWidth = 3;
        const pipHeight = 2;
        const pipSpacing = 1.5;
        const totalW = 5 * pipWidth + 4 * pipSpacing;
        const startPx = -totalW / 2;

        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = i < ship.hp ? faction.color : 'rgba(255, 255, 255, 0.15)';
          ctx.fillRect(startPx + i * (pipWidth + pipSpacing), -13, pipWidth, pipHeight);
        }

        // 25 HP Shield Bar (above health pips if active)
        if (ship.shieldHp > 0) {
          const sRatio = Math.max(0, Math.min(1, ship.shieldHp / 25));
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.fillRect(-10, -16.5, 20, 2);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(-10, -16.5, 20 * sRatio, 2);
          ctx.strokeStyle = 'rgba(2, 132, 199, 0.8)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(-10, -16.5, 20, 2);
        }

        // Thrust Boost Energy Bar on all ships
        const boostRatio = Math.max(0, Math.min(1, ship.boost / ship.maxBoost));
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(-10, -9.5, 20, 2);
        ctx.fillStyle = ship.boosting ? '#38bdf8' : '#0284c7';
        ctx.fillRect(-10, -9.5, 20 * boostRatio, 2);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-10, -9.5, 20, 2);

        ctx.font = '600 9px Plus Jakarta Sans, sans-serif';
        ctx.fillStyle = faction.color;
        ctx.textAlign = 'center';

        const boostTag = ship.boosting ? ' [BOOST 2X]' : '';
        const buffIcons = (ship.shieldHp > 0 ? ' 🛡️' : '') + (ship.hasDoubleDamage ? ' ⚡2X' : '') + (ship.hasHomingRockets ? ' 🚀' : '');
        const statusTag = ship.flightState === 'landed' ? ' [LANDED]' : ship.flightState === 'launching' ? ' [LIFTOFF]' : ship.flightState === 'landing' ? ' [LANDING]' : boostTag;
        const tagY = ship.shieldHp > 0 ? -19 : -17;
        ctx.fillText(faction.name + statusTag + buffIcons, 0, tagY);

        ctx.restore();
      });

      // -------------------------------------------------------------
      // DRAW PROJECTILES / MISSILES
      // -------------------------------------------------------------
      projectilesRef.current.forEach((proj) => {
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(proj.angle);

        if (proj.isHomingRocket) {
          // Guided Homing Missile Sprite
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(-5, -2, 10, 4);

          // Fins
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.moveTo(-5, -4);
          ctx.lineTo(-2, -2);
          ctx.lineTo(-5, -2);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(-5, 4);
          ctx.lineTo(-2, 2);
          ctx.lineTo(-5, 2);
          ctx.closePath();
          ctx.fill();

          // Red warhead
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(5, -2);
          ctx.lineTo(9, 0);
          ctx.lineTo(5, 2);
          ctx.closePath();
          ctx.fill();

          // Thruster flare
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.moveTo(-5, -1.5);
          ctx.lineTo(-9 - Math.random() * 3, 0);
          ctx.lineTo(-5, 1.5);
          ctx.closePath();
          ctx.fill();
        } else {
          // Laser Bolt (Wider and glowing if Double Damage)
          const isDouble = proj.damage > 1;
          ctx.beginPath();
          ctx.moveTo(isDouble ? -6 : -4.5, 0);
          ctx.lineTo(isDouble ? 6 : 4.5, 0);
          ctx.strokeStyle = proj.color;
          ctx.lineWidth = isDouble ? 3.8 : 2.5;
          ctx.shadowColor = proj.color;
          ctx.shadowBlur = isDouble ? 12 : 8;
          ctx.stroke();

          if (isDouble) {
            ctx.beginPath();
            ctx.moveTo(-4, 0);
            ctx.lineTo(4, 0);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.shadowBlur = 0;
        }

        ctx.restore();
      });

      // -------------------------------------------------------------
      // DRAW PARTICLES & EXPLOSIONS
      // -------------------------------------------------------------
      particlesRef.current.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      explosionsRef.current.forEach((ex) => {
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
        ctx.strokeStyle = ex.color;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 1 - ex.elapsed / ex.duration;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      });

      // -------------------------------------------------------------
      // DRAW FLOATING COMBAT & BUFF TEXTS
      // -------------------------------------------------------------
      const remainingTexts: typeof floatingTextsRef.current = [];
      floatingTextsRef.current.forEach((ft) => {
        ft.y -= 14 * dt;
        ft.lifespan -= dt;
        ft.alpha = Math.max(0, ft.lifespan / 2.0);

        if (ft.lifespan > 0 && ft.alpha > 0) {
          ctx.save();
          ctx.font = '700 11px Outfit, Plus Jakarta Sans, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = `rgba(0, 0, 0, ${ft.alpha * 0.75})`;
          ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
          ctx.fillStyle = ft.color;
          ctx.globalAlpha = ft.alpha;
          ctx.fillText(ft.text, ft.x, ft.y);
          ctx.restore();

          remainingTexts.push(ft);
        }
      });
      floatingTextsRef.current = remainingTexts;

      ctx.restore(); // Restore world transform

      // -------------------------------------------------------------
      // SCREEN-SPACE PROMPTS: LIFTOFF & LANDING HINTS
      // -------------------------------------------------------------
      const humanShip = shipsRef.current.find((s) => s.ownerId === 'player');
      if (humanShip && !humanShip.isDead) {
        if (humanShip.flightState === 'landed') {
          const thrustKeys = (keyBindingsRef.current?.thrust || ['KeyW', 'ArrowUp'])
            .map((k) => `[${formatKeyCode(k)}]`)
            .join(' OR ');
          ctx.save();
          ctx.font = '700 13px Outfit, sans-serif';
          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.fillText(`PRESS ${thrustKeys} TO BLAST OFF INTO SPACE`, cx, cy + 90);
          ctx.restore();
        } else if (humanShip.flightState === 'flying' && playerLandablePlanetRef.current) {
          const landKeys = (keyBindingsRef.current?.land || ['KeyS', 'ArrowDown', 'KeyL'])
            .map((k) => `[${formatKeyCode(k)}]`)
            .join(' OR ');
          ctx.save();
          ctx.font = '700 13px Outfit, sans-serif';
          ctx.fillStyle = '#10b981';
          ctx.textAlign = 'center';
          ctx.fillText(`PRESS ${landKeys} TO LAND ON ${playerLandablePlanetRef.current.name.toUpperCase()}`, cx, cy + 90);
          ctx.restore();
        }
      }

      ctx.restore(); // Restore canvas state

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    stars,
    factions,
    isPaused,
    getAllPlanets,
  ]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair" />
    </div>
  );
};
