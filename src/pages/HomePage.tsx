import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Leaf, User as UserIcon, CheckCircle, ArrowRight, MapPin, Lock, Unlock, Edit, Save, X, Share2, MessageCircle, Search, TrendingUp, TrendingDown, BarChart2, Calendar, Activity, DollarSign, Heart, Award, ShieldCheck, Sparkles, Layers, Volume2, VolumeX, Play, Pause, Wheat, Stethoscope, Sprout, ShoppingBag, Clock, Phone, Eye, Upload } from 'lucide-react';
import { api } from '../api';
import { cn } from '../utils';
import * as Sentry from '@sentry/react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  LineChart,
  Line
} from 'recharts';

interface HomePageProps {
  user: User;
  onChangeTab: (tab: string) => void;
  onLogout: () => void;
  isMobile: boolean;
}

export function HomePage({ user, onChangeTab, onLogout, isMobile }: HomePageProps) {
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem('app_logo_url') || '/agricovet.png');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState(() => localStorage.getItem('app_signature_url') || '');

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(img, 0, 0);
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Determine if background is light or dark by sampling corners
          const corners = [
            0, // top-left
            (canvas.width - 1) * 4, // top-right
            (canvas.height - 1) * canvas.width * 4, // bottom-left
            ((canvas.height - 1) * canvas.width + canvas.width - 1) * 4 // bottom-right
          ];
          let bgBrightnessSum = 0;
          for (const idx of corners) {
            // Only count if not fully transparent
            if (data[idx+3] > 0) {
                bgBrightnessSum += data[idx] * 0.299 + data[idx+1] * 0.587 + data[idx+2] * 0.114;
            } else {
                bgBrightnessSum += 255; // assume transparent is light bg
            }
          }
          const isDarkBg = (bgBrightnessSum / 4) < 128;
          
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            if (a === 0) continue;
            
            // Calculate brightness
            const brightness = r * 0.299 + g * 0.587 + b * 0.114;
            let newAlpha = a;
            
            if (isDarkBg) {
                // Dark background: Keep light pixels (signature), make dark pixels transparent
                if (brightness > 120) {
                    newAlpha = 255;
                } else if (brightness < 40) {
                    newAlpha = 0;
                } else {
                    newAlpha = Math.max(0, Math.min(255, (brightness - 40) * (255 / 80)));
                }
            } else {
                // Light background: Keep dark pixels (signature), make light pixels transparent
                if (brightness < 140) {
                    newAlpha = 255;
                } else if (brightness > 220) {
                    newAlpha = 0;
                } else {
                    newAlpha = Math.max(0, Math.min(255, (220 - brightness) * (255 / 80)));
                }
            }
            newAlpha = (newAlpha * a) / 255;

            // Paint the signature pure white
            data[i] = 255;     // White R
            data[i + 1] = 255; // White G
            data[i + 2] = 255; // White B
            data[i + 3] = newAlpha;
          }
          
          ctx.putImageData(imageData, 0, 0);
          canvas.toBlob(async (blob) => {
            if (blob) {
              const processedFile = new File([blob], 'signature.png', { type: 'image/png' });
              try {
                // Show local preview immediately
                const processedDataUrl = canvas.toDataURL('image/png');
                setSignatureUrl(processedDataUrl);
                localStorage.setItem('app_signature_url', processedDataUrl);
                
                // Upload to server
                const res = await api.uploadAppSignature(processedFile);
                if (res && res.signatureUrl) {
                  setSignatureUrl(res.signatureUrl);
                  localStorage.setItem('app_signature_url', res.signatureUrl);
                  // Update warehouse config to persist it
                  await api.updateWarehouseConfig({ signatureUrl: res.signatureUrl });
                }
              } catch (err: any) {
                console.error("Failed to upload signature:", err);
                alert("Error al guardar la firma en el servidor: " + (err.message || err));
              }
            }
          }, 'image/png');
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [isWarehouseUnlocked, setIsWarehouseUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isPasswordError, setIsPasswordError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLocation, setEditLocation] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [waToken, setWaToken] = useState('');
  const [waPhoneId, setWaPhoneId] = useState('');
  const [waUrl, setWaUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isChartsLoading, setIsChartsLoading] = useState(true);
  const [dashboardViewMode, setDashboardViewMode] = useState<'global' | 'mine'>('global');
  const [isViewModeModalOpen, setIsViewModeModalOpen] = useState(false);
  
  // Interactive background video state for modern agroveterinary landing page
  const [activeVideoCategory, setActiveVideoCategory] = useState<'vet' | 'nutri' | 'agri'>('vet');
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);

  // Background Music States and Refs
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.20); // default to 20% volume
  const [activeMusicTrack, setActiveMusicTrack] = useState<'synth' | 'nature' | 'relax'>('synth');

  const audioContextRef = React.useRef<AudioContext | null>(null);
  const synthNodesRef = React.useRef<any[]>([]);
  const audioPlayerRef = React.useRef<HTMLAudioElement | null>(null);
  const synthIntervalRef = React.useRef<any>(null);

  const startSynthMusic = () => {
    try {
      stopSynthMusic();
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const chords = [
        [130.81, 164.81, 196.00, 246.94], // C3, E3, G3, B3 -> Cmaj7
        [98.00, 146.83, 196.00, 246.94],  // G2, D3, G3, B3 -> G
        [87.31, 130.81, 174.61, 220.00],  // F2, C3, F3, A3 -> Fmaj7
        [110.00, 164.81, 220.00, 261.63]  // A2, E3, A3, C4 -> Am7
      ];
      
      let chordIndex = 0;

      const playNextChord = () => {
        if (!audioContextRef.current || audioContextRef.current.state === 'suspended') return;
        
        const now = audioContextRef.current.currentTime;
        const currentChord = chords[chordIndex];
        
        currentChord.forEach((freq, idx) => {
          if (!audioContextRef.current) return;
          const osc = audioContextRef.current.createOscillator();
          const gainNode = audioContextRef.current.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq + (Math.random() * 0.4 - 0.2), now);
          
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime((musicVolume * 0.05) / currentChord.length, now + 2.5);
          gainNode.gain.setValueAtTime((musicVolume * 0.05) / currentChord.length, now + 5.5);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 9);
          
          osc.connect(gainNode);
          gainNode.connect(audioContextRef.current.destination);
          
          osc.start(now);
          osc.stop(now + 9.5);
          
          synthNodesRef.current.push({ osc, gainNode });
        });
        
        chordIndex = (chordIndex + 1) % chords.length;
      };

      playNextChord();
      synthIntervalRef.current = setInterval(playNextChord, 8000);
    } catch (e) {
      console.error("Failed to start synth music", e);
    }
  };

  const stopSynthMusic = () => {
    if (synthIntervalRef.current) {
      clearInterval(synthIntervalRef.current);
      synthIntervalRef.current = null;
    }
    
    if (synthNodesRef.current) {
      synthNodesRef.current.forEach(n => {
        try {
          n.osc.stop();
        } catch(e){}
      });
      synthNodesRef.current = [];
    }
    
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch(e) {}
      audioContextRef.current = null;
    }
  };

  useEffect(() => {
    if (isPlayingMusic) {
      if (activeMusicTrack === 'synth') {
        if (audioPlayerRef.current) {
          audioPlayerRef.current.pause();
        }
        startSynthMusic();
      } else {
        stopSynthMusic();
        
        if (!audioPlayerRef.current) {
          audioPlayerRef.current = new Audio();
          audioPlayerRef.current.loop = true;
        }
        
        const urls = {
          nature: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
          relax: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
        };
        
        audioPlayerRef.current.src = urls[activeMusicTrack as 'nature' | 'relax'];
        audioPlayerRef.current.volume = musicVolume;
        
        audioPlayerRef.current.play().catch(e => {
          console.warn("Autoplay block or loading error:", e);
        });
      }
    } else {
      stopSynthMusic();
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    }
    
    return () => {
      stopSynthMusic();
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, [isPlayingMusic, activeMusicTrack]);

  useEffect(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.volume = musicVolume;
    }
    synthNodesRef.current.forEach(n => {
      try {
        n.gainNode.gain.setValueAtTime((musicVolume * 0.05) / 4, audioContextRef.current?.currentTime || 0);
      } catch(e){}
    });
  }, [musicVolume]);

  const agroveterinaryCategories = [
    {
      id: 'vet' as const,
      title: 'Salud & Medicina Veterinaria',
      subtitle: 'Salud y Cuidado Profesional',
      badge: 'FÁRMACOS Y VACUNAS',
      heading: 'Soluciones Fármaco-Veterinarias Certificadas',
      description: 'Garantizamos la salud y resiliencia de su ganado mayor y menor, aves y mascotas. Ofrecemos antibióticos formulados, desparasitantes y vacunas de alta calidad con cadena de frío estrictamente supervisada, respaldados por asesoría de médicos veterinarios especializados.',
      videoUrl: 'https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3c025f73d7885d4be1629ab122cb4341b&profile_id=139&oauth2_token_id=57447761',
      fallbackImg: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?q=80&w=2070&auto=format&fit=crop',
      features: [
        { label: 'Vacunas y Cadena de Frío', desc: 'Sistemas rigurosos que aseguran la máxima potencia activa de los biológicos.' },
        { label: 'Especialidades Farmacológicas', desc: 'Antibióticos de amplio espectro, desparasitantes y vitaminas concentradas.' },
        { label: 'Apoyo Médico Clínico', desc: 'Diagnósticos profesionales rápidos y visitas asistenciales a granjas.' }
      ],
      stats: { primary: '100% Calidad', secondary: 'Medicamentos Certificados' }
    },
    {
      id: 'nutri' as const,
      title: 'Nutrición de Alto Rendimiento',
      subtitle: 'Conversión y Crecimiento Rápido',
      badge: 'ALIMENTOS Y SALES MINERALES',
      heading: 'Alimentos Balanceados y Concentrados Especiales',
      description: 'Optimice los niveles de rentabilidad de sus animales de campo. Desarrollamos sales minerales y premezclados biológicos para maximizar la conversión en carne y la recolección de leche con resultados científicamente probados.',
      videoUrl: 'https://player.vimeo.com/external/403848141.sd.mp4?s=fd49e3bf3ebcfbd58fe2dc91a5c6dce8869ec89e&profile_id=165&oauth2_token_id=57447761',
      fallbackImg: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?q=80&w=2070&auto=format&fit=crop',
      features: [
        { label: 'Sales de Formulación Precisa', desc: 'Micronutrientes seleccionados de acuerdo a la deficiencia mineral del suelo.' },
        { label: 'Premezclas de Engorde', desc: 'Complementos ricos en proteínas orgánicas para un desarrollo óptimo.' },
        { label: 'Formulación de Pastizales', desc: 'Asesoramiento técnico para potenciar la asimilación digestiva.' }
      ],
      stats: { primary: '+25% Ventajas', secondary: 'De Rendimiento Lácteo y de Peso' }
    },
    {
      id: 'agri' as const,
      title: 'Fitosanitarios & Nutrición Vegetal',
      subtitle: 'Cosechas Sanas e Inmunes',
      badge: 'BIOESTIMULANTES Y SEMILLAS',
      heading: 'Blindaje Fitosanitario de Alta Densidad',
      description: 'Línea completa de bioestimulantes, coadyuvantes, herbicidas y semillas híbridas certificadas de óptimo potencial genético. Soluciones para blindar sus cultivos contra el estrés por sequía o ataques críticos de plagas.',
      videoUrl: 'https://player.vimeo.com/external/435674703.sd.mp4?s=6f41162444372ec0b85298711c470a1ed314e304&profile_id=165&oauth2_token_id=57447761',
      fallbackImg: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2689&auto=format&fit=crop',
      features: [
        { label: 'Bioestimulación Celular', desc: 'Precursores metabólicos para acelerar floraciones abundantes.' },
        { label: 'Inoculantes y Fertilizantes', desc: 'Fungicidas de baja dosificación y excelente fijación foliar.' },
        { label: 'Multiplicación Genética', desc: 'Semillas resistentes de alta pureza física y vigor vegetativo.' }
      ],
      stats: { primary: '3x Rendimiento', secondary: 'Eficiencia de Zonas de Cultivo' }
    }
  ];

  const currentCategoryData = agroveterinaryCategories.find(c => c.id === activeVideoCategory) || agroveterinaryCategories[0];

  useEffect(() => {
    fetchWarehouseConfig();
    if (user.role === 'admin') {
      fetchWaConfig();
    }
    fetchInvoicesForDashboard();
  }, [user.role, user.email, dashboardViewMode]);

  const fetchInvoicesForDashboard = async () => {
    setIsChartsLoading(true);
    try {
      let sellerId: string | undefined = undefined;
      if (dashboardViewMode === 'mine') {
        sellerId = user.email;
      } else {
        sellerId = user.role === 'admin' ? undefined : 'global';
      }
      const data = await api.getInvoices(sellerId);
      setInvoices(data || []);
    } catch (e) {
      console.error("Error fetching invoices for dashboard:", e);
    } finally {
      setIsChartsLoading(false);
    }
  };

  const fetchWaConfig = async () => {
    try {
      const data = await api.getWhatsAppConfig();
      setWaToken(data.waToken || '');
      setWaPhoneId(data.waPhoneId || '');
      setWaUrl(data.waUrl || '');
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWarehouseConfig = async () => {
    try {
      const data = await api.getWarehouseConfig() as any;
      setWarehouseLocation(data.location || 'Ubicación no establecida.');
      setEditLocation(data.location || '');
      if (data.logoUrl) {
        setLogoUrl(data.logoUrl);
        setEditLogoUrl(data.logoUrl);
        localStorage.setItem('app_logo_url', data.logoUrl);
      }
      if (data.signatureUrl) {
        setSignatureUrl(data.signatureUrl);
        localStorage.setItem('app_signature_url', data.signatureUrl);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    try {
      const res = await api.uploadAppLogo(file);
      if (res && res.logoUrl) {
        setLogoUrl(res.logoUrl);
        setEditLogoUrl(res.logoUrl);
        localStorage.setItem('app_logo_url', res.logoUrl);
        alert('Logo corporativo cargado y guardado exitosamente.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error al subir el logo: ' + (err.message || err));
    } finally {
      setLogoUploading(false);
    }
  };

  const handleShareWhatsApp = async () => {
    const loc = warehouseLocation || "Ubicación no establecida.";
    const text = `📦 *AGRICCOVET - Ubicación de Bodega*\n\nNuestra bodega se encuentra en:\n_${loc}_\n\nPuedes verla en Google Maps aquí:\nhttps://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    
    // Open WhatsApp
    window.open(url, '_blank');
    
    // Notify via Email
    try {
      await api.notifyWarehouseShare();
    } catch (err) {
      console.error("Error sending share notification:", err);
    }
  };

  const handleUnlock = async () => {
    setIsLoading(true);
    setIsPasswordError(false);
    try {
      const res = await api.verifyWarehousePassword(passwordInput);
      if (res && res.success) {
        setIsWarehouseUnlocked(true);
        setWarehouseLocation(res.location || "Ubicación no establecida.");
      } else {
        setIsPasswordError(true);
      }
    } catch (err) {
      setIsPasswordError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsLoading(true);
    try {
      await api.updateWarehouseConfig({ 
        location: editLocation, 
        password: editPassword || undefined,
        logoUrl: editLogoUrl || undefined
      });
      await api.updateWhatsAppConfig({
        waToken,
        waPhoneId,
        waUrl
      });
      setWarehouseLocation(editLocation);
      if (editLogoUrl) {
        setLogoUrl(editLogoUrl);
        localStorage.setItem('app_logo_url', editLogoUrl);
      }
      setIsEditing(false);
      setEditPassword('');
      alert('Configuración actualizada (Bodega, WhatsApp y Logo).');
    } catch (err) {
      alert('Error al guardar configuración.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetGeolocation = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización.');
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setEditLocation(`${latitude}, ${longitude}`);
        setIsLoading(false);
        alert('Ubicación obtenida con éxito (Coordenadas).');
      },
      (error) => {
        setIsLoading(false);
        console.error(error);
        alert('No se pudo obtener la ubicación. Asegúrate de dar permisos.');
      },
      { enableHighAccuracy: true }
    );
  };

  const navLinks = [
    { id: 'inventory', label: 'Inventario' },
    { id: 'sales', label: 'Ventas' },
    { id: 'billing', label: 'Facturación' },
    { id: 'team', label: 'Equipo' },
  ];

  // Computation of stats and charts data based on invoices
  const validInvoices = invoices.filter(inv => inv.status !== 'cancelled' && inv.status !== 'rejected');
  
  const getLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const matchesTargetDate = (dateStr: string | null | undefined, target: string) => {
    if (!dateStr || !target) return false;
    if (dateStr.startsWith(target)) return true;
    try {
      const d = new Date(dateStr);
      const adjusted = new Date(d.getTime() - (6 * 60 * 60 * 1000));
      return adjusted.toISOString().split('T')[0] === target;
    } catch {
      return false;
    }
  };

  const today = new Date();
  
  // Monday of this week
  const startOfThisWeek = new Date(today);
  const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
  startOfThisWeek.setDate(diffToMonday);
  startOfThisWeek.setHours(0, 0, 0, 0);

  // Monday of last week
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  const barChartData = DAYS_OF_WEEK.map((dayName, index) => {
    const thisWeekDay = new Date(startOfThisWeek);
    thisWeekDay.setDate(thisWeekDay.getDate() + index);
    const thisWeekDayStr = getLocalDateString(thisWeekDay);

    const lastWeekDay = new Date(startOfLastWeek);
    lastWeekDay.setDate(lastWeekDay.getDate() + index);
    const lastWeekDayStr = getLocalDateString(lastWeekDay);

    const thisWeekSales = validInvoices
      .filter(inv => matchesTargetDate(inv.date, thisWeekDayStr))
      .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);

    const lastWeekSales = validInvoices
      .filter(inv => matchesTargetDate(inv.date, lastWeekDayStr))
      .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);

    return {
      name: dayName,
      'Esta Semana': Number(thisWeekSales.toFixed(2)),
      'Semana Pasada': Number(lastWeekSales.toFixed(2))
    };
  });

  const thisWeekTotal = barChartData.reduce((sum, d) => sum + d['Esta Semana'], 0);
  const lastWeekTotal = barChartData.reduce((sum, d) => sum + d['Semana Pasada'], 0);
  const weeklyDiffPercent = lastWeekTotal > 0 
    ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100 
    : 0;

  // Monthly Data: Daily trend during the last month (30 days)
  const lineChartData = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStr = getLocalDateString(d);
    const formattedDay = `${d.getDate()}/${d.getMonth() + 1}`;

    const daySales = validInvoices
      .filter(inv => matchesTargetDate(inv.date, dayStr))
      .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);

    lineChartData.push({
      dateStr: dayStr,
      label: formattedDay,
      Ventas: Number(daySales.toFixed(2))
    });
  }

  const monthlyTotal = lineChartData.reduce((sum, d) => sum + d.Ventas, 0);
  const monthlyAvg = monthlyTotal / 30;

  // Find strongest day in the last 30 days
  let strongestDay = { label: 'Ninguno', Ventas: 0 };
  lineChartData.forEach(d => {
    if (d.Ventas > strongestDay.Ventas) {
      strongestDay = { label: d.label, Ventas: d.Ventas };
    }
  });

  return (
    <div className="flex flex-col font-sans h-full bg-surface">
      <main className="flex-1 overflow-auto">
        {/* Dynamic Video Background Hero Section */}
        <section className="relative min-h-[640px] md:min-h-[700px] text-white overflow-hidden flex flex-col justify-between">
          
          {/* Video / Fallback Wrapper */}
          <div className="absolute inset-0 z-0">
            {/* Fallback high-resolution cover image */}
            <div 
              className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
              style={{ backgroundImage: `url(${currentCategoryData.fallbackImg})` }}
            />
            {/* Dynamic continuous video loop */}
            {isVideoPlaying && (
              <video
                key={currentCategoryData.videoUrl}
                autoPlay
                loop
                muted={isMuted}
                playsInline
                className="absolute inset-0 w-full h-full object-cover opacity-85 transition-opacity duration-1000"
              >
                <source src={currentCategoryData.videoUrl} type="video/mp4" />
              </video>
            )}
            {/* Beautiful modern gradient overlays for guaranteed text contrast and elegance */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#051c10] via-black/60 to-black/50 z-1" />
            <div className="absolute inset-0 bg-radial-at-t from-transparent via-transparent to-[#051c10]/85 z-1" />
          </div>

          {/* Top Bar inside hero to control video playback and ambient music */}
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 border border-white/10 py-1.5 rounded-full text-xs font-semibold tracking-wider text-emerald-300">
              <Sparkles size={14} className="text-emerald-400" />
              <span>EXPERIENCIA INMERSIVA</span>
            </div>
            
            {/* Integrated Media & Gentle Ambient Player */}
            <div className="flex flex-wrap items-center gap-2.5 bg-black/50 backdrop-blur-md px-4 py-2 rounded-2xl sm:rounded-full border border-white/10 shadow-lg max-w-full justify-center">
              <div className="flex items-center gap-1.5 pr-1.5 border-r border-white/10">
                <Volume2 size={14} className={isPlayingMusic ? "text-emerald-400 animate-pulse" : "text-slate-400"} />
                <span className="text-[10px] font-black uppercase tracking-widest text-[#a7f3d0] mr-1">Música:</span>
                
                <button
                  type="button"
                  onClick={() => setIsPlayingMusic(!isPlayingMusic)}
                  className={`p-1 px-2.5 rounded-lg text-[10px] font-extrabold cursor-pointer flex items-center gap-1 transition-all ${
                    isPlayingMusic 
                      ? 'bg-emerald-600/80 hover:bg-emerald-600 text-white shadow shadow-emerald-950/50 scale-105' 
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                  }`}
                  title={isPlayingMusic ? "Pausar música suave de fondo" : "Reproducir música suave de fondo"}
                >
                  {isPlayingMusic ? <Pause size={10} /> : <Play size={10} />}
                  <span>{isPlayingMusic ? 'Activa' : 'Iniciar'}</span>
                </button>

                <select 
                  value={activeMusicTrack}
                  onChange={(e) => {
                    setActiveMusicTrack(e.target.value as any);
                    setIsPlayingMusic(true);
                  }}
                  className="bg-black/60 text-white text-[10px] px-1.5 py-1 rounded-md border border-white/10 font-bold outline-none cursor-pointer focus:ring-1 focus:ring-emerald-500/50 text-center notranslate"
                  translate="no"
                >
                  <option value="synth">⛺ Sintetizador Brisa</option>
                  <option value="nature">🎸 Guitarra de Campo</option>
                  <option value="relax">🎹 Piano Atardecer</option>
                </select>

                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={musicVolume}
                  onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                  className="w-10 h-1 accent-emerald-400 bg-white/20 rounded-lg appearance-none cursor-pointer hidden md:inline-block ml-1"
                  title={`Volumen música: ${Math.round(musicVolume * 100)}%`}
                />
              </div>

              {/* Video control buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                  className="p-1 px-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/5 hover:border-emerald-500/20 text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer"
                  title={isVideoPlaying ? "Pausar video de fondo" : "Reproducir video de fondo"}
                >
                  {isVideoPlaying ? <Pause size={10} /> : <Play size={10} />}
                  <span>Video</span>
                </button>
                <button
                  className="p-1 px-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/5 hover:border-emerald-500/20 text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer"
                  onClick={() => setIsMuted(!isMuted)}
                  title={isMuted ? "Activar audio de video" : "Silenciar audio de video"}
                >
                  {isMuted ? <VolumeX size={10} /> : <Volume2 size={10} className="text-emerald-400 animate-pulse" />}
                  <span>{isMuted ? "Mute" : "Audio"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 py-12 md:py-20 my-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Text and Features Grid */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Animated badge */}
              <div className="inline-flex items-center gap-2 bg-[#0b4d2c]/65 backdrop-blur-md px-4 py-1.5 rounded-full border border-emerald-500/30 text-xs font-black tracking-widest text-emerald-300 uppercase">
                <Layers size={14} />
                <span>{currentCategoryData.badge}</span>
              </div>

              {/* Outstanding Main Title */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight tracking-tight text-white drop-shadow-sm">
                Agricovet: <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-100">{currentCategoryData.heading}</span>
              </h1>

              {/* Dynamic Description */}
              <p className="text-base md:text-lg text-slate-100 font-medium leading-relaxed max-w-2xl">
                {currentCategoryData.description}
              </p>

              {/* Interactive visual bullet points */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {currentCategoryData.features.map((feat, idx) => (
                  <div key={idx} className="bg-black/35 backdrop-blur-sm p-4 rounded-xl border border-white/5 hover:border-emerald-500/20 transition-all duration-300">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="text-emerald-400 shrink-0" size={16} />
                      <h4 className="font-extrabold text-sm text-white">{feat.label}</h4>
                    </div>
                    <p className="text-xs text-slate-300/90 leading-relaxed pl-5">{feat.desc}</p>
                  </div>
                ))}
              </div>

              {/* Main Call to Action buttons */}
              <div className="flex flex-wrap gap-4 pt-4">
                <button 
                  onClick={() => onChangeTab('inventory')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-xl shadow-emerald-950/40 text-sm md:text-base border border-emerald-500/20 flex items-center gap-2 cursor-pointer"
                >
                  <ShoppingBag size={18} /> Explorar Catálogo de Insumos
                </button>
                <a 
                  href="#sales-performance-dashboard"
                  className="bg-white/10 hover:bg-white/15 backdrop-blur-md text-white border border-white/20 px-8 py-4 rounded-xl font-bold transition-all text-sm md:text-base flex items-center gap-2 cursor-pointer"
                >
                  <BarChart2 size={18} className="text-emerald-300" /> Ver Rendimiento Comercial
                </a>
              </div>
            </div>

            {/* Right Side interactive features and quick stats card (Glassmorphic) */}
            <div className="lg:col-span-5 flex flex-col justify-center">
              <div className="bg-black/45 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/10 shadow-2xl space-y-6">
                <div>
                  <h3 className="font-black text-white text-lg tracking-tight">Estadística de Impacto</h3>
                  <p className="text-xs text-slate-400">Verificado en campo por Agricovet</p>
                </div>

                {/* Big Stat display */}
                <div className="bg-gradient-to-br from-emerald-950/40 to-teal-950/20 rounded-2xl p-6 border border-emerald-500/10 flex items-center justify-between">
                  <div>
                    <span className="text-4xl md:text-5xl font-black text-emerald-300 font-mono tracking-tight">{currentCategoryData.stats.primary}</span>
                    <p className="text-[11px] text-slate-300 font-bold uppercase tracking-wider mt-1">{currentCategoryData.stats.secondary}</p>
                  </div>
                  <div className="p-4 bg-emerald-500/15 text-emerald-400 rounded-2xl border border-emerald-500/20 animate-pulse">
                    <ShieldCheck size={28} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-amber-400 shrink-0" size={16} />
                    <span className="text-xs font-black text-slate-300 uppercase tracking-widest">NUESTRO COMPROMISO</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    Brindamos soporte veterinario y fitopatológico inmediato. Cada insumo comercializado cuenta con registro sanitario oficial, asegurando la inocuidad y máxima asimilación biológica en cada dosis aplicada.
                  </p>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 font-extrabold">
                  <span>REGISTRO OFICIAL MAGA / MINECO</span>
                  <span className="text-emerald-400">VALIDADO 2026</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Navigation Panel */}
          <div className="relative z-10 w-full bg-slate-950/80 backdrop-blur-lg border-t border-white/10 py-4 px-6">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
              <span className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                <Layers size={14} className="animate-pulse" />
                Líneas Clave de Agricovet (Haz clic para alternar el fondo y especificaciones):
              </span>
              
              <div className="flex flex-wrap justify-center gap-2 w-full md:w-auto">
                <button
                  onClick={() => setActiveVideoCategory('vet')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                    activeVideoCategory === 'vet' 
                      ? 'bg-emerald-600 border border-emerald-500 text-white shadow-lg shadow-emerald-900/40 scale-105 animate-pulse' 
                      : 'bg-white/5 border border-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Heart size={14} className={activeVideoCategory === 'vet' ? "text-white" : "text-emerald-400"} />
                  <span>Cuidado Animal</span>
                </button>

                <button
                  onClick={() => setActiveVideoCategory('nutri')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                    activeVideoCategory === 'nutri' 
                      ? 'bg-emerald-600 border border-emerald-500 text-white shadow-lg shadow-emerald-900/40 scale-105 animate-pulse' 
                      : 'bg-white/5 border border-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Award size={14} className={activeVideoCategory === 'nutri' ? "text-white" : "text-emerald-400"} />
                  <span>Nutrición & Conversión</span>
                </button>

                <button
                  onClick={() => setActiveVideoCategory('agri')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                    activeVideoCategory === 'agri' 
                      ? 'bg-emerald-600 border border-emerald-500 text-white shadow-lg shadow-emerald-900/40 scale-105 animate-pulse' 
                      : 'bg-white/5 border border-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Sprout size={14} className={activeVideoCategory === 'agri' ? "text-white" : "text-emerald-400"} />
                  <span>Cultivos & Fitosanitarios</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Sales & Performance Dashboard Section */}
        <section className="py-16 px-6 max-w-5xl mx-auto border-b border-slate-200" id="sales-performance-dashboard">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
            <div>
              <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                <BarChart2 className="text-[#0b4d2c]" size={36} />
                Panel de Control y Ventas
              </h2>
              <p className="text-sm text-slate-500 mt-1 font-medium">
                {user.role === 'admin' 
                  ? 'Análisis comercial global de Agricovet comparando el rendimiento de venta semana tras semana' 
                  : `Visualizando ventas ${dashboardViewMode === 'global' ? 'globales de la empresa' : 'personales'}`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 self-start md:self-auto">
              <div className="flex items-center gap-2 bg-slate-100/80 border border-slate-200 px-4 py-2 rounded-xl text-xs font-black text-slate-600">
                 <Calendar size={16} className="text-[#0b4d2c]" />
                 <span>En tiempo real: {today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
              </div>
              <button
                onClick={() => setIsViewModeModalOpen(true)}
                className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm transition-all"
              >
                <Layers size={14} className="text-teal-600" />
                Cambiar Vista ({dashboardViewMode === 'global' ? 'Global' : 'Mis Ventas'})
              </button>
            </div>
          </div>

          {isChartsLoading ? (
            <div className="space-y-8 animate-pulse">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="bg-slate-100 h-28 rounded-2xl"></div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-100 h-96 rounded-3xl"></div>
                <div className="bg-slate-100 h-96 rounded-3xl"></div>
              </div>
            </div>
          ) : (
            <>
              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {/* Stat 1: This Week */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-teal-500/40 hover:shadow-md transition-all duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Esta Semana</span>
                    <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                      <DollarSign size={16} />
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 font-mono">Q{thisWeekTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                  <div className="flex items-center gap-1.5 mt-2">
                    {weeklyDiffPercent >= 0 ? (
                      <span className="text-xs font-black text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded">
                        <TrendingUp size={14} /> +{weeklyDiffPercent.toFixed(1)}%
                      </span>
                     ) : (
                      <span className="text-xs font-black text-rose-600 flex items-center gap-0.5 bg-rose-50 px-1.5 py-0.5 rounded">
                        <TrendingDown size={14} /> {weeklyDiffPercent.toFixed(1)}%
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-bold">vs. anterior</span>
                  </div>
                </div>

                {/* Stat 2: Last Week */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-teal-500/40 hover:shadow-md transition-all duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Semana Pasada</span>
                    <div className="p-2 bg-slate-50 text-slate-600 rounded-xl">
                      <Calendar size={16} />
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 font-mono">Q{lastWeekTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                  <p className="text-[10px] text-slate-400 mt-3 font-semibold uppercase tracking-wider">Lunes a Domingo previo</p>
                </div>

                {/* Stat 3: Month Total */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-teal-500/40 hover:shadow-md transition-all duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Últimos 30 Días</span>
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Activity size={16} />
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 font-mono">Q{monthlyTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                  <p className="text-[10px] text-slate-400 mt-3 font-semibold">Promedio Diario: Q{monthlyAvg.toFixed(2)}</p>
                </div>

                {/* Stat 4: Best Day */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-teal-500/40 hover:shadow-md transition-all duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Día Pico (30D)</span>
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                      <Leaf size={16} />
                    </div>
                  </div>
                  <h3 className="text-base font-black text-slate-800 truncate">Día: {strongestDay.label}</h3>
                  <div className="flex items-center gap-1.5 mt-2.5">
                    <span className="text-xs font-black text-amber-600 font-mono bg-amber-50 px-1.5 py-0.5 rounded">Q{strongestDay.Ventas.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-400 font-bold">Venta más alta</span>
                  </div>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
                {/* Bar Chart */}
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
                  <div className="mb-6">
                    <h3 className="font-extrabold text-[#0b3b2c] text-sm flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
                      Comparativa de Ventas: Esta Semana vs. Semana Pasada
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">Ventas distribuidas día a día de lunes a domingo</p>
                  </div>
                  <div className="flex-1 text-xs" style={{ minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                        <RechartsTooltip formatter={(value) => [`Q ${Number(value).toLocaleString()}`, '']} />
                        <RechartsLegend verticalAlign="top" height={36} iconType="circle" />
                        <Bar name="Esta Semana" dataKey="Esta Semana" fill="#0b4d2c" radius={[4, 4, 0, 0]} />
                        <Bar name="Semana Pasada" dataKey="Semana Pasada" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Line Chart */}
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
                  <div className="mb-6">
                    <h3 className="font-extrabold text-[#0b3b2c] text-sm flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
                      Tendencia de Ventas (Último Mes)
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">Seguimiento cronológico acumulado por día de calendario</p>
                  </div>
                  <div className="flex-1 text-xs" style={{ minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lineChartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                        <RechartsTooltip formatter={(value) => [`Q ${Number(value).toLocaleString()}`, 'Ventas']} />
                        <Line type="monotone" name="Monto del Día" dataKey="Ventas" stroke="#0b4d2c" strokeWidth={3.5} dot={{ r: 2, fill: '#0b4d2c' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              
              {/* Pattern analysis note */}
              <div className="bg-[#0b4d2c]/5 border border-[#0b4d2c]/10 rounded-2xl p-5 flex items-start gap-3.5 mb-2">
                <div className="p-2 bg-white rounded-xl text-[#0b4d2c] shadow-sm shrink-0">
                  <Leaf size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-[#0b3b2c] uppercase tracking-wider">Identificador de Patrones y Temporalidad</h4>
                  <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
                    El comportamiento de las ventas totales refleja los ciclos agropecuarios y de distribución interna. Los picos mensuales suelen coincidir con los abastecimientos programados de agroquímicos y vacunas veterinarias. Analice la tendencia diaria para anticipar la carga en bodega, coordinar despachos y asignar personal en los días de mayor movimiento comercial.
                  </p>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Warehouse Location Section */}
        <section className="py-20 px-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-3xl font-black text-slate-800">Ubicación de Bodega</h2>
            {user.role === 'admin' && (
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-2 text-teal-600 font-bold hover:text-teal-700 transition-colors"
              >
                {isEditing ? <><X size={20} /> Cancelar</> : <><Edit size={20} /> Editar Configuración</>}
              </button>
            )}
          </div>

          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 mb-12">
            {isEditing && user.role === 'admin' ? (
              <div className="p-10 space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Ubicación Detallada</label>
                    <div className="flex gap-2">
                       <button 
                         onClick={handleGetGeolocation}
                         className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg text-[11px] font-black border border-teal-100 hover:bg-teal-100 transition-colors"
                       >
                         <MapPin size={14} /> Tomar Mi GPS
                       </button>
                       <a 
                         href="https://www.google.com/maps"
                         target="_blank"
                         rel="noopener noreferrer"
                         className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg text-[11px] font-black border border-slate-100 hover:bg-slate-100 transition-colors"
                       >
                         <Search size={14} /> Abrir Google Maps
                       </a>
                    </div>
                  </div>
                  <textarea 
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Describe la ubicación exacta o pega las coordenadas aquí..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 min-h-[150px] outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-slate-700 font-medium"
                  />
                  <p className="text-[10px] text-slate-400 font-bold">
                    * Puedes escribir una dirección manual o usar el GPS para capturar coordenadas exactas.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Nueva Contraseña de Acceso (Opcional)</label>
                  <input 
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Deja vacío para mantener la actual..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-slate-700 font-bold"
                  />
                </div>
                
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl space-y-4">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1">Logotipo de la Empresa</span>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">
                    Sube una imagen (PNG o JPG) de tu logotipo corporativo a Supabase Storage, o escribe una URL directa. Se aplicará a la cabecera del sistema, pantalla de inicio de sesión y plantillas de impresión PDF.
                  </p>
                  
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* Preview Panel */}
                    <div className="w-24 h-24 rounded-2xl border border-slate-200 bg-white p-2 flex items-center justify-center relative overflow-hidden shrink-0 shadow-sm">
                      <img 
                        src={editLogoUrl || logoUrl || '/agricovet.png'} 
                        alt="Preview Logo" 
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/150?text=No+Logo'; }}
                      />
                    </div>

                    <div className="flex-1 w-full space-y-3">
                      {/* File Upload Box */}
                      <div className="relative">
                        <label className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-dashed border-slate-300 hover:border-teal-500 hover:bg-teal-50/20 rounded-2xl text-xs font-bold text-slate-600 cursor-pointer transition-all active:scale-98">
                          {logoUploading ? 'Subiendo Logo...' : 'Sube tu logotipo (PNG/JPG)'}
                          <input 
                            type="file"
                            accept="image/*"
                            onChange={handleLogoFileChange}
                            disabled={logoUploading}
                            className="hidden"
                          />
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase">o</span>
                        <hr className="flex-1 border-slate-200" />
                      </div>

                      {/* Manual URL Input */}
                      <div>
                        <input 
                          type="text"
                          value={editLogoUrl}
                          onChange={(e) => setEditLogoUrl(e.target.value)}
                          placeholder="URL de imagen directa (ej: https://...)"
                          className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-slate-600 font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <hr className="border-slate-200" />
                <h3 className="font-black text-slate-800 text-lg">Configuración de WhatsApp API (Meta Cloud)</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">WhatsApp Token (Access Token)</label>
                    <input 
                      type="text"
                      value={waToken}
                      onChange={(e) => setWaToken(e.target.value)}
                      placeholder="EAAG... (Déjalo vacío para usar el del archivo .env)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-slate-700 max-w-full text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Phone Number ID (ID del Número)</label>
                    <input 
                      type="text"
                      value={waPhoneId}
                      onChange={(e) => setWaPhoneId(e.target.value)}
                      placeholder="1234567890..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-slate-700 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">WhatsApp API URL (Opcional, default graph.facebook.com)</label>
                    <input 
                      type="text"
                      value={waUrl}
                      onChange={(e) => setWaUrl(e.target.value)}
                      placeholder="https://graph.facebook.com/v19.0/"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-slate-700"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">Diagnóstico y Sentry</span>
                  <div className="p-6 bg-red-50/50 border border-red-100 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-800 text-sm">Prueba de Integración Sentry</h4>
                      <p className="text-xs text-slate-500 max-w-lg font-medium leading-relaxed">
                        Envía un registro y lanza un error intencional para verificar la captura y rastreo de errores en tiempo real en tu dashboard de Sentry.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        // Send a log before throwing the error
                        Sentry.logger.info('User triggered test error', {
                          event: 'test_error_button_click',
                        });
                        // Send a test metric before throwing the error
                        Sentry.metrics.count('test_counter', 1);
                        throw new Error('This is your first error!');
                      }}
                      className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all text-xs uppercase tracking-wider cursor-pointer shadow-md shadow-red-500/10 shrink-0 self-start sm:self-center"
                    >
                      Break the world
                    </button>
                  </div>
                </div>
                <button 
                  onClick={handleSaveConfig}
                  disabled={isLoading}
                  className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-slate-900/10 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <Save size={24} /> {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            ) : !isWarehouseUnlocked ? (
              <div className="flex flex-col items-center justify-center p-12 sm:p-20 text-center bg-gradient-to-br from-slate-50 to-white">
                <div className="w-20 h-20 bg-teal-50 text-teal-600 rounded-3xl flex items-center justify-center mb-8 shadow-sm border border-teal-100">
                  <Lock size={40} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-4">Sección Protegida</h3>
                <p className="text-slate-500 mb-10 max-w-sm font-medium">
                  Ingresa la contraseña de la bodega para visualizar la ubicación detallada y los puntos de recolección.
                </p>
                <div className="w-full max-w-xs space-y-4">
                  <div className="relative">
                    <input 
                      type="password"
                      value={passwordInput}
                      onChange={(e) => { setPasswordInput(e.target.value); setIsPasswordError(false); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                      placeholder="Contraseña"
                      className={`w-full bg-white border ${isPasswordError ? 'border-red-400 ring-2 ring-red-400/10' : 'border-slate-200'} rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all text-center font-bold text-slate-800 placeholder:text-slate-300`}
                    />
                    {isPasswordError && (
                      <p className="text-red-500 text-[10px] font-bold absolute -bottom-6 left-0 right-0">Contraseña incorrecta. Intenta de nuevo.</p>
                    )}
                  </div>
                  <button 
                    onClick={handleUnlock}
                    disabled={isLoading || !passwordInput}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:shadow-none"
                  >
                    {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Unlock size={18} />}
                    Revelar Ubicación
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row min-h-[400px]">
                <div className="flex-1 p-10 md:p-16 flex flex-col justify-center">
                  <div className="flex items-center gap-3 text-teal-600 font-black uppercase tracking-[0.2em] text-xs mb-6">
                    <MapPin size={16} /> 
                    Ubicación Confirmada
                  </div>
                  <h3 className="text-3xl font-black text-slate-800 mb-6 leading-tight">Dirección de Recolección</h3>
                  <div className="bg-slate-50 border border-slate-100 rounded-3xl p-8 mb-8 text-slate-600 font-medium leading-relaxed whitespace-pre-wrap">
                    {warehouseLocation || "Ubicación no establecida."}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                     <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(warehouseLocation || "Ubicación no establecida.")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-slate-900 text-white rounded-2xl py-4 font-bold text-center hover:bg-black transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2"
                     >
                       <MapPin size={18} /> Abrir en Maps
                     </a>
                     <button 
                      onClick={handleShareWhatsApp}
                      className="flex-1 bg-[#25D366] hover:bg-[#1ebd5a] text-white rounded-2xl py-4 font-bold transition-all shadow-xl shadow-[#25D366]/20 flex items-center justify-center gap-2"
                     >
                       <MessageCircle size={18} /> Compartir WhatsApp
                     </button>
                     <button 
                      onClick={() => setIsWarehouseUnlocked(false)}
                      className="flex-1 bg-white border border-slate-200 text-slate-500 rounded-2xl py-4 font-bold hover:bg-slate-50 transition-all"
                     >
                       Cerrar Ubicación
                     </button>
                  </div>
                </div>
                <div className="md:w-1/3 bg-teal-600 flex flex-col items-center justify-center p-10 text-white text-center">
                   <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-6">
                     <CheckCircle size={32} />
                   </div>
                   <h4 className="text-xl font-bold mb-2">Punto Autorizado</h4>
                   <p className="text-teal-100 text-sm leading-relaxed">
                     Esta información es confidencial y solo para uso interno de Agricovet y sus colaboradores autorizados.
                   </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Premium Immersive Footer */}
        <footer id="main-footer" className="bg-gradient-to-b from-[#0b4d2c] via-[#07361e] to-[#042111] text-white pt-16 pb-12 px-6 relative overflow-hidden border-t border-emerald-950/20">
          
          {/* Subtle natural accent glow */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between gap-12 relative z-10">
            
            {/* Brand column */}
            <div className="space-y-6 max-w-sm">
              <div className="flex items-center gap-3.5">
                <div className="p-2 bg-white/5 backdrop-blur rounded-2xl border border-white/10 shrink-0 shadow-sm">
                  <img 
                    src={logoUrl} 
                    alt="Agricovet Logo" 
                    className="h-10 w-10 object-contain"
                    onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/40?text=Agro'; }} 
                  />
                </div>
                <div className="flex flex-col">
                  <span translate="no" className="notranslate font-black text-2xl leading-none tracking-tight text-white font-sans">Agricovet</span>
                  <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest mt-1">Sistema Central</span>
                </div>
              </div>
              
              <div className="space-y-3 pt-2">
                <p id="footer-contact-email" className="text-sm text-emerald-100/90 font-medium flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span>Contacto: <strong className="text-white font-semibold">agricovetsa@gmail.com</strong></span>
                </p>
                <a 
                  id="footer-contact-tel"
                  href="https://wa.me/50236450241" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center gap-2 text-sm text-emerald-200 hover:text-emerald-300 font-semibold group transition-all"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span>Tel: <strong className="text-white font-black group-hover:underline">(502) 3645 0241</strong></span>
                </a>
              </div>
            </div>
            
            {/* Nav Links Column */}
            <div className="flex gap-16 md:gap-20">
              <div className="flex flex-col gap-3">
                <h5 className="font-black text-xs uppercase tracking-widest text-emerald-300">Acerca de</h5>
                <button 
                  id="footer-link-sales"
                  onClick={() => onChangeTab('sales')} 
                  className="text-emerald-100/80 text-xs font-semibold hover:text-white hover:translate-x-1 transition-all text-left duration-200"
                >
                  Ventas
                </button>
                <button 
                  id="footer-link-billing"
                  onClick={() => onChangeTab('billing')} 
                  className="text-emerald-100/80 text-xs font-semibold hover:text-white hover:translate-x-1 transition-all text-left duration-200"
                >
                  Facturación
                </button>
                {user?.email !== 'limalopez22@gmail.com' && (
                  <button 
                    id="footer-link-team"
                    onClick={() => onChangeTab('team')} 
                    className="text-emerald-100/80 text-xs font-semibold hover:text-white hover:translate-x-1 transition-all text-left duration-200"
                  >
                    Equipo
                  </button>
                )}
              </div>
              
              <div className="flex flex-col gap-3">
                <h5 className="font-black text-xs uppercase tracking-widest text-emerald-300">Legal</h5>
                <button 
                  id="footer-link-terms"
                  onClick={() => onChangeTab('terms')} 
                  className="text-emerald-100/80 text-xs font-semibold hover:text-white hover:translate-x-1 transition-all text-left duration-200"
                >
                  Términos
                </button>
                <button 
                  id="footer-link-privacy"
                  onClick={() => onChangeTab('privacy')} 
                  className="text-emerald-100/80 text-xs font-semibold hover:text-white hover:translate-x-1 transition-all text-left duration-200"
                >
                  Privacidad
                </button>
              </div>
            </div>
            
            {/* Social Media Column */}
            <div className="flex flex-col items-start md:items-end justify-start">
              <h5 className="font-black text-xs uppercase tracking-widest text-emerald-300 mb-3 md:text-right w-full">Canales Oficiales</h5>
              <div className="flex gap-3">
                <a 
                  id="footer-social-fb"
                  href="https://www.facebook.com/share/1HsscAsdv2/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="w-10 h-10 rounded-full border border-white/20 hover:border-emerald-400 hover:text-emerald-300 hover:scale-110 flex items-center justify-center cursor-pointer hover:bg-white/5 transition-all duration-300"
                  title="Facebook"
                >
                  <span translate="no" className="notranslate text-xs font-bold leading-none select-none">fb</span>
                </a>
                <a 
                  id="footer-social-ig"
                  href="https://www.instagram.com/agricovetsa?igsh=eDdtNHdicjAyaTQ4" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="w-10 h-10 rounded-full border border-white/20 hover:border-emerald-400 hover:text-emerald-300 hover:scale-110 flex items-center justify-center cursor-pointer hover:bg-white/5 transition-all duration-300"
                  title="Instagram"
                >
                  <span translate="no" className="notranslate text-xs font-bold leading-none select-none">ig</span>
                </a>
                <div 
                  id="footer-social-yt"
                  className="w-10 h-10 rounded-full border border-white/20 hover:border-emerald-400 hover:text-emerald-300 hover:scale-110 flex items-center justify-center cursor-pointer hover:bg-white/5 transition-all duration-300"
                  title="YouTube"
                >
                  <span translate="no" className="notranslate text-xs font-bold leading-none select-none">yt</span>
                </div>
              </div>
            </div>

          </div>
          
          {/* Bottom Bar Divider and Copyright */}
          <div className="max-w-5xl mx-auto mt-12 pt-8 pb-4 border-t border-white/10 flex flex-col md:flex-row justify-between items-center md:items-end gap-6 text-[11px] text-emerald-200/60 font-medium relative">
             <div className="flex flex-col items-center md:items-start gap-2 text-center md:text-left z-20">
               <p id="footer-system-descriptor">&copy; 2026 <span translate="no" className="notranslate">Agricovet</span>. Todos los derechos reservados.</p>
               <div className="flex items-center gap-1.5 flex-wrap justify-center md:justify-start">
                 <span>Diseñado por</span>
                 <span className="italic font-serif text-emerald-300 text-sm tracking-wide bg-emerald-900/40 px-2 py-0.5 rounded-md border border-emerald-800/30">Emanuel Lima</span>
                 <span className="text-emerald-500/50 hidden sm:inline">|</span>
                 <a translate="no" className="notranslate text-emerald-400 hover:text-emerald-300 transition-colors font-semibold hover:underline underline-offset-2" href="https://github.agricovet.lat" target="_blank" rel="noopener noreferrer">
                   github.agricovet.lat
                 </a>
               </div>
             </div>
             
             <div className="flex flex-col md:flex-row items-center justify-center md:justify-end gap-4 md:gap-8 relative z-20 pt-6 md:pt-0">
               {/* User signature representation */}
               <div className="w-[320px] sm:w-[480px] md:w-[600px] h-[160px] md:h-[220px] flex items-center justify-end opacity-90 transition-opacity duration-300 hover:opacity-100 relative group">
                 {signatureUrl ? (
                   <>
                     <img 
                       src={signatureUrl} 
                       alt="Firma de Emanuel Lima" 
                       className="w-full h-full object-contain object-center md:object-right pointer-events-none drop-shadow-md scale-125 md:scale-150 origin-right" 
                     />
                     <label className="absolute inset-0 flex items-center justify-center bg-emerald-950/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-md border border-dashed border-emerald-500/50">
                       <span className="text-xs text-emerald-300 font-medium flex items-center gap-1"><Upload className="w-3 h-3" /> Cambiar Firma</span>
                       <input type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} />
                     </label>
                   </>
                 ) : (
                   <label className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-emerald-500/30 rounded-md cursor-pointer hover:border-emerald-400 hover:bg-emerald-900/20 transition-all">
                     <span className="text-xs text-emerald-400/80 font-medium mb-1 flex items-center gap-1"><Upload className="w-4 h-4" /> Subir Firma</span>
                     <span className="text-[10px] text-emerald-500/50">PNG transparente recomendado</span>
                     <input type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} />
                   </label>
                 )}
               </div>
               
               <p id="footer-logo-brand" className="font-black tracking-wider uppercase text-emerald-400/80 m-0 z-20 text-lg md:text-xl">Agricovet</p>
             </div>
          </div>

        </footer>
      </main>

      {/* View Mode Modal */}
      {isViewModeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Layers size={16} className="text-teal-600" />
                Vista de Estadísticas
              </h3>
              <button 
                onClick={() => setIsViewModeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-md hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <button
                onClick={() => {
                  setDashboardViewMode('global');
                  setIsViewModeModalOpen(false);
                }}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  dashboardViewMode === 'global' ? 'border-teal-600 bg-teal-50' : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${dashboardViewMode === 'global' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                    <BarChart2 size={18} />
                  </div>
                  <div className="text-left">
                    <p className={`font-bold text-sm ${dashboardViewMode === 'global' ? 'text-teal-800' : 'text-slate-700'}`}>Global (Todos)</p>
                    <p className="text-[10px] text-slate-500 font-medium">Ver comparativas de toda la empresa</p>
                  </div>
                </div>
                {dashboardViewMode === 'global' && <CheckCircle size={18} className="text-teal-600" />}
              </button>
              
              <button
                onClick={() => {
                  setDashboardViewMode('mine');
                  setIsViewModeModalOpen(false);
                }}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  dashboardViewMode === 'mine' ? 'border-teal-600 bg-teal-50' : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${dashboardViewMode === 'mine' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                    <UserIcon size={18} />
                  </div>
                  <div className="text-left">
                    <p className={`font-bold text-sm ${dashboardViewMode === 'mine' ? 'text-teal-800' : 'text-slate-700'}`}>Mis Ventas</p>
                    <p className="text-[10px] text-slate-500 font-medium">Ver solo mi rendimiento personal</p>
                  </div>
                </div>
                {dashboardViewMode === 'mine' && <CheckCircle size={18} className="text-teal-600" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
