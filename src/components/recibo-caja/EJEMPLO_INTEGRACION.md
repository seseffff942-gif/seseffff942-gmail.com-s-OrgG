# 🛠️ Ejemplo de Integración del Recibo de Caja en Agricovet

El componente `ReciboCajaComponent` está listo para ser insertado en cualquier sección existente del sistema Agricovet (Facturación, Ventas, Historial de Recibos, o un Modal emergente al finalizar venta).

---

### Opción A: Como Sección/Pestaña Inline dentro de una página existente

```tsx
import React, { useState } from 'react';
import { ReciboCajaComponent } from '../components/recibo-caja';

export const MiApartadoVentas: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#0c1b47] mb-4">Apartado de Recibos de Caja</h1>
      
      {/* Componente integrado directamente */}
      <ReciboCajaComponent />
    </div>
  );
};
```

---

### Opción B: Como Modal Emergente al finalizar una Venta

```tsx
import React, { useState } from 'react';
import { ReciboCajaComponent, DatosRecibo } from '../components/recibo-caja';

export const ModalReciboVenta: React.FC<{ venta: any; onClose: () => void }> = ({ venta, onClose }) => {
  const datosIniciales: Partial<DatosRecibo> = {
    clienteNombre: venta.cliente_nombre,
    clienteNit: venta.cliente_nit,
    folio: `P Nº ${venta.numero_factura}`,
    items: venta.productos.map((p: any) => ({
      id: p.id,
      cantidad: p.cantidad,
      descripcion: p.nombre,
      precioUnitario: p.precio
    })),
    efectivoRecibido: venta.monto_efectivo
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full p-4">
        <ReciboCajaComponent 
          initialData={datosIniciales} 
          showForm={true} 
          onClose={onClose} 
        />
      </div>
    </div>
  );
};
```
