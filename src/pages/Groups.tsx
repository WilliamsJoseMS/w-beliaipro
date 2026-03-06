import React, { useEffect, useState, useMemo } from 'react';
import { Users, Copy, Search, Filter, RefreshCw, UserCheck, MessageSquare, Phone, LogOut } from 'lucide-react';

const avatarCache = new Map<string, string>();

const Avatar = React.memo(({ jid, fallback }: { jid: string, fallback: React.ReactNode }) => {
  const [url, setUrl] = useState<string | null>(avatarCache.get(jid) || null);
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (avatarCache.has(jid)) {
      setIsVisible(true); // Ya está en caché, no necesitamos observer
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '50px' }
    );
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [jid]);

  useEffect(() => {
    if (!isVisible) return;
    if (avatarCache.has(jid)) {
      setUrl(avatarCache.get(jid) || null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let isMounted = true;

    // Pequeño delay escalonado para no saturar el backend con peticiones simultáneas
    const delay = Math.random() * 500;
    const timer = setTimeout(() => {
      fetch(`/api/avatar/${jid}`)
        .then(res => res.json())
        .then(data => {
          if (!isMounted) return;
          if (data.url) {
            avatarCache.set(jid, data.url);
            setUrl(data.url);
          } else {
            avatarCache.set(jid, '');
          }
          setLoading(false);
        })
        .catch(() => {
          if (!isMounted) return;
          setLoading(false);
        });
    }, delay);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [jid, isVisible]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center">
      {loading ? (
        <div className="w-5 h-5 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
      ) : url ? (
        <img src={url} alt="Avatar" className="w-full h-full object-cover rounded-xl" />
      ) : (
        fallback
      )}
    </div>
  );
});

export default function Groups() {
  const [groups, setGroups] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'contacts' | 'groups'>('contacts');

  const fetchData = () => {
    if (loading && (groups.length > 0 || contacts.length > 0)) return;
    setLoading(true);
    const endpoint = activeTab === 'groups' ? '/api/groups' : '/api/contacts';

    fetch(endpoint)
      .then((res) => res.json())
      .then((data) => {
        const safeData = Array.isArray(data) ? data : [];
        if (activeTab === 'groups') setGroups(safeData);
        else setContacts(safeData);
      })
      .catch((err) => {
        console.error(`Error al obtener ${activeTab}`, err);
        if (activeTab === 'groups') setGroups([]);
        else setContacts([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const filteredItems = useMemo(() => {
    const safeGroups = Array.isArray(groups) ? groups : [];
    const safeContacts = Array.isArray(contacts) ? contacts : [];
    const items = activeTab === 'groups' ? [...safeGroups] : [...safeContacts];
    const filtered = items.filter(item => {
      const name = activeTab === 'groups' ? item.subject : (item.name || item.notify || item.id);
      return name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.id?.toLowerCase().includes(searchTerm.toLowerCase());
    });

    if (activeTab === 'groups') {
      return filtered.sort((a, b) => (a.participants?.length || 0) - (b.participants?.length || 0));
    } else {
      return filtered.sort((a, b) => {
        const nameA = (a.name || a.notify || a.id).toLowerCase();
        const nameB = (b.name || b.notify || b.id).toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }
  }, [groups, contacts, searchTerm, activeTab]);

  const totalParticipants = useMemo(() => {
    return groups.reduce((acc, curr) => acc + (curr.participants?.length || 0), 0);
  }, [groups]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleLeaveGroup = async (groupId: string, groupName: string) => {
    if (!window.confirm(`¿Estás seguro de que quieres salir y eliminar el grupo "${groupName}"?\nEsta acción no se puede deshacer y borrará el chat de tu dispositivo.`)) {
      return;
    }

    try {
      setGroups(prev => prev.filter(g => g.id !== groupId));
      const response = await fetch(`/api/groups/${groupId}/leave`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Error al salir del grupo');
      }
    } catch (error) {
      console.error(error);
      alert('Hubo un error al intentar salir del grupo.');
      fetchData(); // recargar
    }
  };

  const ItemRow = React.memo(({ item, index }: { item: any, index: number }) => (
    <div className="flex items-center px-6 py-2.5 border-b border-slate-700/30 hover:bg-slate-800/30 transition-all group">
      <div className="w-12 text-slate-600 text-[10px] font-mono font-bold">#{index + 1}</div>

      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 flex items-center justify-center mr-4 shrink-0 overflow-hidden shadow-inner">
        {activeTab === 'groups' ? (
          <Avatar
            jid={item.id}
            fallback={<Users className="w-5 h-5 text-indigo-400" />}
          />
        ) : (
          <Avatar
            jid={item.id}
            fallback={
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 text-indigo-300 font-extrabold text-sm">
                {(item.name || item.notify || '?')[0].toUpperCase()}
              </div>
            }
          />
        )}
      </div>

      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
          {activeTab === 'groups' ? (item.subject || 'Grupo Desconocido') : (item.name || item.notify || 'Sin Nombre')}
        </p>
        <p className="text-[10px] text-slate-500 truncate font-mono mt-0.5 flex items-center">
          {activeTab === 'contacts' && <Phone className="w-2.5 h-2.5 mr-1" />}
          {item.id.split('@')[0]}
        </p>
      </div>

      <div className="w-32 text-right pr-8">
        {activeTab === 'groups' ? (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {item.participants?.length || 0} Miembros
          </span>
        ) : (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Contacto
          </span>
        )}
      </div>

      <div className="w-32 flex justify-end gap-1">
        {activeTab === 'groups' && (
          <button
            onClick={() => handleLeaveGroup(item.id, item.subject || 'Grupo Desconocido')}
            className="text-slate-500 hover:text-rose-400 p-2 rounded-xl hover:bg-rose-500/10 transition-all"
            title="Salir y Eliminar Grupo"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => copyToClipboard(item.id)}
          className="text-slate-500 hover:text-indigo-400 p-2 rounded-xl hover:bg-indigo-500/10 transition-all"
          title="Copiar ID"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </div>
  ));

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col animate-in fade-in duration-500">
      {/* Header & Toggle */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex glass-panel p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('contacts')}
            className={`flex items-center px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'contacts' ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-900/30' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <UserCheck className="w-4 h-4 mr-2" />
            Contactos
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`flex items-center px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'groups' ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-900/30' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Users className="w-4 h-4 mr-2" />
            Grupos
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Sincronización</p>
            <p className="text-xs text-emerald-400 font-bold">Automática Activa</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-3 glass-button rounded-xl text-slate-400 hover:text-indigo-400 transition-all"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main List Card */}
      <div className="glass-panel rounded-3xl flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-700/50 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder={`Buscar en ${activeTab === 'groups' ? 'grupos' : 'contactos'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--bg-base)] border border-slate-700/50 text-white text-sm rounded-2xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-600"
            />
          </div>
          <div className="flex items-center space-x-3">
            {activeTab === 'groups' && (
              <div className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs font-bold text-indigo-400">
                Miembros Totales: {totalParticipants.toLocaleString()}
              </div>
            )}
            <div className="px-4 py-2 glass-button rounded-xl text-xs font-bold text-slate-400">
              Total {activeTab === 'groups' ? 'Grupos' : 'Contactos'}: {filteredItems.length}
            </div>
          </div>
        </div>

        {/* Table Header */}
        <div className="flex items-center px-6 py-4 bg-[var(--bg-base)]/30 border-b border-slate-700/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          <div className="w-12">#</div>
          <div className="w-14">Avatar</div>
          <div className="flex-1">Información</div>
          <div className="w-32 text-right pr-8">Tipo / Miembros</div>
          <div className="w-32 text-right">ID / Acciones</div>
        </div>

        {/* Standard List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 text-sm font-medium">Cargando audiencia...</p>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 p-12 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/10 to-emerald-500/10 rounded-3xl flex items-center justify-center mb-6 border border-slate-700/50">
                {activeTab === 'groups' ? <Users className="w-10 h-10 opacity-30" /> : <UserCheck className="w-10 h-10 opacity-30" />}
              </div>
              <h3 className="text-white font-extrabold text-lg mb-2">No se encontraron {activeTab === 'groups' ? 'grupos' : 'contactos'}</h3>
              <p className="text-sm max-w-xs mx-auto text-slate-500">Asegúrate de que tu WhatsApp esté conectado para sincronizar la lista automáticamente.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/20">
              {filteredItems.map((item, index) => (
                <ItemRow key={item.id || index} item={item} index={index} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
