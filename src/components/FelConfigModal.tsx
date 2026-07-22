import React, { useEffect, useState } from 'react';
import { X, Save, ShieldCheck, AlertTriangle, KeyRound, Building2 } from 'lucide-react';
import { api } from '../api';
import { cn } from '../utils';

/**
 * Configuracion de Factura Electronica (FEL): datos fiscales del emisor,
 * ambiente y credenciales de INFILE. Solo administradores.
 *
 * Las llaves NUNCA se muestran: los campos de credenciales inician vacios y
 * solo se envian si se escriben (vacio = conservar la actual).
 */

interface Props {
  onClose: () => void;
}

const CAMPOS_TEXTO: { clave: string; etiqueta: string; placeholder?: string }[] = [
  { clave: 'nit_emisor', etiqueta: 'NIT del emisor', placeholder: '120894769' },
  { clave: 'nombre_emisor', etiqueta: 'Razón social' },
  { clave: 'nombre_comercial', etiqueta: 'Nombre comercial' },
  { clave: 'direccion', etiqueta: 'Dirección fiscal' },
  { clave: 'municipio', etiqueta: 'Municipio', placeholder: 'GUATEMALA' },
  { clave: 'departamento', etiqueta: 'Departamento', placeholder: 'GUATEMALA' },
  { clave: 'codigo_postal', etiqueta: 'Código postal', placeholder: '01010' },
  { clave: 'codigo_establecimiento', etiqueta: 'Código de establecimiento', placeholder: '2' },
];

export function FelConfigModal({ onClose }: Props) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [credenciales, setCredenciales] = useState({ infile_usuario: '', infile_llave_firma: '', infile_llave_token: '', infile_url: '' });
  const [credencialesCargadas, setCredencialesCargadas] = useState(false);
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    api.getFelConfig()
      .then((r: any) => {
        setForm(r?.config ?? {});
        setFaltantes(r?.camposFaltantes ?? []);
        setCredencialesCargadas(!!r?.credencialesCargadas);
        setCredenciales((c) => ({ ...c, infile_usuario: r?.config?.infile_usuario ?? '', infile_url: r?.config?.infile_url ?? '' }));
      })
      .catch((e: any) => setMensaje({ ok: false, texto: e?.message ?? 'No se pudo cargar la configuración' }))
      .finally(() => setCargando(false));
  }, []);

  const guardar = async () => {
    setGuardando(true);
    setMensaje(null);
    try {
      const cambios: Record<string, any> = {};
      for (const { clave } of CAMPOS_TEXTO) {
        if (form[clave] !== undefined && form[clave] !== null) cambios[clave] = form[clave];
      }
      cambios.tipo_dte_default = form.tipo_dte_default || 'FCAM';
      cambios.ambiente = form.ambiente || 'pruebas';
      // Credenciales: solo se envian si se escribieron (vacio = conservar)
      for (const [k, v] of Object.entries(credenciales)) {
        if (String(v ?? '').trim() !== '') cambios[k] = String(v).trim();
      }
      const r: any = await api.guardarFelConfig(cambios);
      setFaltantes(r?.camposFaltantes ?? []);
      setMensaje({ ok: true, texto: 'Configuración guardada.' });
      setCredenciales((c) => ({ ...c, infile_llave_firma: '', infile_llave_token: '' }));
      if (cambios.infile_llave_firma || cambios.infile_llave_token) setCredencialesCargadas(true);
    } catch (e: any) {
      setMensaje({ ok: false, texto: e?.message ?? 'No se pudo guardar' });
    } finally {
      setGuardando(false);
    }
  };

  const campo = (clave: string, valor: any, onCambio: (v: string) => void, etiqueta: string, placeholder?: string, tipo = 'text') => (
    <label key={clave} className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{etiqueta}</span>
      <input
        type={tipo}
        value={valor ?? ''}
        onChange={(e) => onCambio(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-400"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">

        <div className="flex items-start justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-base font-bold text-slate-800">Configuración FEL</h3>
            <p className="text-xs text-slate-500 mt-0.5">Datos del emisor y credenciales de INFILE</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 bg-slate-50 rounded-full cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {cargando ? (
          <div className="p-10 text-center text-sm text-slate-400">Cargando…</div>
        ) : (
          <div className="p-5 space-y-5">

            {faltantes.length > 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800">
                  Faltan campos para poder emitir: <b>{faltantes.join(', ')}</b>
                </p>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-emerald-800">
                  Datos del emisor completos. Credenciales de INFILE: <b>{credencialesCargadas ? 'cargadas' : 'pendientes'}</b>.
                </p>
              </div>
            )}

            <section>
              <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2.5">
                <Building2 size={13} className="text-[#00696a]" /> Datos fiscales del emisor
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CAMPOS_TEXTO.map(({ clave, etiqueta, placeholder }) =>
                  campo(clave, form[clave], (v) => setForm({ ...form, [clave]: v }), etiqueta, placeholder)
                )}
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tipo de documento</span>
                <select
                  value={form.tipo_dte_default || 'FCAM'}
                  onChange={(e) => setForm({ ...form, tipo_dte_default: e.target.value })}
                  className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 cursor-pointer"
                >
                  <option value="FCAM">FCAM — Factura cambiaria</option>
                  <option value="FACT">FACT — Factura</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ambiente</span>
                <select
                  value={form.ambiente || 'pruebas'}
                  onChange={(e) => setForm({ ...form, ambiente: e.target.value })}
                  className={cn(
                    'mt-1 w-full text-sm border rounded-lg px-3 py-2 bg-white cursor-pointer',
                    form.ambiente === 'produccion' ? 'border-red-300 text-red-700 font-bold' : 'border-slate-200 text-slate-700'
                  )}
                >
                  <option value="pruebas">Pruebas (sandbox)</option>
                  <option value="produccion">PRODUCCIÓN</option>
                </select>
              </label>
              {form.ambiente === 'produccion' && (
                <p className="col-span-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  ⚠️ En producción cada documento certificado es <b>fiscal y real ante SAT</b>. Asegúrate de tener
                  las credenciales de producción cargadas y de haber probado a fondo en el sandbox.
                </p>
              )}
            </section>

            <section>
              <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2.5">
                <KeyRound size={13} className="text-[#00696a]" /> Credenciales de INFILE
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {campo('infile_usuario', credenciales.infile_usuario, (v) => setCredenciales({ ...credenciales, infile_usuario: v }), 'Usuario (API y firma)')}
                {campo('infile_url', credenciales.infile_url, (v) => setCredenciales({ ...credenciales, infile_url: v }), 'URL del certificador')}
                {campo('infile_llave_firma', credenciales.infile_llave_firma, (v) => setCredenciales({ ...credenciales, infile_llave_firma: v }), 'Llave de firma', credencialesCargadas ? '•••••• (dejar vacío para conservar)' : '', 'password')}
                {campo('infile_llave_token', credenciales.infile_llave_token, (v) => setCredenciales({ ...credenciales, infile_llave_token: v }), 'Llave / token de API', credencialesCargadas ? '•••••• (dejar vacío para conservar)' : '', 'password')}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                Las llaves se guardan en la base de datos y nunca se vuelven a mostrar. Deja los campos vacíos para conservar las actuales.
              </p>
            </section>

            {mensaje && (
              <p className={cn(
                'text-xs rounded-lg px-3 py-2 border',
                mensaje.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'
              )}>
                {mensaje.texto}
              </p>
            )}

            <button
              onClick={guardar}
              disabled={guardando}
              className="w-full py-2.5 rounded-xl font-bold text-white bg-[#00696a] hover:bg-[#004f50] disabled:opacity-50 transition-colors cursor-pointer text-sm flex items-center justify-center gap-2"
            >
              <Save size={15} /> {guardando ? 'Guardando…' : 'Guardar configuración'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
