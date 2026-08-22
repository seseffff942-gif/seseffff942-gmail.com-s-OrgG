import React from 'react';
import { motion } from 'framer-motion';

interface Props {
  text?: string;
  subtitle?: string;
  fullScreen?: boolean;
}

export const CubesLoadingScreen: React.FC<Props> = ({
  text = 'Sincronizando Sistema...',
  subtitle = 'Preparando registros contables',
  fullScreen = true
}) => {
  const content = (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto"
    >
      {/* Video Container con Glassmorphism y Glow */}
      <div className="relative mb-4 flex items-center justify-center">
        <div className="absolute -inset-2 bg-emerald-500/20 rounded-3xl blur-xl animate-pulse"></div>
        <div className="relative bg-white/80 backdrop-blur-md p-3 rounded-2xl border border-emerald-500/20 shadow-lg shadow-emerald-900/5">
          <video
            src="/loading-cubes.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-28 h-28 md:w-32 md:h-32 object-contain rounded-xl"
          />
        </div>
      </div>

      {/* Textos con Tipografía Moderna */}
      <h3 className="text-sm md:text-base font-extrabold text-slate-800 tracking-wide font-manrope">
        {text}
      </h3>
      {subtitle && (
        <p className="text-xs text-slate-400 font-medium mt-1 tracking-wider uppercase">
          {subtitle}
        </p>
      )}
    </motion.div>
  );

  if (!fullScreen) {
    return <div className="py-16 flex items-center justify-center">{content}</div>;
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/80 relative min-h-[60vh] overflow-hidden">
      {/* Ambient background particles */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-emerald-500/10 to-transparent blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
      {content}
    </div>
  );
};
