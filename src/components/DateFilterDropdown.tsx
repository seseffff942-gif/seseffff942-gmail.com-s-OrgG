import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check, RotateCcw } from 'lucide-react';
import { cn, diaGuatemala, getMesActualGuatemala, getMesPasadoGuatemala, getNombreMesGuatemala } from '../utils';

export interface DateFilterDropdownProps {
  dateViewMode: 'day' | 'all';
  setDateViewMode: (mode: 'day' | 'all') => void;
  dateFilter: 'all' | 'today' | 'week' | 'month' | 'last_month';
  setDateFilter: (filter: 'all' | 'today' | 'week' | 'month' | 'last_month') => void;
  filterDate: string;
  setFilterDate: (date: string) => void;
  className?: string;
  accentColor?: string;
}

export function DateFilterDropdown({
  dateViewMode,
  setDateViewMode,
  dateFilter,
  setDateFilter,
  filterDate,
  setFilterDate,
  className = '',
  accentColor = '#0c5c35'
}: DateFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const todayGT = diaGuatemala();
  const dYesterday = new Date();
  dYesterday.setDate(dYesterday.getDate() - 1);
  const yesterdayGT = diaGuatemala(dYesterday);

  const mesActualNombre = getNombreMesGuatemala(getMesActualGuatemala());
  const mesPasadoNombre = getNombreMesGuatemala(getMesPasadoGuatemala());

  // Determine label for the button
  const getLabel = () => {
    if (dateViewMode === 'day') {
      if (filterDate === todayGT) return 'Hoy';
      if (filterDate === yesterdayGT) return 'Ayer';
      return filterDate;
    }
    if (dateFilter === 'today') return 'Hoy (24h)';
    if (dateFilter === 'week') return 'Esta Semana';
    if (dateFilter === 'month') return `Este Mes (${mesActualNombre})`;
    if (dateFilter === 'last_month') return `Mes Pasado (${mesPasadoNombre})`;
    return 'Todas las fechas';
  };

  const isFiltered = dateViewMode === 'day' || dateFilter !== 'all';

  return (
    <div className={cn("relative inline-block text-left", className)} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          "flex items-center gap-2 px-3.5 py-1.5 sm:py-2 text-xs font-bold rounded-xl border transition-all shadow-xs cursor-pointer select-none",
          isFiltered
            ? "bg-emerald-50 text-[#0c5c35] border-emerald-300 font-extrabold ring-2 ring-emerald-500/10"
            : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
        )}
      >
        <Calendar size={14} className={isFiltered ? "text-[#0c5c35]" : "text-slate-500"} />
        <span className="truncate max-w-[140px] sm:max-w-[180px]">{getLabel()}</span>
        <ChevronDown size={13} className={cn("text-slate-400 transition-transform duration-200 shrink-0", isOpen && "rotate-180")} />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 lg:right-0 lg:left-auto mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 px-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar size={12} className="text-emerald-600" /> Período de Tiempo
            </span>
            {isFiltered && (
              <button
                type="button"
                onClick={() => {
                  setDateViewMode('all');
                  setDateFilter('all');
                  setIsOpen(false);
                }}
                className="text-[10px] font-bold text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw size={10} /> Restablecer
              </button>
            )}
          </div>

          <div className="space-y-1">
            {/* Opción 1: Hoy */}
            <button
              type="button"
              onClick={() => {
                setDateViewMode('day');
                setFilterDate(todayGT);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer",
                dateViewMode === 'day' && filterDate === todayGT
                  ? "bg-[#0c5c35] text-white shadow-xs font-black"
                  : "hover:bg-slate-100 text-slate-700"
              )}
            >
              <div className="flex items-center gap-2">
                <span>⚡</span>
                <span>Hoy ({todayGT})</span>
              </div>
              {dateViewMode === 'day' && filterDate === todayGT && <Check size={14} />}
            </button>

            {/* Opción 2: Ayer */}
            <button
              type="button"
              onClick={() => {
                setDateViewMode('day');
                setFilterDate(yesterdayGT);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer",
                dateViewMode === 'day' && filterDate === yesterdayGT
                  ? "bg-[#0c5c35] text-white shadow-xs font-black"
                  : "hover:bg-slate-100 text-slate-700"
              )}
            >
              <div className="flex items-center gap-2">
                <span>🗓️</span>
                <span>Ayer ({yesterdayGT})</span>
              </div>
              {dateViewMode === 'day' && filterDate === yesterdayGT && <Check size={14} />}
            </button>

            {/* Opción 3: Esta Semana */}
            <button
              type="button"
              onClick={() => {
                setDateViewMode('all');
                setDateFilter('week');
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer",
                dateViewMode === 'all' && dateFilter === 'week'
                  ? "bg-[#0c5c35] text-white shadow-xs font-black"
                  : "hover:bg-slate-100 text-slate-700"
              )}
            >
              <div className="flex items-center gap-2">
                <span>📊</span>
                <span>Esta Semana</span>
              </div>
              {dateViewMode === 'all' && dateFilter === 'week' && <Check size={14} />}
            </button>

            {/* Opción 4: Este Mes */}
            <button
              type="button"
              onClick={() => {
                setDateViewMode('all');
                setDateFilter('month');
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer",
                dateViewMode === 'all' && dateFilter === 'month'
                  ? "bg-[#0c5c35] text-white shadow-xs font-black"
                  : "hover:bg-slate-100 text-slate-700"
              )}
            >
              <div className="flex items-center gap-2">
                <span>📅</span>
                <span>Este Mes ({mesActualNombre})</span>
              </div>
              {dateViewMode === 'all' && dateFilter === 'month' && <Check size={14} />}
            </button>

            {/* Opción 5: Mes Pasado */}
            <button
              type="button"
              onClick={() => {
                setDateViewMode('all');
                setDateFilter('last_month');
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer",
                dateViewMode === 'all' && dateFilter === 'last_month'
                  ? "bg-[#0c5c35] text-white shadow-xs font-black"
                  : "hover:bg-slate-100 text-slate-700"
              )}
            >
              <div className="flex items-center gap-2">
                <span>⏳</span>
                <span>Mes Pasado ({mesPasadoNombre})</span>
              </div>
              {dateViewMode === 'all' && dateFilter === 'last_month' && <Check size={14} />}
            </button>

            {/* Opción 6: Todas las fechas */}
            <button
              type="button"
              onClick={() => {
                setDateViewMode('all');
                setDateFilter('all');
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer",
                dateViewMode === 'all' && dateFilter === 'all'
                  ? "bg-[#0c5c35] text-white shadow-xs font-black"
                  : "hover:bg-slate-100 text-slate-700"
              )}
            >
              <div className="flex items-center gap-2">
                <span>🌐</span>
                <span>Todas las fechas</span>
              </div>
              {dateViewMode === 'all' && dateFilter === 'all' && <Check size={14} />}
            </button>
          </div>

          {/* Selector de fecha específica */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 px-1">
              O elegir fecha exacta:
            </label>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setFilterDate(e.target.value);
                    setDateViewMode('day');
                    setIsOpen(false);
                  }
                }}
                className="w-full bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer px-1.5"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
