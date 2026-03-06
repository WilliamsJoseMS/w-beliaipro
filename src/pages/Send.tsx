import React, { useState, useEffect } from 'react';
import { Send as SendIcon, ImageIcon, FileText, CheckCircle2, AlertCircle, Calendar, Clock, Search, X, UserCheck, Shield, Video, RefreshCw, Eye, Music, File, UserPlus } from 'lucide-react';
import { WhatsAppPreview } from '../components/WhatsAppPreview';
import { TimePicker } from '../components/TimePicker';

export default function Send() {
  const [jids, setJids] = useState('');
  const [type, setType] = useState<'text' | 'image' | 'video' | 'audio' | 'document'>('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Scheduling
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // Contacts
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Recurring Campaign
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>(['09:00:00']);

  const daysOfWeek = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };
  const addTime = () => setSelectedTimes([...selectedTimes, '09:00:00']);
  const removeTime = (index: number) => setSelectedTimes(selectedTimes.filter((_, i) => i !== index));
  const updateTime = (index: number, val: string) => {
    const newTimes = [...selectedTimes];
    newTimes[index] = val;
    setSelectedTimes(newTimes);
  };

  const fetchContacts = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch('http://localhost:3000/api/contacts');
      const data = await res.json();
      setContacts(data);
    } catch (error) {
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const filteredContacts = contacts.filter(c =>
    (c.name || c.notify || c.id).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleRecipient = (id: string) => {
    setSelectedRecipients(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const allIds = filteredContacts.map(item => item.id);
    setSelectedRecipients(prev => {
      const otherRecipients = prev.filter(id => !allIds.includes(id));
      return [...otherRecipients, ...allIds];
    });
  };

  const deselectAll = () => {
    const allIds = filteredContacts.map(item => item.id);
    setSelectedRecipients(prev => prev.filter(id => !allIds.includes(id)));
  };

  const clearForm = () => {
    setText('');
    setFile(null);
    setCaption('');
    setJids('');
    setSelectedRecipients([]);
    setScheduleDate('');
    setType('text');
    setSelectedDays([]);
    setSelectedTimes(['09:00:00']);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    const manualJids = jids.split(/[,\n]/).map(j => j.trim()).filter(j => j);
    const allRecipients = [...new Set([...selectedRecipients, ...manualJids])];

    if (allRecipients.length === 0) {
      setStatus({ type: 'error', message: 'Selecciona o ingresa al menos un destinatario' });
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('type', type);

    if (type === 'text') {
      formData.append('text', text || ' ');
    } else {
      if (file) formData.append('file', file);
      formData.append('caption', caption || '');
    }

    try {
      const isRecurring = selectedDays.length > 0;
      let endpoint = '/api/send';

      if (isRecurring) {
        endpoint = '/api/campaigns';
        const name = `Mensaje Directo Recurrente (${new Date().toLocaleDateString()})`;
        formData.append('name', name);
        formData.append('recipients', JSON.stringify(allRecipients));
        formData.append('days', JSON.stringify(selectedDays));
        formData.append('times', JSON.stringify(selectedTimes));
        formData.append('start_date', new Date().toISOString().split('T')[0]);
        formData.append('end_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // Default 30 days
      } else {
        formData.append('jids', JSON.stringify(allRecipients));
        if (scheduleDate && scheduleTime) {
          const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
          formData.append('scheduledAt', scheduledAt);
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({
          type: 'success',
          message: isRecurring
            ? `Envío recurrente programado para ${allRecipients.length} contactos`
            : scheduleDate
              ? `Programado para ${allRecipients.length} contactos`
              : `Enviando a ${allRecipients.length} contactos`
        });
        clearForm();
      } else {
        setStatus({ type: 'error', message: data.error || 'Error al procesar el envío' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Error de red' });
    } finally {
      setLoading(false);
    }
  };

  const requiresFile = (messageType: string): boolean => {
    return messageType !== 'text';
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-5 animate-in fade-in duration-500">

      {/* Header Sec */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold heading-gradient flex items-center">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 border border-indigo-500/20 flex items-center justify-center mr-2.5">
              <SendIcon className="w-4 h-4 text-indigo-400" />
            </div>
            Envío Directo
          </h2>
          <p className="text-slate-500 text-xs mt-0.5 ml-[42px]">Envía mensajes o contenido multimedia de forma directa a tus contactos.</p>
        </div>
      </div>

      {status && (
        <div className={`p-4 rounded-2xl flex items-start border backdrop-blur-md ${status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/5' : 'bg-red-500/10 border-red-500/20 text-red-400 shadow-lg shadow-red-500/5'}`}>
          {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 mr-3 mt-0.5 shrink-0" /> : <AlertCircle className="w-5 h-5 mr-3 mt-0.5 shrink-0" />}
          <div>
            <h4 className="font-bold">{status.type === 'success' ? 'Operación Exitosa' : 'Aviso del Sistema'}</h4>
            <p className="text-sm opacity-90 mt-1">{status.message}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* TOP ROW: DESTINATARIOS */}
        <div className="w-full glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center">
              <UserCheck className="w-4 h-4 mr-2 text-indigo-400" />
              Destinatarios
            </h3>
            <button
              type="button"
              onClick={fetchContacts}
              disabled={refreshing}
              className={`p-2 rounded-xl glass-button text-slate-400 hover:text-indigo-400 transition-all ${refreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col space-y-3">
            {/* Lista y Buscador */}
            <div className="flex flex-col space-y-3">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Buscar contactos..."
                    className="w-full bg-[var(--bg-base)] border border-slate-700/50 text-sm text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-600"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={selectAll} className="text-[10px] uppercase font-bold text-indigo-400 hover:text-indigo-300 px-5 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl transition-all hover:bg-indigo-500/20">Todos</button>
                  <button type="button" onClick={deselectAll} className="text-[10px] uppercase font-bold text-slate-400 hover:text-slate-300 px-5 py-2 glass-button rounded-xl transition-all">Ninguno</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[300px] h-full pr-2 custom-scrollbar bg-[var(--bg-base)]/40 rounded-2xl border border-slate-700/30 p-2 grid grid-cols-1 md:grid-cols-2 gap-2 content-start">
                {filteredContacts.length > 0 ? filteredContacts.map(item => (
                  <div
                    key={item.id}
                    onClick={() => toggleRecipient(item.id)}
                    className={`flex items-center p-3 rounded-xl cursor-pointer transition-all ${selectedRecipients.includes(item.id) ? 'bg-indigo-600/15 border-indigo-500/30 border shadow-sm' : 'hover:bg-slate-800/30 border-transparent border'}`}
                  >
                    <div className={`w-5 h-5 rounded-lg border mr-3 flex items-center justify-center transition-all shrink-0 ${selectedRecipients.includes(item.id) ? 'bg-indigo-500 border-indigo-500 shadow-md shadow-indigo-500/20' : 'border-slate-600 bg-slate-800/50'}`}>
                      {selectedRecipients.includes(item.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-sm font-medium text-white truncate" title={item.name || item.notify || 'Desconocido'}>{item.name || item.notify || 'Desconocido'}</p>
                      <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">{item.id.split('@')[0]}</p>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-full text-center py-10 text-slate-500 text-sm italic">Sin contactos</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: CONTENT & PREVIEW */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start w-full">

          {/* COLUMN 2: MSG CONTENT & SCHEDULING */}
          <div className="xl:col-span-7 glass-panel rounded-2xl p-4 h-[480px] overflow-y-auto custom-scrollbar">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center mb-4">
              <FileText className="w-4 h-4 mr-2 text-indigo-400" />
              Contenido
            </h3>

            <div className="flex flex-wrap bg-[var(--bg-base)]/50 p-1.5 rounded-2xl border border-slate-700/30 mb-6">
              {[
                { id: 'text', label: 'Texto', icon: FileText },
                { id: 'image', label: 'Imágen', icon: ImageIcon },
                { id: 'video', label: 'Video', icon: Video },
                { id: 'audio', label: 'Audio', icon: Music },
                { id: 'document', label: 'Doc', icon: File },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setType(tab.id as any)}
                  className={`flex-1 flex items-center justify-center py-2.5 rounded-xl text-xs font-bold transition-all ${type === tab.id
                    ? 'bg-gradient-to-r from-indigo-600/80 to-indigo-500/80 text-white shadow-lg shadow-indigo-900/20 border border-indigo-500/30'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
                    }`}
                >
                  <tab.icon className="w-3.5 h-3.5 mr-1.5 sm:mr-2" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {type === 'text' ? (
                <div className="relative h-[160px]">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full h-full bg-[var(--bg-base)] border border-slate-700/50 text-white text-sm rounded-3xl p-5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600 resize-none custom-scrollbar"
                    placeholder={"Redacta el mensaje aquí...\nPuedes usar *negrita*, _cursiva_, ~tachado~ y emojis."}
                    required={type === 'text'}
                  />
                  <div className="absolute bottom-4 right-4 text-[10px] text-slate-500 font-mono bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/50">
                    {text.length} caracteres
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex-1 bg-[var(--bg-base)]/40 border-2 border-dashed border-slate-700/50 rounded-3xl p-4 flex flex-col items-center justify-center hover:border-indigo-500/40 hover:bg-[var(--bg-base)]/60 transition-all cursor-pointer relative group shrink-0 min-h-[160px]">
                    {file ? (
                      <div className="text-center space-y-3">
                        <div className="w-16 h-16 bg-indigo-500/20 rounded-3xl flex items-center justify-center mx-auto ring-4 ring-indigo-500/10 shadow-xl">
                          {file.type.startsWith('image') ? <ImageIcon className="w-8 h-8 text-indigo-400" /> : <Video className="w-8 h-8 text-indigo-400" />}
                        </div>
                        <div>
                          <p className="text-white text-sm font-bold truncate max-w-[240px] mx-auto px-4">{file.name}</p>
                          <p className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button type="button" onClick={() => setFile(null)} className="text-xs font-bold text-red-400 hover:text-red-300 hover:underline px-4 py-2 bg-red-500/10 rounded-xl transition-colors">Remover Archivo</button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="file"
                          accept={
                            type === 'image' ? 'image/*' :
                              type === 'video' ? 'video/*' :
                                type === 'audio' ? 'audio/*' :
                                  '*/*'
                          }
                          onChange={(e) => setFile(e.target.files?.[0] || null)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          required={requiresFile(type)}
                        />
                        <div className="text-center group-hover:scale-105 transition-transform duration-300">
                          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/10 to-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-3 border border-slate-700/50">
                            <UserPlus className="w-8 h-8 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                          </div>
                          <p className="text-sm text-slate-300 font-bold">Subir {type}</p>
                          <p className="text-xs text-slate-500 mt-1">Arrastra o haz clic para buscar</p>
                        </div>
                      </>
                    )}
                  </div>
                  {type !== 'audio' && (
                    <div className="space-y-2">
                      <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Leyenda (Opcional)</label>
                      <textarea
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        className="w-full bg-[var(--bg-base)] border border-slate-700/50 text-sm text-white rounded-2xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600 resize-none h-[70px] custom-scrollbar"
                        placeholder="Agrega una descripción..."
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-700/50 mt-4 pt-4 mb-1">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center mb-3">
                <Calendar className="w-4 h-4 mr-2 text-indigo-400" />
                Programar Envío (Opcional)
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <input
                    type="date"
                    className="w-full bg-[var(--bg-base)] border border-slate-700/50 text-white text-sm rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                    value={scheduleDate}
                    onChange={e => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="space-y-2">
                  <TimePicker
                    className="w-full justify-center"
                    value={scheduleTime}
                    onChange={val => setScheduleTime(val)}
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-3 font-medium mb-4">Nota: Para enviar inmediatamente, deja la fecha y hora en blanco.</p>

              <div className="pt-4 border-t border-slate-700/30">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center mb-3">
                  <Clock className="w-4 h-4 mr-2 text-emerald-400" />
                  Programación Recurrente
                </h4>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Días de la semana</label>
                    <div className="flex flex-wrap gap-2">
                      {daysOfWeek.map((day, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => toggleDay(index)}
                          className={`w-9 h-9 rounded-xl text-xs font-bold transition-all border flex items-center justify-center ${selectedDays.includes(index)
                            ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400 shadow-lg shadow-emerald-500/10'
                            : 'bg-[var(--bg-base)] border-slate-700/50 text-slate-500 hover:border-slate-600 hover:bg-slate-800/50'
                            }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Horarios de envío</label>
                      <button type="button" onClick={addTime} className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl hover:bg-emerald-500/20 transition-colors font-bold">+ Añadir Hora</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedTimes.map((time, index) => (
                        <div key={index} className="relative group">
                          <TimePicker
                            value={time.substring(0, 5)} // Extract HH:mm just to be sure
                            onChange={val => updateTime(index, val + ':00')}
                            className="w-full justify-center text-xs"
                          />
                          {selectedTimes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTime(index)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* COLUMN 3: PREVIEW & ACTION */}
          <div className="xl:col-span-5 flex flex-col gap-6 h-[520px]">
            <div className="flex-1 glass-panel rounded-3xl p-6 flex flex-col">
              <h3 className="text-sm font-extrabold text-slate-300 uppercase tracking-widest flex items-center mb-6">
                <Eye className="w-4 h-4 mr-2 text-emerald-400" />
                Vista Previa
              </h3>

              <div className="flex-1 bg-[var(--bg-base)]/60 rounded-4xl border-4 border-slate-800/50 flex items-center justify-center p-4 relative overflow-hidden group">
                {/* Fake phone shine */}
                <div className="absolute inset-0 bg-linear-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none"></div>

                <div className="w-full max-w-[280px]">
                  <WhatsAppPreview
                    text={text}
                    caption={caption}
                    type={type}
                    file={file}
                  />
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-6">
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3.5 px-6 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold text-sm uppercase tracking-wider rounded-xl hover:from-indigo-500 hover:to-indigo-400 transition-all shadow-lg shadow-indigo-900/30 flex items-center justify-center group ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                    Procesando...
                  </div>
                ) : (
                  <div className="flex items-center">
                    {selectedDays.length > 0 ? 'Crear Envío Recurrente' : (scheduleDate ? 'Programar Envío' : 'Iniciar Envío')}
                    <SendIcon className="w-5 h-5 ml-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </div>
                )}
              </button>

              <div className="mt-5 flex items-center justify-between px-2 text-slate-500">
                <div className="flex items-center text-[9px] uppercase font-bold tracking-widest glass-button px-3 py-1.5 rounded-xl">
                  <Shield className="w-3 h-3 mr-1.5 text-emerald-500" />
                  Anti-Ban Activo
                </div>
                <div className="flex items-center text-[9px] uppercase font-bold tracking-widest glass-button px-3 py-1.5 rounded-xl">
                  <Clock className="w-3 h-3 mr-1.5 text-indigo-500" />
                  Intervalos dinámicos
                </div>
              </div>
            </div>
          </div>

        </div>
      </form>
    </div>
  );
}