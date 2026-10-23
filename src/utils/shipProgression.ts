import { ShipClass } from '../types/game';

export interface ShipClassDef {
  id: ShipClass;
  name: string;
  codename: string;
  role: string;
  description: string;
  unlockCondition: string;
  prerequisiteClass: ShipClass | null;
  hull: number;
  speedRating: 'Normal' | 'Blistering' | 'Armored / Slow';
  weaponName: string;
  specialName: string;
  specialDescription: string;
  specialCooldown: number; // in seconds
  color: string;
}

export const SHIP_CLASS_DEFS: Record<ShipClass, ShipClassDef> = {
  standard: {
    id: 'standard',
    name: 'Terran Scout',
    codename: 'Standard Fighter',
    role: 'Balanced Strike Craft',
    description: 'Versatile space superiority fighter with balanced speed, twin blasters, and agile maneuverability.',
    unlockCondition: 'Unlocked by default',
    prerequisiteClass: null,
    hull: 5,
    speedRating: 'Normal',
    weaponName: 'Twin Plasma Blasters',
    specialName: 'Standard Overdrive',
    specialDescription: 'Equipped with standard afterburner thrusters (Hold Shift).',
    specialCooldown: 0,
    color: '#38bdf8',
  },
  interceptor: {
    id: 'interceptor',
    name: 'Vanguard Interceptor',
    codename: 'Interceptor',
    role: 'Glass Cannon / Speed Demon',
    description: 'Ultra-light needle-hull racer with blistering velocity, rapid dual-firing blasters, and an evasive dash, balanced by a fragile hull.',
    unlockCondition: 'Win a campaign with the Standard Fighter',
    prerequisiteClass: 'standard',
    hull: 3,
    speedRating: 'Blistering',
    weaponName: 'Rapid Twin Autocannons',
    specialName: 'EMP Shockwave',
    specialDescription: 'Every 30s: Emits a massive ionized EMP blast that knocks out enemy ship flight controls and planetary turret firing for 10 seconds.',
    specialCooldown: 30,
    color: '#06b6d4',
  },
  commander: {
    id: 'commander',
    name: 'Aegis Commander',
    codename: 'Commander',
    role: 'Fleet Carrier / Swarm Host',
    description: 'Armored command vessel equipped to deploy aggressive autonomous combat drones that strike hostile planetary garrisons.',
    unlockCondition: 'Win a campaign with the Interceptor',
    prerequisiteClass: 'interceptor',
    hull: 5,
    speedRating: 'Normal',
    weaponName: 'Twin Heavy Lasers',
    specialName: 'Attack Drone Swarm',
    specialDescription: 'Every 30s: Launches 10 mini attack drones (survive 2 shots each) that swarm and aggressively bombard the nearest unallied planet.',
    specialCooldown: 30,
    color: '#3b82f6',
  },
  heavy_frigate: {
    id: 'heavy_frigate',
    name: 'Titan Dreadnought',
    codename: 'Heavy Frigate',
    role: 'Heavy Siege / Fortress',
    description: 'Behemoth warship with thick rechargeable energy shields, multi-target explosive flak cannons, and a catastrophic planet-clearing death laser.',
    unlockCondition: 'Win a campaign with the Commander',
    prerequisiteClass: 'commander',
    hull: 7,
    speedRating: 'Armored / Slow',
    weaponName: 'Explosive Flak Battery',
    specialName: 'Titan Death Beam',
    specialDescription: 'Every 30s: Unleashes a planet-sized apocalyptic beam across the entire sector, obliterating all enemy ships, colony arks, and planetary installations in its path.',
    specialCooldown: 30,
    color: '#a855f7',
  },
};

const UNLOCKS_STORAGE_KEY = 'galactic_clash_unlocked_ships_v1';

export interface ShipUnlocks {
  standard: boolean;
  interceptor: boolean;
  commander: boolean;
  heavy_frigate: boolean;
}

export function getShipUnlocks(): ShipUnlocks {
  if (typeof window === 'undefined') {
    return { standard: true, interceptor: false, commander: false, heavy_frigate: false };
  }
  try {
    const raw = localStorage.getItem(UNLOCKS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        standard: true,
        interceptor: !!parsed.interceptor,
        commander: !!parsed.commander,
        heavy_frigate: !!parsed.heavy_frigate,
      };
    }
  } catch (err) {
    console.error('Failed to load ship unlocks', err);
  }
  return { standard: true, interceptor: false, commander: false, heavy_frigate: false };
}

export function saveShipUnlocks(unlocks: ShipUnlocks): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(UNLOCKS_STORAGE_KEY, JSON.stringify(unlocks));
  } catch (err) {
    console.error('Failed to save ship unlocks', err);
  }
}

export function unlockShipClass(shipClass: ShipClass): ShipUnlocks {
  const current = getShipUnlocks();
  current[shipClass] = true;
  saveShipUnlocks(current);
  return current;
}

/**
 * Checks if winning with the current ship class unlocks the next ship class in the tree.
 * Returns the newly unlocked class if an unlock occurred, or null.
 */
export function checkAndUnlockNext(currentClass: ShipClass): ShipClass | null {
  const unlocks = getShipUnlocks();
  let newlyUnlocked: ShipClass | null = null;

  if (currentClass === 'standard' && !unlocks.interceptor) {
    newlyUnlocked = 'interceptor';
  } else if (currentClass === 'interceptor' && !unlocks.commander) {
    newlyUnlocked = 'commander';
  } else if (currentClass === 'commander' && !unlocks.heavy_frigate) {
    newlyUnlocked = 'heavy_frigate';
  }

  if (newlyUnlocked) {
    unlockShipClass(newlyUnlocked);
  }

  return newlyUnlocked;
}
