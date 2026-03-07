import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { apiUrl } from '../config/api';
import {
  Plus,
  Trash2,
  Play,
  Pause,
  Calendar,
  Clock,
  Type,
  Image as ImageIcon,
  Video,
  Music,
  Share2,
  CheckCircle2,
  AlertCircle,
  Edit2,
  X,
  Search,
  Users,
  Palette,
  ChevronRight
} from 'lucide-react';
import { WhatsAppPreview } from '../components/WhatsAppPreview';
import { TimePicker } from '../components/TimePicker';

interface ScheduledStatus {
  id: string;
  type: 'text' | 'image' | 'video';
  content: any;
  days: number[];
  times: string[];
  start_date: string;
  end_date: string;
  share_to_groups: string[];
  status: 'active' | 'paused';
  created_at: string;
}

export default function Status() {
  const [statuses, setStatuses] = useState<ScheduledStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingStatus, setEditingStatus] = useState<ScheduledStatus | null>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');

  const [formData, setFormData] = useState({
    type: 'text' as 'text' | 'image' | 'video',
    text: '',
    backgroundColor: '#000000',
    font: 0,
    caption: '',
    file: null as File | null,
    days: [] as number[],
    times: ['09:00'],
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    share_to_groups: [] as string[]
  });

  const fetchStatuses = async () => {
    try {
      const res = await fetch(apiUrl('/api/statuses'));
      const data = await res.json();
      setStatuses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch(apiUrl('/api/groups'));
      const data = await res.json();
      setGroups(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatuses();
    fetchGroups();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.days.length === 0) {
      toast.error('Selecciona al menos un día');
      return;
    }
    setSubmitting(true);

    const body = new FormData();
    body.append('type', formData.type);
    body.append('days', JSON.stringify(formData.days));
    body.append('times', JSON.stringify(formData.times));
    body.append('start_date', formData.start_date);
    body.append('end_date', formData.end_date);
    body.append('share_to_groups', JSON.stringify(formData.share_to_groups));

    if (editingStatus) {
      body.append('id', editingStatus.id);
    }

    if (formData.type === 'text') {
      body.append('text', formData.text);
      body.append('backgroundColor', formData.backgroundColor);
      body.append('font', formData.font.toString());
    } else {
      if (formData.file) body.append('file', formData.file);
      body.append('caption', formData.caption);
    }

    try {
      const res = await fetch(editingStatus ? `/api/statuses/${editingStatus.id}` : '/api/statuses', {
        method: editingStatus ? 'PATCH' : 'POST',
        body
      });
      if (res.ok) {
        toast.success(editingStatus ? 'Estado actualizado correctamente' : 'Estado programado correctamente');
        setIsModalOpen(false);
        fetchStatuses();
        setEditingStatus(null);
        // Reset form
        setFormData({
          type: 'text',
          text: '',
          backgroundColor: '#000000',
          font: 0,
          caption: '',
          file: null,
          days: [],
          times: ['09:00'],
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          share_to_groups: []
        });
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error al guardar');
      }
    } catch (err) {
      toast.error('Error de red');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (id: string) => {
    const promise = fetch(`/api/statuses/${id}/toggle`, { method: 'POST' });
    toast.promise(promise, {
      loading: 'Cambiando estado...',
      success: 'Estado cambiado',
      error: 'Error al cambiar estado',
    });
    await promise;
    fetchStatuses();
  };

  const deleteStatus = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este estado programado?')) return;
    const promise = fetch(`/api/statuses/${id}`, { method: 'DELETE' });
    toast.promise(promise, {
      loading: 'Eliminando...',
      success: 'Estado eliminado',
      error: 'Error al eliminar',
    });
    await promise;
    fetchStatuses();
  };

  const toggleDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day]
    }));
  };

  const toggleGroup = (jid: string) => {
    setFormData(prev => ({
      ...prev,
      share_to_groups: prev.share_to_groups.includes(jid) ? prev.share_to_groups.filter(g => g !== jid) : [...prev.share_to_groups, jid]
    }));
  };

  const convertTo12Hour = (time24h: string) => {
    if (!time24h) return '';
    const [hours, minutes] = time24h.split(':');
    const h = parseInt(hours);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = ((h + 11) % 12 + 1);
    return `${String(h12).padStart(2, '0')}:${minutes} ${suffix}`;
  };

  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const bgColors = ['#000000', '#128C7E', '#075E54', '#34B7F1', '#25D366', '#FC6400', '#D30038', '#8E24AA'];

  return (
    <div className="max-w-[1600px] mx-auto space-y-5 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold heading-gradient tracking-tight flex items-center">
            <Share2 className="w-5 h-5 mr-2.5 text-emerald-400" />
            Estados Automáticos
          </h2>
          <p className="text-slate-500 text-xs mt-0.5 ml-[30px]">Programa actualizaciones de estado rotativas y difusión grupal.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="glass-button bg-emerald-600/80 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center transition-all text-xs hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Crear Nuevo Estado
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
        </div>
      ) : statuses.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl border-dashed border-2 border-slate-700/50 hover:border-emerald-500/30 transition-colors">
          <div className="w-14 h-14 bg-slate-900/80 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700/50 shadow-inner">
            <Share2 className="w-7 h-7 text-emerald-500/50" />
          </div>
          <h3 className="text-base font-bold text-white tracking-tight mb-1">No tienes estados activos</h3>
          <p className="text-slate-400 text-xs">Tu máquina de estados está vacía. Comienza programando el primero.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {statuses.map(status => (
            <div key={status.id} className="glass-panel rounded-2xl overflow-hidden flex flex-col group hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] transition-all duration-500">
              <div className="p-4 flex-1 space-y-3">
                <div className="flex justify-between items-start">
                  <div className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${status.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                    {status.status === 'active' ? 'Activo' : 'Pausado'}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingStatus(status);
                        setFormData({
                          type: status.type,
                          text: status.content.text || '',
                          backgroundColor: status.content.backgroundColor || '#000000',
                          font: status.content.font || 0,
                          caption: status.content.caption || '',
                          file: null,
                          days: status.days,
                          times: status.times,
                          start_date: status.start_date,
                          end_date: status.end_date,
                          share_to_groups: status.share_to_groups
                        });
                        setIsModalOpen(true);
                      }}
                      className="p-2 bg-slate-800/80 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleStatus(status.id)} className={`p-2 border rounded-lg transition-all ${status.status === 'active' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20'}`}>
                      {status.status === 'active' ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
                    </button>
                    <button onClick={() => deleteStatus(status.id)} className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 hover:bg-red-500/20 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="aspect-square sm:aspect-video bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800 relative group-hover:border-emerald-500/30 transition-all shadow-inner">
                  {status.type === 'text' ? (
                    <div
                      className="w-full h-full flex items-center justify-center p-6 text-center"
                      style={{ backgroundColor: status.content.backgroundColor }}
                    >
                      <p className="text-white text-base md:text-lg font-bold line-clamp-4 leading-relaxed tracking-wide">{status.content.text}</p>
                    </div>
                  ) : (
                    <div className="w-full h-full relative">
                      {status.type === 'image' ? (
                        <img src={status.content.url} alt="" className="w-full h-full object-cover opacity-60 mix-blend-luminosity hover:mix-blend-normal transition-all duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-950">
                          <Video className="w-10 h-10 text-slate-800" />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/40 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-xl">
                          {status.type === 'image' ? <ImageIcon className="w-6 h-6 text-emerald-400" /> : <Video className="w-6 h-6 text-emerald-400" />}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center text-xs text-slate-300">
                    <Calendar className="w-4 h-4 mr-2 text-emerald-500 bg-emerald-500/10 p-0.5 rounded" />
                    {status.days.map(d => daysOfWeek[d]).join(', ')}
                  </div>
                  <div className="flex items-center text-xs text-slate-300">
                    <Clock className="w-4 h-4 mr-2 text-indigo-500 bg-indigo-500/10 p-0.5 rounded" />
                    {status.times.map(t => convertTo12Hour(t)).join(', ')}
                  </div>
                  {status.share_to_groups.length > 0 && (
                    <div className="flex items-center text-xs text-blue-400 font-bold bg-blue-500/5 p-2 rounded-lg border border-blue-500/10">
                      <Share2 className="w-4 h-4 mr-2 bg-blue-500/20 p-0.5 rounded" />
                      Difusión a {status.share_to_groups.length} grupos
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Premium Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-lg animate-in fade-in duration-300">
          <div className="glass-panel rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.8)] border border-slate-700/60 font-manrope">
            <div className="p-3 border-b border-slate-700/60 flex justify-between items-center bg-slate-900/80 relative overflow-hidden">
              <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-emerald-500 to-indigo-500"></div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">{editingStatus ? 'Editar Estado' : 'Programador de Estados'}</h3>
                <p className="text-slate-400 text-[10px] font-medium mt-0">Configura la aparición automática en historias o grupos</p>
              </div>
              <button onClick={() => { setIsModalOpen(false); setEditingStatus(null); }} className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-all border border-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900/40">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">

                {/* Left: Content */}
                <div className="lg:col-span-12 xl:col-span-7 space-y-3 p-3 border-r border-slate-700/50">
                  <div className="space-y-4">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Formato</label>
                    <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                      {[
                        { id: 'text', label: 'Texto Rotativo', icon: Type },
                        { id: 'image', label: 'Imagen HD', icon: ImageIcon },
                        { id: 'video', label: 'Clípeo Video', icon: Video }
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, type: t.id as any, file: null })}
                          className={`flex-1 flex items-center justify-center py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${formData.type === t.id ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}
                        >
                          <t.icon className={`w-5 h-5 mr-2 ${formData.type === t.id ? 'text-emerald-400' : ''}`} />
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {formData.type === 'text' ? (
                    <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
                      <div className="space-y-4">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Mensaje en Pantalla</label>
                        <textarea
                          value={formData.text}
                          onChange={e => setFormData({ ...formData, text: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 text-white text-sm font-bold leading-relaxed rounded-2xl p-4 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-slate-700 min-h-[120px] shadow-inner"
                          placeholder="Tu mensaje que impacta..."
                          required
                        />
                      </div>

                      <div className="space-y-4">
                        <label className="flex items-center text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          <Palette className="w-4 h-4 mr-2 text-emerald-500" />
                          Ambiente de Fondo
                        </label>
                        <div className="flex flex-wrap gap-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
                          {bgColors.map(color => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setFormData({ ...formData, backgroundColor: color })}
                              className={`w-8 h-8 rounded-lg transition-all duration-300 ${formData.backgroundColor === color ? 'ring-2 ring-emerald-500 scale-110 shadow-lg' : 'hover:scale-105 border border-white/10'}`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
                      <div className="bg-slate-950 border-2 border-dashed border-slate-800 rounded-3xl p-8 text-center hover:border-emerald-500/50 hover:bg-slate-900/50 transition-all duration-300 cursor-pointer relative group flex flex-col items-center justify-center min-h-[200px]">
                        {formData.file ? (
                          <div className="space-y-6">
                            <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/20 shadow-inner">
                              {formData.type === 'image' ? <ImageIcon className="w-10 h-10 text-emerald-400" /> : <Video className="w-10 h-10 text-emerald-400" />}
                            </div>
                            <p className="text-white font-black text-lg truncate max-w-[250px] mx-auto bg-slate-900 p-2 rounded-lg border border-slate-800">{formData.file.name}</p>
                            <button type="button" onClick={() => setFormData({ ...formData, file: null })} className="text-sm font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-widest bg-red-500/10 px-4 py-2 rounded-lg">Borrar</button>
                          </div>
                        ) : (
                          <>
                            <input
                              type="file"
                              accept={formData.type === 'image' ? 'image/*' : 'video/*'}
                              onChange={e => setFormData({ ...formData, file: e.target.files?.[0] || null })}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              required={!editingStatus}
                            />
                            <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-800 shadow-inner group-hover:scale-110 transition-transform">
                              <Plus className="w-8 h-8 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                            </div>
                            <p className="text-lg text-slate-300 font-bold mb-2">Click para subir {formData.type === 'image' ? 'Imagen' : 'Video'}</p>
                            <p className="text-sm text-slate-500 font-medium">o arrastra y suelta el archivo aquí</p>
                          </>
                        )}
                      </div>
                      <div className="space-y-4">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Leyenda Descriptiva</label>
                        <input
                          type="text"
                          value={formData.caption}
                          onChange={e => setFormData({ ...formData, caption: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-5 py-3.5 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-slate-600 font-medium text-sm shadow-inner"
                          placeholder="Texto que acompaña al archivo multimedia..."
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-8 border-t border-slate-700/50 space-y-6">
                    <div className="flex items-center justify-between bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <label className="flex items-center text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        <Share2 className="w-5 h-5 mr-3 text-indigo-400 bg-indigo-500/10 p-1 rounded-lg" />
                        Distribución Grupal
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowGroupSelector(!showGroupSelector)}
                        className={`text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border transition-all duration-300 ${showGroupSelector || formData.share_to_groups.length > 0 ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'}`}
                      >
                        {formData.share_to_groups.length} Vínculos
                      </button>
                    </div>

                    {showGroupSelector && (
                      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-inner animate-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center justify-between gap-4">
                          <div className="relative flex-1">
                            <Search className="w-5 h-5 absolute left-4 top-3.5 text-slate-600" />
                            <input
                              type="text"
                              placeholder="Buscar en el directorio..."
                              value={groupSearch}
                              onChange={e => setGroupSearch(e.target.value)}
                              className="w-full bg-slate-900 text-sm font-medium text-white pl-12 pr-4 py-3.5 rounded-xl border border-slate-800 outline-none focus:border-indigo-500/50 transition-colors"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, share_to_groups: groups.map(g => g.id) })}
                              className="text-[10px] uppercase font-black text-indigo-400 px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl hover:bg-indigo-500/20 transition-colors"
                            >
                              Seleccionar Todo
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, share_to_groups: [] })}
                              className="text-[10px] uppercase font-black text-slate-500 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:text-white transition-colors"
                            >
                              Limpiar
                            </button>
                          </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar p-1">
                          {groups.filter(g => g.subject?.toLowerCase().includes(groupSearch.toLowerCase())).map(group => (
                            <div
                              key={group.id}
                              onClick={() => toggleGroup(group.id)}
                              className={`flex items-center p-4 rounded-2xl cursor-pointer transition-all duration-200 ${formData.share_to_groups.includes(group.id) ? 'bg-indigo-500/10 border border-indigo-500/30 shadow-sm' : 'hover:bg-slate-900 border border-transparent'}`}
                            >
                              <div className={`w-6 h-6 rounded-lg border-2 mr-4 flex items-center justify-center transition-colors ${formData.share_to_groups.includes(group.id) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-700 bg-slate-900'}`}>
                                {formData.share_to_groups.includes(group.id) && <CheckCircle2 className="w-4 h-4 text-white" />}
                              </div>
                              <span className={`text-sm tracking-wide truncate ${formData.share_to_groups.includes(group.id) ? 'text-white font-bold' : 'text-slate-400 font-medium'}`}>{group.subject}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-12 xl:col-span-5 flex flex-col bg-slate-900/40 p-3 shadow-inner">
                  <div className="space-y-4 flex-1">
                    <div className="space-y-4">
                      <label className="flex items-center text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        <Calendar className="w-5 h-5 mr-3 text-emerald-500" />
                        Cronograma de Días
                      </label>
                      <div className="grid grid-cols-4 gap-3">
                        {daysOfWeek.map((day, index) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(index)}
                            className={`py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 border ${formData.days.includes(index) ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/30' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700 hover:bg-slate-800'}`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          <Clock className="w-5 h-5 mr-3 text-emerald-500" />
                          Ejecución Rotativa
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, times: [...formData.times, '09:00'] })}
                          className="text-[10px] uppercase font-black tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-colors flex items-center"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Hito
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {formData.times.map((time, index) => (
                          <div key={index} className="relative group perspective">
                            <div className="bg-slate-950 p-2 rounded-2xl border border-slate-800 shadow-inner">
                              <TimePicker
                                value={time}
                                onChange={val => {
                                  const newTimes = [...formData.times];
                                  newTimes[index] = val;
                                  setFormData({ ...formData, times: newTimes });
                                }}
                                className="w-full text-center"
                              />
                            </div>
                            {formData.times.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, times: formData.times.filter((_, i) => i !== index) })}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner">
                      <div className="space-y-3">
                        <p className="text-[10px] text-emerald-400 uppercase font-black tracking-widest flex items-center">
                          <ChevronRight className="w-3 h-3 mr-1" /> F. Inicio
                        </p>
                        <input
                          type="date"
                          value={formData.start_date}
                          onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 text-white font-mono text-sm rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-colors custom-date-picker"
                        />
                      </div>
                      <div className="space-y-3">
                        <p className="text-[10px] text-red-400 uppercase font-black tracking-widest flex items-center">
                          <AlertCircle className="w-3 h-3 mr-1" /> F. Término
                        </p>
                        <input
                          type="date"
                          value={formData.end_date}
                          onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 text-white font-mono text-sm rounded-xl px-4 py-3 outline-none focus:border-red-500/50 transition-colors custom-date-picker"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Simulación del Dispositivo</label>
                      <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800 shadow-inner flex items-center justify-center min-h-[180px]">
                        <WhatsAppPreview
                          text={formData.text}
                          caption={formData.caption}
                          type={formData.type}
                          file={formData.file}
                          backgroundColor={formData.backgroundColor}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action Button inside right panel for better alignment */}
                  <div className="mt-6">
                    <button
                      type="submit"
                      disabled={submitting}
                      className={`glass-button w-full py-3.5 bg-emerald-600/80 text-white font-black text-base tracking-wide rounded-2xl flex items-center justify-center shadow-[0_10px_40px_-10px_rgba(16,185,129,0.5)] border-t-0 border-emerald-400/50 ${submitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-500 hover:shadow-[0_10px_40px_-5px_rgba(16,185,129,0.6)] hover:-translate-y-1'}`}
                    >
                      {submitting ? (
                        <div className="w-7 h-7 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>
                          {editingStatus ? <Edit2 className="w-6 h-6 mr-3" /> : <Play className="w-6 h-6 mr-3" />}
                          {editingStatus ? 'Actualizar Sistema' : 'Iniciar Automatización'}
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-center text-slate-500 font-bold uppercase tracking-widest mt-4">Los datos se sincronizarán mediante cloud</p>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
