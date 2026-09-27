import { Ship, Planet, FactionConfig, Projectile } from '../types/game';
import { distance, angleBetween, shortestAngleDiff, getBuildingWorldPos } from './physics';

export interface AIDecision {
  thrust: boolean;
  boost?: boolean;
  steerAngle: number;
  shoot: boolean;
  launch?: boolean;
  landOnPlanet?: Planet;
}

export function updateAIShip(
  aiShip: Ship,
  faction: FactionConfig,
  allPlanets: Planet[],
  allShips: Ship[],
  dt: number
): { decision: AIDecision; projectile?: Projectile } {
  if (aiShip.isDead) {
    return { decision: { thrust: false, steerAngle: aiShip.angle, shoot: false } };
  }

  // If currently landed on a planet, handle launch countdown & healing
  if (aiShip.flightState === 'landed') {
    const dockedPlanet = allPlanets.find((p) => p.id === aiShip.landedPlanetId);
    const isHealingOnFriendlyWorld =
      dockedPlanet &&
      dockedPlanet.ownerId === aiShip.ownerId &&
      aiShip.hp < aiShip.maxHp;

    // Stay docked until fully healed!
    if (isHealingOnFriendlyWorld) {
      aiShip.aiLaunchTimer = 0.6; // Will launch shortly after health reaches 100%
      return {
        decision: {
          thrust: false,
          steerAngle: aiShip.angle,
          shoot: false,
        },
      };
    }

    aiShip.aiLaunchTimer = (aiShip.aiLaunchTimer || 1.5) - dt;
    if (aiShip.aiLaunchTimer <= 0) {
      // Ready to fly off into open space!
      aiShip.aiLaunchTimer = 1.5;
      return {
        decision: {
          thrust: true,
          steerAngle: aiShip.angle,
          shoot: false,
          launch: true,
        },
      };
    }
    return {
      decision: {
        thrust: false,
        steerAngle: aiShip.angle,
        shoot: false,
      },
    };
  }

  // If in transition (launching or landing), don't steer
  if (aiShip.flightState === 'launching' || aiShip.flightState === 'landing') {
    return {
      decision: {
        thrust: false,
        steerAngle: aiShip.angle,
        shoot: false,
      },
    };
  }

  // ============================================================
  // OPEN SPACE FLIGHT BEHAVIOR (flightState === 'flying')
  // ============================================================
  const aggression = faction.aggression || 'balanced';
  const myFactionId = faction.id;

  // 1. Territories & Status
  const myPlanets = allPlanets.filter((p) => p.ownerId === myFactionId);
  const unmarkedPlanets = allPlanets.filter((p) => p.ownerId === null);
  const allMarked = unmarkedPlanets.length === 0;
  const allColonized = allMarked && allPlanets.every((p) => p.buildings.filter((b) => b.hp > 0).length >= 4);
  const everythingMarkedButNotColonized = allMarked && !allColonized;

  // 2. Enemy worlds
  const enemyPlanets = allPlanets.filter((p) => p.ownerId !== null && p.ownerId !== myFactionId);
  const enemyPlanetsWithBuildings = enemyPlanets.filter((p) => p.buildings.some((b) => b.hp > 0));
  const clearedEnemyPlanets = enemyPlanets.filter((p) => p.buildings.every((b) => b.hp <= 0));
  const uncolonizedEnemyPlanets = enemyPlanets.filter(
    (p) => p.buildings.filter((b) => b.hp > 0).length < 4
  );

  // 3. Friendly bases for repair
  const myBases = myPlanets.filter(
    (p) => p.buildings.some((b) => b.type === 'base' && b.hp > 0)
  );

  // 4. Enemy ships
  const enemyShips = allShips.filter((s) => s.ownerId !== myFactionId && !s.isDead);
  let closestEnemyShip: Ship | null = null;
  let minDistToEnemyShip = Infinity;
  for (const es of enemyShips) {
    const d = distance(aiShip.x, aiShip.y, es.x, es.y);
    if (d < minDistToEnemyShip) {
      minDistToEnemyShip = d;
      closestEnemyShip = es;
    }
  }

  // Player ship specifically (for Berserker grudges)
  const playerShip = allShips.find((s) => s.ownerId === 'player' && !s.isDead);

  // Helper: "The others will focus on the planets closest to their existing planets."
  const getEnemyPlanetClosestToMyPlanets = (candidates: Planet[]): Planet | null => {
    if (candidates.length === 0) return null;
    if (myPlanets.length === 0) {
      return candidates.reduce((closest, p) =>
        distance(aiShip.x, aiShip.y, p.x, p.y) < distance(aiShip.x, aiShip.y, closest.x, closest.y) ? p : closest
      );
    }
    let best = candidates[0];
    let minDist = Infinity;
    for (const cand of candidates) {
      for (const myP of myPlanets) {
        const d = distance(cand.x, cand.y, myP.x, myP.y);
        if (d < minDist) {
          minDist = d;
          best = cand;
        }
      }
    }
    return best;
  };

  let targetX = aiShip.x;
  let targetY = aiShip.y;
  let wantsToShoot = false;
  let candidatePlanetToLand: Planet | undefined = undefined;

  // Manage anti-relanding cooldown & force-fight timers
  if (aiShip.planetLandingCooldown) {
    aiShip.planetLandingCooldown = Math.max(0, aiShip.planetLandingCooldown - dt);
  }
  if (aiShip.forceFightTimer) {
    aiShip.forceFightTimer = Math.max(0, aiShip.forceFightTimer - dt);
  }

  // ============================================================
  // FORCED COMBAT MODE
  // "the computers sometimes end up landing and relanding over and over on the same planet. They all need to switch to fighting if this happens."
  // ============================================================
  if ((aiShip.forceFightTimer || 0) > 0) {
    candidatePlanetToLand = undefined; // Disallow all landings while forced in combat

    if (closestEnemyShip) {
      targetX = closestEnemyShip.x + closestEnemyShip.vx * 0.35;
      targetY = closestEnemyShip.y + closestEnemyShip.vy * 0.35;

      const toEnemyAngle = angleBetween(aiShip.x, aiShip.y, closestEnemyShip.x, closestEnemyShip.y);
      const diff = Math.abs(shortestAngleDiff(aiShip.angle, toEnemyAngle));
      if (diff < 0.50 && minDistToEnemyShip < 650) {
        wantsToShoot = true;
      }
    } else {
      // If no enemy ships alive, attack enemy bases/planets
      const enemyWithBld = enemyPlanetsWithBuildings[0] || enemyPlanets[0];
      if (enemyWithBld) {
        const targetBuilding = enemyWithBld.buildings.find((b) => b.hp > 0);
        if (targetBuilding) {
          const bx = enemyWithBld.x + Math.cos(targetBuilding.angleOnPlanet) * (enemyWithBld.radius + 10);
          const by = enemyWithBld.y + Math.sin(targetBuilding.angleOnPlanet) * (enemyWithBld.radius + 10);
          const standoff = enemyWithBld.radius + 130;
          const approachAngle = angleBetween(enemyWithBld.x, enemyWithBld.y, bx, by);
          targetX = enemyWithBld.x + Math.cos(approachAngle) * standoff;
          targetY = enemyWithBld.y + Math.sin(approachAngle) * standoff;

          const toBAngle = angleBetween(aiShip.x, aiShip.y, bx, by);
          const diff = Math.abs(shortestAngleDiff(aiShip.angle, toBAngle));
          if (distance(aiShip.x, aiShip.y, bx, by) < 380 && diff < 0.45) {
            wantsToShoot = true;
          }
        } else {
          targetX = enemyWithBld.x;
          targetY = enemyWithBld.y;
        }
      }
    }
  }

  // ============================================================
  // ARCHETYPE 1: EXPANSIONIST
  // "Except for the expansionist they should try to mark all the planets that are not marked at all and if all are marked then they should begin fighting over one's that are not colonized yet.
  // Also when everything is marked but not colonized make the expansionist focus on colony ships. They will destroy one then mark a planet then destroy a colony ship then mark a planet and repeat"
  // ============================================================
  else if (aggression === 'expansionist') {
    // Phase 1: Mark all un-marked planets first without getting distracted by dogfights
    if (!allMarked && unmarkedPlanets.length > 0) {
      let closestUnmarked = unmarkedPlanets[0];
      let minD = Infinity;
      for (const p of unmarkedPlanets) {
        const d = distance(aiShip.x, aiShip.y, p.x, p.y);
        if (d < minD) {
          minD = d;
          closestUnmarked = p;
        }
      }

      targetX = closestUnmarked.x;
      targetY = closestUnmarked.y;

      if (minD < closestUnmarked.radius + 55) {
        candidatePlanetToLand = closestUnmarked;
      }

      // Shoot only if an enemy is directly in front while flying to mark
      if (closestEnemyShip && minDistToEnemyShip < 320) {
        const toEnemyAngle = angleBetween(aiShip.x, aiShip.y, closestEnemyShip.x, closestEnemyShip.y);
        const diff = Math.abs(shortestAngleDiff(aiShip.angle, toEnemyAngle));
        if (diff < 0.35) wantsToShoot = true;
      }
    }
    // Phase 2: Everything marked but not colonized: alternating cycle (Destroy colony ship -> Mark planet -> Repeat)
    else if (everythingMarkedButNotColonized) {
      const phase = aiShip.aiExpansionistPhase || 'destroy_colony_ship';

      if (phase === 'destroy_colony_ship') {
        // Find all enemy colony ships
        const allEnemyColonyShips: { cs: any; planet: Planet }[] = [];
        allPlanets.forEach((p) => {
          p.colonyShips.forEach((cs) => {
            if (cs.ownerId !== myFactionId) {
              allEnemyColonyShips.push({ cs, planet: p });
            }
          });
        });

        if (allEnemyColonyShips.length > 0) {
          // Hunt closest enemy colony ship
          let targetColony = allEnemyColonyShips[0];
          let minCDist = Infinity;
          for (const item of allEnemyColonyShips) {
            const d = distance(aiShip.x, aiShip.y, item.cs.x, item.cs.y);
            if (d < minCDist) {
              minCDist = d;
              targetColony = item;
            }
          }

          targetX = targetColony.cs.x;
          targetY = targetColony.cs.y;

          const toCSAngle = angleBetween(aiShip.x, aiShip.y, targetColony.cs.x, targetColony.cs.y);
          const diff = Math.abs(shortestAngleDiff(aiShip.angle, toCSAngle));
          if (diff < 0.45 && minCDist < 480) {
            wantsToShoot = true;
          }
        } else {
          // No colony ships exist right now; advance to mark_planet
          aiShip.aiExpansionistPhase = 'mark_planet';
        }
      }

      if (aiShip.aiExpansionistPhase === 'mark_planet') {
        // Target an uncolonized planet closest to existing territory
        const targetPlanet =
          getEnemyPlanetClosestToMyPlanets(uncolonizedEnemyPlanets) ||
          getEnemyPlanetClosestToMyPlanets(clearedEnemyPlanets) ||
          getEnemyPlanetClosestToMyPlanets(enemyPlanets);

        if (targetPlanet) {
          const isCleared = targetPlanet.buildings.every((b) => b.hp <= 0);
          if (isCleared) {
            targetX = targetPlanet.x;
            targetY = targetPlanet.y;
            if (distance(aiShip.x, aiShip.y, targetPlanet.x, targetPlanet.y) < targetPlanet.radius + 55) {
              candidatePlanetToLand = targetPlanet;
            }
          } else {
            // Bombard buildings to clear it
            const targetBuilding = targetPlanet.buildings.find((b) => b.hp > 0);
            if (targetBuilding) {
              const bx = targetPlanet.x + Math.cos(targetBuilding.angleOnPlanet) * (targetPlanet.radius + 10);
              const by = targetPlanet.y + Math.sin(targetBuilding.angleOnPlanet) * (targetPlanet.radius + 10);
              const standoff = targetPlanet.radius + 130;
              const approachAngle = angleBetween(targetPlanet.x, targetPlanet.y, bx, by);
              targetX = targetPlanet.x + Math.cos(approachAngle) * standoff;
              targetY = targetPlanet.y + Math.sin(approachAngle) * standoff;

              const toBAngle = angleBetween(aiShip.x, aiShip.y, bx, by);
              const diff = Math.abs(shortestAngleDiff(aiShip.angle, toBAngle));
              if (distance(aiShip.x, aiShip.y, bx, by) < 380 && diff < 0.45) {
                wantsToShoot = true;
              }
            }
          }
        }
      }
    }
    // Phase 3: Everything colonized -> Conquer enemy planets closest to existing planets
    else {
      const targetPlanet =
        getEnemyPlanetClosestToMyPlanets(enemyPlanetsWithBuildings) ||
        getEnemyPlanetClosestToMyPlanets(clearedEnemyPlanets);

      if (targetPlanet) {
        const isCleared = targetPlanet.buildings.every((b) => b.hp <= 0);
        if (isCleared) {
          targetX = targetPlanet.x;
          targetY = targetPlanet.y;
          if (distance(aiShip.x, aiShip.y, targetPlanet.x, targetPlanet.y) < targetPlanet.radius + 55) {
            candidatePlanetToLand = targetPlanet;
          }
        } else {
          const targetBuilding = targetPlanet.buildings.find((b) => b.hp > 0);
          if (targetBuilding) {
            const bx = targetPlanet.x + Math.cos(targetBuilding.angleOnPlanet) * (targetPlanet.radius + 10);
            const by = targetPlanet.y + Math.sin(targetBuilding.angleOnPlanet) * (targetPlanet.radius + 10);
            const standoff = targetPlanet.radius + 130;
            const approachAngle = angleBetween(targetPlanet.x, targetPlanet.y, bx, by);
            targetX = targetPlanet.x + Math.cos(approachAngle) * standoff;
            targetY = targetPlanet.y + Math.sin(approachAngle) * standoff;

            const toBAngle = angleBetween(aiShip.x, aiShip.y, bx, by);
            const diff = Math.abs(shortestAngleDiff(aiShip.angle, toBAngle));
            if (distance(aiShip.x, aiShip.y, bx, by) < 380 && diff < 0.45) {
              wantsToShoot = true;
            }
          }
        }
      }
    }
  }

  // ============================================================
  // ARCHETYPE 2: BERSERKER
  // "The berserker will hold grudges if their worlds are attacked by you they will not defend them but they will focus on you in return."
  // ============================================================
  else if (aggression === 'berserker') {
    // Check if player attacked any of Berserker's worlds
    const myWorldAttackedByPlayer = myPlanets.some(
      (p) => p.lastAttackedBy === 'player' && p.lastAttackedTime && Date.now() - p.lastAttackedTime < 60000
    );

    if (aiShip.aiGrudgeTarget === 'player' || myWorldAttackedByPlayer) {
      aiShip.aiGrudgeTarget = 'player';

      // Will NOT defend their worlds, but focus relentlessly on the player!
      if (playerShip && !playerShip.isDead) {
        targetX = playerShip.x + playerShip.vx * 0.35;
        targetY = playerShip.y + playerShip.vy * 0.35;

        const toPlayerAngle = angleBetween(aiShip.x, aiShip.y, playerShip.x, playerShip.y);
        const diff = Math.abs(shortestAngleDiff(aiShip.angle, toPlayerAngle));
        if (diff < 0.45 && distance(aiShip.x, aiShip.y, playerShip.x, playerShip.y) < 550) {
          wantsToShoot = true;
        }
      } else {
        // Player is dead/respawning -> attack planets closest to player
        const playerPlanets = allPlanets.filter((p) => p.ownerId === 'player');
        if (playerPlanets.length > 0) {
          const targetP = playerPlanets[0];
          targetX = targetP.x;
          targetY = targetP.y;
        }
      }
    } else {
      // Normal Berserker: Relentless ship hunting & dogfighting
      if (closestEnemyShip) {
        targetX = closestEnemyShip.x + closestEnemyShip.vx * 0.3;
        targetY = closestEnemyShip.y + closestEnemyShip.vy * 0.3;

        const toEnemyAngle = angleBetween(aiShip.x, aiShip.y, closestEnemyShip.x, closestEnemyShip.y);
        const diff = Math.abs(shortestAngleDiff(aiShip.angle, toEnemyAngle));
        if (diff < 0.45 && minDistToEnemyShip < 550) {
          wantsToShoot = true;
        }
      }
    }
  }

  // ============================================================
  // ARCHETYPE 3: DEFENDER (`passive`)
  // Doctrine:
  // 1. Focus on home star system first: fight to mark and re-mark all planets in the system (not just home planet)
  //    and actively prevent anyone from getting a foothold.
  // 2. If a planet is colonized, let it defend itself if there are still uncolonized planets around their star.
  // 3. Move back to defend and capture anything in a system they already have a stake in until they own the whole thing.
  // 4. Once home system is 100% owned & colonized, take over the nearest star and all its planets in the exact same way,
  //    one star at a time, until the entire galaxy is won.
  // 5. If hurt (<= 3.0 HP), retreat to a colonized world to heal quickly.
  // ============================================================
  else if (aggression === 'passive') {
    const colonizedFriendlyWorlds = myPlanets.filter((p) => p.buildings.some((b) => b.hp > 0));
    const safeHavenWorlds = colonizedFriendlyWorlds.length > 0 ? colonizedFriendlyWorlds : myPlanets;
    const isHurt = aiShip.hp <= 3.0;

    // 1. TACTICAL RETREAT FOR RAPID REPAIRS
    if (isHurt && safeHavenWorlds.length > 0) {
      let closestSafe = safeHavenWorlds[0];
      let minD = Infinity;
      for (const w of safeHavenWorlds) {
        const d = distance(aiShip.x, aiShip.y, w.x, w.y);
        if (d < minD) {
          minD = d;
          closestSafe = w;
        }
      }
      targetX = closestSafe.x;
      targetY = closestSafe.y;
      if (minD < closestSafe.radius + 55) {
        candidatePlanetToLand = closestSafe;
      }
    } else {
      // 2. IDENTIFY STAKED STAR SYSTEMS & STAR PROGRESSION
      const homeStarId =
        aiShip.homeStarId ||
        myPlanets[0]?.starId ||
        (allPlanets.length > 0 ? allPlanets[0].starId : '');

      const allStarIds = Array.from(new Set(allPlanets.map((p) => p.starId)));

      const getStarStatus = (sId: string) => {
        const sPlanets = allPlanets.filter((p) => p.starId === sId);
        const unownedPlanets = sPlanets.filter((p) => p.ownerId !== myFactionId);
        const uncolonizedPlanets = sPlanets.filter(
          (p) => !(p.ownerId === myFactionId && p.buildings.some((b) => b.hp > 0))
        );
        const colonizedPlanets = sPlanets.filter(
          (p) => p.ownerId === myFactionId && p.buildings.some((b) => b.hp > 0)
        );
        const isFullyOwnedAndColonized =
          sPlanets.length > 0 &&
          unownedPlanets.length === 0 &&
          uncolonizedPlanets.length === 0;

        return {
          sPlanets,
          unownedPlanets,
          uncolonizedPlanets,
          colonizedPlanets,
          isFullyOwnedAndColonized,
        };
      };

      // Systems where Defender has a stake:
      // Home star is always priority #1, followed by any star where Defender currently owns worlds
      // or previously targeted star
      const stakedStars: string[] = [];
      if (homeStarId && allStarIds.includes(homeStarId)) {
        stakedStars.push(homeStarId);
      }
      allStarIds.forEach((sId) => {
        if (!stakedStars.includes(sId) && myPlanets.some((p) => p.starId === sId)) {
          stakedStars.push(sId);
        }
      });
      if (
        aiShip.aiTargetStarId &&
        allStarIds.includes(aiShip.aiTargetStarId) &&
        !stakedStars.includes(aiShip.aiTargetStarId)
      ) {
        stakedStars.push(aiShip.aiTargetStarId);
      }

      // Check if any staked system has an urgent attack needing ship defense:
      // Rule: "If a planet is colonized they will let it defend itself if their are uncolonized planets around their star."
      // But if the planet is uncolonized, OR all planets in that star system are colonized, Defender moves back to defend!
      let urgentDefensePlanet: Planet | null = null;
      let urgentAttackerShip: Ship | null = null;

      for (const sId of stakedStars) {
        const status = getStarStatus(sId);
        const hasUncolonized = status.uncolonizedPlanets.length > 0;

        const attackedInStar = status.sPlanets.filter(
          (p) =>
            p.ownerId === myFactionId &&
            p.lastAttackedTime &&
            Date.now() - p.lastAttackedTime < 16000
        );

        for (const ap of attackedInStar) {
          const isColonized = ap.buildings.some((b) => b.hp > 0);
          if (isColonized && hasUncolonized) {
            // Let it defend itself!
            continue;
          }
          // Needs Defender ship intervention
          urgentDefensePlanet = ap;
          // Find the attacker near this planet
          let minADist = Infinity;
          for (const es of enemyShips) {
            const d = distance(es.x, es.y, ap.x, ap.y);
            if (d < minADist) {
              minADist = d;
              urgentAttackerShip = es;
            }
          }
          break;
        }
        if (urgentDefensePlanet) break;
      }

      if (urgentDefensePlanet && urgentAttackerShip) {
        // Move back to defend planet in staked system!
        targetX = urgentAttackerShip.x + urgentAttackerShip.vx * 0.25;
        targetY = urgentAttackerShip.y + urgentAttackerShip.vy * 0.25;

        const toAttackerAngle = angleBetween(aiShip.x, aiShip.y, urgentAttackerShip.x, urgentAttackerShip.y);
        const diff = Math.abs(shortestAngleDiff(aiShip.angle, toAttackerAngle));
        if (diff < 0.45 && distance(aiShip.x, aiShip.y, urgentAttackerShip.x, urgentAttackerShip.y) < 520) {
          wantsToShoot = true;
        }
      } else {
        // "they will still move back to defend and capture anything in a system they already have a stake in until they own the whole thing."
        // Find the highest priority incomplete star system:
        let activeStarId: string | null = null;

        for (const sId of stakedStars) {
          const status = getStarStatus(sId);
          if (!status.isFullyOwnedAndColonized) {
            activeStarId = sId;
            break;
          }
        }

        // If ALL currently staked systems are 100% owned & colonized:
        // "Once they do have their home system they will focus on the nearest stars and all its planets in the same way until they have all of those and then the next until they win."
        if (!activeStarId) {
          const unconqueredStars = allStarIds.filter((sId) => !getStarStatus(sId).isFullyOwnedAndColonized);
          if (unconqueredStars.length > 0) {
            let bestStar = unconqueredStars[0];
            let minStarDist = Infinity;
            for (const sId of unconqueredStars) {
              const sPlanets = allPlanets.filter((p) => p.starId === sId);
              for (const sp of sPlanets) {
                for (const mp of myPlanets) {
                  const d = distance(sp.x, sp.y, mp.x, mp.y);
                  if (d < minStarDist) {
                    minStarDist = d;
                    bestStar = sId;
                  }
                }
              }
            }
            activeStarId = bestStar;
            aiShip.aiTargetStarId = bestStar;
          }
        }

        // Execute capture, marking, and foothold prevention in the active star system:
        if (activeStarId) {
          const { sPlanets, unownedPlanets, uncolonizedPlanets } = getStarStatus(activeStarId);
          const hasUncolonized = uncolonizedPlanets.length > 0;

          // Check for trespassing enemy colony ships or ships trying to get a foothold in this star
          let enemyColonyShipInStar: { cs: any; planet: Planet } | null = null;
          for (const p of sPlanets) {
            for (const cs of p.colonyShips) {
              if (cs.ownerId !== myFactionId) {
                enemyColonyShipInStar = { cs, planet: p };
                break;
              }
            }
            if (enemyColonyShipInStar) break;
          }

          // Enemy ship near any planet in this active star
          const enemyInStar = enemyShips.find((es) =>
            sPlanets.some((p) => distance(es.x, es.y, p.x, p.y) < 550)
          );

          if (enemyColonyShipInStar) {
            // Prevent enemy from getting a foothold: blast the colony ship!
            targetX = enemyColonyShipInStar.cs.x;
            targetY = enemyColonyShipInStar.cs.y;
            const toCSAngle = angleBetween(aiShip.x, aiShip.y, enemyColonyShipInStar.cs.x, enemyColonyShipInStar.cs.y);
            const diff = Math.abs(shortestAngleDiff(aiShip.angle, toCSAngle));
            const dToCS = distance(aiShip.x, aiShip.y, enemyColonyShipInStar.cs.x, enemyColonyShipInStar.cs.y);
            if (diff < 0.45 && dToCS < 480) {
              wantsToShoot = true;
            }
          } else if (unownedPlanets.length > 0) {
            // Target the unowned planet to mark/re-mark
            const targetPlanet = unownedPlanets.reduce((best, p) =>
              distance(aiShip.x, aiShip.y, p.x, p.y) < distance(aiShip.x, aiShip.y, best.x, best.y)
                ? p
                : best
            );

            // Check if an enemy ship is contesting this planet or near Defender
            const enemyContesting = enemyShips.find(
              (es) =>
                distance(es.x, es.y, targetPlanet.x, targetPlanet.y) < 480 ||
                distance(es.x, es.y, aiShip.x, aiShip.y) < 380
            );

            if (enemyContesting) {
              // "fight another player if they are trying to mark a planet and another player is near by, they will land if they can to mark it but they should focus on fighting other player."
              targetX = enemyContesting.x + enemyContesting.vx * 0.25;
              targetY = enemyContesting.y + enemyContesting.vy * 0.25;

              const toEnemyAngle = angleBetween(aiShip.x, aiShip.y, enemyContesting.x, enemyContesting.y);
              const diff = Math.abs(shortestAngleDiff(aiShip.angle, toEnemyAngle));
              if (diff < 0.45 && distance(aiShip.x, aiShip.y, enemyContesting.x, enemyContesting.y) < 520) {
                wantsToShoot = true;
              }

              if (distance(aiShip.x, aiShip.y, targetPlanet.x, targetPlanet.y) < targetPlanet.radius + 55) {
                candidatePlanetToLand = targetPlanet;
              }
            } else {
              // Clear enemy buildings to re-mark, or land if clear
              const hasEnemyBuildings = targetPlanet.buildings.some((b) => b.hp > 0);
              if (hasEnemyBuildings) {
                const targetBuilding = targetPlanet.buildings.find((b) => b.hp > 0);
                if (targetBuilding) {
                  const bx = targetPlanet.x + Math.cos(targetBuilding.angleOnPlanet) * (targetPlanet.radius + 10);
                  const by = targetPlanet.y + Math.sin(targetBuilding.angleOnPlanet) * (targetPlanet.radius + 10);
                  const standoff = targetPlanet.radius + 130;
                  const approachAngle = angleBetween(targetPlanet.x, targetPlanet.y, bx, by);
                  targetX = targetPlanet.x + Math.cos(approachAngle) * standoff;
                  targetY = targetPlanet.y + Math.sin(approachAngle) * standoff;

                  const toBAngle = angleBetween(aiShip.x, aiShip.y, bx, by);
                  const diff = Math.abs(shortestAngleDiff(aiShip.angle, toBAngle));
                  if (distance(aiShip.x, aiShip.y, bx, by) < 380 && diff < 0.45) {
                    wantsToShoot = true;
                  }
                }
              } else {
                targetX = targetPlanet.x;
                targetY = targetPlanet.y;
                if (distance(aiShip.x, aiShip.y, targetPlanet.x, targetPlanet.y) < targetPlanet.radius + 55) {
                  candidatePlanetToLand = targetPlanet;
                }
              }
            }
          } else if (enemyInStar) {
            // Star planets are marked, but an enemy is inside the system: intercept them!
            targetX = enemyInStar.x + enemyInStar.vx * 0.25;
            targetY = enemyInStar.y + enemyInStar.vy * 0.25;

            const toEnemyAngle = angleBetween(aiShip.x, aiShip.y, enemyInStar.x, enemyInStar.y);
            const diff = Math.abs(shortestAngleDiff(aiShip.angle, toEnemyAngle));
            if (diff < 0.45 && distance(aiShip.x, aiShip.y, enemyInStar.x, enemyInStar.y) < 520) {
              wantsToShoot = true;
            }
          } else {
            // All planets in active star are marked, waiting for colonization:
            // Patrol around the uncolonized planet to guard it until colonized!
            const patrolTarget = uncolonizedPlanets[0] || sPlanets[0];
            if (patrolTarget) {
              targetX = patrolTarget.x;
              targetY = patrolTarget.y;
            }
          }
        } else {
          // Entire galaxy owned and colonized! Patrol home space
          if (myPlanets.length > 0) {
            targetX = myPlanets[0].x;
            targetY = myPlanets[0].y;
          }
        }
      }
    }
  }

  // ============================================================
  // ARCHETYPE 4: BALANCED
  // "When everything is colonized balanced will try to conquer but if they are being attacked, after they die they will defend before going back to conquer."
  // ============================================================
  else if (aggression === 'balanced') {
    // Check if defending after death
    if (aiShip.aiDefendAfterDeath) {
      aiShip.aiDefendTimer = (aiShip.aiDefendTimer || 25) - dt;

      // Find any threatened or attacked friendly worlds
      const threatenedWorld = myPlanets.find((p) => {
        const isUnderFire = p.lastAttackedTime && Date.now() - p.lastAttackedTime < 25000;
        const enemyNear = enemyShips.some((es) => distance(es.x, es.y, p.x, p.y) < 550);
        return isUnderFire || enemyNear;
      });

      if (threatenedWorld && (aiShip.aiDefendTimer || 0) > 0) {
        // Prioritize defending friendly worlds!
        let attackerNearWorld: Ship | null = null;
        let minADist = Infinity;
        for (const es of enemyShips) {
          const d = distance(es.x, es.y, threatenedWorld.x, threatenedWorld.y);
          if (d < minADist) {
            minADist = d;
            attackerNearWorld = es;
          }
        }

        if (attackerNearWorld && minADist < 650) {
          targetX = attackerNearWorld.x + attackerNearWorld.vx * 0.25;
          targetY = attackerNearWorld.y + attackerNearWorld.vy * 0.25;

          const toAAngle = angleBetween(aiShip.x, aiShip.y, attackerNearWorld.x, attackerNearWorld.y);
          const diff = Math.abs(shortestAngleDiff(aiShip.angle, toAAngle));
          if (diff < 0.45 && distance(aiShip.x, aiShip.y, attackerNearWorld.x, attackerNearWorld.y) < 520) {
            wantsToShoot = true;
          }
        } else {
          targetX = threatenedWorld.x;
          targetY = threatenedWorld.y;
        }
      } else {
        // Threats cleared or timer expired: Return to conquer!
        aiShip.aiDefendAfterDeath = false;
      }
    }

    if (!aiShip.aiDefendAfterDeath) {
      // If critical HP, retreat to colonized world to rapidly heal
      const colonizedFriendly = myPlanets.filter((p) => p.buildings.some((b) => b.hp > 0));
      const safeWorld = colonizedFriendly.length > 0 ? colonizedFriendly[0] : myPlanets[0];

      if (aiShip.hp <= 1.5 && safeWorld) {
        targetX = safeWorld.x;
        targetY = safeWorld.y;
        if (distance(aiShip.x, aiShip.y, safeWorld.x, safeWorld.y) < safeWorld.radius + 55) {
          candidatePlanetToLand = safeWorld;
        }
      } else {
        // General marking & conquering:
        // Check contested planet rule:
      // "every computer type will fight another player if they are trying to mark a planet and another player is near by, they will land if they can to mark it but they should focus on fighting other player."
      const contestedPlanet = unmarkedPlanets.concat(clearedEnemyPlanets).find((p) => {
        return distance(aiShip.x, aiShip.y, p.x, p.y) < 550;
      });

      const enemyNearContested = contestedPlanet
        ? enemyShips.find(
            (es) =>
              distance(es.x, es.y, contestedPlanet.x, contestedPlanet.y) < 450 ||
              distance(es.x, es.y, aiShip.x, aiShip.y) < 380
          )
        : null;

      if (contestedPlanet && enemyNearContested) {
        // Focus on fighting the other player!
        targetX = enemyNearContested.x + enemyNearContested.vx * 0.25;
        targetY = enemyNearContested.y + enemyNearContested.vy * 0.25;

        const toEnemyAngle = angleBetween(aiShip.x, aiShip.y, enemyNearContested.x, enemyNearContested.y);
        const diff = Math.abs(shortestAngleDiff(aiShip.angle, toEnemyAngle));
        if (diff < 0.45 && distance(aiShip.x, aiShip.y, enemyNearContested.x, enemyNearContested.y) < 520) {
          wantsToShoot = true;
        }

        // Land if within touchdown range to mark it, but focus on fighting
        if (distance(aiShip.x, aiShip.y, contestedPlanet.x, contestedPlanet.y) < contestedPlanet.radius + 55) {
          candidatePlanetToLand = contestedPlanet;
        }
      } else if (unmarkedPlanets.length > 0) {
        // Fly to mark closest unmarked planet
        const closestUnmarked = unmarkedPlanets.reduce((best, p) =>
          distance(aiShip.x, aiShip.y, p.x, p.y) < distance(aiShip.x, aiShip.y, best.x, best.y) ? p : best
        );
        targetX = closestUnmarked.x;
        targetY = closestUnmarked.y;
        if (distance(aiShip.x, aiShip.y, closestUnmarked.x, closestUnmarked.y) < closestUnmarked.radius + 55) {
          candidatePlanetToLand = closestUnmarked;
        }
      } else {
        // When everything is colonized / all marked: Conquering phase!
        // "The others will focus on the planets closest to their existing planets."
        const targetPlanet =
          getEnemyPlanetClosestToMyPlanets(enemyPlanetsWithBuildings) ||
          getEnemyPlanetClosestToMyPlanets(clearedEnemyPlanets);

        if (targetPlanet) {
          const isCleared = targetPlanet.buildings.every((b) => b.hp <= 0);
          if (isCleared) {
            targetX = targetPlanet.x;
            targetY = targetPlanet.y;
            if (distance(aiShip.x, aiShip.y, targetPlanet.x, targetPlanet.y) < targetPlanet.radius + 55) {
              candidatePlanetToLand = targetPlanet;
            }
          } else {
            const targetBuilding = targetPlanet.buildings.find((b) => b.hp > 0);
            if (targetBuilding) {
              const bx = targetPlanet.x + Math.cos(targetBuilding.angleOnPlanet) * (targetPlanet.radius + 10);
              const by = targetPlanet.y + Math.sin(targetBuilding.angleOnPlanet) * (targetPlanet.radius + 10);
              const standoff = targetPlanet.radius + 130;
              const approachAngle = angleBetween(targetPlanet.x, targetPlanet.y, bx, by);
              targetX = targetPlanet.x + Math.cos(approachAngle) * standoff;
              targetY = targetPlanet.y + Math.sin(approachAngle) * standoff;

              const toBAngle = angleBetween(aiShip.x, aiShip.y, bx, by);
              const diff = Math.abs(shortestAngleDiff(aiShip.angle, toBAngle));
              if (distance(aiShip.x, aiShip.y, bx, by) < 380 && diff < 0.45) {
                wantsToShoot = true;
              }
            }
          }
        }
      }
    }
  }
}

  // ============================================================
  // ARCHETYPE 5: AGGRESSIVE
  // "The others will focus on the planets closest to their existing planets."
  // ============================================================
  else {
    // Check contested planet fighting
    const contestedPlanet = unmarkedPlanets.concat(clearedEnemyPlanets).find((p) => {
      return distance(aiShip.x, aiShip.y, p.x, p.y) < 550;
    });

    const enemyNearContested = contestedPlanet
      ? enemyShips.find(
          (es) =>
            distance(es.x, es.y, contestedPlanet.x, contestedPlanet.y) < 450 ||
            distance(es.x, es.y, aiShip.x, aiShip.y) < 380
        )
      : null;

    if (contestedPlanet && enemyNearContested) {
      // Focus on fighting the other player!
      targetX = enemyNearContested.x + enemyNearContested.vx * 0.25;
      targetY = enemyNearContested.y + enemyNearContested.vy * 0.25;

      const toEnemyAngle = angleBetween(aiShip.x, aiShip.y, enemyNearContested.x, enemyNearContested.y);
      const diff = Math.abs(shortestAngleDiff(aiShip.angle, toEnemyAngle));
      if (diff < 0.45 && distance(aiShip.x, aiShip.y, enemyNearContested.x, enemyNearContested.y) < 520) {
        wantsToShoot = true;
      }

      if (distance(aiShip.x, aiShip.y, contestedPlanet.x, contestedPlanet.y) < contestedPlanet.radius + 55) {
        candidatePlanetToLand = contestedPlanet;
      }
    } else {
      // Focus on planets closest to existing territory
      const targetPlanet =
        getEnemyPlanetClosestToMyPlanets(enemyPlanetsWithBuildings) ||
        getEnemyPlanetClosestToMyPlanets(clearedEnemyPlanets) ||
        (unmarkedPlanets.length > 0 ? unmarkedPlanets[0] : null);

      if (targetPlanet) {
        const isCleared = targetPlanet.buildings.every((b) => b.hp <= 0);
        if (isCleared) {
          targetX = targetPlanet.x;
          targetY = targetPlanet.y;
          if (distance(aiShip.x, aiShip.y, targetPlanet.x, targetPlanet.y) < targetPlanet.radius + 55) {
            candidatePlanetToLand = targetPlanet;
          }
        } else {
          const targetBuilding = targetPlanet.buildings.find((b) => b.hp > 0);
          if (targetBuilding) {
            const bx = targetPlanet.x + Math.cos(targetBuilding.angleOnPlanet) * (targetPlanet.radius + 10);
            const by = targetPlanet.y + Math.sin(targetBuilding.angleOnPlanet) * (targetPlanet.radius + 10);
            const standoff = targetPlanet.radius + 130;
            const approachAngle = angleBetween(targetPlanet.x, targetPlanet.y, bx, by);
            targetX = targetPlanet.x + Math.cos(approachAngle) * standoff;
            targetY = targetPlanet.y + Math.sin(approachAngle) * standoff;

            const toBAngle = angleBetween(aiShip.x, aiShip.y, bx, by);
            const diff = Math.abs(shortestAngleDiff(aiShip.angle, toBAngle));
            if (distance(aiShip.x, aiShip.y, bx, by) < 380 && diff < 0.45) {
              wantsToShoot = true;
            }
          }
        }
      }
    }
  }

  // Steering calculation in open space
  const desiredAngle = angleBetween(aiShip.x, aiShip.y, targetX, targetY);
  const angleError = shortestAngleDiff(aiShip.angle, desiredAngle);
  const turnSpeed = 3.8 * dt;

  let newAngle = aiShip.angle;
  if (Math.abs(angleError) > 0.04) {
    newAngle += Math.sign(angleError) * Math.min(Math.abs(angleError), turnSpeed);
  }

  // Active thrust and boost in open space
  const thrust = Math.abs(angleError) < 1.4;
  const distToTarget = distance(aiShip.x, aiShip.y, targetX, targetY);
  // Boost when aligned and traveling long distance, dogfighting, or retreating
  const wantsBoost =
    thrust &&
    Math.abs(angleError) < 0.6 &&
    aiShip.boost > 15 &&
    (distToTarget > 380 || aiShip.hp <= 2.5 || (wantsToShoot && distToTarget > 240));

  // Anti-Relanding Cooldown: Prevent immediate relanding on the planet just launched from
  if (
    candidatePlanetToLand &&
    aiShip.planetLandingCooldownId &&
    candidatePlanetToLand.id === aiShip.planetLandingCooldownId &&
    (aiShip.planetLandingCooldown || 0) > 0
  ) {
    candidatePlanetToLand = undefined;
  }

  // ============================================================
  // UNIVERSAL COMBAT FIRING CHECK:
  // "The computer's all need to fire weapons more regularly as well"
  // If ANY enemy entity (ship, installation/building, space station, colony ship)
  // is within the forward firing cone and combat range, computers fire!
  // ============================================================
  if (!wantsToShoot) {
    // 1. Enemy ships in forward firing arc
    for (const es of enemyShips) {
      const d = distance(aiShip.x, aiShip.y, es.x, es.y);
      if (d < 700) {
        const toAngle = angleBetween(aiShip.x, aiShip.y, es.x, es.y);
        const diff = Math.abs(shortestAngleDiff(aiShip.angle, toAngle));
        if (diff < (d < 300 ? 0.85 : 0.62)) {
          wantsToShoot = true;
          break;
        }
      }
    }

    // 2. Enemy installations, space stations, and colony ships in forward firing arc
    if (!wantsToShoot) {
      for (const p of enemyPlanets) {
        // Buildings / installations
        for (const bld of p.buildings) {
          if (bld.hp > 0) {
            const bPos = getBuildingWorldPos(p.x, p.y, p.radius, bld.angleOnPlanet);
            const d = distance(aiShip.x, aiShip.y, bPos.x, bPos.y);
            if (d < 520) {
              const toAngle = angleBetween(aiShip.x, aiShip.y, bPos.x, bPos.y);
              const diff = Math.abs(shortestAngleDiff(aiShip.angle, toAngle));
              if (diff < 0.58) {
                wantsToShoot = true;
                break;
              }
            }
          }
        }
        if (wantsToShoot) break;

        // Space stations
        if (p.spaceStation && p.spaceStation.ownerId !== myFactionId && p.spaceStation.hp > 0) {
          const st = p.spaceStation;
          const stX = p.x + Math.cos(st.angle) * st.distance;
          const stY = p.y + Math.sin(st.angle) * st.distance;
          const d = distance(aiShip.x, aiShip.y, stX, stY);
          if (d < 560) {
            const toAngle = angleBetween(aiShip.x, aiShip.y, stX, stY);
            const diff = Math.abs(shortestAngleDiff(aiShip.angle, toAngle));
            if (diff < 0.58) {
              wantsToShoot = true;
              break;
            }
          }
        }
        if (wantsToShoot) break;

        // Colony ships
        for (const cs of p.colonyShips) {
          if (cs.ownerId !== myFactionId && cs.hp > 0) {
            const d = distance(aiShip.x, aiShip.y, cs.x, cs.y);
            if (d < 560) {
              const toAngle = angleBetween(aiShip.x, aiShip.y, cs.x, cs.y);
              const diff = Math.abs(shortestAngleDiff(aiShip.angle, toAngle));
              if (diff < 0.58) {
                wantsToShoot = true;
                break;
              }
            }
          }
          if (wantsToShoot) break;
        }
        if (wantsToShoot) break;
      }
    }
  }

  return {
    decision: {
      thrust,
      boost: wantsBoost,
      steerAngle: newAngle,
      shoot: wantsToShoot,
      landOnPlanet: candidatePlanetToLand,
    },
  };
}
