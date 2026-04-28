# 📊 Gestión de Gastos - App

Aplicación web moderna para la administración, control y reporte de gastos y solicitudes de recursos, diseñada para ofrecer una experiencia fluida y eficiente tanto en escritorio como en dispositivos móviles (PWA).

## 🚀 Características Principales

- **Gestión de Solicitudes**: Módulo completo para la creación, seguimiento y cierre de solicitudes de recursos.
- **Control de Gastos**: Registro detallado de gastos con soporte para múltiples categorías y edición dinámica.
- **Gestión de Casetas**: Manejo especializado de gastos de peaje, permitiendo el registro sin factura inicial y actualización posterior.
- **Generación de Reportes**:
  - Exportación a **Excel** y **PDF**.
  - Reportes ejecutivos con opción de descarga en **PNG** con marca de agua personalizada.
- **Cálculos Automáticos**: Lógica inteligente para determinar reembolsos o reintegros (CECAI) basada en lo recibido vs. facturado.
- **Multi-persona**: Escalado dinámico de presupuestos según la cantidad de personas en la solicitud.
- **PWA (Progressive Web App)**: Instalable en dispositivos móviles para acceso rápido y offline.

## 🛠️ Stack Tecnológico

- **Frontend**: [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Estilos**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Componentes UI**: [Tremor](https://www.tremor.so/) & [Lucide React](https://lucide.dev/)
- **Animaciones**: [Framer Motion](https://www.framer.com/motion/)
- **Backend/Hosting**: [Firebase](https://firebase.google.com/)
- **Reportes**: [ExcelJS](https://github.com/exceljs/exceljs), [XLSX](https://github.com/SheetJS/sheetjs) & [PDF-Lib](https://pdf-lib.js.org/)
- **Testing**: [Vitest](https://vitest.dev/) & [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

## 📦 Instalación

1. Clonar el repositorio:
   ```bash
   git clone [url-del-repositorio]
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Configurar variables de entorno (Firebase):
   Crea un archivo `.env` o configura las credenciales necesarias en el proyecto.

4. Iniciar servidor de desarrollo:
   ```bash
   npm run dev
   ```

## 📜 Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo en red local.
- `npm run build`: Genera el bundle de producción optimizado en la carpeta `dist`.
- `npm run lint`: Ejecuta ESLint para verificar la calidad del código.
- `npm test`: Ejecuta la suite de pruebas unitarias con Vitest.
- `npm run preview`: Previsualiza la versión de producción localmente.

---
Desarrollado con ❤️ para optimizar la gestión financiera.
