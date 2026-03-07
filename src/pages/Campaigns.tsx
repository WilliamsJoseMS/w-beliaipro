import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { apiUrl } from '../config/api';
import {
  Megaphone, Plus, Search, Calendar, Clock,
  Play, Pause, Edit2, Trash2, Users,
  FileText, ImageIcon, Video, Music, File,
  CheckCircle2, AlertCircle, X, ChevronRight,
  MoreVertical, Send, Eye, Link2, GripVertical
} from 'lucide-react';
import { WhatsAppPreview, type UrlButton } from '../components/WhatsAppPreview';
import { TimePicker } from '../components/TimePicker';

interface Campaign {
  id: string;
  name: string;
  recipients: string[];
  type: string;
  content: any;
  days: number[];
  times: string[];
  start_date: string;
  end_date: string;
  taskId: string;
  task_id: string;
  status: 'active' | 'paused';
}

const DAYS_OF_WEEK = [
  { label: 'Dom', value: 0 },
  { label: 'Lun', value: 1 },
  { label: 'Mar', value: 2 },
  { label: 'Mié', value: 3 },
  { label: 'Jue', value: 4 },
  { label: 'Vie', value: 5 },
  { label: 'Sáb', value: 6 },
];

interface CampaignFormData {
  name: string;
  recipients: string[];
  type: string;
  text: string;
  caption: string;
  footer: string;
  taskId: string;
  file: File | null;
  days: number[];
  times: string[];
  start_date: string;
  end_date: string;
  urlButtons: UrlButton[];
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [groups, setGroups] = useState<any[]>([]);

  // Form state
  const [formData, setFormData] = useState<CampaignFormData>({
    name: '',
    recipients: [],
    type: 'text',
    text: '',
    caption: '',
    footer: '',
    taskId: '',
    file: null as File | null,
    days: [1, 2, 3, 4, 5, 6], // Mon-Sat by default
    times: [''], // Start with one time slot
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    urlButtons: [],
  });

  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const addTimeSlot = () => {
    if (formData.times.length < 10) { // Limit to 10 for safety
      setFormData({ ...formData, times: [...formData.times, ''] });
    }
  };

  const removeTimeSlot = (index: number) => {
    if (formData.times.length > 1) {
      const newTimes = formData.times.filter((_, i) => i !== index);
      setFormData({ ...formData, times: newTimes });
    }
  };

  const convertTo24Hour = (time12h: string) => {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') {
      hours = '00';
    }
    if (modifier === 'PM') {
      hours = (parseInt(hours, 10) + 12).toString();
    }
    return `${hours.padStart(2, '0')}:${minutes}`;
  };

  const convertTo12Hour = (time24h: string) => {
    if (!time24h) return '';
    const [hours, minutes] = time24h.split(':');
    const h = parseInt(hours);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = ((h + 11) % 12 + 1);
    return `${String(h12).padStart(2, '0')}:${minutes} ${suffix}`;
  };

  const updateTimeSlot = (index: number, value: string) => {
    const newTimes = [...formData.times];
    newTimes[index] = value;
    setFormData({ ...formData, times: newTimes });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCampaigns();
      fetchGroups();
    }, 500);

    // Supabase Realtime Subscription
    const channel = supabase
      .channel('campaigns-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns' },
        (payload) => {
          console.log('[Supabase Realtime] Change received:', payload);
          fetchCampaigns(); // Refresh list on any change
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch(apiUrl('/api/campaigns'));
      if (res.status === 429) {
        setStatus({ type: 'error', message: 'Límite de peticiones excedido. Esperando...' });
        return;
      }
      const data = await res.json();
      setCampaigns(data);
    } catch (error) {
      console.error('Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch(apiUrl('/api/groups'));
      if (!res.ok) {
        console.warn('Failed to fetch groups:', res.status);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setGroups(data);
      }
    } catch (error) {
      console.error('Failed to fetch groups');
    }
  };

  const [groupSearch, setGroupSearch] = useState('');

  const filteredGroups = groups.filter(g =>
    g.subject?.toLowerCase().includes(groupSearch.toLowerCase())
  );

  const toggleAllGroups = () => {
    if (formData.recipients.length === groups.length) {
      setFormData({ ...formData, recipients: [] });
    } else {
      setFormData({ ...formData, recipients: groups.map(g => g.id) });
    }
  };

  const toggleGroup = (id: string) => {
    const newRecipients = formData.recipients.includes(id)
      ? formData.recipients.filter(r => r !== id)
      : [...formData.recipients, id];
    setFormData({ ...formData, recipients: newRecipients });
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const data = new FormData();
    data.append('name', formData.name);
    data.append('recipients', JSON.stringify(formData.recipients));
    data.append('type', formData.type);
    data.append('days', JSON.stringify(formData.days));
    data.append('times', JSON.stringify(formData.times.filter(t => t)));
    data.append('start_date', formData.start_date);
    data.append('end_date', formData.end_date);

    if (formData.type === 'text') {
      data.append('text', formData.text || ' ');
    } else {
      if (formData.file) {
        data.append('file', formData.file);
      }
      data.append('caption', formData.caption || '');
    }

    // Send URL buttons if any
    const validUrlButtons = formData.urlButtons.filter(b => b.text && b.url);
    if (validUrlButtons.length > 0) {
      data.append('urlButtons', JSON.stringify(validUrlButtons));
    }

    try {
      const url = editingId ? `/api/campaigns/${editingId}` : '/api/campaigns';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method: method,
        body: data,
      });

      if (res.ok) {
        setStatus({ type: 'success', message: editingId ? 'Campaña actualizada' : 'Campaña creada correctamente' });
        setShowModal(false);
        setEditingId(null);
        fetchCampaigns();
        resetForm();
      } else if (res.status === 429) {
        setStatus({ type: 'error', message: 'Demasiadas solicitudes. Por favor, espera un momento antes de intentar de nuevo.' });
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save campaign');
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Error al procesar la campaña' });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const editCampaign = (campaign: Campaign) => {
    setEditingId(campaign.id);

    // Recover url buttons from content
    let urlButtons: UrlButton[] = [];
    if (campaign.content.urlButtons && Array.isArray(campaign.content.urlButtons)) {
      urlButtons = campaign.content.urlButtons;
    }

    setFormData({
      name: campaign.name,
      recipients: campaign.recipients,
      type: campaign.type as any,
      text: campaign.content.text || '',
      caption: campaign.content.caption || '',
      footer: campaign.content.footer || '',
      taskId: campaign.taskId,
      file: null,
      days: campaign.days,
      times: campaign.times,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      urlButtons,
    });
    setShowModal(true);
  };

  // URL Buttons helpers
  const addUrlButton = () => {
    if (formData.urlButtons.length < 3) {
      setFormData({ ...formData, urlButtons: [...formData.urlButtons, { text: '', url: '' }] });
    }
  };

  const removeUrlButton = (index: number) => {
    setFormData({ ...formData, urlButtons: formData.urlButtons.filter((_, i) => i !== index) });
  };

  const updateUrlButton = (index: number, field: 'text' | 'url', value: string) => {
    const updated = [...formData.urlButtons];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, urlButtons: updated });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      recipients: [],
      type: 'text',
      text: '',
      caption: '',
      footer: '',
      taskId: '',
      file: null,
      days: [1, 2, 3, 4, 5, 6],
      times: [''],
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      urlButtons: [],
    });
  };

  const toggleStatus = async (id: string) => {
    try {
      await fetch(`/api/campaigns/${id}/toggle`, { method: 'POST' });
      fetchCampaigns();
    } catch (error) {
      console.error('Failed to toggle status');
    }
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta campaña?')) return;
    try {
      await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      fetchCampaigns();
    } catch (error) {
      console.error('Failed to delete campaign');
    }
  };

  const triggerManual = async (id: string) => {
    try {
      await fetch(`/api/campaigns/${id}/trigger`, { method: 'POST' });
      setStatus({ type: 'success', message: 'Envío manual iniciado' });
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      console.error('Failed to trigger manual send');
    }
  };

  const filteredCampaigns = campaigns.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold heading-gradient flex items-center">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 border border-indigo-500/20 flex items-center justify-center mr-2.5">
              <Megaphone className="w-4 h-4 text-indigo-400" />
            </div>
            Campañas de Difusión
          </h2>
          <p className="text-slate-500 text-xs mt-0.5 ml-[42px]">Gestiona tus campañas publicitarias programadas.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl text-xs font-bold hover:from-indigo-500 hover:to-indigo-400 transition-all shadow-lg shadow-indigo-900/20 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Campaña
        </button>
      </div>

      {status && (
        <div className={`p-4 rounded-2xl flex items-start border backdrop-blur-md ${status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/5' : 'bg-red-500/10 border-red-500/20 text-red-400 shadow-lg shadow-red-500/5'}`}>
          {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 mr-3 mt-0.5" /> : <AlertCircle className="w-5 h-5 mr-3 mt-0.5" />}
          <div>
            <p className="text-sm font-bold">{status.message}</p>
          </div>
          <button onClick={() => setStatus(null)} className="ml-auto hover:bg-slate-800/50 p-1 rounded-lg transition-all">
            <X className="w-4 h-4 opacity-50 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="glass-panel rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar campañas por nombre..."
            className="w-full bg-[var(--bg-base)] border border-slate-700/50 text-white rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-600"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Campaigns List */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500">Cargando campañas...</p>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="glass-panel rounded-3xl py-20 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/10 to-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-700/50">
              <Megaphone className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-xl font-extrabold text-white">No hay campañas activas</h3>
            <p className="text-slate-500 mt-2">Crea tu primera campaña publicitaria para empezar.</p>
          </div>
        ) : (
          filteredCampaigns.map(campaign => (
            <div key={campaign.id} className="glass-panel rounded-3xl overflow-hidden hover:border-slate-600/50 transition-all group">
              <div className="p-6 flex flex-col lg:flex-row lg:items-center gap-6">
                {/* Campaign Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-extrabold text-white truncate">{campaign.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${campaign.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                      {campaign.status === 'active' ? 'Activa' : 'Pausada'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-1.5 text-indigo-400/60" />
                      {campaign.recipients.length} Grupos
                    </div>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1.5 text-indigo-400/60" />
                      {campaign.days.length} días/semana
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1.5 text-indigo-400/60" />
                      {campaign.times.map(t => convertTo12Hour(t)).join(', ')}
                    </div>
                  </div>
                  {campaign.task_id && (
                    <div className="mt-2">
                      <code className="text-[10px] font-mono text-purple-400/80 bg-purple-500/10 px-2.5 py-0.5 rounded-lg border border-purple-500/20">
                        {campaign.task_id}
                      </code>
                    </div>
                  )}
                </div>

                {/* Schedule Preview */}
                <div className="flex items-center gap-2 bg-[var(--bg-base)]/40 p-3 rounded-xl border border-slate-700/30">
                  {DAYS_OF_WEEK.map(day => (
                    <div
                      key={day.value}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold border ${campaign.days.includes(day.value)
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-900/20'
                        : 'bg-[var(--bg-base)] border-slate-700/50 text-slate-600'
                        }`}
                    >
                      {day.label}
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 border-t lg:border-t-0 lg:border-l border-slate-700/50 pt-4 lg:pt-0 lg:pl-6">
                  <button
                    onClick={() => triggerManual(campaign.id)}
                    className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"
                    title="Enviar ahora (Prueba)"
                  >
                    <Play className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => editCampaign(campaign)}
                    className="p-2.5 glass-button text-slate-300 rounded-xl hover:text-white transition-all"
                    title="Editar"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => toggleStatus(campaign.id)}
                    className={`p-2.5 rounded-xl transition-all ${campaign.status === 'active'
                      ? 'bg-amber-600/10 text-amber-400 hover:bg-amber-600 hover:text-white'
                      : 'bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-white'
                      }`}
                    title={campaign.status === 'active' ? 'Pausar' : 'Reanudar'}
                  >
                    {campaign.status === 'active' ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => deleteCampaign(campaign.id)}
                    className="p-2.5 bg-red-600/10 text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition-all"
                    title="Eliminar"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-base)]/80 backdrop-blur-md">
          <div className="glass-panel rounded-3xl w-full max-w-6xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 border border-indigo-500/20 flex items-center justify-center">
                  <Megaphone className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">{editingId ? 'Editar Campaña' : 'Nueva Campaña'}</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Configuración completa</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingId(null);
                  resetForm();
                }}
                className="p-2 hover:bg-slate-800/50 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-0">

                {/* ═══ LEFT COLUMN: Destinatarios + Programación ═══ */}
                <div className="lg:col-span-4 lg:border-r border-slate-700/30 p-5 space-y-5 bg-[var(--bg-base)]/20">

                  {/* Campaign Name */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nombre de la Campaña</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Publicidad Juan Perez"
                      className="w-full bg-[var(--bg-base)] border border-slate-700/50 text-white rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-600"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  {/* Groups selector */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                        <Users className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                        Grupos ({formData.recipients.length})
                      </label>
                      <button
                        type="button"
                        onClick={toggleAllGroups}
                        className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {formData.recipients.length === groups.length ? 'Ninguno' : 'Todos'}
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Filtrar..."
                        className="w-full bg-[var(--bg-base)] border border-slate-700/50 text-white text-xs rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-indigo-500/50 transition-all"
                        value={groupSearch}
                        onChange={e => setGroupSearch(e.target.value)}
                      />
                    </div>

                    <div className="bg-[var(--bg-base)]/60 border border-slate-700/50 rounded-xl overflow-hidden">
                      <div className="max-h-[150px] overflow-y-auto divide-y divide-slate-800/50 custom-scrollbar">
                        {filteredGroups.length === 0 ? (
                          <div className="p-3 text-center text-slate-500 text-[10px] italic">Sin grupos disponibles</div>
                        ) : (
                          filteredGroups.map(g => (
                            <label
                              key={g.id}
                              className="flex items-center px-3 py-2 hover:bg-slate-800/80 transition-colors cursor-pointer group"
                            >
                              <input
                                type="checkbox"
                                className="w-3.5 h-3.5 rounded border-slate-700/50 bg-[var(--bg-base)] text-indigo-600 focus:ring-indigo-500/50 mr-2.5"
                                checked={formData.recipients.includes(g.id)}
                                onChange={() => toggleGroup(g.id)}
                              />
                              <p className="text-xs font-medium text-slate-300 truncate group-hover:text-white transition-colors">{g.subject}</p>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Separator */}
                  <div className="border-t border-slate-700/50" />

                  {/* Days */}
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                      Días de Envío
                    </label>
                    <div className="flex gap-1.5">
                      {DAYS_OF_WEEK.map(day => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => {
                            const newDays = formData.days.includes(day.value)
                              ? formData.days.filter(d => d !== day.value)
                              : [...formData.days, day.value];
                            setFormData({ ...formData, days: newDays });
                          }}
                          className={`flex-1 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all border ${formData.days.includes(day.value)
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/30'
                            : 'bg-[var(--bg-base)] border-slate-700/50 text-slate-500 hover:border-slate-600'
                            }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time slots */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                        Horarios
                      </label>
                      <button
                        type="button"
                        onClick={addTimeSlot}
                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        Añadir
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {formData.times.map((time, idx) => (
                        <div key={idx} className="relative group">
                          <TimePicker
                            required
                            value={time}
                            onChange={val => updateTimeSlot(idx, val)}
                            className="w-full justify-center"
                          />
                          {formData.times.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTimeSlot(idx)}
                              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Date range */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Desde</label>
                      <input
                        type="date"
                        required
                        className="w-full bg-[var(--bg-base)] border border-slate-700/50 text-white rounded-lg px-2.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500/50 transition-all"
                        value={formData.start_date}
                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Hasta</label>
                      <input
                        type="date"
                        required
                        className="w-full bg-[var(--bg-base)] border border-slate-700/50 text-white rounded-lg px-2.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500/50 transition-all"
                        value={formData.end_date}
                        onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* ═══ CENTER COLUMN: Contenido del Mensaje ═══ */}
                <div className="lg:col-span-4 p-5 space-y-4 lg:border-r border-slate-700/30">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                    <FileText className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                    Contenido del Mensaje
                  </label>

                  {/* Type tabs */}
                  <div className="flex gap-1 p-0.5 bg-[var(--bg-base)]/50 rounded-xl border border-slate-700/30">
                    {[
                      { id: 'text', label: 'Texto', icon: FileText },
                      { id: 'image', label: 'Img', icon: ImageIcon },
                      { id: 'video', label: 'Vid', icon: Video },
                      { id: 'audio', label: 'Audio', icon: Music },
                      { id: 'document', label: 'Doc', icon: File },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, type: tab.id })}
                        className={`flex-1 flex items-center justify-center px-1.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${formData.type === tab.id ? 'bg-gradient-to-r from-indigo-600/80 to-indigo-500/80 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-500 hover:text-white hover:bg-slate-800/30'}`}
                      >
                        <tab.icon className="w-3 h-3 mr-1" />
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {formData.type === 'text' ? (
                    <textarea
                      required
                      placeholder={'Escribe el texto publicitario aquí...\n\nUsa *negrita*, _cursiva_, ~tachado~ y emojis 🎉'}
                      className="w-full bg-[var(--bg-base)] border border-slate-700/50 text-white rounded-xl p-4 focus:ring-2 focus:ring-indigo-500/50 min-h-[280px] text-sm font-sans leading-relaxed resize-none placeholder:text-slate-600 transition-all"
                      value={formData.text}
                      onChange={e => setFormData({ ...formData, text: e.target.value })}
                    />
                  ) : (
                    <div className="space-y-3">
                      <div className="border-2 border-dashed border-slate-700/50 rounded-xl p-6 text-center hover:border-indigo-500/40 transition-colors cursor-pointer relative group">
                        <input
                          type="file"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          onChange={e => setFormData({ ...formData, file: e.target.files?.[0] || null })}
                          accept={
                            formData.type === 'image' ? 'image/*' :
                              formData.type === 'video' ? 'video/*' :
                                formData.type === 'audio' ? 'audio/*' : '*/*'
                          }
                        />
                        {formData.file ? (
                          <div className="space-y-2">
                            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center mx-auto ring-2 ring-indigo-500/10">
                              <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                            </div>
                            <p className="text-xs text-white font-bold truncate">{formData.file.name}</p>
                            <p className="text-[10px] text-slate-500">{(formData.file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        ) : (
                          <div className="group-hover:scale-105 transition-transform pointer-events-none">
                            {formData.type === 'image' && <ImageIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />}
                            {formData.type === 'video' && <Video className="w-8 h-8 text-slate-600 mx-auto mb-2" />}
                            {formData.type === 'audio' && <Music className="w-8 h-8 text-slate-600 mx-auto mb-2" />}
                            {formData.type === 'document' && <File className="w-8 h-8 text-slate-600 mx-auto mb-2" />}
                            <p className="text-xs text-slate-400">Click para subir {formData.type}</p>
                          </div>
                        )}
                      </div>
                      {formData.type !== 'audio' && (
                        <textarea
                          placeholder="Leyenda del archivo..."
                          className="w-full bg-[var(--bg-base)] border border-slate-700/50 text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/50 min-h-[120px] resize-none placeholder:text-slate-600 transition-all"
                          value={formData.caption}
                          onChange={e => setFormData({ ...formData, caption: e.target.value })}
                        />
                      )}
                    </div>
                  )}

                  {/* ═══ URL BUTTONS (Hyperlink) ═══ */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                        <Link2 className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
                        Botones con Enlace
                      </label>
                      {formData.urlButtons.length < 3 && (
                        <button
                          type="button"
                          onClick={addUrlButton}
                          className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          Añadir Botón
                        </button>
                      )}
                    </div>

                    {formData.urlButtons.length === 0 ? (
                      <button
                        type="button"
                        onClick={addUrlButton}
                        className="w-full border-2 border-dashed border-slate-700 rounded-xl p-4 text-center hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all group cursor-pointer"
                      >
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Link2 className="w-4 h-4 text-cyan-400" />
                          </div>
                          <p className="text-[11px] text-slate-500 group-hover:text-cyan-400 transition-colors font-medium">Agregar botón con hipervínculo</p>
                          <p className="text-[9px] text-slate-600">Máximo 3 botones</p>
                        </div>
                      </button>
                    ) : (
                      <div className="space-y-2">
                        {formData.urlButtons.map((btn, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-900/80 border border-slate-700 rounded-xl p-3 space-y-2 relative group hover:border-cyan-500/30 transition-all"
                          >
                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={() => removeUrlButton(idx)}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                              <X className="w-3 h-3" />
                            </button>

                            {/* Button number indicator */}
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-5 h-5 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                                <span className="text-[9px] font-bold text-cyan-400">{idx + 1}</span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Botón {idx + 1}</span>
                            </div>

                            {/* Button text */}
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Nombre del botón (ej: Visitar Tienda)"
                                maxLength={25}
                                className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg pl-3 pr-3 py-2 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all placeholder:text-slate-600"
                                value={btn.text}
                                onChange={e => updateUrlButton(idx, 'text', e.target.value)}
                              />
                            </div>

                            {/* URL input */}
                            <div className="relative">
                              <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                              <input
                                type="url"
                                placeholder="https://ejemplo.com"
                                className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all placeholder:text-slate-600 font-mono"
                                value={btn.url}
                                onChange={e => updateUrlButton(idx, 'url', e.target.value)}
                              />
                            </div>
                          </div>
                        ))}

                        {formData.urlButtons.length < 3 && (
                          <button
                            type="button"
                            onClick={addUrlButton}
                            className="w-full border border-dashed border-slate-700 rounded-lg py-2 text-center text-[10px] text-slate-500 hover:text-cyan-400 hover:border-cyan-500/30 transition-all"
                          >
                            <Plus className="w-3 h-3 inline mr-1" />
                            Añadir otro botón ({formData.urlButtons.length}/3)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ═══ RIGHT COLUMN: Preview + Summary + Submit ═══ */}
                <div className="lg:col-span-4 p-5 flex flex-col bg-[var(--bg-base)]/20">
                  <div className="flex-1 space-y-4">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                      <Eye className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                      Vista Previa
                    </label>
                    <div className="bg-[#0b141a] rounded-2xl p-4 border border-slate-700/30 flex items-center justify-center min-h-[260px]">
                      <WhatsAppPreview
                        text={formData.text}
                        caption={formData.caption}
                        type={formData.type}
                        file={formData.file}
                        footer={formData.footer}
                        urlButtons={formData.urlButtons}
                      />
                    </div>

                    {/* Summary stats */}
                    <div className="bg-[var(--bg-base)]/40 rounded-xl border border-slate-700/30 p-3 space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resumen</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-3 h-3 text-indigo-400" />
                          <span className="text-xs text-slate-300">{formData.recipients.length} grupos</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-indigo-400" />
                          <span className="text-xs text-slate-300">{formData.days.length} días/sem</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-indigo-400" />
                          <span className="text-xs text-slate-300">{formData.times.filter(t => t).length} horarios</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ChevronRight className="w-3 h-3 text-indigo-400" />
                          <span className="text-xs text-slate-300 capitalize">{formData.type}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-4 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold rounded-2xl hover:from-indigo-500 hover:to-indigo-400 transition-all shadow-xl shadow-indigo-900/30 flex items-center justify-center group hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {loading ? (
                      <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>{editingId ? 'Guardando...' : 'Creando...'}</>
                    ) : (
                      <>
                        <Megaphone className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                        {editingId ? 'Guardar Cambios' : 'Activar Campaña'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
