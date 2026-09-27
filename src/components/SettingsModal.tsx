import React from 'react';
import { KeyBindings, GameSettings } from '../types/game';
import { KeyBindingsEditor } from './KeyBindingsEditor';
import { Settings, Volume2, VolumeX, Map, X, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GameSettings;
  onUpdateSettings: (settings: GameSettings) => void;
  keyBindings: KeyBindings;
  onUpdateKeyBindings: (bindings: KeyBindings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  keyBindings,
  onUpdateKeyBindings,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-800 p-6 md:p-8 shadow-2xl overflow-y-auto">
        {/* Accent glow */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-['Outfit'] tracking-tight">
                Game Settings & Key Bindings
              </h2>
              <p className="text-xs text-slate-400">
                Customize flight controls, audio, and tactical displays
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Toggles */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            type="button"
            onClick={() => onUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
            className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold transition-all ${
              settings.soundEnabled
                ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
          >
            {settings.soundEnabled ? (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-rose-400" />
            )}
            <span>Sound Effects: {settings.soundEnabled ? 'Enabled' : 'Muted'}</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateSettings({ ...settings, showMinimap: !settings.showMinimap })}
            className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold transition-all ${
              settings.showMinimap
                ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Map className="w-4 h-4 text-cyan-400" />
            <span>Galaxy Radar: {settings.showMinimap ? 'Visible' : 'Hidden'}</span>
          </button>
        </div>

        {/* Key Bindings Section */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Custom Flight Controls
            </h3>
            <span className="text-[11px] text-cyan-400 font-mono">
              Landing defaults to S, ↓, and L
            </span>
          </div>

          <KeyBindingsEditor bindings={keyBindings} onChange={onUpdateKeyBindings} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/25 active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
