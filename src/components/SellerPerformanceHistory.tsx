import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, User } from '../types';
import { api } from '../api';
import { 
  TrendingUp, TrendingDown, Calendar, User as UserIcon, 
  BarChart3, DollarSign, Award, AlertTriangle, Sparkles, 
  ArrowUpRight, ArrowDownRight, Layers, FileText, CheckCircle2,
  Clock, Filter, RefreshCw, ChevronDown, Activity, Info,
  Package, Users, ShoppingBag, ArrowRight, Eye, Target, Compass
} from 'lucide-react';
import { formatMoney, cn, parseGuatemalaDateParts, getGuatemalaWeekInfo } from '../utils';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  AreaChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ReferenceLine,
  Cell
} from 'recharts';

interface SellerPerformanceHistoryProps {
  invoices: Invoice[];
  users?: User[];
  currentUser?: User;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const SHORT_MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export function SellerPerformanceHistory({
  invoices,
  users: initialUsers = [],
  currentUser
}: SellerPerformanceHistoryProps) {
  const [usersList, setUsersList] = useState<User[]>(initialUsers);
  // viewGranularity: 'weekly' (default), 'daily', 'monthly'
  const [viewGranularity, setViewGranularity] = useState<'weekly' | 'daily' | 'monthly'>('weekly');
  const [selectedSeller, setSelectedSeller] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all' or '1' to '12'
  const [timeRange, setTimeRange] = useState<'all' | '2m' | '3m' | '6m' | '12m'>('all');
  const [weeklyTimeRange, setWeeklyTimeRange] = useState<'all' | '4w' | '8w' | '12w' | '24w'>('12w');
  const [dailyTimeRange, setDailyTimeRange] = useState<'14d' | '30d' | '60d' | '90d' | 'all'>('60d');
  const [chartMetric, setChartMetric] = useState<'sales' | 'count' | 'both'>('both');

  // Load users if not supplied
  useEffect(() => {
    if (!initialUsers || initialUsers.length === 0) {
      api.getUsers().then(u => {
        if (u && u.length > 0) setUsersList(u);
      }).catch(console.error);
    } else {
      setUsersList(initialUsers);
    }
  }, [initialUsers]);

  // Helper to standardize seller names
  const getSellerDisplayName = (sellerKeyOrEmail?: string) => {
    if (!sellerKeyOrEmail) return 'Sin Asignar';
    const key = String(sellerKeyOrEmail).toLowerCase().trim();

    if (usersList && usersList.length > 0) {
      const match = usersList.find(u => 
        (u.email && u.email.toLowerCase() === key) ||
        u.id === sellerKeyOrEmail ||
        (u.sellerCode && u.sellerCode.toLowerCase() === key) ||
        (u.name && u.name.toLowerCase() === key)
      );
      if (match && match.name) return match.name;
    }

    if (key.includes('herbert') || key.includes('gruasytransportesali') || key === 'h1521') {
      return 'Herbert Argueta';
    }
    if (key.includes('erick') || key.includes('jerickottoniel') || key === 'e8363') {
      return 'Erick Juárez';
    }
    if (key.includes('seseffff942') || key.includes('dueño') || key.includes('admin')) {
      return 'Dirección / CEO';
    }

    return sellerKeyOrEmail;
  };

  // Valid invoices (ignoring cancelled or rejected)
  const validInvoices = useMemo(() => {
    return (invoices || []).filter(inv => inv.status !== 'cancelled' && inv.status !== 'rejected');
  }, [invoices]);

  // Unique sellers list for dropdown
  const availableSellers = useMemo(() => {
    const set = new Set<string>();
    validInvoices.forEach(inv => {
      const sellerId = inv.sellerId || (inv as any).seller;
      const name = getSellerDisplayName(sellerId);
      if (name) set.add(name);
    });
    usersList.forEach(u => {
      if (u.name) set.add(u.name);
    });
    return Array.from(set).sort();
  }, [validInvoices, usersList]);

  // Available Years
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    validInvoices.forEach(inv => {
      const parts = parseGuatemalaDateParts(inv.date);
      if (parts) {
        yearsSet.add(parts.year);
      }
    });
    const currYear = new Date().getFullYear();
    yearsSet.add(currYear);
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [validInvoices]);

  // =========================================================================
  // 1. HISTORIAL MENSUAL GLOBAL COMPLETO (BASE DE COMPARACIÓN SIN FILTRO)
  // =========================================================================
  const allHistoricalMonths = useMemo(() => {
    const map: Record<string, {
      yearMonth: string;
      year: number;
      monthIndex: number;
      monthName: string;
      shortMonthName: string;
      totalSales: number;
      invoiceCount: number;
      paidAmount: number;
      pendingAmount: number;
      clientsSet: Set<string>;
      invoicesList: Invoice[];
    }> = {};

    validInvoices.forEach(inv => {
      const parts = parseGuatemalaDateParts(inv.date);
      if (!parts) return;

      const sellerName = getSellerDisplayName(inv.sellerId || (inv as any).seller);
      if (selectedSeller !== 'all' && sellerName !== selectedSeller) return;

      const { year, month, yearMonth } = parts;
      const monthIndex = month - 1;

      if (!map[yearMonth]) {
        map[yearMonth] = {
          yearMonth,
          year,
          monthIndex,
          monthName: MONTH_NAMES[monthIndex],
          shortMonthName: SHORT_MONTH_NAMES[monthIndex],
          totalSales: 0,
          invoiceCount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          clientsSet: new Set(),
          invoicesList: []
        };
      }

      const total = Number(inv.totalAmount) || 0;
      const paid = Number(inv.paidAmount) || 0;

      map[yearMonth].totalSales += total;
      map[yearMonth].invoiceCount += 1;
      map[yearMonth].paidAmount += paid;
      map[yearMonth].pendingAmount += (total - paid);
      map[yearMonth].invoicesList.push(inv);
      if (inv.client) map[yearMonth].clientsSet.add(inv.client);
    });

    const list = Object.values(map).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    
    // Find TRUE record month across all history
    let trueRecordMonth: typeof list[0] | null = null;
    list.forEach(m => {
      if (!trueRecordMonth || m.totalSales > trueRecordMonth.totalSales) {
        trueRecordMonth = m;
      }
    });

    return {
      list,
      trueRecordMonth
    };
  }, [validInvoices, selectedSeller, usersList]);

  // =========================================================================
  // 2. HISTORIAL SEMANAL GLOBAL COMPLETO (BASE DE COMPARACIÓN SIN FILTRO)
  // =========================================================================
  const allHistoricalWeeks = useMemo(() => {
    const map: Record<string, any> = {};

    validInvoices.forEach(inv => {
      const weekInfo = getGuatemalaWeekInfo(inv.date);
      if (!weekInfo) return;

      const sellerName = getSellerDisplayName(inv.sellerId || (inv as any).seller);
      if (selectedSeller !== 'all' && sellerName !== selectedSeller) return;

      const { weekKey } = weekInfo;

      if (!map[weekKey]) {
        map[weekKey] = {
          ...weekInfo,
          totalSales: 0,
          invoiceCount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          clientsSet: new Set(),
          invoicesList: []
        };
      }

      const total = Number(inv.totalAmount) || 0;
      const paid = Number(inv.paidAmount) || 0;

      map[weekKey].totalSales += total;
      map[weekKey].invoiceCount += 1;
      map[weekKey].paidAmount += paid;
      map[weekKey].pendingAmount += (total - paid);
      map[weekKey].invoicesList.push(inv);
      if (inv.client) map[weekKey].clientsSet.add(inv.client);
    });

    const list = Object.values(map).sort((a: any, b: any) => a.startIso.localeCompare(b.startIso));
    let trueRecordWeek: any = null;
    list.forEach((w: any) => {
      if (!trueRecordWeek || w.totalSales > trueRecordWeek.totalSales) {
        trueRecordWeek = w;
      }
    });

    return {
      list,
      trueRecordWeek
    };
  }, [validInvoices, selectedSeller, usersList]);

  // ==========================================
  // 3. AGREGACIÓN SEMANAL (CON FILTROS DE RANGO)
  // ==========================================
  const weeklyData = useMemo(() => {
    const fullList = allHistoricalWeeks.list.filter((w: any) => {
      if (selectedYear !== 'all' && String(w.year) !== selectedYear) return false;
      return true;
    });

    let filtered = [...fullList];
    if (weeklyTimeRange === '4w' && filtered.length > 4) {
      filtered = filtered.slice(filtered.length - 4);
    } else if (weeklyTimeRange === '8w' && filtered.length > 8) {
      filtered = filtered.slice(filtered.length - 8);
    } else if (weeklyTimeRange === '12w' && filtered.length > 12) {
      filtered = filtered.slice(filtered.length - 12);
    } else if (weeklyTimeRange === '24w' && filtered.length > 24) {
      filtered = filtered.slice(filtered.length - 24);
    }

    return filtered.map((w: any) => {
      // Find actual preceding week in global fullList
      const fullIdx = allHistoricalWeeks.list.findIndex((item: any) => item.weekKey === w.weekKey);
      const prev = fullIdx > 0 ? allHistoricalWeeks.list[fullIdx - 1] : null;

      let wowPercent = 0;
      let wowAbsolute = 0;
      let wowOrderDiff = 0;
      let wowOrderPercent = 0;

      if (prev && prev.totalSales > 0) {
        wowAbsolute = w.totalSales - prev.totalSales;
        wowPercent = ((w.totalSales - prev.totalSales) / prev.totalSales) * 100;
      }
      if (prev) {
        wowOrderDiff = w.invoiceCount - prev.invoiceCount;
        if (prev.invoiceCount > 0) {
          wowOrderPercent = (wowOrderDiff / prev.invoiceCount) * 100;
        }
      }

      const avgTicket = w.invoiceCount > 0 ? w.totalSales / w.invoiceCount : 0;
      const collectionRate = w.totalSales > 0 ? (w.paidAmount / w.totalSales) * 100 : 0;
      const isTrueRecord = allHistoricalWeeks.trueRecordWeek && w.weekKey === allHistoricalWeeks.trueRecordWeek.weekKey;

      let comparisonNarrative = '';
      if (prev) {
        if (wowOrderDiff < 0) {
          comparisonNarrative = `${Math.abs(wowOrderDiff)} pedidos menos que la semana pasada (${w.invoiceCount} vs ${prev.invoiceCount} pedidos)`;
        } else if (wowOrderDiff > 0) {
          comparisonNarrative = `${wowOrderDiff} pedidos más que la semana pasada (${w.invoiceCount} vs ${prev.invoiceCount} pedidos)`;
        } else {
          comparisonNarrative = `Mismo volumen (${w.invoiceCount} pedidos)`;
        }
      }

      return {
        ...w,
        label: `Sem ${w.weekNumber}`,
        chartLabel: `Sem ${w.weekNumber} (${w.startDateStr})`,
        avgTicket,
        collectionRate,
        wowPercent,
        wowAbsolute,
        wowOrderDiff,
        wowOrderPercent,
        comparisonNarrative,
        isTrueRecord,
        hasPrev: prev !== null,
        prevWeekLabel: prev?.shortLabel || '',
        prevSales: prev?.totalSales || 0,
        prevCount: prev?.invoiceCount || 0,
        uniqueClients: w.clientsSet.size
      };
    });
  }, [allHistoricalWeeks, selectedYear, weeklyTimeRange]);

  // ==========================================
  // 4. AGREGACIÓN DIARIA CONTINUA (Día a Día)
  // ==========================================
  const dailyData = useMemo(() => {
    const map: Record<string, {
      isoDate: string;
      dayNum: number;
      monthNum: number;
      year: number;
      label: string;
      fullDateStr: string;
      totalSales: number;
      invoiceCount: number;
      paidAmount: number;
      pendingAmount: number;
      clientsSet: Set<string>;
      invoicesList: Invoice[];
    }> = {};

    validInvoices.forEach(inv => {
      const parts = parseGuatemalaDateParts(inv.date);
      if (!parts) return;

      const sellerName = getSellerDisplayName(inv.sellerId || (inv as any).seller);
      if (selectedSeller !== 'all' && sellerName !== selectedSeller) return;
      if (selectedYear !== 'all' && String(parts.year) !== selectedYear) return;
      if (selectedMonth !== 'all' && String(parts.month) !== selectedMonth) return;

      const { isoDate, day, month, year } = parts;

      if (!map[isoDate]) {
        map[isoDate] = {
          isoDate,
          dayNum: day,
          monthNum: month,
          year,
          label: `${String(day).padStart(2, '0')} ${SHORT_MONTH_NAMES[month - 1]}`,
          fullDateStr: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
          totalSales: 0,
          invoiceCount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          clientsSet: new Set(),
          invoicesList: []
        };
      }

      const total = Number(inv.totalAmount) || 0;
      const paid = Number(inv.paidAmount) || 0;

      map[isoDate].totalSales += total;
      map[isoDate].invoiceCount += 1;
      map[isoDate].paidAmount += paid;
      map[isoDate].pendingAmount += (total - paid);
      map[isoDate].invoicesList.push(inv);
      if (inv.client) map[isoDate].clientsSet.add(inv.client);
    });

    let sortedDays = Object.values(map).sort((a, b) => a.isoDate.localeCompare(b.isoDate));

    if (dailyTimeRange === '14d' && sortedDays.length > 14) {
      sortedDays = sortedDays.slice(sortedDays.length - 14);
    } else if (dailyTimeRange === '30d' && sortedDays.length > 30) {
      sortedDays = sortedDays.slice(sortedDays.length - 30);
    } else if (dailyTimeRange === '60d' && sortedDays.length > 60) {
      sortedDays = sortedDays.slice(sortedDays.length - 60);
    } else if (dailyTimeRange === '90d' && sortedDays.length > 90) {
      sortedDays = sortedDays.slice(sortedDays.length - 90);
    }

    return sortedDays.map((d, idx) => {
      const prev = idx > 0 ? sortedDays[idx - 1] : null;
      const diffSales = prev ? d.totalSales - prev.totalSales : 0;
      const diffOrders = prev ? d.invoiceCount - prev.invoiceCount : 0;
      const avgTicket = d.invoiceCount > 0 ? d.totalSales / d.invoiceCount : 0;

      return {
        ...d,
        avgTicket,
        diffSales,
        diffOrders,
        hasPrev: prev !== null,
        uniqueClients: d.clientsSet.size
      };
    });
  }, [validInvoices, selectedSeller, selectedYear, selectedMonth, dailyTimeRange, usersList]);

  // ==========================================
  // 5. AGREGACIÓN MENSUAL (CON COMPARACIÓN REAL HISTÓRICA)
  // ==========================================
  const monthlyData = useMemo(() => {
    const fullList = allHistoricalMonths.list.filter(m => {
      if (selectedYear !== 'all' && String(m.year) !== selectedYear) return false;
      if (selectedMonth !== 'all' && String(m.monthIndex + 1) !== selectedMonth) return false;
      return true;
    });

    let filtered = [...fullList];
    if (selectedMonth === 'all') {
      if (timeRange === '2m' && filtered.length > 2) {
        filtered = filtered.slice(filtered.length - 2);
      } else if (timeRange === '3m' && filtered.length > 3) {
        filtered = filtered.slice(filtered.length - 3);
      } else if (timeRange === '6m' && filtered.length > 6) {
        filtered = filtered.slice(filtered.length - 6);
      } else if (timeRange === '12m' && filtered.length > 12) {
        filtered = filtered.slice(filtered.length - 12);
      }
    }

    return filtered.map((m) => {
      // Find actual preceding month in global allHistoricalMonths.list
      const fullIdx = allHistoricalMonths.list.findIndex(item => item.yearMonth === m.yearMonth);
      const prev = fullIdx > 0 ? allHistoricalMonths.list[fullIdx - 1] : null;

      let momPercent = 0;
      let momAbsolute = 0;
      let momCountDiff = 0;

      if (prev && prev.totalSales > 0) {
        momAbsolute = m.totalSales - prev.totalSales;
        momPercent = ((m.totalSales - prev.totalSales) / prev.totalSales) * 100;
      }
      if (prev) {
        momCountDiff = m.invoiceCount - prev.invoiceCount;
      }

      const avgTicket = m.invoiceCount > 0 ? m.totalSales / m.invoiceCount : 0;
      const collectionRate = m.totalSales > 0 ? (m.paidAmount / m.totalSales) * 100 : 0;
      
      // ONLY true record if it matches global all-time record month
      const isTrueRecord = allHistoricalMonths.trueRecordMonth && m.yearMonth === allHistoricalMonths.trueRecordMonth.yearMonth;

      return {
        ...m,
        label: `${m.shortMonthName} ${String(m.year).slice(2)}`,
        fullLabel: `${m.monthName} ${m.year}`,
        avgTicket,
        collectionRate,
        momPercent,
        momAbsolute,
        momCountDiff,
        isTrueRecord,
        hasPrev: prev !== null,
        prevMonthName: prev?.monthName || '',
        prevSales: prev?.totalSales || 0,
        prevCount: prev?.invoiceCount || 0,
        uniqueClients: m.clientsSet.size
      };
    });
  }, [allHistoricalMonths, selectedYear, selectedMonth, timeRange]);

  // ==========================================
  // 6. DETECCIÓN INTELIGENTE DE PUNTO DE PICADA
  // ==========================================
  const dropAnalysis = useMemo(() => {
    if (weeklyData.length < 2) return null;

    let peakWeek = weeklyData[0];
    let sharpestDrop: { from: typeof weeklyData[0]; to: typeof weeklyData[0]; dropPercent: number; orderDiff: number; salesDiff: number } | null = null;

    weeklyData.forEach((w, idx) => {
      if (w.totalSales > peakWeek.totalSales) {
        peakWeek = w;
      }
      if (idx > 0) {
        const prev = weeklyData[idx - 1];
        const diffSales = w.totalSales - prev.totalSales;
        const diffOrders = w.invoiceCount - prev.invoiceCount;
        const dropPct = prev.totalSales > 0 ? (diffSales / prev.totalSales) * 100 : 0;

        if (diffOrders < 0 || dropPct < -15) {
          if (!sharpestDrop || dropPct < sharpestDrop.dropPercent) {
            sharpestDrop = {
              from: prev,
              to: w,
              dropPercent: dropPct,
              orderDiff: diffOrders,
              salesDiff: diffSales
            };
          }
        }
      }
    });

    let dropStartingDay: string | null = null;
    if (sharpestDrop && dailyData.length > 0) {
      const candidateDays = dailyData.filter(d => d.isoDate >= sharpestDrop!.from.startIso && d.isoDate <= sharpestDrop!.to.endIso);
      if (candidateDays.length > 0) {
        const firstLowDay = candidateDays.find(d => d.isoDate >= sharpestDrop!.to.startIso);
        if (firstLowDay) {
          dropStartingDay = firstLowDay.fullDateStr;
        }
      }
    }

    return {
      peakWeek,
      sharpestDrop,
      dropStartingDay
    };
  }, [weeklyData, dailyData]);

  // Active dataset based on viewGranularity
  const activeDataset = useMemo(() => {
    if (viewGranularity === 'weekly') return weeklyData;
    if (viewGranularity === 'daily') return dailyData;
    return monthlyData;
  }, [viewGranularity, weeklyData, dailyData, monthlyData]);

  // Overall Statistics for active view
  const summaryStats = useMemo(() => {
    if (activeDataset.length === 0) {
      return {
        totalSales: 0,
        totalInvoices: 0,
        avgPeriodSales: 0,
        bestPeriod: null,
        totalPaid: 0,
        totalPending: 0,
        collectionRate: 0,
        overallAvgTicket: 0,
        periodsCount: 0
      };
    }

    const totalSales = activeDataset.reduce((acc: number, curr: any) => acc + curr.totalSales, 0);
    const totalInvoices = activeDataset.reduce((acc: number, curr: any) => acc + curr.invoiceCount, 0);
    const totalPaid = activeDataset.reduce((acc: number, curr: any) => acc + curr.paidAmount, 0);
    const totalPending = activeDataset.reduce((acc: number, curr: any) => acc + curr.pendingAmount, 0);
    const avgPeriodSales = totalSales / activeDataset.length;
    const overallAvgTicket = totalInvoices > 0 ? totalSales / totalInvoices : 0;
    const collectionRate = totalSales > 0 ? (totalPaid / totalSales) * 100 : 0;

    // True all-time record period
    let bestPeriod = viewGranularity === 'weekly' 
      ? allHistoricalWeeks.trueRecordWeek 
      : allHistoricalMonths.trueRecordMonth;

    return {
      totalSales,
      totalInvoices,
      avgPeriodSales,
      bestPeriod,
      totalPaid,
      totalPending,
      collectionRate,
      overallAvgTicket,
      periodsCount: activeDataset.length
    };
  }, [activeDataset, viewGranularity, allHistoricalWeeks, allHistoricalMonths]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. FILTER HEADER BAR */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-6 rounded-3xl shadow-md border border-slate-700/60 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase rounded-full tracking-widest flex items-center gap-1.5">
                <Compass size={12} className="text-emerald-400 animate-pulse" />
                Auditoría de Curva y Picadas de Rendimiento
              </span>
              <span className="text-slate-400 text-xs font-medium">
                {viewGranularity === 'weekly' ? `${weeklyData.length} semanas` :
                 viewGranularity === 'daily' ? `${dailyData.length} días con ventas` :
                 `${monthlyData.length} meses`}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Evolución Comercial {selectedSeller !== 'all' ? `• ${selectedSeller}` : '• Todo el Equipo'}
            </h3>
            <p className="text-xs text-slate-300 font-medium max-w-xl mt-0.5">
              Identifica la semana y el día exacto donde comenzó a caer el rendimiento para tomar acciones comerciales a tiempo.
            </p>
          </div>

          {/* Interactive Filters Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* GRANULARITY TOGGLE: SEMANAS vs DIAS vs MESES */}
            <div className="relative min-w-[240px]">
              <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                Granularidad (Ver Semanas / Días):
              </label>
              <div className="flex bg-slate-800/90 p-1 rounded-xl border border-slate-600/70">
                <button
                  type="button"
                  onClick={() => setViewGranularity('weekly')}
                  className={cn(
                    "flex-1 py-1.5 px-2.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-1",
                    viewGranularity === 'weekly' ? "bg-emerald-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                  )}
                >
                  <Calendar size={13} />
                  <span>Semanas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewGranularity('daily')}
                  className={cn(
                    "flex-1 py-1.5 px-2.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-1",
                    viewGranularity === 'daily' ? "bg-emerald-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                  )}
                >
                  <Activity size={13} />
                  <span>Días</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewGranularity('monthly')}
                  className={cn(
                    "flex-1 py-1.5 px-2.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-1",
                    viewGranularity === 'monthly' ? "bg-emerald-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                  )}
                >
                  <Layers size={13} />
                  <span>Meses</span>
                </button>
              </div>
            </div>

            {/* VENDEDOR SELECTOR */}
            <div className="relative min-w-[170px] sm:min-w-[190px]">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Vendedor:
              </label>
              <div className="relative">
                <select
                  value={selectedSeller}
                  onChange={(e) => setSelectedSeller(e.target.value)}
                  className="w-full appearance-none bg-slate-800/90 border border-slate-600/70 hover:border-emerald-500/50 rounded-xl px-3.5 py-2 pr-9 text-xs font-bold text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer transition"
                >
                  <option value="all">👥 Todo el Equipo Comercial</option>
                  {availableSellers.map(seller => (
                    <option key={seller} value={seller}>
                      👤 {seller}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* AÑO SELECTOR */}
            <div className="relative min-w-[90px]">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Año:
              </label>
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full appearance-none bg-slate-800/90 border border-slate-600/70 hover:border-emerald-500/50 rounded-xl px-3 py-2 pr-8 text-xs font-bold text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer transition"
                >
                  <option value="all">📅 Todos</option>
                  {availableYears.map(yr => (
                    <option key={yr} value={String(yr)}>
                      {yr}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* RANGO CONTROL SEGÚN GRANULARIDAD */}
            {viewGranularity === 'weekly' && (
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Rango Semanas:
                </label>
                <div className="flex bg-slate-800/90 p-0.5 rounded-xl border border-slate-600/70">
                  {(['4w', '8w', '12w', '24w', 'all'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setWeeklyTimeRange(r)}
                      className={cn(
                        "px-2 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer",
                        weeklyTimeRange === r ? "bg-emerald-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                      )}
                    >
                      {r === 'all' ? 'Todo' : r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {viewGranularity === 'daily' && (
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Rango Días:
                </label>
                <div className="flex bg-slate-800/90 p-0.5 rounded-xl border border-slate-600/70">
                  {(['14d', '30d', '60d', '90d', 'all'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setDailyTimeRange(r)}
                      className={cn(
                        "px-2 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer",
                        dailyTimeRange === r ? "bg-emerald-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                      )}
                    >
                      {r === 'all' ? 'Todo' : r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {viewGranularity === 'monthly' && (
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Rango Meses:
                </label>
                <div className="flex bg-slate-800/90 p-0.5 rounded-xl border border-slate-600/70">
                  {(['2m', '6m', '12m', 'all'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setTimeRange(r)}
                      className={cn(
                        "px-2 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer",
                        timeRange === r ? "bg-emerald-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                      )}
                    >
                      {r === 'all' ? 'Todo' : r}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* QUICK MONTH CHIPS (ONLY IN MONTHLY MODE) */}
        {viewGranularity === 'monthly' && (
          <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1 shrink-0">
              Vista por Mes:
            </span>
            <button
              onClick={() => setSelectedMonth('all')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition cursor-pointer",
                selectedMonth === 'all'
                  ? "bg-emerald-500 text-slate-950 font-black shadow-xs"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
              )}
            >
              Todos (1-12)
            </button>
            {MONTH_NAMES.map((name, i) => {
              const mNum = String(i + 1);
              const isSel = selectedMonth === mNum;
              return (
                <button
                  key={mNum}
                  onClick={() => setSelectedMonth(mNum)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition cursor-pointer flex items-center gap-1",
                    isSel
                      ? "bg-emerald-500 text-slate-950 font-black shadow-xs ring-2 ring-emerald-300/40"
                      : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
                  )}
                >
                  <span className="text-[10px] opacity-70 font-mono">#{mNum}</span>
                  <span>{SHORT_MONTH_NAMES[i]}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. INFLECTION POINT & DROP DETECTION BANNER */}
      {dropAnalysis && dropAnalysis.sharpestDrop && (
        <div className="bg-gradient-to-r from-rose-50 via-amber-50/50 to-white p-5 rounded-3xl border border-rose-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-rose-600 text-white rounded-2xl shadow-xs shrink-0">
              <TrendingDown size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md">
                  Punto de Picada Identificado
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {selectedSeller !== 'all' ? selectedSeller : 'Equipo Comercial'}
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                La caída comenzó en la {dropAnalysis.sharpestDrop.to.fullLabel}
              </h4>
              <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                Venía de registrar <strong>{dropAnalysis.sharpestDrop.from.invoiceCount} pedidos</strong> ({formatMoney(dropAnalysis.sharpestDrop.from.totalSales)}) en la {dropAnalysis.sharpestDrop.from.shortLabel} y cayó a <strong>{dropAnalysis.sharpestDrop.to.invoiceCount} pedidos</strong> ({formatMoney(dropAnalysis.sharpestDrop.to.totalSales)}), representando una baja de <strong>{Math.abs(dropAnalysis.sharpestDrop.orderDiff)} pedidos menos</strong> ({dropAnalysis.sharpestDrop.dropPercent.toFixed(1)}%).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <button
              onClick={() => setViewGranularity('weekly')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-xs",
                viewGranularity === 'weekly' ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              )}
            >
              <Calendar size={13} />
              <span>Ver Semanas</span>
            </button>
            <button
              onClick={() => setViewGranularity('daily')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-xs",
                viewGranularity === 'daily' ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              )}
            >
              <Activity size={13} />
              <span>Ver Días Exactos</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. SUMMARY KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* Total Facturado */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {viewGranularity === 'weekly' ? 'Venta Total en Semanas' :
               viewGranularity === 'daily' ? 'Venta Total en Días' : 'Venta Total Periodo'}
            </span>
            <div className="p-1.5 bg-emerald-50 text-[#0b4d2c] rounded-lg">
              <DollarSign size={14} />
            </div>
          </div>
          <div>
            <span className="text-lg sm:text-xl font-black text-slate-900 block notranslate" translate="no">
              {formatMoney(summaryStats.totalSales)}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 mt-0.5 block">
              {summaryStats.totalInvoices} pedidos en {summaryStats.periodsCount} {viewGranularity === 'weekly' ? 'semanas' : viewGranularity === 'daily' ? 'días' : 'meses'}
            </span>
          </div>
        </div>

        {/* Promedio de Venta */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {viewGranularity === 'weekly' ? 'Promedio Semanal' :
               viewGranularity === 'daily' ? 'Promedio Diario' : 'Promedio Mensual'}
            </span>
            <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
              <BarChart3 size={14} />
            </div>
          </div>
          <div>
            <span className="text-lg sm:text-xl font-black text-blue-900 block notranslate" translate="no">
              {formatMoney(summaryStats.avgPeriodSales)}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 mt-0.5 block">
              Ticket Prom: {formatMoney(summaryStats.overallAvgTicket)}
            </span>
          </div>
        </div>

        {/* Mejor Periodo */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {viewGranularity === 'weekly' ? 'Semana Récord' : 'Mes Récord'}
            </span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Award size={14} />
            </div>
          </div>
          <div>
            {summaryStats.bestPeriod ? (
              <>
                <span className="text-xs sm:text-sm font-black text-slate-900 block leading-tight truncate">
                  {summaryStats.bestPeriod.shortLabel || summaryStats.bestPeriod.fullLabel || summaryStats.bestPeriod.label}
                </span>
                <span className="text-[11px] font-black text-amber-700 block mt-0.5 notranslate" translate="no">
                  {formatMoney(summaryStats.bestPeriod.totalSales)} ({summaryStats.bestPeriod.invoiceCount} ped.)
                </span>
              </>
            ) : (
              <span className="text-xs font-medium text-slate-400">Sin datos</span>
            )}
          </div>
        </div>

        {/* Cobrado vs Por Cobrar */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">Tasa de Recaudo</span>
            <div className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg sm:text-xl font-black text-emerald-800">
                {summaryStats.collectionRate.toFixed(1)}%
              </span>
              <span className="text-[10px] font-bold text-slate-400">Cobrado</span>
            </div>
            <span className="text-[10px] font-bold text-amber-700 mt-0.5 block notranslate" translate="no">
              Pendiente: {formatMoney(summaryStats.totalPending)}
            </span>
          </div>
        </div>

      </div>

      {/* 4. INTERACTIVE RECHARTS GRAPH */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
          <div>
            <h4 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 size={16} className="text-[#0b4d2c]" />
              {viewGranularity === 'weekly' 
                ? 'Curva Semanal: Trayectoria y Puntos de Caída' 
                : viewGranularity === 'daily'
                ? 'Curva Diaria: Días de Actividad'
                : 'Facturación y Pedidos Mes a Mes'}
            </h4>
            <p className="text-[11px] text-slate-500 font-medium">
              {viewGranularity === 'weekly'
                ? 'Barras por semana natural (Lunes a Domingo) para auditar ventas y pedidos.'
                : viewGranularity === 'daily'
                ? 'Detalle de días con pedidos registrados.'
                : 'Resumen consolidado por meses.'}
            </p>
          </div>

          {/* Metric switch buttons */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 self-start sm:self-auto text-xs">
            <button
              onClick={() => setChartMetric('both')}
              className={cn(
                "px-2 py-1 rounded-lg font-bold transition cursor-pointer text-[11px]",
                chartMetric === 'both' ? "bg-white text-slate-900 shadow-xs font-black" : "text-slate-500 hover:text-slate-900"
              )}
            >
              Ventas & Pedidos
            </button>
            <button
              onClick={() => setChartMetric('sales')}
              className={cn(
                "px-2 py-1 rounded-lg font-bold transition cursor-pointer text-[11px]",
                chartMetric === 'sales' ? "bg-white text-slate-900 shadow-xs font-black" : "text-slate-500 hover:text-slate-900"
              )}
            >
              Solo Monto (Q)
            </button>
            <button
              onClick={() => setChartMetric('count')}
              className={cn(
                "px-2 py-1 rounded-lg font-bold transition cursor-pointer text-[11px]",
                chartMetric === 'count' ? "bg-white text-slate-900 shadow-xs font-black" : "text-slate-500 hover:text-slate-900"
              )}
            >
              Solo Pedidos
            </button>
          </div>
        </div>

        {activeDataset.length > 0 ? (
          <div className="h-[250px] sm:h-[280px] w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={activeDataset} margin={{ top: 15, right: 15, left: 5, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="label" 
                  stroke="#64748b" 
                  fontSize={viewGranularity === 'daily' ? 10 : 11} 
                  tickLine={false}
                  dy={8}
                  interval={viewGranularity === 'daily' && activeDataset.length > 25 ? 'preserveStartEnd' : 0}
                />
                <YAxis 
                  yAxisId="left" 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => `Q${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                {(chartMetric === 'both' || chartMetric === 'count') && (
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(val) => `${val} ped`}
                  />
                )}
                <RechartsTooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const title = data.fullLabel || data.fullDateStr || data.label;
                      const isDrop = (data.wowOrderDiff !== undefined && data.wowOrderDiff < 0) || (data.diffOrders !== undefined && data.diffOrders < 0) || (data.momCountDiff !== undefined && data.momCountDiff < 0);
                      const isSpike = (data.wowOrderDiff !== undefined && data.wowOrderDiff > 0) || (data.diffOrders !== undefined && data.diffOrders > 0) || (data.momCountDiff !== undefined && data.momCountDiff > 0);

                      return (
                        <div className="bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-xl border border-slate-700/80 backdrop-blur-md text-xs space-y-2 min-w-[220px]">
                          <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                            <span className="font-black text-xs text-emerald-400">{title}</span>
                            {data.hasPrev && (
                              <span className={cn(
                                "font-black px-1.5 py-0.5 rounded text-[10px] flex items-center gap-0.5",
                                isDrop ? "bg-rose-900/60 text-rose-300 border border-rose-700" :
                                isSpike ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700" :
                                "bg-slate-800 text-slate-300"
                              )}>
                                {isDrop ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
                                {viewGranularity === 'weekly' ? `${data.wowPercent > 0 ? `+${data.wowPercent.toFixed(1)}%` : `${data.wowPercent.toFixed(1)}%`}` :
                                 viewGranularity === 'daily' ? `${data.diffSales >= 0 ? `+${formatMoney(data.diffSales)}` : formatMoney(data.diffSales)}` :
                                 `${data.momPercent > 0 ? `+${data.momPercent.toFixed(1)}%` : `${data.momPercent.toFixed(1)}%`}`}
                              </span>
                            )}
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Total Facturado:</span>
                              <span className="font-black text-white notranslate" translate="no">{formatMoney(data.totalSales)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Pedidos:</span>
                              <span className="font-bold text-teal-300">{data.invoiceCount} pedidos</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Ticket Promedio:</span>
                              <span className="font-bold text-slate-200 notranslate" translate="no">{formatMoney(data.avgTicket)}</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-slate-800 text-[11px]">
                              <span className="text-slate-400">Cobrado:</span>
                              <span className="font-bold text-emerald-300 notranslate" translate="no">{formatMoney(data.paidAmount)}</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-400">Saldo Pendiente:</span>
                              <span className="font-bold text-amber-300 notranslate" translate="no">{formatMoney(data.pendingAmount)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <RechartsLegend verticalAlign="top" height={30} wrapperStyle={{ fontSize: '11px' }} />

                {/* Average Reference Line */}
                <ReferenceLine 
                  yAxisId="left" 
                  y={summaryStats.avgPeriodSales} 
                  stroke="#94a3b8" 
                  strokeDasharray="4 4" 
                  label={{ value: `Prom: Q${Math.round(summaryStats.avgPeriodSales).toLocaleString()}`, fill: '#94a3b8', fontSize: 9, position: 'insideTopLeft' }} 
                />

                {/* Bars */}
                {(chartMetric === 'both' || chartMetric === 'sales') && (
                  <Bar 
                    yAxisId="left" 
                    dataKey="totalSales" 
                    name="Facturación (Q)" 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={viewGranularity === 'daily' ? 18 : 36}
                  >
                    {activeDataset.map((entry: any, index: number) => {
                      const isRecord = Boolean(entry.isTrueRecord);
                      const isDrop = (entry.wowOrderDiff !== undefined && entry.wowOrderDiff <= -4) || (entry.diffOrders !== undefined && entry.diffOrders < 0) || (entry.momCountDiff !== undefined && entry.momCountDiff <= -4) || (entry.momPercent !== undefined && entry.momPercent <= -15);
                      const isGrowth = (entry.wowOrderDiff !== undefined && entry.wowOrderDiff >= 4) || (entry.diffOrders !== undefined && entry.diffOrders > 0) || (entry.momCountDiff !== undefined && entry.momCountDiff >= 4) || (entry.momPercent !== undefined && entry.momPercent >= 15);
                      
                      let fillColor = '#0b4d2c';
                      if (isRecord) fillColor = '#f59e0b';
                      else if (isDrop) fillColor = '#ef4444';
                      else if (isGrowth) fillColor = '#10b981';

                      return <Cell key={`cell-${index}`} fill={fillColor} />;
                    })}
                  </Bar>
                )}

                {/* Orders Line */}
                {(chartMetric === 'both' || chartMetric === 'count') && (
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="invoiceCount" 
                    name="Pedidos" 
                    stroke="#3b82f6" 
                    strokeWidth={2} 
                    dot={{ r: viewGranularity === 'daily' ? 2 : 3, fill: '#3b82f6' }}
                    activeDot={{ r: 5 }} 
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">
            <Info size={24} className="mx-auto mb-1.5 opacity-50" />
            <p className="font-bold text-xs">No hay datos registrados para los filtros seleccionados</p>
          </div>
        )}
      </div>

      {/* 5. DETAILED AUDIT TABLE (COMPACT EXECUTIVE TABLE) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Calendar size={16} className="text-[#0b4d2c]" />
              {viewGranularity === 'weekly' ? 'Auditoría Semana a Semana (Lunes a Domingo)' :
               viewGranularity === 'daily' ? 'Auditoría Día por Día' :
               'Auditoría Mes a Mes'}
            </h4>
            <p className="text-[11px] text-slate-500 font-medium">
              Desglose con comparativa respecto al periodo inmediatamente anterior.
            </p>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            {activeDataset.length} periodos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                <th className="py-2.5 px-3 whitespace-nowrap">
                  {viewGranularity === 'weekly' ? 'Semana (Período)' :
                   viewGranularity === 'daily' ? 'Fecha' : 'Mes / Periodo'}
                </th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Facturación</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Variación</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Pedidos</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Comparativa</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Ticket Prom.</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Cobrado</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Por Cobrar</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {activeDataset.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400 font-bold text-xs">
                    No se encontraron registros en este periodo
                  </td>
                </tr>
              ) : (
                [...activeDataset].reverse().map((row: any) => {
                  const isRecord = Boolean(row.isTrueRecord);
                  const orderDiff = viewGranularity === 'weekly' ? row.wowOrderDiff : viewGranularity === 'daily' ? row.diffOrders : row.momCountDiff;
                  const pctChange = viewGranularity === 'weekly' ? row.wowPercent : viewGranularity === 'monthly' ? row.momPercent : 0;
                  const isSevereDrop = row.hasPrev && (orderDiff <= -3 || pctChange <= -12);
                  const isGoodGrowth = row.hasPrev && (orderDiff >= 3 || pctChange >= 12);

                  return (
                    <tr key={row.weekKey || row.isoDate || row.yearMonth} className="hover:bg-slate-50/80 transition">
                      
                      {/* Periodo */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "w-6 h-6 rounded-md flex items-center justify-center font-black text-[10px] shrink-0",
                            isRecord ? "bg-amber-100 text-amber-900 border border-amber-300" :
                            isSevereDrop ? "bg-rose-100 text-rose-800" :
                            "bg-slate-100 text-slate-700"
                          )}>
                            {viewGranularity === 'weekly' ? `W${row.weekNumber}` :
                             viewGranularity === 'daily' ? row.dayNum :
                             row.shortMonthName}
                          </span>
                          <span className="font-bold text-xs text-slate-900">
                            {viewGranularity === 'weekly' 
                              ? `Sem ${row.weekNumber} (${row.startDateStr} - ${row.endDateStr})`
                              : viewGranularity === 'daily' 
                              ? row.fullDateStr 
                              : `${row.monthName} ${row.year}`}
                          </span>
                        </div>
                      </td>

                      {/* Facturación Total */}
                      <td className="py-2.5 px-3 text-right font-black text-slate-900 text-xs whitespace-nowrap notranslate" translate="no">
                        {formatMoney(row.totalSales)}
                      </td>

                      {/* Variación Ventas */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {row.hasPrev ? (
                          <span className={cn(
                            "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-black",
                            (viewGranularity === 'daily' ? row.diffSales > 0 : pctChange > 0)
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                              : (viewGranularity === 'daily' ? row.diffSales < 0 : pctChange < 0)
                              ? "bg-rose-50 text-rose-800 border border-rose-200" 
                              : "bg-slate-100 text-slate-600"
                          )}>
                            {(viewGranularity === 'daily' ? row.diffSales > 0 : pctChange > 0) ? <ArrowUpRight size={11} className="text-emerald-700" /> : <ArrowDownRight size={11} className="text-rose-700" />}
                            {viewGranularity === 'daily' 
                              ? (row.diffSales >= 0 ? `+${formatMoney(row.diffSales)}` : formatMoney(row.diffSales))
                              : (pctChange > 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] font-medium">-</span>
                        )}
                      </td>

                      {/* Pedidos */}
                      <td className="py-2.5 px-3 text-center font-bold text-slate-800 text-xs whitespace-nowrap">
                        {row.invoiceCount} ped.
                      </td>

                      {/* Comparativa de Pedidos */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {row.hasPrev ? (
                          orderDiff < 0 ? (
                            <span className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                              🔻 {Math.abs(orderDiff)} menos
                            </span>
                          ) : orderDiff > 0 ? (
                            <span className="inline-flex items-center text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                              🟢 +{orderDiff} más
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400">
                              Igual
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 text-[10px]">-</span>
                        )}
                      </td>

                      {/* Ticket Promedio */}
                      <td className="py-2.5 px-3 text-right font-medium text-slate-600 text-xs whitespace-nowrap notranslate" translate="no">
                        {formatMoney(row.avgTicket)}
                      </td>

                      {/* Cobrado */}
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700 text-xs whitespace-nowrap notranslate" translate="no">
                        {formatMoney(row.paidAmount)}
                      </td>

                      {/* Por Cobrar */}
                      <td className="py-2.5 px-3 text-right font-bold text-amber-700 text-xs whitespace-nowrap notranslate" translate="no">
                        {formatMoney(row.pendingAmount)}
                      </td>

                      {/* Estado / Diagnóstico */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isRecord ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-black text-[9px] rounded-md inline-flex items-center gap-1">
                            🏆 Récord
                          </span>
                        ) : isSevereDrop ? (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 font-black text-[9px] rounded-md inline-flex items-center gap-1">
                            ⚠️ Caída
                          </span>
                        ) : isGoodGrowth ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 font-black text-[9px] rounded-md inline-flex items-center gap-1">
                            🚀 Alza
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 font-semibold text-[9px] rounded-md">
                            Estable
                          </span>
                        )}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
