# Uber Invoice Assistant

Extensión Manifest V3 para Chrome y Microsoft Edge. Lee el formato copiado por Gastos App y completa campos visibles de RFC, fecha y monto en `help.uber.com`. El RFC se consulta desde el documento corporativo en Firestore `cfdi/CCI190920376`. No envía el reclamo.

## Instalar localmente

1. Abre `chrome://extensions` en Chrome o `edge://extensions` en Edge.
2. Activa **Modo de desarrollador**.
3. Elige **Cargar descomprimida** y selecciona esta carpeta.
4. Inicia sesión en Uber y abre la página de ayuda del reclamo.
5. En Gastos App, selecciona de uno a cinco gastos y pulsa **Continuar reclamo**.
6. La confirmación aparece solo en la página del reclamo y cuando el portapapeles contiene un RFC y al menos una factura válida. Pulsa **Sí, completar** para llenar los campos.
7. Revisa los datos completados y envía el reclamo manualmente en Uber. El popup de la extensión también sigue disponible como alternativa.

La extensión comprueba en la página de Uber que el formato del portapapeles sea válido antes de mostrar la confirmación. Solo lee los datos para llenar campos después de aceptar. Si no encuentra suficientes campos reconocibles, no cambia ninguno y permite reintentar cuando el formulario esté listo. No envía el reclamo.