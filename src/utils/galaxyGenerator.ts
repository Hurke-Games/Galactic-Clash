import { Star, Planet, Building, FactionConfig, FactionId, BuildingType } from '../types/game';

const STAR_NAMES = [
  'Solaria', 'Sirius', 'Vega', 'Antares', 'Betelgeuse', 'Aldebaran', 'Rigel',
  'Polaris', 'Proxima', 'Altair', 'Deneb', 'Spica', 'Arcturus', 'Capella',
  'Canopus', 'Castor', 'Pollux', 'Bellatrix', 'Mira', 'Achernar'
];

const PLANET_NAMES = [
  'Prime', 'Nova', 'Aegis', 'Vanguard', 'Zephyr', 'Orion', 'Elysium', 'Tartarus',
  'Chronos', 'Hyperion', 'Caelum', 'Zenith', 'Nadir', 'Apex', 'Crux', 'Vesper',
  'Aurora', 'Valhalla', 'Titan', 'Atlas', 'Nemesis', 'Helios', 'Selene', 'Nyx'
];

const STAR_PALETTES = [
  { color: '#f59e0b', corona: 'rgba(245, 158, 11, 0.35)', core: '#fef3c7' }, // Solar Yellow
  { color: '#38bdf8', corona: 'rgba(56, 189, 248, 0.35)', core: '#f0f9ff' }, // Blue Giant
  { color: '#ef4444', corona: 'rgba(239, 68, 68, 0.35)', core: '#fee2e2' }, // Red Giant
  { color: '#fb923c', corona: 'rgba(251, 146, 60, 0.35)', core: '#fff7ed' }, // Orange Dwarf
  { color: '#a855f7', corona: 'rgba(168, 85, 247, 0.35)', core: '#faf5ff' }, // Violet Pulsar
  { color: '#2dd4bf', corona: 'rgba(45, 212, 191, 0.35)', core: '#f0fdfa' }, // Cyan Hypergiant
];

const PLANET_THEMES = [
  { color: '#10b981', detail: '#047857', atmosphere: 'rgba(52, 211, 153, 0.4)', glow: '#059669' }, // Terran
  { color: '#0284c7', detail: '#0369a1', atmosphere: 'rgba(56, 189, 248, 0.45)', glow: '#0284c7' }, // Ocean
  { color: '#dc2626', detail: '#991b1b', atmosphere: 'rgba(248, 113, 113, 0.35)', glow: '#b91c1c' }, // Volcanic
  { color: '#d97706', detail: '#b45309', atmosphere: 'rgba(251, 191, 36, 0.35)', glow: '#d97706' }, // Desert
  { color: '#06b6d4', detail: '#0891b2', atmosphere: 'rgba(103, 232, 249, 0.45)', glow: '#0891b2' }, // Ice
  { color: '#8b5cf6', detail: '#6d28d9', atmosphere: 'rgba(196, 181, 253, 0.4)', glow: '#7c3aed' }, // Exotic Purple
  { color: '#64748b', detail: '#475569', atmosphere: 'rgba(148, 163, 184, 0.3)', glow: '#475569' }, // Barren Rock
];

export function createStandardBuildings(): Building[] {
  // 4 buildings positioned evenly around the perimeter: 0, PI/2, PI, 3*PI/2
  const types: BuildingType[] = ['base', 'production_hub', 'lab', 'comms_center'];
  const names: Record<BuildingType, string> = {
    base: 'Planetary Base',
    production_hub: 'Production Hub',
    lab: 'Research Lab',
    comms_center: 'Comms Center',
  };

  return types.map((type, idx) => ({
    id: `bld_${type}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    name: names[type],
    maxHp: type === 'base' ? 20 : 10,
    hp: type === 'base' ? 20 : 10,
    angleOnPlanet: (idx * Math.PI) / 2, // 0, 90, 180, 270 degrees
    width: 22,
    height: 18,
  }));
}

export function generateGalaxy(
  starCount: number,
  factions: FactionConfig[]
): { stars: Star[]; assignedPlanets: Map<FactionId, Planet> } {
  const stars: Star[] = [];
  const assignedPlanets = new Map<FactionId, Planet>();

  const shuffledStarNames = [...STAR_NAMES].sort(() => Math.random() - 0.5);
  const shuffledPlanetNames = [...PLANET_NAMES].sort(() => Math.random() - 0.5);

  const galaxyWidth = 6300; // 150% larger map (was 4200)
  const galaxyHeight = 5400; // 150% larger map (was 3600)
  const minStarDist = 1450; // Increased spacing between star systems (was 950)

  // Generate stars with sufficient distance between each other
  for (let i = 0; i < starCount; i++) {
    let x = 0;
    let y = 0;
    let attempts = 0;
    let valid = false;

    while (!valid && attempts < 200) {
      attempts++;
      // Distribute in a spacious galaxy cluster around origin
      const angle = (i / starCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = 750 + Math.random() * (galaxyWidth / 2 - 950);
      x = Math.cos(angle) * dist;
      y = Math.sin(angle) * dist;

      // Check distance to all existing stars
      valid = true;
      for (const s of stars) {
        const d = Math.hypot(s.x - x, s.y - y);
        if (d < minStarDist) {
          valid = false;
          break;
        }
      }
    }

    const palette = STAR_PALETTES[i % STAR_PALETTES.length];
    const starRadius = 55 + Math.random() * 20;

    // Generate 1 to 4 planets per star as requested
    const planetCount = Math.floor(Math.random() * 4) + 1;
    const planets: Planet[] = [];

    // Planets generate farther away from each other and the star
    const baseOrbit = starRadius + 260; // Generous distance from star core (was 140)
    const orbitGap = 340; // Much wider spacing between planets (was 160)

    for (let p = 0; p < planetCount; p++) {
      const orbitRadius = baseOrbit + p * orbitGap + (Math.random() - 0.5) * 40;
      const orbitAngle = Math.random() * Math.PI * 2; // Spread evenly in full 360 orbit
      const orbitSpeed = (0.010 / (p + 1)) * (Math.random() > 0.5 ? 1 : -1);
      const planetRadius = 38 + Math.random() * 14;
      const theme = PLANET_THEMES[(i * 3 + p) % PLANET_THEMES.length];
      const planetName = `${shuffledStarNames[i % shuffledStarNames.length]} ${p + 1}`;

      const px = x + Math.cos(orbitAngle) * orbitRadius;
      const py = y + Math.sin(orbitAngle) * orbitRadius;

      planets.push({
        id: `planet_${i}_${p}_${Math.random().toString(36).substring(2, 6)}`,
        name: planetName,
        starId: `star_${i}`,
        orbitRadius,
        orbitAngle,
        orbitSpeed,
        radius: planetRadius,
        color: theme.color,
        surfaceDetailColor: theme.detail,
        atmosphereColor: theme.atmosphere,
        atmosphereGlow: theme.glow,
        hasRings: Math.random() < 0.25,
        ringColor: 'rgba(255, 255, 255, 0.25)',
        x: px,
        y: py,
        ownerId: null,
        buildings: [],
        spaceStation: null,
        colonyShips: [],
        productionQueue: null,
        turretFireCooldown: 0,
        lastLandedBy: null,
      });
    }

    stars.push({
      id: `star_${i}`,
      name: shuffledStarNames[i % shuffledStarNames.length] || `Star-${i + 1}`,
      x,
      y,
      radius: starRadius,
      color: palette.color,
      coronaColor: palette.corona,
      coreColor: palette.core,
      pulsePhase: Math.random() * Math.PI * 2,
      planets,
    });
  }

  // Now assign 1 distinct starting planet at random to human player and each computer player
  // Gather all planets
  const allPlanets: Planet[] = [];
  for (const s of stars) {
    for (const p of s.planets) {
      allPlanets.push(p);
    }
  }

  // Shuffle planets to pick fairly spread or random starting home planets
  const shuffledPlanets = [...allPlanets].sort(() => Math.random() - 0.5);

  // Pick one planet per faction
  factions.forEach((faction, idx) => {
    if (idx < shuffledPlanets.length) {
      const homePlanet = shuffledPlanets[idx];
      homePlanet.ownerId = faction.id;
      homePlanet.lastLandedBy = faction.id;
      // Start with all 4 initial buildings fully constructed!
      homePlanet.buildings = createStandardBuildings();
      // Start with 1 space station orbiting
      homePlanet.spaceStation = {
        id: `station_${homePlanet.id}`,
        ownerId: faction.id,
        angle: Math.random() * Math.PI * 2,
        distance: homePlanet.radius * 1.85,
        orbitSpeed: 0.012,
        hp: 30,
        maxHp: 30,
        fireCooldown: 0,
      };
      // Start with 1 Colony Ship ready in orbit
      homePlanet.colonyShips = [
        {
          id: `colony_${homePlanet.id}_initial`,
          ownerId: faction.id,
          originPlanetId: homePlanet.id,
          x: homePlanet.x + homePlanet.radius + 45,
          y: homePlanet.y,
          vx: 0,
          vy: 0,
          angle: 0,
          state: 'orbiting',
          orbitAngle: Math.random() * Math.PI * 2,
          orbitDistance: homePlanet.radius + 48,
          orbitSpeed: 0.010,
          hp: 5,
          maxHp: 5,
          fireCooldown: 0,
        },
      ];

      assignedPlanets.set(faction.id, homePlanet);
    }
  });

  return { stars, assignedPlanets };
}
