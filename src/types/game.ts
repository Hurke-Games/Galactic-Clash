export type FactionId = 'player' | 'bot_1' | 'bot_2' | 'bot_3';

export type AIAggression = 'passive' | 'balanced' | 'aggressive' | 'berserker' | 'expansionist';

export interface FactionConfig {
  id: FactionId;
  name: string;
  isHuman: boolean;
  color: string;
  accentColor: string;
  glowColor: string;
  shipColor: string;
  aggression?: AIAggression;
}

export type BuildingType = 'base' | 'production_hub' | 'lab' | 'comms_center';

export interface Building {
  id: string;
  type: BuildingType;
  name: string;
  maxHp: number;
  hp: number;
  angleOnPlanet: number; // In radians, determines position on planet perimeter
  width: number;
  height: number;
  rebuildTimer?: number; // In seconds when being rebuilt
}

export interface SpaceStation {
  id: string;
  ownerId: FactionId;
  angle: number; // orbital angle
  distance: number; // distance from planet center
  orbitSpeed: number;
  hp: number;
  maxHp: number;
  fireCooldown: number; // seconds until next 4-shot volley
}

export interface ColonyShip {
  id: string;
  ownerId: FactionId;
  originPlanetId: string;
  targetPlanetId?: string; // If traveling to colonize or returning home
  orbitPlanetId?: string; // Current planet being orbited
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  state: 'orbiting' | 'traveling' | 'building';
  orbitAngle: number;
  orbitDistance: number;
  orbitSpeed: number;
  hp: number;
  maxHp: number;
  fireCooldown: number; // seconds until next 2-shot volley
  buildProgress?: number; // 0 to 100 when building on arrival
}

export interface Planet {
  id: string;
  name: string;
  starId: string;
  orbitRadius: number; // distance from star
  orbitAngle: number;
  orbitSpeed: number;
  radius: number;
  color: string;
  surfaceDetailColor: string;
  atmosphereColor: string;
  atmosphereGlow: string;
  hasRings?: boolean;
  ringColor?: string;
  x: number; // Current calculated world position
  y: number;
  ownerId: FactionId | null; // null if uncolonized
  buildings: Building[];
  spaceStation: SpaceStation | null;
  colonyShips: ColonyShip[];
  productionQueue: {
    target: 'building' | 'station' | 'colony_ship';
    buildingType?: BuildingType;
    duration: number; // total required time (e.g. 30s)
    progress: number; // current elapsed time
  } | null;
  turretFireCooldown: number; // Defense base cooldown
  lastLandedBy: FactionId | null;
  lastAttackedTime?: number;
  lastAttackedBy?: FactionId | null;
}

export interface Star {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  coronaColor: string;
  coreColor: string;
  pulsePhase: number;
  planets: Planet[];
}

export type ShipFlightState = 'landed' | 'launching' | 'flying' | 'landing';

export interface Ship {
  id: string;
  ownerId: FactionId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // In radians, 0 is facing right
  thrusting: boolean;
  hp: number;
  maxHp: number;
  fireCooldown: number;
  respawnTimer: number; // If dead
  isDead: boolean;
  lastLandedPlanetId: string | null;
  kills: number;
  deaths: number;
  planetsColonized: number;
  // Thrust & Boost Energy (Burns in 3s, Regens in 12s, 2x Speed)
  boost: number;
  maxBoost: number;
  boosting: boolean;
  // Upgrades & Buffs (Rolled after dying or landing on colonized worlds)
  shieldHp: number; // Shield with up to 25 HP
  maxShieldHp: number;
  hasDoubleDamage: boolean; // 2x damage on all weapons
  hasHomingRockets: boolean; // Guided homing missiles
  // Flight & Landing States
  flightState: ShipFlightState;
  landedPlanetId: string | null;
  surfaceAngle: number;
  transitionProgress: number; // 0 to 1 during launch or landing animation
  aiLaunchTimer?: number; // Timer before bot launches off planet
  aiGrudgeTarget?: FactionId | null; // For Berserker grudges against attacking player
  aiDefendAfterDeath?: boolean; // For Balanced defending after death before conquering
  aiDefendTimer?: number;
  aiExpansionistPhase?: 'destroy_colony_ship' | 'mark_planet'; // For Expansionist cycle
  aiExpansionistTargetColonyShipId?: string | null;
  homeStarId?: string | null; // Home star system ID
  aiTargetStarId?: string | null; // For Defender conquering one star system at a time
  // Anti-Relanding & Combat Switch
  recentLandingPlanetId?: string | null;
  samePlanetLandingCount?: number;
  forceFightTimer?: number;
  planetLandingCooldownId?: string | null;
  planetLandingCooldown?: number;
}

export interface ShipRadarMarker {
  id: string;
  ownerId: FactionId;
  x: number;
  y: number;
  angle: number;
  isDead: boolean;
}

export interface Projectile {
  id: string;
  ownerId: FactionId;
  sourceType: 'ship' | 'base_turret' | 'space_station' | 'colony_ship';
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  color: string;
  damage: number;
  lifespan: number; // Remaining time in seconds
  radius: number;
  isHomingRocket?: boolean;
  homingTargetType?: 'ship' | 'building' | 'space_station' | 'colony_ship';
  homingTargetId?: string | null;
  homingPlanetId?: string | null;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  lifespan: number;
}

export interface Explosion {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  duration: number;
  elapsed: number;
}

export interface KeyBindings {
  thrust: string[];
  land: string[];
  reverse: string[];
  turnLeft: string[];
  turnRight: string[];
  shoot: string[];
}

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  thrust: ['KeyW', 'ArrowUp'],
  land: ['KeyS', 'ArrowDown', 'KeyL'], // S, Down Arrow, and L by default!
  reverse: ['KeyS', 'ArrowDown'],
  turnLeft: ['KeyA', 'ArrowLeft'],
  turnRight: ['KeyD', 'ArrowRight'],
  shoot: ['Space', 'KeyF'],
};

export interface GameSettings {
  starCount: number; // 4 to 8
  aiPlayerCount: number; // 1 to 3
  aiAggression: AIAggression;
  aiStyles?: AIAggression[]; // Per-rival style configuration
  soundEnabled: boolean;
  showMinimap: boolean;
  keyBindings?: KeyBindings;
}

export interface GameStats {
  elapsedTime: number;
  shotsFired: number;
  buildingsDestroyed: number;
  shipsDestroyed: number;
  planetsClaimed: number;
}
