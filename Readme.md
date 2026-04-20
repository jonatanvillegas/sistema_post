# 📦 Sistema POS Moderno - Escritorio

Un sistema de Punto de Venta (POS) robusto, estético y eficiente diseñado para funcionar de forma local. Construido con una arquitectura moderna que permite el empaquetamiento como aplicación de escritorio mediante Electron.

---

## ✨ Características Principales

### 📊 Dashboard Inteligente
- Visualización simétrica de estadísticas clave (Ventas, Productos Top, Inventario).
- Gráficos interactivos de tendencias de ventas y métodos de pago.
- Diseño "Glassmorphism" moderno y responsive.

### 🛒 Punto de Venta (Scanner-Ready)
- **Escucha Global**: Detecta automáticamente scanners físicos y aplicaciones móviles (como *Barcode to PC*) sin necesidad de foco manual.
- **Auto-Inserción**: Agrega productos al carrito instantáneamente al detectar un código de barras válido.
- **Gestión de Pestañas**: Maneja múltiples ventas simultáneas de forma organizada (F2 para nueva pestaña).

### 🛡️ Seguridad y Mantenimiento
- **Respaldos Manuales ZIP**: Genera copias de seguridad completas de la base de datos directamente al **Escritorio** del usuario en formato comprimido.
- **Control de Acceso**: Sistema de roles (Administrador / Cajero) con permisos granulares.

### 📦 Gestión de Inventario y Créditos
- Control de stock con alertas visuales de inventario bajo.
- Historial de movimientos (Kardex) detallado.
- Módulo de **Créditos a Clientes** para gestionar deudas y pagos.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend**: React.js, Ant Design, Recharts, Zustand (State Management).
- **Backend**: Node.js, Express, Mongoose.
- **Base de Datos**: MongoDB Community Edition.
- **Empaquetamiento**: Preparado para Electron.

---

## 🚀 Requisitos de Instalación

Para que el sistema funcione correctamente en modo local, es necesario instalar:

1.  **[MongoDB Community Server](https://www.mongodb.com/try/download/community)**: Motor de base de datos.
2.  **[MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools)**: Indispensable para la función de respaldos (Backups).
3.  **[Node.js (LTS)](https://nodejs.org/)**: Motor de ejecución para el desarrollo/backend.
4.  **[Barcode to PC](https://barcodetopc.com/)** (Opcional): Si deseas usar tu dispositivo móvil como scanner USB/Wi-Fi.

---

## ⚙️ Configuración del Entorno

1.  **Backend**:
    - Navega a `backend/`.
    - Crea un archivo `.env` con:
      ```env
      PORT=5000
      MONGO_URI=mongodb://localhost:27017/sistema-pos
      JWT_SECRET=tu_secreto_super_seguro
      ```
    - Ejecuta `npm install` y luego `npm start`.

2.  **Frontend**:
    - Navega a `front/sistema-pos-front/`.
    - Ejecuta `npm install` y luego `npm run dev`.

---

## 💻 Atajos de Teclado (Punto de Venta)

| Tecla | Acción |
| :--- | :--- |
| **F2** | Nueva pestaña de venta |
| **F10** | Enfocar buscador de productos |
| **F12** | Abrir ventana de cobro |
| **F4** | Limpiar carrito actual |
| **Esc** | Cerrar modales |
| **Ctrl + → / ←** | Cambiar entre pestañas de ventas |

---

## 🏠 Despliegue en Escritorio (Electron)

Este proyecto está diseñado para ser empaquetado con Electron. Al hacerlo:

## Despliegue en Coolify (Web + API)

Este repo incluye un `Dockerfile` en la raíz que:
- Construye el frontend (Vite) en `front/sistema-pos-front/dist`.
- Levanta el backend (Express) y sirve el frontend como SPA.

### 1) Crear aplicación en Coolify
- Source: tu repo (GitHub/GitLab).
- Build Pack: **Dockerfile**.
- Puerto: usa el puerto de la app (por defecto `5000`).

### 2) Variables de entorno (Coolify)
Configura estas variables en el servicio:
- `PORT=5000` (o el que prefieras; Coolify puede mapearlo)
- `NODE_ENV=production`
- `MONGO_URI=mongodb://USER:PASS@HOST:27017/DB?authSource=admin` (tu Mongo remoto)
- `JWT_SECRET=...` (obligatorio)
- `JWT_EXPIRES_IN=8h` (opcional)

**Admin inicial (recomendado)**
- En producción no se crea admin automáticamente.
- Si quieres crear el admin solo la primera vez:
  - `SEED_ADMIN=true`
  - `ADMIN_EMAIL=admin@admin.com`
  - `ADMIN_PASSWORD=UnaClaveSegura`
Luego puedes quitar `SEED_ADMIN` o dejarlo en `false`.

### 3) URL
- La UI queda en: `https://TU-DOMINIO/`
- La API queda en: `https://TU-DOMINIO/api/health`

Si despliegas el frontend separado, define `VITE_API_URL` al construir el front.
---

## 📝 Créditos e Integraciones
Desarrollado como una solución integral para comercios locales que buscan modernizar su operación con alta velocidad de escaneo y backups seguros.
