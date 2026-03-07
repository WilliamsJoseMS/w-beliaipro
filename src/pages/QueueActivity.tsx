import React, { useEffect, useState } from 'react';
import { Clock, Megaphone, Send, Image, Users, Hash, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { io } from 'socket.io-client';
import { WS_URL, apiUrl } from '../config/api';

const socket = io(WS_URL);

interface QueueLog {
  id: string;
  jid: string;
  type: string;
  content: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  task_id: string | null;
  source_id: string | null;
  source_name: string | null;
  created_at: string;
  processed_at: string | null;
}

// Parse task_id prefix to get type info
function getTaskBadge(taskId: string | null): { label: string; color: string; icon: React.ReactNode } {
  if (!taskId) return { label: 'LEGACY', color: 'bg-slate-700/30 text-slate-400 border-slate-600/50', icon: <Hash className="w-3 h-3" /> };

  if (taskId.startsWith('DIR-')) {
    return { label: 'DIRECTO', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', icon: <Send className="w-3 h-3" /> };
  }
  if (taskId.startsWith('CMP-')) {
    return { label: 'CAMPAÑA', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: <Megaphone className="w-3 h-3" /> };
  }
  if (taskId.startsWith('STS-')) {
    return { label: 'ESTADO', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: <Image className="w-3 h-3" /> };
  }

  return { label: 'TAREA', color: 'bg-slate-700/30 text-slate-400 border-slate-600/50', icon: <Hash className="w-3 h-3" /> };
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return { label: 'Enviado', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]' };
    case 'failed':
      return { label: 'Fallido', color: 'bg-red-500/10 text-red-400 border-red-500/20', dot: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]' };
    case 'processing':
      return { label: 'Enviando', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', dot: 'bg-indigo-500 shadow-[0_0_6px_rgba(129,140,248,0.4)] animate-pulse' };
    default:
      return { label: 'En cola', color: 'bg-slate-700/30 text-slate-400 border-slate-600/50', dot: 'bg-slate-500' };
  }
}

export default function QueueActivity() {
  const [queueLogs, setQueueLogs] = useState<QueueLog[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  const handleClearHistory = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevenir que se contraiga el panel

    if (!window.confirm("¿Estás seguro de que deseas limpiar todo el historial de la cola? Esta acción no se puede deshacer y borrará todos los mensajes pendientes, procesados y fallidos.")) {
      return;
    }

    setIsClearing(true);
    try {
      const res = await fetch(apiUrl('/api/queue/clear'), { method: 'DELETE' });
      if (res.ok) {
        setQueueLogs([]);
      } else {
        alert("Hubo un error al limpiar la cola.");
      }
    } catch (error) {
      console.error(error);
      alert("Error de red al intentar limpiar.");
    } finally {
      setIsClearing(false);
    }
  };

  useEffect(() => {
    let isRateLimited = false;

    const fetchLogs = () => {
      if (document.visibilityState === 'visible' && !isRateLimited) {
        fetch(apiUrl('/api/queue/logs'))
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
    fetchLogs();
    const logsInterval = setInterval(fetchLogs, 30000);

    return () => {
      clearInterval(logsInterval);
    };
  }, []);

  // Group logs by task_id for a cleaner view
  const groupedByTask = queueLogs.reduce<Record<string, QueueLog[]>>((acc, log) => {
    const key = log.task_id || log.id; // Fallback to individual id if no task_id
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {});

  const taskGroups = Object.entries(groupedByTask);

  return (
    <div className="glass-panel rounded-3xl overflow-hidden">
      {/* Header */}
      <div
        className="w-full p-5 flex items-center justify-between hover:bg-slate-800/30 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 border border-indigo-500/20 flex items-center justify-center">
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-left">
            <h3 className="text-white font-extrabold text-sm">Actividad de la Cola</h3>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
              {queueLogs.filter(l => l.status === 'pending').length} pendientes · {queueLogs.filter(l => l.status === 'completed').length} enviados
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            title="Limpiar Historial"
            onClick={handleClearHistory}
            disabled={isClearing || queueLogs.length === 0}
            className={`p-2.5 rounded-xl border transition-all flex items-center ${isClearing || queueLogs.length === 0
              ? 'bg-slate-800/30 border-slate-700/30 text-slate-600 cursor-not-allowed opacity-50'
              : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white hover:shadow-lg hover:shadow-red-500/20'
              }`}
          >
            {isClearing ? (
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="border-t border-slate-700/50">
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto p-3 custom-scrollbar">
            {taskGroups.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-8 italic">No hay actividad reciente</p>
            ) : (
              taskGroups.map(([taskKey, logs]) => {
                const firstLog = logs[0];
                const badge = getTaskBadge(firstLog.task_id);
                const completedCount = logs.filter(l => l.status === 'completed').length;
                const failedCount = logs.filter(l => l.status === 'failed').length;
                const pendingCount = logs.filter(l => l.status === 'pending' || l.status === 'processing').length;
                const totalCount = logs.length;

                // Choose overall status for the group
                let groupStatus = 'pending';
                if (completedCount === totalCount) groupStatus = 'completed';
                else if (failedCount === totalCount) groupStatus = 'failed';
                else if (completedCount > 0 || logs.some(l => l.status === 'processing')) groupStatus = 'processing';

                const statusBadge = getStatusBadge(groupStatus);

                return (
                  <div
                    key={taskKey}
                    className="p-3.5 bg-[var(--bg-base)]/40 rounded-2xl border border-slate-700/30 hover:border-slate-600/50 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: Task info */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${statusBadge.dot}`}></span>
                        <div className="min-w-0 flex-1">
                          {/* Task ID */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${badge.color}`}>
                              {badge.icon}
                              {badge.label}
                            </span>
                            {firstLog.task_id && (
                              <code className="text-[11px] text-slate-300 font-mono font-bold">
                                {firstLog.task_id}
                              </code>
                            )}
                          </div>

                          {/* Source name / descriptive info */}
                          {firstLog.source_name && (
                            <p className="text-xs text-slate-400 mt-1 truncate">
                              {firstLog.source_name}
                            </p>
                          )}

                          {/* Progress bar for multi-recipient tasks */}
                          {totalCount > 1 && (
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                                    style={{ width: `${(completedCount / totalCount) * 100}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                  {completedCount}/{totalCount}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px]">
                                {completedCount > 0 && <span className="text-emerald-400">✓ {completedCount}</span>}
                                {pendingCount > 0 && <span className="text-slate-400">⏳ {pendingCount}</span>}
                                {failedCount > 0 && <span className="text-red-400">✗ {failedCount}</span>}
                              </div>
                            </div>
                          )}

                          {/* Timestamp */}
                          <p className="text-[10px] text-slate-600 mt-1.5 font-mono">
                            {firstLog.processed_at || firstLog.created_at
                              ? new Date(firstLog.processed_at || firstLog.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: 'numeric', minute: 'numeric', hour12: true })
                              : '---'}
                          </p>
                        </div>
                      </div>

                      {/* Right: Status badge */}
                      <div className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-xl border shrink-0 ${statusBadge.color}`}>
                        {statusBadge.label}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}