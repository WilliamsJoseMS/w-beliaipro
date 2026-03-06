import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';
import { CheckCircle, AlertCircle, Loader2, Activity, Smartphone, Wifi, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const socket = io('http://localhost:3000');

export default function Dashboard() {
  const [queueStats, setQueueStats] = useState<any>({ pending: 0, completed: 0, failed: 0 });
  const [queueLogs, setQueueLogs] = useState<any[]>([]);
  const [serverTime, setServerTime] = useState<any>(null);

  useEffect(() => {
    // Sincronizar la zona horaria real del dispositivo con el servidor
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      fetch('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: tz })
      }).catch(() => { });
    } catch (e) { }

    let isRateLimited = false;

    const fetchTime = () => {
      if (document.visibilityState === 'visible' && !isRateLimited) {
        fetch('http://localhost:3000/api/time')
          .then(res => {
            if (res.status === 429) {
              isRateLimited = true;
              setTimeout(() => { isRateLimited = false; }, 60000);
              return;
            }
            return res.json();
          })
          .then(data => { if (data) setServerTime(data); })
          .catch(() => { });
      }
    };

    const fetchLogs = () => {
      if (document.visibilityState === 'visible' && !isRateLimited) {
        fetch('http://localhost:3000/api/queue/logs')
          .then(res => {
            if (res.status === 429) {
              isRateLimited = true;
              setTimeout(() => { isRateLimited = false; }, 60000);
              return;
            }
            return res.json();
          })
          .then(data => { if (data) setQueueLogs(data); })
          .catch(() => { });
      }
    };

    fetchTime();
    fetchLogs();
    const timeInterval = setInterval(fetchTime, 60000); // Update every 60s
    const logsInterval = setInterval(fetchLogs, 30000); // Update every 30s

    // CAMBIO 3: Eliminado el event listener de visibilitychange que causaba spam de peticiones

    socket.on('queue_update', (stats) => {
      setQueueStats(stats);
    });

    fetch('http://localhost:3000/api/queue/stats').then(res => res.json()).then(setQueueStats);

    // Auto reload dashboard every 5 minutes (300000 ms)
    const reloadInterval = setInterval(() => {
      window.location.reload();
    }, 300000);

    return () => {
      clearInterval(timeInterval);
      clearInterval(logsInterval);
      clearInterval(reloadInterval);
      // CAMBIO 3: Eliminado el removeEventListener correspondiente
      socket.off('queue_update');
    };
  }, []);

  return (
    <div className="max-w-[1600px] mx-auto space-y-5 animate-in fade-in duration-700">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-linear-to-r from-white to-slate-400 tracking-tight">
            Panel Principal
          </h2>
          <p className="text-slate-400 text-xs mt-0.5 font-medium">Resumen general de actividad y rendimiento del sistema.</p>
        </div>
        {serverTime && (
          <div className="flex items-center space-x-2.5 bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 px-4 py-2 rounded-xl shadow-md">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
            <div>
              <p className="text-[9px] uppercase font-bold text-slate-500 tracking-widest leading-none mb-0.5">Hora del Servidor</p>
              <p className="text-xs font-black text-white font-mono leading-none">{serverTime.local12}</p>
            </div>
          </div>
        )}
      </div>

      {/* 1. TOP STATS ROW - PREMIUM GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

        {/* Operativo Card */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 p-3 rounded-2xl shadow-xl relative overflow-hidden group hover:border-indigo-500/50 transition-all duration-500 flex flex-col justify-between min-h-[100px]">
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 rounded-full blur-3xl -mr-8 -mt-8 group-hover:bg-indigo-500/20 transition-all duration-700"></div>
          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-linear-to-r from-indigo-600 to-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

          <div className="flex justify-between items-start relative z-10 w-full">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-inner">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <span className="text-[8px] uppercase font-black text-indigo-400 tracking-widest bg-indigo-500/10 px-2 py-1 rounded-full border border-indigo-500/20">
              En línea
            </span>
          </div>
          <div className="relative z-10 mt-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Estado</p>
            <p className="text-lg font-black text-white leading-none tracking-tight">Operativo</p>
          </div>
        </div>

        {/* Enviados Card */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 p-3 rounded-2xl shadow-xl relative overflow-hidden group hover:border-emerald-500/50 transition-all duration-500 flex flex-col justify-between min-h-[100px]">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-3xl -mr-8 -mt-8 group-hover:bg-emerald-500/20 transition-all duration-700"></div>
          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-linear-to-r from-emerald-600 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

          <div className="flex justify-between items-start relative z-10 w-full">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-inner">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-[8px] uppercase font-black text-emerald-400 tracking-widest bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
              Éxito
            </span>
          </div>
          <div className="relative z-10 mt-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Enviados</p>
            <p className="text-xl font-black text-white leading-none tracking-tight">{queueStats.completed.toLocaleString()}</p>
          </div>
        </div>

        {/* Pendientes Card */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 p-3 rounded-2xl shadow-xl relative overflow-hidden group hover:border-amber-500/50 transition-all duration-500 flex flex-col justify-between min-h-[100px]">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full blur-3xl -mr-8 -mt-8 group-hover:bg-amber-500/20 transition-all duration-700"></div>
          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-linear-to-r from-amber-600 to-amber-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

          <div className="flex justify-between items-start relative z-10 w-full">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-inner">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            {queueStats.pending > 0 && (
              <span className="text-[8px] uppercase font-black text-amber-400 tracking-widest bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20 animate-pulse">
                Procesando
              </span>
            )}
          </div>
          <div className="relative z-10 mt-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Pendientes</p>
            <p className="text-xl font-black text-white leading-none tracking-tight">{queueStats.pending.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* 2. MAIN LAYOUT (RECENT DB ONLY) */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl flex flex-col overflow-hidden min-h-[350px]">

        {/* Table Header Area */}
        <div className="px-5 py-4 border-b border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-800/20 relative overflow-hidden">
          <div className="absolute left-0 top-0 w-0.5 h-full bg-linear-to-b from-indigo-500 to-emerald-500"></div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              Monitor de Actividad
            </h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Historial reciente de la cola de envíos</p>
          </div>
          <span className="mt-2 sm:mt-0 text-[9px] bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20 text-indigo-400 font-bold tracking-widest uppercase">
            Top 10 Registros
          </span>
        </div>

        <div className="flex-1 overflow-x-auto p-1.5">
          {queueLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 min-h-[250px]">
              <div className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center mb-3 border border-slate-700/50">
                <Activity className="w-7 h-7 opacity-30 text-indigo-400" />
              </div>
              <p className="text-sm font-bold text-slate-400">Sin actividad reciente</p>
              <p className="text-xs opacity-60 mt-0.5">Los registros aparecerán aquí automáticamente.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-400 text-[9px] uppercase tracking-widest font-bold border-b border-slate-700/30">
                  <th className="px-4 py-2.5">ID de Campaña / Tarea</th>
                  <th className="px-4 py-2.5">Destinatario</th>
                  <th className="px-4 py-2.5 text-center">Formato</th>
                  <th className="px-4 py-2.5 text-right">Estado Actual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {queueLogs.slice(0, 10).map((log, i) => (
                  <tr key={log.id || i} className="hover:bg-slate-800/40 transition-colors duration-200 group">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-500/50 group-hover:bg-indigo-400 transition-colors"></div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white max-w-[200px] truncate" title={log.source_name || ''}>
                            {log.source_name || 'Mensaje Directo'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 mt-0.5">
                            {log.task_id || (log.id ? log.id.substring(0, 8) : '')}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="inline-flex items-center border border-slate-700 bg-slate-900/50 rounded-lg px-3 py-1.5 font-mono text-xs text-slate-300">
                        <Smartphone className="w-3 h-3 mr-2 text-slate-500" />
                        +{log.jid ? log.jid.split('@')[0] : '---'}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-block text-[10px] px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 uppercase font-black tracking-wider">
                        {log.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {log.status === 'completed' && (
                        <span className="inline-flex items-center text-[10px] font-black tracking-widest uppercase text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-md border border-emerald-500/20">
                          <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Completado
                        </span>
                      )}
                      {log.status === 'failed' && (
                        <span className="inline-flex items-center text-[10px] font-black tracking-widest uppercase text-red-400 bg-red-500/10 px-3 py-1.5 rounded-md border border-red-500/20">
                          <AlertCircle className="w-3.5 h-3.5 mr-1.5" /> Error
                        </span>
                      )}
                      {log.status === 'processing' && (
                        <span className="inline-flex items-center text-[10px] font-black tracking-widest uppercase text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-md border border-amber-500/20">
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Procesando
                        </span>
                      )}
                      {log.status === 'pending' && (
                        <span className="inline-flex items-center text-[10px] font-black tracking-widest uppercase text-slate-400 bg-slate-800 px-3 py-1.5 rounded-md border border-slate-700">
                          <Clock className="w-3.5 h-3.5 mr-1.5" /> Espera
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );

}