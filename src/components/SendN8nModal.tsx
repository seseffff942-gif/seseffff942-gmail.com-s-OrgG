import React, { useState, useEffect } from 'react';
import { Send, CheckSquare, Square, X, Users, Clock, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../api';
import { User } from '../types';

interface SendN8nModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (summary: { count: number; sellers: string[] }) => void;
}

export function SendN8nModal({ isOpen, onClose, onSuccess }: SendN8nModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('n8n_selected_sellers');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const [corteHora, setCorteHora] = useState<'12:00' | '17:00'>(() => {
    const hour = new Date().getHours();
    return hour >= 15 ? '17:00' : '12:00';
  });

  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStatusMessage(null);
      return;
    }

    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const data = await api.getUsers();
        const validUsers = (data || []).filter(u => 
          u && u.email && (u.role as string) !== 'system' && (u.role === 'seller' || u.role === 'admin') &&
          !u.email.toLowerCase().includes('susana') &&
          !(u.name || '').toLowerCase().includes('susana')
        );
        setUsers(validUsers);

        // Si no hay selección guardada previamente, marcar a todos por defecto
        if (selectedEmails.length === 0 && validUsers.length > 0) {
          const allEmails = validUsers.map(u => (u.email || '').toLowerCase().trim()).filter(Boolean);
          setSelectedEmails(allEmails);
        }
      } catch (err) {
        console.error('Error cargando usuarios para n8n:', err);
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, [isOpen]);

  const toggleSelectUser = (email: string) => {
    const cleanEmail = email.toLowerCase().trim();
    setSelectedEmails(prev => {
      const exists = prev.includes(cleanEmail);
      const next = exists ? prev.filter(e => e !== cleanEmail) : [...prev, cleanEmail];
      localStorage.setItem('n8n_selected_sellers', JSON.stringify(next));
      return next;
    });
  };

  const handleSelectAll = () => {
    const allEmails = users.map(u => (u.email || '').toLowerCase().trim()).filter(Boolean);
    setSelectedEmails(allEmails);
    localStorage.setItem('n8n_selected_sellers', JSON.stringify(allEmails));
  };

  const handleDeselectAll = () => {
    setSelectedEmails([]);
    localStorage.setItem('n8n_selected_sellers', JSON.stringify([]));
  };

  const handleSend = async () => {
    if (selectedEmails.length === 0) {
      setStatusMessage({ type: 'error', text: 'Por favor selecciona al menos un vendedor de la lista.' });
      return;
    }

    setIsSending(true);
    setStatusMessage(null);

    try {
      const res = await api.checkDailySales({
        sendToWebhook: true,
        corteHora,
        targetSellerEmails: selectedEmails,
      });

      const selectedNames = users
        .filter(u => selectedEmails.includes((u.email || '').toLowerCase().trim()))
        .map(u => u.name || u.email);

      const count = selectedEmails.length;
      const successText = count === 1 
        ? `✅ ¡Reporte de ${selectedNames[0]} enviado exitosamente por WhatsApp!`
        : `✅ ¡Envío iniciado para ${count} asesores con pausas de 1 minuto anti-baneo!`;

      setStatusMessage({ type: 'success', text: successText });

      if (onSuccess) {
        onSuccess({ count, sellers: selectedNames });
      }

      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('Error enviando a n8n:', err);
      setStatusMessage({ 
        type: 'error', 
        text: `❌ Error al enviar reporte: ${err.message || 'No se pudo conectar con el webhook de n8n.'}` 
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header con gradiente esmeralda */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-emerald-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center backdrop-blur-md shadow-inner">
              <Send className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight">Enviar Reporte por WhatsApp</h3>
                <span className="bg-emerald-400/20 text-emerald-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-300/30">
                  Evolution API
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 font-medium">
                Selecciona qué asesores recibirán su corte del día por WhatsApp
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isSending}
            className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-slate-800">
          
          {/* Selector de Horario de Corte */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2">
              <Clock size={13} className="text-teal-600" />
              Tipo de Corte Horario
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCorteHora('12:00')}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-2 cursor-pointer ${
                  corteHora === '12:00'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>🕛 Mediodía (12:00 PM)</span>
              </button>
              <button
                type="button"
                onClick={() => setCorteHora('17:00')}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-2 cursor-pointer ${
                  corteHora === '17:00'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>🕔 Cierre (5:00 PM)</span>
              </button>
            </div>
          </div>

          {/* Selector de Vendedores */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-slate-600" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Vendedores ({selectedEmails.length} de {users.length} seleccionados)
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                >
                  Todos
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                >
                  Ninguno
                </button>
              </div>
            </div>

            {loadingUsers ? (
              <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                Cargando vendedores...
              </div>
            ) : users.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No se encontraron vendedores registrados.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                {users.map(u => {
                  const emailClean = (u.email || '').toLowerCase().trim();
                  const isChecked = selectedEmails.includes(emailClean);
                  const isSergio = emailClean === 'limalopez22@gmail.com' || (u.name || '').toLowerCase().includes('sergio');

                  return (
                    <div
                      key={u.id || u.email}
                      onClick={() => toggleSelectUser(emailClean)}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer select-none ${
                        isChecked 
                          ? 'bg-emerald-50/70 border-emerald-300 text-slate-900 shadow-xs' 
                          : 'bg-white border-slate-200/90 text-slate-500 hover:bg-slate-50 opacity-75'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition ${
                          isChecked ? 'text-emerald-600' : 'text-slate-400'
                        }`}>
                          {isChecked ? <CheckSquare size={18} className="text-emerald-600" /> : <Square size={18} />}
                        </div>

                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0 border border-emerald-200">
                          {u.name ? u.name.substring(0, 2).toUpperCase() : 'VD'}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold truncate ${isChecked ? 'text-slate-900 font-extrabold' : 'text-slate-600'}`}>
                              {u.name || u.email}
                            </span>
                            {isSergio && (
                              <span className="bg-teal-100 text-teal-800 text-[9px] font-black px-1.5 py-0.2 rounded shrink-0">
                                Sergio Lima
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate flex items-center gap-2">
                            <span>{u.email}</span>
                            {u.sellerCode && <span>• Cód: {u.sellerCode}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 ml-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          u.role === 'admin' 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {u.role === 'admin' ? 'Admin' : 'Vendedor'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mensajes de Alerta / Estado */}
          {statusMessage && (
            <div className={`p-3 rounded-xl text-xs font-bold flex items-start gap-2 animate-in fade-in ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                : 'bg-red-100 text-red-900 border border-red-300'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 size={16} className="text-emerald-700 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="text-red-700 shrink-0 mt-0.5" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Footer con Botón de Envío */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            disabled={isSending}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={isSending || selectedEmails.length === 0}
            onClick={handleSend}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black px-6 py-2.5 rounded-xl text-xs shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Send size={14} className={isSending ? 'animate-spin' : ''} />
            <span>
              {isSending 
                ? 'Enviando por WhatsApp...' 
                : `🚀 Enviar por WhatsApp (${selectedEmails.length})`
              }
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
