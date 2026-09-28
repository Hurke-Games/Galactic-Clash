import React, { useState, useEffect } from 'react';
import { KeyBindings, DEFAULT_KEY_BINDINGS } from '../types/game';
import { formatKeyCode } from '../utils/controls';
import { RotateCcw, Plus, X, Keyboard } from 'lucide-react';

interface KeyBindingsEditorProps {
  bindings: KeyBindings;
  onChange: (updated: KeyBindings) => void;
}

type ActionKey = keyof KeyBindings;

interface ActionDef {
  key: ActionKey;
  label: string;
  description: string;
}

const ACTIONS: ActionDef[] = [
  {
    key: 'land',
    label: 'Land on Planet',
    description: 'When near any world, tap to enter orbital landing & claim territory. (Defaults: S, ↓, L)',
  },
  {
    key: 'thrust',
    label: 'Thrust / Liftoff',
    description: 'Launch ship off planet into space & accelerate forward (W, ↑, Shift)',
  },
  {
    key: 'boost',
    label: 'Hyper-Thrust / Boost',
    description: 'Engage high-velocity afterburners (Defaults: Left Shift, Right Shift)',
  },
  {
    key: 'turnLeft',
    label: 'Turn Left',
    description: 'Rotate ship counter-clockwise in space flight',
  },
  {
    key: 'turnRight',
    label: 'Turn Right',
    description: 'Rotate ship clockwise in space flight',
  },
  {
    key: 'reverse',
    label: 'Reverse / Brake',
    description: 'Slow down ship velocity in open space (retro-thrusters)',
  },
  {
    key: 'shoot',
    label: 'Fire Lasers',
    description: 'Discharge plasma cannons (Space, F, or Left Mouse Button)',
  },
];

export const KeyBindingsEditor: React.FC<KeyBindingsEditorProps> = ({ bindings, onChange }) => {
  const [listeningAction, setListeningAction] = useState<{
    action: ActionKey;
    index?: number; // if undefined, adding a new key
  } | null>(null);

  useEffect(() => {
    if (!listeningAction) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.code === 'Escape') {
        setListeningAction(null);
        return;
      }

      const newCode = e.code || e.key;
      const { action, index } = listeningAction;
      const currentKeys = [...(bindings[action] || [])];

      if (index !== undefined && index >= 0 && index < currentKeys.length) {
        // Replace existing key
        currentKeys[index] = newCode;
      } else {
        // Add new key if not already bound
        if (!currentKeys.includes(newCode)) {
          currentKeys.push(newCode);
        }
      }

      // Deduplicate
      const uniqueKeys = Array.from(new Set(currentKeys));

      onChange({
        ...bindings,
        [action]: uniqueKeys,
      });

      setListeningAction(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [listeningAction, bindings, onChange]);

  const handleRemoveKey = (action: ActionKey, keyToRemove: string) => {
    const currentKeys = bindings[action] || [];
    if (currentKeys.length <= 1) return; // Keep at least one binding
    onChange({
      ...bindings,
      [action]: currentKeys.filter((k) => k !== keyToRemove),
    });
  };

  const handleResetDefaults = () => {
    onChange({ ...DEFAULT_KEY_BINDINGS });
  };

  return (
    <div className="space-y-4">
      {/* Listening Overlay Alert */}
      {listeningAction && (
        <div className="p-3.5 rounded-xl bg-cyan-950/80 border border-cyan-500/60 text-cyan-200 text-xs flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-cyan-400" />
            <span>
              Press any key for{' '}
              <strong className="text-white font-semibold">
                {ACTIONS.find((a) => a.key === listeningAction.action)?.label}
              </strong>
              ...
            </span>
          </div>
          <span className="text-[11px] text-cyan-400/80">Press ESC to cancel</span>
        </div>
      )}

      {/* Action Table */}
      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
        {ACTIONS.map((action) => {
          const keys = bindings[action.key] || [];

          return (
            <div
              key={action.key}
              className={`p-3 rounded-xl border transition-all ${
                listeningAction?.action === action.key
                  ? 'bg-slate-800/90 border-cyan-500 shadow-md shadow-cyan-500/10'
                  : 'bg-slate-950/60 border-slate-800/90 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-white font-sans flex items-center gap-2">
                    <span>{action.label}</span>
                    {action.key === 'land' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-medium">
                        S / ↓ / L
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    {action.description}
                  </p>
                </div>

                {/* Key Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {keys.map((code, idx) => {
                    const isListeningThis =
                      listeningAction?.action === action.key && listeningAction?.index === idx;

                    return (
                      <div key={idx} className="relative group flex items-center">
                        <button
                          type="button"
                          onClick={() => setListeningAction({ action: action.key, index: idx })}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                            isListeningThis
                              ? 'bg-cyan-500 text-slate-950 border-cyan-400 animate-pulse'
                              : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700 hover:border-cyan-500/50'
                          }`}
                          title="Click to rebind this key"
                        >
                          {formatKeyCode(code)}
                        </button>
                        {keys.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveKey(action.key, code)}
                            className="ml-0.5 p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
                            title="Remove key"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Add additional key binding button */}
                  {keys.length < 3 && (
                    <button
                      type="button"
                      onClick={() => setListeningAction({ action: action.key })}
                      className="p-1.5 rounded-lg bg-slate-900 border border-dashed border-slate-700 hover:border-cyan-500 text-slate-400 hover:text-cyan-400 transition-colors"
                      title="Add secondary key"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reset to Defaults Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
        <span className="text-[11px]">Click any key to rebind, or press + to add another key.</span>
        <button
          type="button"
          onClick={handleResetDefaults}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs font-medium"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Defaults</span>
        </button>
      </div>
    </div>
  );
};
