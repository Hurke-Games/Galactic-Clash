import { KeyBindings, DEFAULT_KEY_BINDINGS } from '../types/game';

const STORAGE_KEY = 'galactic_clash_key_bindings_v2';

export function loadKeyBindings(): KeyBindings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        thrust: Array.isArray(parsed.thrust) && parsed.thrust.length ? parsed.thrust : DEFAULT_KEY_BINDINGS.thrust,
        land: Array.isArray(parsed.land) && parsed.land.length ? parsed.land : DEFAULT_KEY_BINDINGS.land,
        reverse: Array.isArray(parsed.reverse) && parsed.reverse.length ? parsed.reverse : DEFAULT_KEY_BINDINGS.reverse,
        turnLeft: Array.isArray(parsed.turnLeft) && parsed.turnLeft.length ? parsed.turnLeft : DEFAULT_KEY_BINDINGS.turnLeft,
        turnRight: Array.isArray(parsed.turnRight) && parsed.turnRight.length ? parsed.turnRight : DEFAULT_KEY_BINDINGS.turnRight,
        shoot: Array.isArray(parsed.shoot) && parsed.shoot.length ? parsed.shoot : DEFAULT_KEY_BINDINGS.shoot,
        boost: Array.isArray(parsed.boost) && parsed.boost.length ? parsed.boost : DEFAULT_KEY_BINDINGS.boost,
      };
    }
  } catch (err) {
    console.error('Failed to load key bindings', err);
  }
  return { ...DEFAULT_KEY_BINDINGS };
}

export function saveKeyBindings(bindings: KeyBindings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch (err) {
    console.error('Failed to save key bindings', err);
  }
}

export function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3).toUpperCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'SPACE';
  if (code === 'ArrowUp') return '↑';
  if (code === 'ArrowDown') return '↓';
  if (code === 'ArrowLeft') return '←';
  if (code === 'ArrowRight') return '→';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'CTRL';
  if (code === 'AltLeft' || code === 'AltRight') return 'ALT';
  if (code === 'Enter') return 'ENTER';
  if (code === 'Tab') return 'TAB';
  if (code === 'Backspace') return 'BKSP';
  if (code === 'Escape') return 'ESC';
  return code.toUpperCase();
}

export function matchesBinding(e: KeyboardEvent, codes: string[]): boolean {
  if (!codes || codes.length === 0) return false;
  if (codes.includes(e.code)) return true;

  for (const code of codes) {
    if (code === 'Space' && (e.key === ' ' || e.key === 'Spacebar')) return true;
    if (code === 'ArrowUp' && e.key === 'ArrowUp') return true;
    if (code === 'ArrowDown' && e.key === 'ArrowDown') return true;
    if (code === 'ArrowLeft' && e.key === 'ArrowLeft') return true;
    if (code === 'ArrowRight' && e.key === 'ArrowRight') return true;
    if (code.startsWith('Key') && e.key.toLowerCase() === code.slice(3).toLowerCase()) return true;
    if (code.startsWith('Digit') && e.key === code.slice(5)) return true;
  }
  return false;
}
