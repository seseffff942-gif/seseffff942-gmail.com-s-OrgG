import React, { useState, useEffect } from 'react';
import { FileCheck2, Clock, AlertTriangle, XCircle, Ban, RefreshCw, X, Copy, Check, Download } from 'lucide-react';
import { api } from '../api';
import type { EstadoFacturaFEL, EstadoFEL, Invoice, User } from '../types';
import { cn } from '../utils';

/** Apariencia de cada estado FEL. El color codifica la urgencia, no la marca. */
const ESTILOS: Record<EstadoFEL, { texto: string; clase: string; Icono: any }> = {
  sin_emitir:  { texto: 'Sin emitir',  clase: 'bg-slate-100 text-slate-600 border-slate-200',    Icono: Clock },
  pendiente:   { texto: 'Pendiente',   clase: 'bg-amber-50 text-amber-700 border-amber-200',     Icono: Clock },
  enviado:     { texto: 'Enviado',     clase: 'bg-blue-50 text-blue-700 border-blue-200',        Icono: RefreshCw },
  certificado: { texto: 'Certificada', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icono: FileCheck2 },
  error:       { texto: 'Con error',   clase: 'bg-red-50 text-red-700 border-red-200',           Icono: XCircle },
  anulado:     { texto: 'Anulada',     clase: 'bg-slate-100 text-slate-500 border-slate-200',    Icono: Ban },
};

const quetzales = (n?: number | null) =>
  `Q${Number(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Distintivo compacto para listados de facturas. */
export function FelBadge({ estado, onClick }: { estado: EstadoFEL; onClick?: () => void }) {
  const { texto, clase, Icono } = ESTILOS[estado] ?? ESTILOS.sin_emitir;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`FEL: ${texto}`}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide transition-all',
        clase,
        onClick && 'cursor-pointer hover:brightness-95 active:scale-95'
      )}
    >
      <Icono size={11} />
      FEL: {texto}
    </button>
  );
}

interface FelPanelProps {
  invoice: Invoice;
  user: User;
  onClose: () => void;
}

/**
 * Detalle FEL de una factura: desglose fiscal, estado ante SAT y accion para
 * certificar. Funciona aunque INFILE no este configurado todavia; en ese caso
 * muestra el desglose ya calculado y explica que falta.
 */
export function FelPanel({ invoice, user, onClose }: FelPanelProps) {
  const [datos, setDatos] = useState<EstadoFacturaFEL | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  // Verificacion del NIT contra el padron de SAT (servicio de INFILE)
  const [nitVerificado, setNitVerificado] = useState<{ valido: boolean; nombre?: string; mensaje?: string } | null>(null);
  const [verificandoNit, setVerificandoNit] = useState(false);
  // Flujo de anulacion: requiere motivo y confirmacion explicita
  const [mostrandoAnulacion, setMostrandoAnulacion] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');

  const cargar = async () => {
    try {
      setError(null);
      setDatos(await api.getFelEstado(invoice.id));
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo consultar el estado FEL');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // Sin polling: el estado FEL solo cambia cuando el usuario actua.
  }, [invoice.id]);

  const certificar = async () => {
    setProcesando(true);
    setError(null);
    setAviso(null);
    try {
      const r = await api.certificarFel(invoice.id);
      setAviso(r?.certificado ? 'Factura certificada correctamente.' : r?.mensaje ?? null);
      await cargar();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo certificar');
    } finally {
      setProcesando(false);
    }
  };

  const copiarUuid = () => {
    const uuid = datos?.documento?.numero_autorizacion;
    if (!uuid) return;
    navigator.clipboard?.writeText(uuid);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  };

  const verificarNit = async () => {
    if (!datos?.nitReceptor) return;
    setVerificandoNit(true);
    setNitVerificado(null);
    try {
      setNitVerificado(await api.consultarNitFel(datos.nitReceptor));
    } catch (e: any) {
      setNitVerificado({ valido: false, mensaje: e?.message ?? 'No se pudo consultar' });
    } finally {
      setVerificandoNit(false);
    }
  };

  const descargarXml = async (tipo: 'enviado' | 'certificado') => {
    try {
      const blob = await api.descargarFelXml(invoice.id, tipo);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DTE-${tipo}-${datos?.documento?.numero_autorizacion || invoice.id}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo descargar el XML');
    }
  };

  const anular = async () => {
    if (motivoAnulacion.trim().length < 5) {
      setError('Indica el motivo de la anulación (mínimo 5 caracteres).');
      return;
    }
    setProcesando(true);
    setError(null);
    setAviso(null);
    try {
      const r = await api.anularFel(invoice.id, motivoAnulacion.trim());
      setAviso(r?.anulado ? 'Documento anulado ante SAT.' : r?.mensaje ?? null);
      setMostrandoAnulacion(false);
      setMotivoAnulacion('');
      await cargar();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo anular');
    } finally {
      setProcesando(false);
    }
  };

  const estado: EstadoFEL = datos?.estado ?? 'sin_emitir';
  const { texto, clase, Icono } = ESTILOS[estado] ?? ESTILOS.sin_emitir;
  const doc = datos?.documento;
  const esAdmin = user.role === 'admin';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">

        <div className="flex items-start justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-base font-bold text-slate-800">Factura Electrónica (FEL)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {invoice.folio ? `Folio ${invoice.folio} · ` : ''}{invoice.client}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 bg-slate-50 rounded-full cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {cargando ? (
          <div className="p-10 text-center text-sm text-slate-400">Consultando estado…</div>
        ) : (
          <div className="p-5 space-y-4">

            <div className={cn('flex items-center gap-3 rounded-xl border p-3.5', clase)}>
              <Icono size={20} className="shrink-0" />
              <div>
                <p className="font-bold text-sm leading-none">{texto}</p>
                {doc?.fecha_certificacion && (
                  <p className="text-[11px] opacity-80 mt-1">
                    Certificada el {new Date(doc.fecha_certificacion).toLocaleString('es-GT')}
                  </p>
                )}
              </div>
            </div>

            {doc?.numero_autorizacion && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Número de autorización (SAT)
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-slate-700 break-all flex-1">{doc.numero_autorizacion}</code>
                  <button onClick={copiarUuid} className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer shrink-0">
                    {copiado ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} className="text-slate-500" />}
                  </button>
                </div>
                {(doc.serie || doc.numero) && (
                  <p className="text-[11px] text-slate-500 mt-2">
                    Serie <b>{doc.serie ?? '—'}</b> · Número <b>{doc.numero ?? '—'}</b>
                  </p>
                )}
              </div>
            )}

            <div className="border border-slate-200 rounded-xl px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  NIT del receptor
                </span>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'font-mono text-sm font-bold',
                    datos?.nitReceptor ? 'text-slate-700' : 'text-amber-600'
                  )}>
                    {datos?.nitReceptor || 'CF (consumidor final)'}
                  </span>
                  {datos?.nitReceptor && !datos?.esConsumidorFinal && (
                    <button
                      onClick={verificarNit}
                      disabled={verificandoNit}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-teal-50 text-[#00696a] hover:bg-teal-100 border border-teal-100 cursor-pointer disabled:opacity-50"
                    >
                      {verificandoNit ? 'Consultando…' : 'Verificar en SAT'}
                    </button>
                  )}
                </div>
              </div>
              {nitVerificado && (
                <p className={cn(
                  'text-[11px] mt-1.5 leading-snug',
                  nitVerificado.valido ? 'text-emerald-700' : 'text-red-600'
                )}>
                  {nitVerificado.valido
                    ? <>✓ Registrado en SAT como: <b>{nitVerificado.nombre}</b></>
                    : <>✗ {nitVerificado.mensaje}</>}
                </p>
              )}
            </div>

            {/* Desglose fiscal: el dato clave es que el gran total NO cambia */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3.5 pt-3 pb-2">
                Desglose fiscal
              </p>
              <div className="divide-y divide-slate-100">
                <div className="flex justify-between px-3.5 py-2 text-sm">
                  <span className="text-slate-500">Base gravable</span>
                  <span className="font-mono tabular-nums text-slate-700">{quetzales(datos?.desglose.montoGravable)}</span>
                </div>
                <div className="flex justify-between px-3.5 py-2 text-sm">
                  <span className="text-slate-500">IVA (12%)</span>
                  <span className="font-mono tabular-nums text-slate-700">{quetzales(datos?.desglose.montoIva)}</span>
                </div>
                <div className="flex justify-between px-3.5 py-2.5 bg-slate-50">
                  <span className="text-sm font-bold text-slate-700">Total a pagar</span>
                  <span className="font-mono tabular-nums font-bold text-[#00696a]">{quetzales(datos?.desglose.granTotal)}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 px-3.5 py-2 border-t border-slate-100">
                Los precios ya incluyen IVA: el total cobrado al cliente no cambia.
              </p>
            </div>

            {/* Descarga de XML: lo que pide el certificador cuando hay que
                diagnosticar un error ("mandame el XML y te digo que paso") */}
            {doc && (doc as any).intentos > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => descargarXml('enviado')}
                  className="flex-1 py-2 rounded-xl font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer text-[11px] flex items-center justify-center gap-1.5"
                >
                  <Download size={12} /> XML enviado
                </button>
                {doc.numero_autorizacion && (
                  <button
                    onClick={() => descargarXml('certificado')}
                    className="flex-1 py-2 rounded-xl font-bold text-[#00696a] bg-teal-50 hover:bg-teal-100 border border-teal-100 transition-colors cursor-pointer text-[11px] flex items-center justify-center gap-1.5"
                  >
                    <Download size={12} /> XML certificado
                  </button>
                )}
              </div>
            )}

            {!!datos?.advertencias?.length && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800 mb-1.5">
                  <AlertTriangle size={13} /> Revisar antes de certificar
                </p>
                <ul className="space-y-1">
                  {datos.advertencias.map((a, i) => (
                    <li key={i} className="text-[11px] text-amber-700 leading-snug">• {a}</li>
                  ))}
                </ul>
              </div>
            )}

            {doc?.mensaje_error && estado !== 'certificado' && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Último resultado</p>
                <p className="text-[11px] text-slate-600 leading-snug">{doc.mensaje_error}</p>
                {!!doc.intentos && <p className="text-[10px] text-slate-400 mt-1.5">Intentos: {doc.intentos}</p>}
              </div>
            )}

            {aviso && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{aviso}</p>}
            {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            {esAdmin && estado !== 'certificado' && estado !== 'anulado' && (
              <button
                onClick={certificar}
                disabled={procesando}
                className="w-full py-2.5 rounded-xl font-bold text-white bg-[#00696a] hover:bg-[#004f50] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer text-sm flex items-center justify-center gap-2"
              >
                {procesando ? <><RefreshCw size={15} className="animate-spin" /> Procesando…</>
                            : <><FileCheck2 size={15} /> Certificar ante SAT</>}
              </button>
            )}

            {/* Anulación: solo admin, solo documentos certificados */}
            {esAdmin && estado === 'certificado' && !mostrandoAnulacion && (
              <button
                onClick={() => setMostrandoAnulacion(true)}
                className="w-full py-2 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors cursor-pointer text-xs flex items-center justify-center gap-1.5"
              >
                <Ban size={13} /> Anular documento ante SAT
              </button>
            )}
            {esAdmin && estado === 'certificado' && mostrandoAnulacion && (
              <div className="border border-red-200 bg-red-50 rounded-xl p-3.5 space-y-2.5">
                <p className="text-xs font-bold text-red-800">
                  La anulación es un trámite fiscal ante SAT y no se puede deshacer.
                </p>
                <textarea
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  placeholder="Motivo de la anulación (obligatorio)…"
                  rows={2}
                  className="w-full text-xs border border-red-200 rounded-lg p-2 bg-white text-slate-700 resize-none focus:outline-none focus:ring-1 focus:ring-red-300"
                />
                <div className="flex gap-2">
                  <button
                    onClick={anular}
                    disabled={procesando || motivoAnulacion.trim().length < 5}
                    className="flex-1 py-2 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-xs"
                  >
                    {procesando ? 'Anulando…' : 'Confirmar anulación'}
                  </button>
                  <button
                    onClick={() => { setMostrandoAnulacion(false); setMotivoAnulacion(''); }}
                    className="py-2 px-4 rounded-lg font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {estado === 'anulado' && datos?.documento && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Anulación</p>
                <p className="text-[11px] text-slate-600">
                  Motivo: <b>{(datos.documento as any).motivo_anulacion || '—'}</b>
                </p>
                {(datos.documento as any).fecha_anulacion && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    {new Date((datos.documento as any).fecha_anulacion).toLocaleString('es-GT')}
                  </p>
                )}
              </div>
            )}

            {!esAdmin && (
              <p className="text-[11px] text-slate-400 text-center">
                Solo un administrador puede certificar documentos.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
