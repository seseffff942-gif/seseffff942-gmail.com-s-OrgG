# Componente de Recibo de Caja - Agricovet 🧾

Módulo de Recibo de Caja independiente diseñado para el sistema **Agricovet**.

## 📌 Características Técnicas y Especificaciones
- **Ancho del Papel**: 80 mm (Estándar de impresoras térmicas de pos / ticket).
- **Área Útil de Impresión**: **72 mm** (aprox. 576 píxeles a 203 DPI).
- **Márgenes CSS**: Ajustados a 0 mm - 2 mm para aprovechar el 100% del área imprimible.
- **Largo (Alto)**: Continuo (`auto`), adaptándose dinámicamente al contenido del recibo.
- **Paleta de Colores**: Fondo e identidad institucional `#0c1b47` con tipografía de alto contraste en blanco.
- **Soporte de Impresión Oscura**: Incluye `-webkit-print-color-adjust: exact;` y `print-color-adjust: exact;` para asegurar que los encabezados y bloques oscuros se impriman correctamente en impresoras térmicas y láser/PDF.
- **Sección Invertida para Pagos en Efectivo**: Destacado visual con fondo azul noche (`#0c1b47`), donde resalta:
  - **Monto Total Recibo**
  - **Efectivo Recibido**
  - **Cambio / Vueltas (Entregado al Cliente)** o Saldo Pendiente.

---

## 🚀 Cómo Integrar el Componente en el Proyecto

Puedes importar el componente en cualquier vista sin afectar el resto del sistema:

```tsx
import { ReciboCajaComponent } from './components/recibo-caja';

function MiVistaVentas() {
  return (
    <div>
      <ReciboCajaComponent />
    </div>
  );
}
```

---

## 📝 Instrucciones de Uso (Cómo rellenar y descargar)

1. **Rellenar Datos**:
   - En el panel izquierdo ("Formulario de Recibo"), edita el **No. de Folio**, **Fecha**, **Nombre del Cliente**, **NIT**, y el **Concepto**.
   - Agrega o elimina ítems a la tabla usando el botón **"Agregar Fila"** o el icono de papelera.
   - En el panel **"Sección Invertida: Pago en Efectivo"**, ingresa el monto en **"Efectivo Recibido (Paga Con)"**.
   - El sistema calcula instantáneamente el **Cambio (Vueltas)** o avisa si hay **Saldo Pendiente**.

2. **Imprimir el Recibo en Rollo Térmico (80mm)**:
   - Presiona el botón **"Imprimir Ticket (80mm)"**.
   - Se abrirá la ventana de impresión configurada a 80mm/72mm de ancho dinámico.

3. **Descargar en PDF**:
   - Presiona el botón **"Descargar PDF"**.
   - El sistema generará y descargará el archivo PDF en formato de rollo térmico.
