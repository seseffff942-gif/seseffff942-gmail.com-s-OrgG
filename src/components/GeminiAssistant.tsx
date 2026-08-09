import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import { Send, Sparkles, X, Clipboard, Check, RefreshCw, AlertCircle, MessageSquare } from 'lucide-react';

interface GeminiAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GeminiLogo({ size = 24, animate = true }: { size?: number, animate?: boolean }) {
  return (
    <img 
      src="/agricovet.png" 
      alt="Agricovet" 
      width={size} 
      height={size} 
      className={`object-contain rounded-full shadow-sm ${animate ? "animate-pulse" : ""}`}
      referrerPolicy="no-referrer"
    />
  );
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

export function GeminiAssistant({ isOpen, onClose }: GeminiAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content: '¡Hola! Soy tu **Asistente Inteligente Agricovet**, potenciado por **Google Gemini**.\n\n¿En qué te puedo ayudar hoy? Algunas tareas rápidas para agilizar tu flujo de trabajo:\n- Escribir un recordatorio de cobro profesional para mandar por WhatsApp.\n- Dar detalles técnicos, dosificación y control de plagas agrícolas.\n- Recomendar productos del catálogo.'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<{ error: string; details: string } | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const quickPrompts = [
    { label: '📝 Cobro WhatsApp', text: 'Redacta un mensaje amable y persuasivo de WhatsApp para recordarle a un cliente que tiene un saldo pendiente de pago que debe ser abonado. Hazlo profesional y deja espacios para rellenar nombre y monto.' },
    { label: '🐄 Salud Ganadera', text: 'Dame recomendaciones de desparasitación y vitaminas esenciales para el ganado lechero durante temporada de lluvias.' },
    { label: '🌽 Plagas en Cultivo', text: 'Recomienda plaguicidas de tu inventario para combatir el gusano cogollero en el maíz y cuál es la dosificación típica.' },
    { label: '🐕 Simparica Trio', text: '¿Para qué sirve el producto Simparica Trio y cuál es su peso recomendado o dosificación de acuerdo al inventario?' }
  ];

  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed) return;

    setErrorStatus(null);
    const userMsg: Message = {
      id: `m-${Date.now()}-user`,
      role: 'user',
      content: trimmed
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const historyPayload = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await api.askGemini(trimmed, historyPayload);
      
      setMessages(prev => [
        ...prev,
        {
          id: `m-${Date.now()}-gemini`,
          role: 'model',
          content: res.reply
        }
      ]);
    } catch (err: any) {
      console.error(err);
      setErrorStatus({
        error: err.message || 'Error de comunicación',
        details: err.details || 'Asegúrese de que el servidor esté activo y que haya configurado su variable de entorno GEMINI_API_KEY propia.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).then(() => {
          setCopiedMessageId(id);
          setTimeout(() => setCopiedMessageId(null), 2000);
        }).catch((err) => {
          console.warn("Clipboard write failed:", err);
          fallbackCopyToClipboard(text, id);
        });
      } else {
        fallbackCopyToClipboard(text, id);
      }
    } catch (e) {
      console.warn("Clipboard write threw error:", e);
      fallbackCopyToClipboard(text, id);
    }
  };

  const fallbackCopyToClipboard = (text: string, id: string) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      // Prevent scrolling on focus
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) {
        setCopiedMessageId(id);
        setTimeout(() => setCopiedMessageId(null), 2000);
      }
    } catch (err) {
      console.error('Fallback clipboard copy failed:', err);
    }
  };

  // Basic safe formatter for markdown rendering (XSS Protection)
  const parseBoldText = (text: string, isLi: boolean = false) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return (
          <strong 
            key={i} 
            className={isLi ? "font-bold text-slate-800" : "font-bold text-slate-900"}
          >
            {part}
          </strong>
        );
      }
      return part;
    });
  };

  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      // Bullet items
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const itemContent = line.replace(/^[-*]\s+/, '');
        return (
          <li key={idx} className="ml-5 list-disc my-1 text-slate-700 leading-relaxed text-sm">
            {parseBoldText(itemContent, true)}
          </li>
        );
      }
      return (
        <p key={idx} className="my-1.5 text-slate-700 leading-relaxed text-sm">
          {parseBoldText(line, false)}
        </p>
      );
    });
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-100 animate-slide-in h-screen" id="gemini-assistant-panel">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
            <GeminiLogo size={32} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              Asistente Gemini AI
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full tracking-wider">LITE</span>
            </h2>
            <p className="text-[11px] font-semibold text-slate-400">Automatiza y agiliza tu día a día</p>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          id="close-gemini-btn"
        >
          <X size={20} />
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.map((m) => (
          <div 
            key={m.id} 
            className={`flex flex-col max-w-[85%] ${m.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
          >
            <span className="text-[10px] font-bold text-slate-400 mb-1 px-1 flex items-center gap-1">
              {m.role === 'user' ? 'Tú' : 'Gemini AI'}
            </span>
            <div 
              className={`rounded-2xl p-4 shadow-sm border text-sm relative group transition-all ${
                m.role === 'user' 
                  ? 'bg-teal-600 text-white border-teal-700 rounded-tr-none' 
                  : 'bg-white text-slate-700 border-slate-100 rounded-tl-none'
              }`}
            >
              {m.role === 'user' ? (
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              ) : (
                <div className="space-y-1">
                  {renderMessageContent(m.content)}
                </div>
              )}

              {/* Copy action for messages */}
              <button 
                onClick={() => copyToClipboard(m.content, m.id)}
                className={`absolute bottom-2 right-2 p-1.5 rounded-md bg-slate-100/10 hover:bg-slate-100/30 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm ${
                  m.role === 'model' ? 'bg-slate-50 hover:bg-slate-100 text-slate-400 group-hover:opacity-100' : ''
                }`}
                title="Copiar texto"
              >
                {copiedMessageId === m.id ? (
                  <Check size={12} className="text-emerald-500" />
                ) : (
                  <Clipboard size={12} />
                )}
              </button>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 mr-auto max-w-[80%] bg-white p-4 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm">
            <RefreshCw size={16} className="text-indigo-500 animate-spin" />
            <span className="text-xs font-semibold text-slate-400 leading-none">Pensando y consultando inventario...</span>
          </div>
        )}

        {/* Instructions / Error state for missing API Key */}
        {errorStatus && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-800 space-y-2 max-w-[95%]">
            <div className="flex items-center gap-2 font-bold text-sm">
              <AlertCircle size={18} className="text-rose-600" />
              <h3>{errorStatus.error}</h3>
            </div>
            <p className="text-xs text-rose-600 font-medium leading-relaxed">
              {errorStatus.details}
            </p>
            <div className="p-3 bg-white/70 rounded-xl border border-rose-100/50 text-[11px] font-semibold text-slate-600 space-y-1">
              <h4 className="font-bold text-slate-800">¿Cómo configurar tu API key de Gemini?</h4>
              <ol className="list-decimal list-inside space-y-1">
                <li>Consigue una API Key gratuita en Google AI Studio.</li>
                <li>Agrégala como variable de entorno <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600 font-mono">GEMINI_API_KEY</code>.</li>
                <li>¡Listo! El servidor recargará automáticamente y este chat se activará.</li>
              </ol>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Suggested chips panel (shown before inputting) */}
      <div className="p-3 bg-slate-50/50 border-t border-slate-100 overflow-x-auto whitespace-nowrap scrollbar-none flex gap-2">
        {quickPrompts.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(chip.text)}
            className="px-3 py-1.5 bg-white border border-slate-200/60 rounded-full text-xs font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0"
          >
            <Sparkles size={11} className="text-indigo-400 shrink-0" />
            {chip.label}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputMessage);
        }}
        className="p-3 border-t border-slate-100 bg-white flex items-center gap-2"
      >
        <input 
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Escribe tu duda u orden..."
          className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-400 text-sm placeholder-slate-400 font-medium transition-all"
          disabled={isLoading}
          maxLength={1000}
        />
        <button
          type="submit"
          disabled={isLoading || !inputMessage.trim()}
          className="p-3 bg-indigo-600 hover:bg-slate-800 text-white rounded-xl transition-all disabled:opacity-40 disabled:hover:bg-indigo-600 font-bold active:scale-95"
          id="send-gemini-btn"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
