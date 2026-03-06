import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Send, Users, Settings, LogOut, ShieldCheck, Bell, Megaphone, Share2, List, Smartphone, Wifi, Loader2 } from 'lucide-react';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';

const socket = io('http://localhost:3000');

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [licenseInfo, setLicenseInfo] = React.useState<any>(null);
  const [status, setStatus] = React.useState<any>({ connected: true, qr: null, user: null, loading: true }); // Assume connected initially to hide modal before fetch
  const [qrUrl, setQrUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch('/api/license/status')
      .then(res => res.json())
      .then(data => setLicenseInfo(data))
      .catch(console.error);

    socket.on('status', (data) => {
      setStatus(data);
      if (data.qr) {
        QRCode.toDataURL(data.qr).then(setQrUrl);
      } else {
        setQrUrl(null);
      }
    });

    socket.on('qr', (qr) => {
      QRCode.toDataURL(qr).then(setQrUrl);
    });

    socket.on('ready', (user) => {
      setStatus((prev: any) => ({ ...prev, connected: true, user, qr: null, loading: false }));
      setQrUrl(null);
    });

    socket.on('disconnected', () => {
      setStatus({ connected: false, qr: null, user: null, loading: false });
      setQrUrl(null);
    });

    fetch('http://localhost:3000/api/status')
      .then(res => res.json())
      .then(data => {
        setStatus({ ...data, loading: false });
        if (data.qr) QRCode.toDataURL(data.qr).then(setQrUrl);
      })
      .catch(() => setStatus(prev => ({ ...prev, connected: false, loading: false })));

    return () => {
      socket.off('status');
      socket.off('qr');
      socket.off('ready');
      socket.off('disconnected');
    };
  }, []);

  const handleConnect = () => {
    setStatus(prev => ({ ...prev, loading: true }));
    fetch('http://localhost:3000/api/connect', { method: 'POST' })
      .catch(() => setStatus(prev => ({ ...prev, loading: false })));
  };

  const handleWhatsAppLogout = () => {
    if (!confirm('¿Estás seguro de que deseas cerrar la sesión de WhatsApp?')) return;
    setStatus((prev: any) => ({ ...prev, loading: true }));
    fetch('http://localhost:3000/api/disconnect', { method: 'POST' })
      .catch(() => setStatus((prev: any) => ({ ...prev, loading: false })));
  };

  const navItems = [
    { path: '/', label: 'Inicio', icon: LayoutDashboard },
    { path: '/campaigns', label: 'Campañas', icon: Megaphone },
    { path: '/send', label: 'Envío Directo', icon: Send },
    { path: '/status', label: 'Estados', icon: Share2 },
    { path: '/groups', label: 'Contactos', icon: Users },
    { path: '/queueactivity', label: 'Actividad de la Cola', icon: List },
    { path: '/settings', label: 'Configuración', icon: Settings },
  ];

  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <div className="flex h-screen bg-slate-900 text-slate-50 overflow-hidden">
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-slate-800 rounded-lg text-white shadow-lg"
        >
          <LayoutDashboard className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-56 bg-slate-950 border-r border-slate-800 flex flex-col transition-transform duration-300 transform 
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:relative lg:translate-x-0
      `}>
        <div className="p-4 flex items-center space-x-3 border-b border-slate-700/50 bg-slate-900/40 backdrop-blur-md">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center p-0.5 shadow-[0_0_10px_rgba(79,70,229,0.3)] bg-gradient-to-br from-indigo-500 to-purple-600 overflow-hidden border border-indigo-400/30">
            <img src="/logo.png" alt="W-Beli.Ai Logo" className="w-full h-full object-cover rounded-lg bg-slate-950" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-white">W-Beli.Ai Pro</h1>
            <p className="text-[8px] text-indigo-400 font-bold tracking-widest uppercase">Portal Empresarial</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center px-3 py-2.5 rounded-xl transition-all duration-300 group ${isActive
                  ? 'bg-indigo-500/10 border border-indigo-500/20 text-white shadow-lg shadow-indigo-900/20'
                  : 'text-slate-400 border border-transparent hover:bg-slate-800/50 hover:border-slate-700/50 hover:text-white'
                  }`}
              >
                <div className={`p-1.5 rounded-lg mr-2.5 transition-colors duration-300 ${isActive ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800/50 text-slate-500 group-hover:bg-slate-700 group-hover:text-slate-300'}`}>
                  <item.icon className="w-4 h-4" />
                </div>
                <span className="font-semibold text-[13px]">{item.label}</span>
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-700/50 bg-slate-900/40 backdrop-blur-xl flex flex-col space-y-2">
          {status.connected && status.user && (
            <div className="glass-panel p-2.5 rounded-xl relative group overflow-hidden border-emerald-500/20 shadow-none">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="flex items-center space-x-2.5 relative z-10 w-full">
                <div className="relative shrink-0">
                  {status.user.ppUrl ? (
                    <img src={status.user.ppUrl} alt="Profile" className="w-9 h-9 rounded-xl object-cover ring-2 ring-emerald-500/30 shadow-md" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center ring-2 ring-emerald-500/30 shadow-md">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                    </div>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950 shadow-[0_0_6px_rgba(16,185,129,0.8)]"></div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-xs font-bold text-white truncate leading-tight">
                    {status.user.name || status.user.notify || 'WhatsApp Bot'}
                  </p>
                  <p className="text-[9px] text-slate-400 font-mono truncate mt-0.5">+{status.user.id ? status.user.id.split(':')[0].split('@')[0] : '---'}</p>
                </div>
              </div>
            </div>
          )}
          <button
            onClick={status.connected ? handleWhatsAppLogout : undefined}
            className="flex items-center justify-center w-full px-3 py-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
            disabled={!status.connected || status.loading}
          >
            <LogOut className="w-3.5 h-3.5 mr-2 group-hover:-translate-x-1 transition-transform" />
            <span className="font-semibold text-xs tracking-wide uppercase">Apagar Motor</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-slate-900 border-b border-slate-800 h-12 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
          <h2 className="text-sm font-semibold text-white tracking-tight ml-12 lg:ml-0">
            {navItems.find((i) => i.path === location.pathname)?.label || 'Panel'}
          </h2>
          <div className="flex items-center space-x-6">
            <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-900"></span>
            </button>
            <div className="flex items-center space-x-3 pl-6 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white">{licenseInfo?.clientName || 'Admin'}</p>
                <p className="text-[10px] text-blue-500 font-bold uppercase tracking-tighter">
                  {licenseInfo?.expirationDate ? `Vence: ${new Date(licenseInfo.expirationDate).toLocaleDateString()}` : 'Licencia Pro'}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-linear-to-tr from-blue-500 to-purple-500 border-2 border-slate-800 shadow-sm flex items-center justify-center text-xs font-bold text-white uppercase">
                {(licenseInfo?.clientName || 'A').charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <main className="flex-1 overflow-y-auto bg-slate-900 p-3 lg:p-5">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Modal QR Code */}
      {!status.connected && !status.loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-700/50 p-8 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center max-w-sm w-full relative">
            {qrUrl ? (
              <>
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <h3 className="text-xl font-black text-white mb-6 relative z-10">Escanea el código QR</h3>
                <div className="p-4 bg-white rounded-xl shadow-xl mb-6 relative group z-10">
                  <img src={qrUrl} alt="Código QR" className="w-56 h-56" />
                </div>
                <p className="text-sm text-center text-slate-400 mb-6 relative z-10 leading-relaxed tracking-wide">
                  Abre WhatsApp en tu teléfono, toca Configuración de dispositivos vinculados y escanea.
                </p>
                <button
                  onClick={() => {
                    setStatus(prev => ({ ...prev, loading: true }));
                    fetch('http://localhost:3000/api/reset', { method: 'POST' }).finally(() => setStatus(prev => ({ ...prev, loading: false })));
                  }}
                  className="w-full py-3.5 bg-slate-800/80 text-slate-300 font-bold rounded-xl hover:bg-slate-700 transition relative z-10 border border-slate-700"
                >
                  Actualizar QR / Reiniciar
                </button>
              </>
            ) : (
              <>
                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <div className="w-24 h-24 mb-6 rounded-2xl border border-slate-700 bg-slate-800/50 flex items-center justify-center relative z-10 shadow-inner">
                  <Smartphone className="w-10 h-10 text-slate-400 mb-1" />
                </div>
                <h3 className="text-xl font-black text-white mb-2 text-center relative z-10">Bot Desconectado</h3>
                <p className="text-sm text-center text-slate-400 mb-8 relative z-10 leading-relaxed tracking-wide">
                  Genera un nuevo código QR para volver a vincular tu cuenta de WhatsApp.
                </p>
                <button
                  onClick={handleConnect}
                  className="w-full py-3.5 bg-blue-600 text-white font-bold text-sm tracking-wide uppercase rounded-xl hover:bg-blue-500 transition shadow-lg shadow-blue-900/30 relative z-10"
                >
                  Generar QR de Acceso
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
