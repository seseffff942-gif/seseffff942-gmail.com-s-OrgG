import React, { useState, useEffect } from 'react';

/**
 * Imagen de producto con respaldo a prueba de fallos.
 * Muestra la imagen real del producto o un bote blanco genérico profesional
 * para insumos veterinarios y agrícolas que aún no tienen fotografía.
 */

export const BOTE_BLANCO_FALLBACK = "/placeholder-bottle.webp";

const svgADataUri = (svg: string) =>
  `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;

export const PLACEHOLDER_BOTELLA_SVG = svgADataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#f8fafc" rx="8"/>
    <rect x="42" y="10" width="16" height="8" rx="2" fill="#047857"/>
    <rect x="44" y="18" width="12" height="7" fill="#e2e8f0"/>
    <path d="M34 32 C34 25, 44 25, 44 25 L56 25 C56 25, 66 25, 66 32 L70 80 C70 86, 64 90, 58 90 L42 90 C36 90, 30 86, 30 80 Z" 
          fill="#ffffff" stroke="#cbd5e1" stroke-width="1.8" stroke-linejoin="round"/>
    <rect x="36" y="42" width="28" height="34" rx="2" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1"/>
    <circle cx="50" cy="56" r="6" fill="#ecfdf5"/>
    <path d="M50 52 v8 M46 56 h8" stroke="#10b981" stroke-width="1.8" stroke-linecap="round"/>
    <text x="50" y="86" font-family="sans-serif" font-size="5" font-weight="bold" fill="#94a3b8" text-anchor="middle">AGRICOVET</text>
  </svg>
`);

export const LOGO_PLACEHOLDER = svgADataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="14" fill="#00696a"/>
    <path d="M20 44 32 18l12 26" fill="none" stroke="#ffffff" stroke-width="4"
          stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M25 37h14" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
  </svg>
`);

/** URLs que ya fallaron. A nivel de modulo: sobrevive a re-renders y remontajes. */
const urlsFallidas = new Set<string>();

export function getFallbackImage(category?: string | null): string {
  return BOTE_BLANCO_FALLBACK;
}

interface ProductImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  category?: string | null;
}

export function ProductImage({
  src,
  category,
  alt = '',
  ...rest
}: ProductImageProps) {
  const [fallo, setFallo] = useState(false);
  const [falloSecundario, setFalloSecundario] = useState(false);

  // Si cambia el producto, volver a permitir el intento con su imagen.
  useEffect(() => {
    setFallo(false);
    setFalloSecundario(false);
  }, [src]);

  const tieneSrc = !!src && src.trim() !== '' && !urlsFallidas.has(src);
  
  let fuente = BOTE_BLANCO_FALLBACK;
  if (tieneSrc && !fallo) {
    fuente = src as string;
  } else if (falloSecundario) {
    fuente = PLACEHOLDER_BOTELLA_SVG;
  }

  return (
    <img
      {...rest}
      src={fuente}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => {
        if (tieneSrc && !fallo) {
          if (src) urlsFallidas.add(src);
          setFallo(true);
        } else {
          setFalloSecundario(true);
        }
      }}
    />
  );
}
