import React, { useState } from 'react';
import { Client, Invoice, Payment, User } from '../types';
import { X, Download, MessageCircle, FileText, Calendar, DollarSign, Clock, CheckCircle, AlertTriangle, Printer, Phone } from 'lucide-react';
import { formatMoney, formatDateSafe, downloadHtmlAsPdf, printHtml, cn } from '../utils';

interface ClientAccountStatementModalProps {
  client: Client;
  invoices: Invoice[];
  user: User;
  onClose: () => void;
}

export function ClientAccountStatementModal({
  client,
  invoices,
  user,
  onClose
}: ClientAccountStatementModalProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Filter invoices for this client (active, pending, paid)
  const clientInvoices = invoices.filter(inv => {
    const invClient = (inv.client || inv.clientName || '').toLowerCase().trim();
    const cName = (client.name || '').toLowerCase().trim();
    const cComp = (client.companyName || '').toLowerCase().trim();
    return invClient === cName || (cComp && invClient === cComp) || (cComp && invClient.includes(cComp)) || invClient.includes(cName);
  });

  const validInvoices = clientInvoices.filter(i => i.status !== 'cancelled' && i.status !== 'rejected');
  const pendingInvoices = validInvoices.filter(i => i.status === 'pending');
  const paidInvoices = validInvoices.filter(i => i.status === 'paid');

  const totalBilled = validInvoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);
  const totalPaid = validInvoices.reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0);
  const totalBalance = totalBilled - totalPaid;

  const now = Date.now();

  const getWhatsAppMessage = () => {
    let msg = `*📋 ESTADO DE CUENTA - AGRICOVET*\n`;
    msg += `---------------------------------------\n`;
    msg += `*Cliente:* ${client.name}\n`;
    if (client.companyName) msg += `*Empresa / Agro:* ${client.companyName}\n`;
    if (client.nit) msg += `*NIT:* ${client.nit}\n`;
    msg += `*Fecha de Emisión:* ${new Date().toLocaleDateString('es-GT')}\n`;
    msg += `---------------------------------------\n`;
    msg += `💰 *SALDO TOTAL PENDIENTE:* *${formatMoney(totalBalance)}*\n`;
    msg += `• Total Facturado: ${formatMoney(totalBilled)}\n`;
    msg += `• Total Abonado: ${formatMoney(totalPaid)}\n`;
    msg += `---------------------------------------\n`;
    
    if (pendingInvoices.length > 0) {
      msg += `📑 *DETALLE DE FACTURAS PENDIENTES:*\n`;
      pendingInvoices.forEach(inv => {
        const folioStr = inv.folio ? `#${inv.folio}` : `#${inv.id.slice(0, 8)}`;
        const dateStr = formatDateSafe(inv.date);
        const invTotal = Number(inv.totalAmount) || 0;
        const invPaid = Number(inv.paidAmount) || 0;
        const invPending = invTotal - invPaid;
        const days = inv.date ? Math.floor((now - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
        
        msg += `• *Folio ${folioStr}* (${dateStr})\n`;
        msg += `   Total: ${formatMoney(invTotal)} | Saldo: *${formatMoney(invPending)}* (${days} días)\n`;
      });
      msg += `---------------------------------------\n`;
    } else {
      msg += `✅ *¡Su cuenta se encuentra al día y sin saldos pendientes!*\n`;
      msg += `---------------------------------------\n`;
    }

    msg += `Por favor coordinar su pago o depósito a nuestras cuentas autorizadas. ¡Muchas gracias por su preferencia! 🐾🌾\n`;
    return msg;
  };

  const handleShareWhatsApp = () => {
    let rawPhone = (client.phone || '').replace(/\D/g, '');
    if (!rawPhone || rawPhone.length < 8) {
      const inputPhone = prompt('Ingrese el número de WhatsApp del cliente (ej. 55443322):', rawPhone || '');
      if (!inputPhone) return;
      rawPhone = inputPhone.replace(/\D/g, '');
    }
    const fullPhone = rawPhone.length === 8 ? `502${rawPhone}` : rawPhone;
    const text = encodeURIComponent(getWhatsAppMessage());
    window.open(`https://wa.me/${fullPhone}?text=${text}`, '_blank');
  };

  const generateStatementHtml = () => {
    const dateStr = new Date().toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });
    
    let tableRows = '';
    validInvoices.forEach(inv => {
      const folioStr = inv.folio ? `${inv.folio}` : `${inv.id.slice(0, 8)}`;
      const invDate = formatDateSafe(inv.date);
      const invTotal = Number(inv.totalAmount) || 0;
      const invPaid = Number(inv.paidAmount) || 0;
      const invBalance = invTotal - invPaid;
      const days = inv.date ? Math.floor((now - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      const statusLabel = inv.status === 'paid' ? 'PAGADA' : `${days} DÍAS EN CRÉDITO`;
      const statusColor = inv.status === 'paid' ? '#0b4d2c' : (days > 30 ? '#b91c1c' : '#b45309');

      tableRows += `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 10px 8px; font-weight: bold; color: #1e293b;">#${folioStr}</td>
          <td style="padding: 10px 8px; color: #475569;">${invDate}</td>
          <td style="padding: 10px 8px; color: #334155;">${inv.items?.length || 1} productos (${inv.invoiceType || 'Agro'})</td>
          <td style="padding: 10px 8px; text-align: right; font-weight: 600; color: #1e293b;">${formatMoney(invTotal)}</td>
          <td style="padding: 10px 8px; text-align: right; color: #059669; font-weight: 600;">${formatMoney(invPaid)}</td>
          <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: ${invBalance > 0 ? '#b91c1c' : '#059669'};">${formatMoney(invBalance)}</td>
          <td style="padding: 10px 8px; text-align: center; font-weight: bold; color: ${statusColor}; font-size: 10px;">${statusLabel}</td>
        </tr>
      `;
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Estado de Cuenta - ${client.name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 25px; color: #0f172a; background: #fff; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0c5c35; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: 900; color: #0c5c35; text-transform: uppercase; margin: 0 0 4px 0; }
          .subtitle { font-size: 11px; color: #64748b; margin: 0; }
          .client-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; }
          .summary-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 25px; }
          .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 15px; }
          .card-title { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
          .card-val { font-size: 18px; font-weight: 900; color: #0c5c35; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          th { background: #f1f5f9; color: #475569; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 8px; text-align: left; border-bottom: 2px solid #cbd5e1; }
          .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 10px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">Agricovet de Guatemala</h1>
            <p class="subtitle">Distribuidora de Productos Agropecuarios & Veterinarios</p>
            <p class="subtitle">Documento Oficial de Estado de Cuenta Crediticio</p>
          </div>
          <div style="text-align: right;">
            <span style="display: inline-block; background: #0c5c35; color: #fff; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase;">Estado de Cuenta</span>
            <p style="font-size: 11px; color: #475569; margin: 5px 0 0 0;">Fecha: <strong>${dateStr}</strong></p>
          </div>
        </div>

        <div class="client-box">
          <div>
            <p style="margin: 0 0 4px 0;"><strong>Cliente:</strong> ${client.name}</p>
            <p style="margin: 0 0 4px 0;"><strong>Empresa / Agro:</strong> ${client.companyName || 'Particular'}</p>
            <p style="margin: 0;"><strong>NIT:</strong> ${client.nit || 'C/F'}</p>
          </div>
          <div>
            <p style="margin: 0 0 4px 0;"><strong>Teléfono:</strong> ${client.phone || 'No registrado'}</p>
            <p style="margin: 0 0 4px 0;"><strong>Dirección:</strong> ${client.address || 'No registrada'}</p>
            <p style="margin: 0;"><strong>Código de Cliente:</strong> #${client.clientCode || 'N/A'}</p>
          </div>
        </div>

        <div class="summary-cards">
          <div class="card">
            <div class="card-title">Total Facturado Histórico</div>
            <div class="card-val">${formatMoney(totalBilled)}</div>
          </div>
          <div class="card">
            <div class="card-title">Total Pagos & Abonos</div>
            <div class="card-val" style="color: #059669;">${formatMoney(totalPaid)}</div>
          </div>
          <div class="card" style="background: #fef2f2; border-color: #fecaca;">
            <div class="card-title" style="color: #991b1b;">Saldo Total Pendiente</div>
            <div class="card-val" style="color: #b91c1c;">${formatMoney(totalBalance)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Folio</th>
              <th>Fecha</th>
              <th>Detalle</th>
              <th style="text-align: right;">Total Venta</th>
              <th style="text-align: right;">Abonado</th>
              <th style="text-align: right;">Saldo Actual</th>
              <th style="text-align: center;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #94a3b8;">Sin facturas registradas</td></tr>'}
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; margin-top: 40px; padding: 0 40px;">
          <div style="text-align: center; border-top: 1px solid #000; width: 200px; padding-top: 5px; font-size: 11px;">
            <strong>Firma Autorizada</strong><br>
            <span style="color: #64748b; font-size: 9px;">Agricovet de Guatemala</span>
          </div>
          <div style="text-align: center; border-top: 1px solid #000; width: 200px; padding-top: 5px; font-size: 11px;">
            <strong>Conforme Cliente</strong><br>
            <span style="color: #64748b; font-size: 9px;">${client.name}</span>
          </div>
        </div>

        <div class="footer">
          Agricovet de Guatemala • Sistema de Gestión Comercial y Control de Cartera • Generado el ${dateStr}
        </div>
      </body>
      </html>
    `;
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const html = generateStatementHtml();
      await downloadHtmlAsPdf(html, `Estado-De-Cuenta-${client.name.replace(/\s+/g, '-')}.pdf`);
    } catch (err: any) {
      alert('Error al generar PDF: ' + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    const html = generateStatementHtml();
    printHtml(html);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-[#0b4d2c] to-[#083a21] text-white flex justify-between items-start shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-white/20 text-emerald-200 text-[10px] font-black uppercase rounded-full tracking-widest">
                Gestión de Cartera
              </span>
            </div>
            <h3 className="text-xl font-black tracking-tight">{client.name}</h3>
            <p className="text-xs text-emerald-200/90 font-medium">
              {client.companyName ? `${client.companyName} • ` : ''}NIT: {client.nit || 'C/F'} • Tel: {client.phone || 'N/A'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Facturado</span>
              <span className="text-lg font-black text-slate-900 notranslate" translate="no">{formatMoney(totalBilled)}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">{validInvoices.length} facturas emitidas</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">Total Abonado</span>
              <span className="text-lg font-black text-emerald-700 notranslate" translate="no">{formatMoney(totalPaid)}</span>
              <span className="text-[10px] text-emerald-600 block mt-0.5">{paidInvoices.length} canceladas</span>
            </div>

            <div className={cn(
              "p-4 rounded-2xl border shadow-xs",
              totalBalance > 0 ? "bg-rose-50 border-rose-200 text-rose-950" : "bg-emerald-50 border-emerald-200 text-emerald-950"
            )}>
              <span className="text-[10px] font-black uppercase tracking-wider block mb-1">Saldo Pendiente</span>
              <span className="text-xl font-black notranslate" translate="no">{formatMoney(totalBalance)}</span>
              <span className="text-[10px] font-bold block mt-0.5">
                {pendingInvoices.length > 0 ? `${pendingInvoices.length} facturas por cobrar` : 'Cuenta al día ✓'}
              </span>
            </div>
          </div>

          {/* Pending Invoices Breakout */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Clock size={14} className="text-amber-600" />
                Facturas Pendientes de Cobro ({pendingInvoices.length})
              </h4>
            </div>

            {pendingInvoices.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs font-medium">
                No hay facturas con saldo pendiente para este cliente.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {pendingInvoices.map(inv => {
                  const folioStr = inv.folio ? `#${inv.folio}` : `#${inv.id.slice(0, 8)}`;
                  const invTotal = Number(inv.totalAmount) || 0;
                  const invPaid = Number(inv.paidAmount) || 0;
                  const invBalance = invTotal - invPaid;
                  const days = inv.date ? Math.floor((now - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24)) : 0;

                  return (
                    <div key={inv.id} className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/60 flex justify-between items-center gap-3 transition">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-slate-900">{folioStr}</span>
                          <span className="text-[10px] text-slate-500">{formatDateSafe(inv.date)}</span>
                          <span className={cn(
                            "text-[9px] font-black px-1.5 py-0.5 rounded",
                            days > 30 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                          )}>
                            {days} días
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Total: {formatMoney(invTotal)} • Abonado: {formatMoney(invPaid)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="block text-xs font-black text-rose-700 notranslate" translate="no">
                          {formatMoney(invBalance)}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Saldo</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Action Footer */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Printer size={14} /> Imprimir
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-black text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Download size={14} /> {isGeneratingPdf ? 'Generando...' : 'Descargar PDF'}
            </button>
          </div>

          <button
            onClick={handleShareWhatsApp}
            className="px-5 py-2.5 bg-[#25D366] hover:bg-[#1ebd5a] text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-md shadow-green-900/10 transition active:scale-95 cursor-pointer"
          >
            <MessageCircle size={16} /> Enviar a WhatsApp
          </button>
        </div>

      </div>
    </div>
  );
}
