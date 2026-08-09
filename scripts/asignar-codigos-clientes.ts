/**
 * Script: Asignar códigos a todos los clientes que no tienen uno
 * Ejecutar con: npx tsx scripts/asignar-codigos-clientes.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Faltan variables de entorno SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function generarCodigo(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function main() {
  console.log('🔍 Obteniendo clientes sin código...\n');

  // Traer todos los clientes
  const { data: clientes, error } = await supabase
    .from('clients')
    .select('id, name, client_code')
    .or('client_code.is.null,client_code.eq.');

  if (error) {
    console.error('❌ Error al obtener clientes:', error.message);
    process.exit(1);
  }

  if (!clientes || clientes.length === 0) {
    console.log('✅ Todos los clientes ya tienen código asignado.');
    process.exit(0);
  }

  console.log(`📋 ${clientes.length} clientes sin código encontrados:\n`);

  // Generar códigos únicos
  const codigosUsados = new Set<string>();
  let actualizados = 0;
  let errores = 0;

  for (const cliente of clientes) {
    // Generar código único
    let codigo = generarCodigo();
    while (codigosUsados.has(codigo)) {
      codigo = generarCodigo();
    }
    codigosUsados.add(codigo);

    const { error: updateError } = await supabase
      .from('clients')
      .update({ client_code: codigo })
      .eq('id', cliente.id);

    if (updateError) {
      console.error(`  ❌ Error en "${cliente.name}": ${updateError.message}`);
      errores++;
    } else {
      console.log(`  ✅ ${cliente.name.padEnd(40)} → Código: ${codigo}`);
      actualizados++;
    }
  }

  console.log(`\n🎉 Finalizado: ${actualizados} actualizados, ${errores} errores.`);
}

main();
