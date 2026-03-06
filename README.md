# W-Beli.Ai Pro

W-Beli.Ai Pro es una plataforma avanzada de automatización y gestión de campañas para WhatsApp. Diseñada con una interfaz premium y moderna, esta herramienta permite gestionar conexiones, programar envíos masivos, publicar estados dinámicos y evadir bloqueos gracias a sus medidas integradas de anti-spam.

## 🚀 Características Principales

- **Conexión mediante QR (Multi-Device):** Vincula tu cuenta de WhatsApp de forma rápida y segura sin depender de un teléfono encendido.
- **Gestión de Campañas:** Programa mensajes masivos para grupos y contactos directos en fechas y horas específicas.
- **Mensajes Interactivos:** Soporte para envíos ricos en multimedia, incluyendo texto, imágenes, videos, **Botones Interactivos** y Call-to-Actions (URLs).
- **Publicación de Estados (Stories):** Programa la publicación automática de estados de WhatsApp.
- **Sistema Anti-Spam Avanzado:** Configuración integrada para definir intervalos entre mensajes, límites por hora/día y pausas entre grupos para proteger tu cuenta.
- **Gestiones de Contactos y Grupos:** Sincronización automática de tus grupos y contactos de WhatsApp en un panel unificado.
- **Panel de Control (Dashboard):** Métricas e historial de la actividad de tu cola de mensajes en tiempo real.
- **Interfaz Premium:** Una experiencia de usuario ultra-moderna (Glassmorphism), rápida y fluida, con animaciones y transiciones de alta calidad.

## 🛠️ Tecnologías

**Frontend:**
- [React 19](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [TailwindCSS v4](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/) (Animaciones premium)
- [Lucide React](https://lucide.dev/) (Iconografía)
- [React Router](https://reactrouter.com/)

**Backend:**
- [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
- [Socket.IO](https://socket.io/) (Comunicación en tiempo real y QR)
- [Baileys (@dark-yasiya/baileys)](https://github.com/WhiskeySockets/Baileys) (Librería principal de WhatsApp)
- [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3) (Base de datos local ultrarrápida)
- [Supabase](https://supabase.com/) (Almacenamiento multimedia y sincronización en la nube)

## 📋 Requisitos Previos

- [Node.js](https://nodejs.org/) (versión 18 o superior recomendada)
- Proyecto/Cuenta de [Supabase](https://supabase.com/) para el almacenamiento de archivos multimedia.

## ⚙️ Configuración y Ejecución

1. **Clonar el repositorio e instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configuración de Variables de Entorno:**
   Copia el archivo `.env.example` a `.env` (si existe) o crea un archivo `.env` en la raíz del proyecto y configura tus credenciales de Supabase:
   ```env
   SUPABASE_URL=tu_url_de_supabase
   SUPABASE_ANON_KEY=tu_anon_key_de_supabase
   SUPABASE_SERVICE_ROLE_KEY=tu_service_key_de_supabase
   ```

3. **Ejecutar en modo Desarrollo:**
   Se ejecutará tanto el servidor backend (puerto 3000) como el frontend Vite de forma integrada.
   ```bash
   npm run dev
   ```

4. **Compilar para Producción:**
   ```bash
   npm run build
   ```

## 📁 Estructura Principal del Proyecto

```text
w-beli-ai-pro/
├── src/
│   ├── components/       # Componentes reutilizables de React (Layout, Preview, etc.)
│   ├── pages/            # Páginas de la aplicación (Dashboard, Send, Campaigns, Status, Settings)
│   ├── server/           # Backend (Node.js/Express)
│   │   ├── whatsapp.ts   # Integración con Baileys
│   │   ├── queue.ts      # Cola inteligente de mensajes y anti-spam
│   │   ├── statusManager.ts # Programación de Estados
│   │   ├── campaignManager.ts
│   │   └── db.ts         # Base de datos SQLite
│   ├── App.tsx           # Enrutamiento principal
│   └── main.tsx          # Punto de entrada de React
├── server.ts             # Punto de entrada del servidor Backend y API
├── wbot.db               # Archivo local de SQLite (Generado automáticamente)
└── package.json
```

## 🛡️ Aviso Legal (Disclaimer)
Esta herramienta no es una aplicación oficial de WhatsApp ni de Meta Platforms, Inc. El uso de software no oficial para envíos masivos o automatización puede resultar en el bloqueo temporal o permanente de tu cuenta de WhatsApp. Utiliza siempre la plataforma asumiendo la responsabilidad y aplicando los retrasos anti-spam adecuados para evitar ser marcado como spam.

