import React, { useState, useEffect, useCallback, memo } from 'react';
import { ShieldCheck, Calendar, Power, Trash2, Plus, RefreshCw, User, Key, Monitor, Clock, Copy, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface License {
    id: string;
    key: string;
    machine_id: string | null;
    client_name: string;
    manager_name: string | null;
    expiration_date: string;
    is_active: boolean;
    last_check_in: string;
    client_state: string;
    created_at: string;
}

const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Nunca';
    return new Date(dateStr).toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
};

const isOnline = (lastCheckIn: string) => {
    if (!lastCheckIn) return false;
    const last = new Date(lastCheckIn).getTime();
    const now = Date.now();
    return (now - last) < 3 * 60 * 1000; // 3 minutes threshold
};

const getStatusLabel = (license: License) => {
    const online = isOnline(license.last_check_in);
    const expired = new Date(license.expiration_date) < new Date();

    if (!license.is_active) {
        return {
            label: online ? 'Acceso Revocado (Ping)' : 'Suspendido (Off)',
            color: 'text-red-500',
            dot: online ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse' : 'bg-red-600'
        };
    }

    if (!online) return { label: 'Desconectado', color: 'text-slate-500', dot: 'bg-slate-600' };

    if (expired) {
        return { label: 'Bloqueado (Caducado)', color: 'text-amber-400', dot: 'bg-amber-500 animate-pulse' };
    }

    return { label: 'En línea', color: 'text-emerald-400', dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse' };
};

const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
};

const LicenseCard = memo(({ license, adminKey, fetchLicenses, updateField, toggleStatus, handleDelete }: any) => (
    <div className={`glass-panel rounded-3xl p-4 shadow-lg transition-all hover:border-slate-600/50 ${!license.is_active ? 'border-red-500/20' : ''}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1 space-y-4">
                <div className="flex items-center space-x-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${license.is_active ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-400 border border-emerald-500/20' : 'bg-gradient-to-br from-red-500/20 to-red-500/5 text-red-400 border border-red-500/20'}`}>
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="flex-1 max-w-md">
                        <input
                            type="text"
                            defaultValue={license.client_name}
                            onBlur={(e) => {
                                if (e.target.value !== license.client_name) {
                                    updateField(license.id, 'client_name', e.target.value);
                                }
                            }}
                            className="bg-transparent font-extrabold text-lg text-white hover:bg-slate-800/50 rounded-lg px-2 -ml-2 w-full border-none outline-none focus:bg-slate-800/50 transition-colors"
                        />
                        <div className="flex items-center space-x-3 text-xs">
                            <div className="flex items-center space-x-1 text-slate-400">
                                <Key className="w-3 h-3" />
                                <span className="font-mono">{license.key}</span>
                                <button
                                    onClick={() => copyToClipboard(license.key)}
                                    className="ml-1 p-1 hover:bg-slate-700/50 rounded-lg transition-colors hover:text-indigo-400"
                                    title="Copiar licencia"
                                >
                                    <Copy className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="flex items-center space-x-2 text-indigo-400 font-medium">
                                <User className="w-3 h-3" />
                                <input
                                    type="text"
                                    defaultValue={license.manager_name || ''}
                                    placeholder="Nombre del operador"
                                    onBlur={(e) => {
                                        if (e.target.value !== (license.manager_name || '')) {
                                            updateField(license.id, 'manager_name', e.target.value);
                                        }
                                    }}
                                    className="bg-transparent hover:bg-slate-800/50 rounded-lg px-1 -ml-1 border-none outline-none focus:bg-slate-800/50 text-indigo-400 placeholder-indigo-400/40 transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-[var(--bg-base)]/50 rounded-full border border-slate-700/50">
                            <div className={`w-2 h-2 rounded-full ${getStatusLabel(license).dot}`}></div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${getStatusLabel(license).color}`}>
                                {getStatusLabel(license).label}
                            </span>
                        </div>
                        {!license.is_active && <span className="px-2.5 py-1 bg-red-500 text-white text-[10px] font-bold rounded-full uppercase shadow-lg shadow-red-500/20">Suspendido</span>}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-[var(--bg-base)]/50 p-2.5 rounded-xl border border-slate-700/30">
                        <div className="flex items-center space-x-2 text-slate-500 mb-1">
                            <Monitor className="w-3 h-3" />
                            <span className="text-[10px] uppercase font-bold tracking-tighter">ID Equipo</span>
                        </div>
                        <input
                            type="text"
                            defaultValue={license.machine_id || ''}
                            placeholder="Sincronizando..."
                            onBlur={(e) => {
                                if (e.target.value !== (license.machine_id || '')) {
                                    updateField(license.id, 'machine_id', e.target.value || null);
                                }
                            }}
                            className="bg-transparent text-xs font-mono text-indigo-400 truncate w-full border-none outline-none focus:bg-slate-800/50 rounded-lg px-1 -ml-1 transition-colors"
                        />
                    </div>
                    <div className="bg-[var(--bg-base)]/50 p-2.5 rounded-xl border border-slate-700/30">
                        <div className="flex items-center space-x-2 text-slate-500 mb-1">
                            <Clock className="w-3 h-3" />
                            <span className="text-[10px] uppercase font-bold tracking-tighter">Último Check-in</span>
                        </div>
                        <p className="text-xs text-white font-medium">{formatDate(license.last_check_in)}</p>
                    </div>
                    <div className="bg-[var(--bg-base)]/50 p-3 rounded-xl border border-slate-700/30 flex flex-col justify-between">
                        <div className="flex items-center space-x-2 text-slate-500 mb-1">
                            <Calendar className="w-3 h-3" />
                            <span className="text-[10px] uppercase font-bold tracking-tighter">Vencimiento</span>
                        </div>
                        <input
                            type="date"
                            defaultValue={new Date(license.expiration_date).toISOString().split('T')[0]}
                            onBlur={(e) => {
                                const newVal = e.target.value;
                                if (newVal && newVal !== new Date(license.expiration_date).toISOString().split('T')[0]) {
                                    updateField(license.id, 'expiration_date', new Date(newVal).toISOString());
                                }
                            }}
                            className="bg-transparent text-xs text-white outline-none border-none cursor-pointer hover:text-indigo-400 transition-colors"
                        />
                    </div>
                    <div className="bg-[var(--bg-base)]/50 p-2.5 rounded-xl border border-slate-700/30">
                        <div className="flex items-center space-x-2 text-slate-500 mb-1">
                            <Plus className="w-3 h-3" />
                            <span className="text-[10px] uppercase font-bold tracking-tighter">Creado el</span>
                        </div>
                        <p className="text-xs">{new Date(license.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
            </div>

            <div className="flex md:flex-col gap-2">
                <button
                    onClick={() => toggleStatus(license)}
                    className={`flex-1 md:w-32 flex items-center justify-center p-2.5 rounded-xl border transition-all ${license.is_active ? 'border-amber-500/20 text-amber-500 hover:bg-amber-500/10 hover:shadow-lg hover:shadow-amber-500/5' : 'border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 hover:shadow-lg hover:shadow-emerald-500/5'}`}
                >
                    <Power className="w-4 h-4 mr-2" />
                    <span className="text-xs font-bold">{license.is_active ? 'Suspender' : 'Activar'}</span>
                </button>
                <button
                    onClick={() => handleDelete(license.id)}
                    className="flex-1 md:w-32 flex items-center justify-center p-2.5 rounded-xl border border-red-500/20 text-red-500 hover:bg-red-500/10 hover:shadow-lg hover:shadow-red-500/5 transition-all"
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    <span className="text-xs font-bold">Eliminar</span>
                </button>
            </div>
        </div>
    </div>
));

export default function Admin() {
    const [licenses, setLicenses] = useState<License[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminKey, setAdminKey] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // New license form
    const [newLicense, setNewLicense] = useState({
        key: '',
        client_name: '',
        manager_name: '',
        machine_id: '',
        expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });

    const generateRandomKey = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O, 0, I, 1
        const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const key = `WBN-${segment()}-${segment()}-${segment()}`;
        setNewLicense(prev => ({ ...prev, key }));
    };

    useEffect(() => {
        if (!newLicense.key) generateRandomKey();
    }, []);

    const fetchLicenses = useCallback(async (key: string) => {
        try {
            const res = await fetch('/api/license/admin/list', {
                headers: { 'x-admin-key': key }
            });
            if (res.ok) {
                const data = await res.json();
                setLicenses(data);
                setIsAdmin(true);
                localStorage.setItem('admin_key', key);
            } else {
                toast.error('Acceso denegado. Clave de administrador incorrecta.');
            }
        } catch (error) {
            toast.error('Error al conectar con el servidor.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const savedKey = localStorage.getItem('admin_key');
        if (savedKey) {
            setAdminKey(savedKey);
            fetchLicenses(savedKey);
        } else {
            setLoading(false);
        }
    }, []);

    const handleLogin = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        fetchLicenses(adminKey);
    }, [adminKey, fetchLicenses]);

    const handleCreate = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/license/admin/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': adminKey
                },
                body: JSON.stringify({
                    ...newLicense,
                    machine_id: newLicense.machine_id.trim() || null,
                    expiration_date: new Date(newLicense.expiration_date).toISOString()
                })
            });

            if (res.ok) {
                toast.success('Licencia creada');
                fetchLicenses(adminKey);
                setNewLicense({
                    key: '',
                    client_name: '',
                    manager_name: '',
                    machine_id: '',
                    expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                });
                generateRandomKey();
            } else {
                toast.error('Error al crear licencia');
            }
        } catch (error) {
            toast.error('Error de red');
        }
    }, [adminKey, newLicense, fetchLicenses]);

    const toggleStatus = useCallback(async (license: License) => {
        try {
            const res = await fetch(`/api/license/admin/update/${license.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': adminKey
                },
                body: JSON.stringify({ is_active: !license.is_active })
            });
            if (res.ok) {
                toast.success('Estado actualizado');
                fetchLicenses(adminKey);
            }
        } catch (error) {
            toast.error('Error al actualizar');
        }
    }, [adminKey, fetchLicenses]);

    const handleDelete = useCallback(async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta licencia?')) return;
        try {
            const res = await fetch(`/api/license/admin/delete/${id}`, {
                method: 'DELETE',
                headers: { 'x-admin-key': adminKey }
            });
            if (res.ok) {
                toast.success('Licencia eliminada');
                fetchLicenses(adminKey);
            }
        } catch (error) {
            toast.error('Error al eliminar');
        }
    }, [adminKey, fetchLicenses]);

    const updateField = useCallback(async (id: string, field: string, value: any) => {
        try {
            const res = await fetch(`/api/license/admin/update/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': adminKey
                },
                body: JSON.stringify({ [field]: value })
            });
            if (res.ok) {
                toast.success('Campo actualizado');
                fetchLicenses(adminKey);
            }
        } catch (error) {
            toast.error('Error al actualizar');
        }
    }, [adminKey, fetchLicenses]);

    if (loading) {
        return (
            <div className="h-screen bg-[var(--bg-base)] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center animate-pulse">
                        <ShieldCheck className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-500/30 border-t-indigo-500"></div>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-4">
                <div className="w-full max-w-md glass-panel rounded-3xl p-10 shadow-2xl relative overflow-hidden">
                    {/* Decorative gradient orb */}
                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="relative z-10">
                        <div className="flex justify-center mb-8">
                            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 rounded-3xl flex items-center justify-center border border-indigo-500/30 shadow-xl shadow-indigo-500/10">
                                <ShieldCheck className="w-10 h-10 text-indigo-400" />
                            </div>
                        </div>
                        <h2 className="text-3xl font-extrabold text-center heading-gradient mb-2">Panel Maestro</h2>
                        <p className="text-sm text-slate-500 text-center mb-8">Control de Licencias y Clientes</p>
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">Clave de Acceso</label>
                                <input
                                    type="password"
                                    value={adminKey}
                                    onChange={(e) => setAdminKey(e.target.value)}
                                    className="w-full bg-[var(--bg-base)] border border-slate-700/50 rounded-2xl px-5 py-3.5 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
                                    placeholder="Ingresa tu clave maestra"
                                />
                            </div>
                            <button className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-indigo-900/30 hover:shadow-indigo-900/50 hover:scale-[1.02] active:scale-[0.98]">
                                Entrar al Panel
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-base)] text-slate-100 pb-20">
            <header className="glass-panel sticky top-0 z-10 px-8 py-5">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-xl shadow-lg shadow-indigo-900/30">
                            <ShieldCheck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-extrabold heading-gradient">Panel Maestro</h1>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Control de Licencias y Clientes</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => fetchLicenses(adminKey)}
                            className="p-2.5 glass-button rounded-xl transition-all hover:text-indigo-400"
                            title="Refrescar"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => { localStorage.removeItem('admin_key'); setIsAdmin(false); }}
                            className="text-sm text-red-400 hover:text-red-300 font-bold px-4 py-2 rounded-xl hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                        >
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-8 py-10 space-y-8">
                {/* Create New License Section */}
                <section className="glass-panel rounded-3xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-700/50 bg-gradient-to-r from-indigo-500/5 to-transparent flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                            <Plus className="w-4 h-4 text-indigo-400" />
                        </div>
                        <h2 className="font-extrabold text-white">Generar Nueva Licencia</h2>
                    </div>
                    <form onSubmit={handleCreate} className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">Clave de Licencia</label>
                                <div className="flex space-x-2">
                                    <div className="relative flex-1">
                                        <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <input
                                            type="text"
                                            required
                                            value={newLicense.key}
                                            onChange={e => setNewLicense({ ...newLicense, key: e.target.value })}
                                            className="w-full bg-[var(--bg-base)] border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                            placeholder="WBN-XXXX-XXXX"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={generateRandomKey}
                                        className="p-2.5 glass-button rounded-xl text-slate-400 hover:text-indigo-400 transition-all"
                                        title="Generar nueva clave"
                                    >
                                        <RefreshCw className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">Nombre de Empresa / Cliente</label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="text"
                                        required
                                        value={newLicense.client_name}
                                        onChange={e => setNewLicense({ ...newLicense, client_name: e.target.value })}
                                        className="w-full bg-[var(--bg-base)] border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                        placeholder="Ej: Chatbot Pro S.A."
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">Persona Encargada (Operador)</label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="text"
                                        required
                                        value={newLicense.manager_name}
                                        onChange={e => setNewLicense({ ...newLicense, manager_name: e.target.value })}
                                        className="w-full bg-[var(--bg-base)] border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                        placeholder="Nombre del operador"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">ID del Equipo (Opcional)</label>
                                <div className="relative">
                                    <Monitor className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="text"
                                        value={newLicense.machine_id}
                                        onChange={e => setNewLicense({ ...newLicense, machine_id: e.target.value })}
                                        className="w-full bg-[var(--bg-base)] border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                        placeholder="Vinculación manual"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">Fecha de Vencimiento</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="date"
                                        required
                                        value={newLicense.expiration_date}
                                        onChange={e => setNewLicense({ ...newLicense, expiration_date: e.target.value })}
                                        className="w-full bg-[var(--bg-base)] border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="flex items-end">
                                <button className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-sm font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-900/20 uppercase tracking-wide flex items-center justify-center hover:scale-[1.02] active:scale-[0.98]">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Crear Licencia
                                </button>
                            </div>
                        </div>
                    </form>
                </section>

                {/* Search and Filters */}
                <section className="glass-panel rounded-2xl p-4 flex items-center space-x-4">
                    <div className="relative flex-1">
                        <Monitor className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Buscar por cliente, empresa, clave o equipo..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[var(--bg-base)] border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                        />
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest whitespace-nowrap">
                        Mostrando {licenses.filter(l =>
                            l.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            l.manager_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            l.key?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            l.machine_id?.toLowerCase().includes(searchQuery.toLowerCase())
                        ).length} de {licenses.length}
                    </div>
                </section>

                {/* License List Section */}
                <div className="grid grid-cols-1 gap-4">
                    {licenses
                        .filter(l =>
                            l.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            l.manager_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            l.key?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            l.machine_id?.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map(license => (
                            <LicenseCard
                                key={license.id}
                                license={license}
                                adminKey={adminKey}
                                fetchLicenses={fetchLicenses}
                                updateField={updateField}
                                toggleStatus={toggleStatus}
                                handleDelete={handleDelete}
                            />
                        ))}
                    {licenses.length === 0 && (
                        <div className="text-center py-20 glass-panel rounded-3xl border-2 border-dashed border-slate-700/50">
                            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/10 to-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-700/50">
                                <ShieldCheck className="w-8 h-8 text-slate-600" />
                            </div>
                            <p className="text-slate-500 font-medium">No hay licencias generadas aún.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
