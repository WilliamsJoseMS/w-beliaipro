import React, { useEffect, useState } from 'react';
import { ShieldAlert, Key, Clipboard, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface LicenseStatus {
    isValid: boolean;
    message?: string;
    expirationDate?: string;
    clientName?: string;
}

export default function LicenseGuard({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<LicenseStatus | null>(null);
    const [machineId, setMachineId] = useState<string>('');
    const [licenseKey, setLicenseKey] = useState('');
    const [loading, setLoading] = useState(true);
    const [activating, setActivating] = useState(false);

    const fetchStatus = async () => {
        try {
            const clientState = status?.isValid ? 'EN LINEA' : 'BLOQUEADO';
            const res = await fetch(`/api/license/status?state=${clientState}`);
            const data = await res.json();
            setStatus(data);

            const machineRes = await fetch('/api/license/machine-id');
            const machineData = await machineRes.json();
            setMachineId(machineData.machineId);
        } catch (error) {
            console.error('Error fetching license status:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        // Background check every 1 minute
        const interval = setInterval(fetchStatus, 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!licenseKey.trim()) return;

        setActivating(true);
        try {
            const res = await fetch('/api/license/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey: licenseKey.trim() })
            });

            const data = await res.json();
            if (res.ok) {
                toast.success('¡Licencia activada con éxito!');
                setStatus(data);
            } else {
                toast.error(data.message || 'Error al activar la licencia.');
            }
        } catch (error) {
            toast.error('Error de conexión.');
        } finally {
            setActivating(false);
        }
    };

    const copyMachineId = () => {
        navigator.clipboard.writeText(machineId);
        toast.success('ID de equipo copiado al portapapeles');
    };

    if (loading) {
        return (
            <div className="h-screen w-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (status?.isValid) {
        return <>{children}</>;
    }

    return (
        <div className="fixed inset-0 z-100 bg-slate-950 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-blue-900/10 via-slate-950 to-slate-950"></div>

            <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-8">
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
                            <ShieldAlert className="w-8 h-8 text-red-500" />
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-center text-white mb-2">Activación Requerida</h2>
                    <p className="text-slate-400 text-center text-sm mb-8">
                        {status?.message || 'Tu suscripción ha expirado o el equipo no está autorizado.'}
                    </p>

                    <div className="space-y-6">
                        {/* Machine ID Display */}
                        <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                ID Único de Equipo
                            </label>
                            <div className="flex items-center space-x-2">
                                <code className="flex-1 text-xs text-blue-400 font-mono truncate bg-slate-900 p-2 rounded border border-slate-800">
                                    {machineId}
                                </code>
                                <button
                                    onClick={copyMachineId}
                                    className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors border border-slate-700"
                                >
                                    <Clipboard className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2">
                                Proporciona este ID al administrador para generar tu licencia.
                            </p>
                        </div>

                        {/* License Key Input */}
                        <form onSubmit={handleActivate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                                    Clave de Licencia
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Key className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <input
                                        type="text"
                                        value={licenseKey}
                                        onChange={(e) => setLicenseKey(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all sm:text-sm"
                                        placeholder="ABCD-1234-EFGH-5678"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={activating || !licenseKey.trim()}
                                className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20"
                            >
                                {activating ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                        Activar Software
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="px-8 py-4 bg-slate-950/50 border-t border-slate-800">
                    <p className="text-center text-xs text-slate-500">
                        ¿Necesitas ayuda? Contacta con el equipo de soporte.
                    </p>
                </div>
            </div>
        </div>
    );
}
