import React, { useState, useEffect } from 'react';

/**
 * Imagen de producto con respaldo a prueba de fallos.
 *
 * PROBLEMA QUE RESUELVE
 * ---------------------
 * El patron anterior era:
 *
 *   <img src={product.image || getFallbackImage(cat)}
 *        onError={(e) => { e.currentTarget.src = getFallbackImage(cat); }} />
 *
 * Eso mutaba el DOM directamente, pero `src` es una prop controlada por React.
 * En cuanto la pagina se re-renderizaba (Ventas refresca cada 10s e Inventario
 * cada 15s), React devolvia `src` a la URL rota -> fallaba -> onError volvia a
 * poner el respaldo -> y asi indefinidamente.
 *
 * Encima, los archivos de respaldo (/box.png y /bottle.png) estaban corruptos y
 * pesaban ~850 KB cada uno, asi que cada vuelta del bucle descargaba casi un
 * megabyte. Se midio mas de 1 GB transferido en una sola sesion.
 *
 * SOLUCION
 * --------
 * 1. El fallo se guarda en estado de React, no mutando el DOM. React entonces
 *    renderiza el respaldo y deja de intentar la URL rota.
 * 2. Las URLs que fallaron se recuerdan a nivel de modulo, de modo que al
 *    re-renderizar o al remontar el componente no se vuelven a pedir.
 * 3. El respaldo es un SVG embebido (data URI): no hace peticion de red, no
 *    puede dar 404 y por lo tanto no puede reiniciar el ciclo.
 */

const svgADataUri = (svg: string) =>
  `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;

const PLACEHOLDER_BOTELLA = svgADataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" fill="#f1f5f4"/>
    <rect x="27" y="7" width="10" height="5" rx="1.5" fill="#00696a"/>
    <path d="M27 12h10v5l4 6v29a4 4 0 0 1-4 4H27a4 4 0 0 1-4-4V23l4-6v-5Z"
          fill="#ffffff" stroke="#00696a" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M23 34h18" stroke="#00696a" stroke-width="2.5"/>
  </svg>
`);

const PLACEHOLDER_CAJA = svgADataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" fill="#f1f5f4"/>
    <path d="M32 11 54 19v26L32 53 10 45V19L32 11Z"
          fill="#ffffff" stroke="#00696a" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M10 19l22 8 22-8M32 27v26" stroke="#00696a" stroke-width="2.5" stroke-linejoin="round"/>
  </svg>
`);

/**
 * Respaldo del logo. Sustituye a via.placeholder.com, que era un servicio
 * externo: si no respondia, el onError volvia a dispararse en bucle y ademas
 * exponia la app a una dependencia de terceros fuera de nuestro control.
 */
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
  if (category && category.toLowerCase().includes('agro')) return PLACEHOLDER_BOTELLA;
  return PLACEHOLDER_CAJA;
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
  const respaldo = getFallbackImage(category);
  const [fallo, setFallo] = useState(false);

  // Si cambia el producto, volver a permitir el intento con su imagen.
  useEffect(() => {
    setFallo(false);
  }, [src]);

  const utilizable = !!src && !urlsFallidas.has(src);
  const fuente = !utilizable || fallo ? respaldo : (src as string);

  return (
    <img
      {...rest}
      src={fuente}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => {
        if (src) urlsFallidas.add(src);
        if (!fallo) setFallo(true);
      }}
    />
  );
}
