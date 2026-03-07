import React, { useEffect, useState, useCallback } from 'react';
import { Save, Shield, Clock, AlertTriangle, Info, MessageSquare, RotateCcw } from 'lucide-react';
import { TimePicker } from '../components/TimePicker';
import { apiUrl } from '../config/api';

const initialSettings = {
  minDelay: 50,
  maxDelay: 115,
  sleepStart: '22:00',
  sleepEnd: '08:00',
  maxDailyMessages: 500,
  warmupMode: false,
  typingDelay: 10,
  timezone: 'America/Caracas'
};

export default function Settings() {
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    fetch(apiUrl('/api/settings'))
      .then(res => res.json())
      .then(data => {
        if (Object.keys(data).length > 0) {
          setSettings(prev => ({ ...prev, ...data }));
        }
      })
      .catch(console.error);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }, []);

  const handleReset = useCallback(() => {
    if (window.confirm('¿Estás seguro de restablecer los valores iniciales recomendados?')) {
      setSettings(initialSettings);
      setStatus({ type: 'success', message: 'Valores restablecidos. Por favor, haz clic en "Aplicar Parámetros" para guardar.' });
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch(apiUrl('/api/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (res.ok) {
        setStatus({ type: 'success', message: 'Configuración guardada correctamente' });
      } else {
        throw new Error('Error al guardar');
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Error al guardar la configuración' });
    } finally {
      setLoading(false);
    }
  }, [settings]);

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-in fade-in duration-700">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold heading-gradient tracking-tight flex items-center">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 border border-indigo-500/20 flex items-center justify-center mr-2.5">
              <Shield className="w-4 h-4 text-indigo-400" />
            </div>
            Configuración del Sistema
          </h2>
          <p className="text-slate-500 text-xs mt-0.5 ml-[42px]">Define las políticas de envío y el comportamiento del bot.</p>
        </div>
      </div>

      <div className="glass-panel p-5 rounded-2xl relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

        <div className="flex items-center space-x-3 mb-6 relative z-10 border-b border-slate-700/50 pb-4">
          <div className="w-9 h-9 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
            <Shield className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Preferencias Anti-Spam</h2>
            <p className="text-indigo-400/80 text-[10px] font-bold tracking-wider uppercase">Protección Activa Activada</p>
          </div>
        </div>

        {status && (
          <div className={`p-3 mb-5 rounded-xl relative z-10 text-xs font-bold ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            <div className="flex items-center">
              {status.type === 'success' ? <Shield className="w-4 h-4 mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
              {status.message}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          {/* Delays Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              Intervalos de Envío Naturales
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[var(--bg-base)]/60 border border-slate-700/50 p-4 rounded-xl hover:border-indigo-500/30 transition-colors group">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 group-hover:text-indigo-400 transition-colors">Retraso Mínimo (segundos)</label>
                <input
                  type="number"
                  name="minDelay"
                  value={settings.minDelay}
                  onChange={handleChange}
                  min="1"
                  className="w-full bg-slate-950 border border-slate-700/50 text-white rounded-lg px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500/50 transition-all outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-2">Recomendado: Mínimo 50s</p>
              </div>
              <div className="bg-[var(--bg-base)]/60 border border-slate-700/50 p-4 rounded-xl hover:border-indigo-500/30 transition-colors group">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 group-hover:text-indigo-400 transition-colors">Retraso Máximo (segundos)</label>
                <input
                  type="number"
                  name="maxDelay"
                  value={settings.maxDelay}
                  onChange={handleChange}
                  min="2"
                  className="w-full bg-slate-950 border border-slate-700/50 text-white rounded-lg px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500/50 transition-all outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-2">Recomendado: Máximo 115s</p>
              </div>
            </div>
          </div>

          {/* Typing Simulation Section */}
          <div className="pt-5 border-t border-slate-700/50 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              Simulación Humana Dinámica
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-[var(--bg-base)]/60 border border-slate-700/50 p-4 rounded-xl hover:border-emerald-500/30 transition-colors group">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 group-hover:text-emerald-400 transition-colors">
                  Tiempo de escritura (seg)
                </label>
                <input
                  type="number"
                  name="typingDelay"
                  value={settings.typingDelay}
                  onChange={handleChange}
                  min="0"
                  max="30"
                  className="w-full bg-slate-950 border border-slate-700/50 text-white rounded-lg px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-emerald-500/50 transition-all outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-2">0 = deshabilitado. Recomendado: 2–8s</p>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex items-start space-x-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg shrink-0">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 mb-0.5">Efecto "Escribiendo..."</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Antes de cada envío, el sistema emitirá el estado de escritura. Esto hace indetectable y orgánico el envío.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Limits Section */}
          <div className="pt-5 border-t border-slate-700/50 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Límites, Husos y Modo Reposo
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[var(--bg-base)]/60 border border-slate-700/50 p-4 rounded-xl hover:border-amber-500/30 transition-colors group">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 group-hover:text-amber-400 transition-colors">Huso Horario Master</label>
                <select
                  name="timezone"
                  value={settings.timezone}
                  onChange={(e) => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700/50 text-white rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500/50 transition-all outline-none appearance-none cursor-pointer"
                >
                  <option value="America/Caracas">America/Caracas (VET)</option>
                  <option value="America/Mexico_City">America/Mexico_City (CST/CDT)</option>
                  <option value="America/Bogota">America/Bogota (EST)</option>
                  <option value="America/Lima">America/Lima (EST)</option>
                  <option value="America/Santiago">America/Santiago (CLT)</option>
                  <option value="America/Argentina/Buenos_Aires">America/Argentina/Buenos_Aires (ART)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="Europe/Madrid">Europe/Madrid (CET/CEST)</option>
                  <option value="UTC">UTC Universal</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-2">Coordina toda la mensajería.</p>
              </div>
              <div className="bg-[var(--bg-base)]/60 border border-slate-700/50 p-4 rounded-xl hover:border-amber-500/30 transition-colors group">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 group-hover:text-amber-400 transition-colors">Dormir el Bot a las</label>
                <TimePicker
                  value={settings.sleepStart}
                  onChange={(val) => setSettings(prev => ({ ...prev, sleepStart: val }))}
                  className="w-full"
                />
              </div>
              <div className="bg-[var(--bg-base)]/60 border border-slate-700/50 p-4 rounded-xl hover:border-amber-500/30 transition-colors group">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 group-hover:text-amber-400 transition-colors">Despertar a las</label>
                <TimePicker
                  value={settings.sleepEnd}
                  onChange={(val) => setSettings(prev => ({ ...prev, sleepEnd: val }))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 flex items-start space-x-3">
              <Info className="shrink-0 mt-0.5 w-4 h-4 text-amber-500" />
              <p className="text-[11px] text-slate-300 leading-relaxed">
                El modo reposo detiene todas las tareas simulando a un usuario humano durmiendo. No habrá salidas hasta la "hora de despertar".
              </p>
            </div>
          </div>

          <div className="pt-5 border-t border-slate-700/50 flex flex-col flex-col-reverse sm:flex-row justify-end space-y-3 space-y-reverse sm:space-y-0 sm:space-x-3">
            <button
              type="button"
              onClick={handleReset}
              className="w-full sm:w-auto px-6 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 flex items-center justify-center text-sm transition-all hover:scale-[1.02] active:scale-[0.98] border border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-slate-500/50"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Valores Iniciales
            </button>
            <button
              type="submit"
              disabled={loading}
              className="glass-button w-full sm:w-auto px-6 py-2.5 bg-indigo-600/80 text-white font-bold rounded-xl hover:bg-indigo-500 flex items-center justify-center text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? 'Sincronizando...' : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Aplicar Parámetros
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
