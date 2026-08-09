export const PRODUCT_KNOWLEDGE_BASE: Record<string, string> = {
  "Oxitetraciclina": "**Composición:** Oxitetraciclina Clorhidrato. \n**Uso:** Antibiótico de amplio espectro contra bacterias Gram(+) y Gram(-). \n**Dosis:** 10-20 mg/kg de peso vivo vía IM profunda o IV lenta. \n**Precauciones:** No usar en animales con hipersensibilidad a tetraciclinas. Tiempo de retiro en carne: 28 días.",
  "Ivermectina": "**Composición:** Ivermectina al 1% o 4%. \n**Uso:** Endectocida para el control de parásitos internos (nematodos) y externos (garrapatas, ácaros). \n**Dosis:** 1 ml por cada 50 kg de peso (1%) o según concentración. SC únicamente. \n**Precauciones:** No administrar en vacas en lactancia cuya leche se destine a consumo humano.",
  "Complejo B": "**Composición:** Vitaminas B1, B2, B6, B12 y Niacinamida. \n**Uso:** Reconstituyente vitamínico para estados de debilidad, anemia y estrés. \n**Dosis:** 5-10 ml en animales grandes, 1-2 ml en pequeños. Vía IM o SC. \n**Precauciones:** Mantener en lugar fresco y protegido de la luz solar.",
  "Glifosato": "**Composición:** Glifosato (Sal isopropilamina). \n**Uso:** Herbicida sistémico no selectivo para el control de malezas anuales y perennes. \n**Dosis:** 1.5 a 3.0 litros por hectárea según la densidad de maleza. \n**Precauciones:** Evitar la deriva hacia cultivos deseados. Usar equipo de protección completo.",
  "Paraquat": "**Composición:** Dicloruro de Paraquat. \n**Uso:** Herbicida de contacto para quema rápida de malezas. \n**Dosis:** 1.5 a 2.0 litros por manzana con suficiente agua. \n**Precauciones:** Altamente tóxico. No inhalar. Almacenar bajo llave lejos de alimentos.",
  "Urea": "**Composición:** Nitrógeno 46%. \n**Uso:** Fertilizante nitrogenado para promover el crecimiento vegetativo y verdor del cultivo. \n**Dosis:** Según análisis de suelo, generalmente 2-4 quintales por manzana. \n**Precauciones:** Incorporar al suelo inmediatamente después de aplicar para evitar volatilización.",
  "Triple 15": "**Composición:** Nitrógeno 15%, Fósforo 15%, Potasio 15%. \n**Uso:** Fertilizante completo para mantenimiento nutritivo balanceado en diversos cultivos. \n**Dosis:** Aplicar en la zona de goteo de la planta según edad y requerimiento técnico. \n**Precauciones:** Distanciar del tallo principal para evitar quemaduras radiculares.",
  "Alimento Crecimiento": "**Composición:** Mezcla balanceada de cereales, proteínas vegetales y minerales. \n**Uso:** Alimentación completa para la etapa de desarrollo acelerado en aves o cerdos. \n**Dosis:** Suministrar a voluntad (ad-libitum) asegurando agua limpia constante. \n**Precauciones:** Almacenar sobre tarimas en lugar seco para evitar hongos y micotoxinas.",
  "Vacuna Newcastle": "**Composición:** Virus vivo atenuado (Cepa LaSota). \n**Uso:** Inmunización activa contra la enfermedad de Newcastle en aves. \n**Dosis:** Una gota vía ocular o nasal, o mediante el agua de bebida según edad. \n**Precauciones:** Mantener estrictamente la cadena de frío (2-8°C). Vacunar solo animales sanos.",
  "Cipermetrina": "**Composición:** Cipermetrina Concentrado Emulsionable. \n**Uso:** Insecticida y acaricida de amplio espectro por contacto e ingestión. \n**Dosis:** Diluir 1 ml por cada litro de agua para pulverización en instalaciones o ganado. \n**Precauciones:** Producto moderadamente tóxico. No contaminar fuentes de agua.",
  "Amoxicilina": "**Composición:** Amoxicilina Trihidrato. \n**Uso:** Antibiótico bactericida para infecciones respiratorias, urogenitales y cutáneas. \n**Dosis:** 15 mg/kg cada 24 horas por 3 a 5 días. \n**Precauciones:** Puede causar trastornos gastrointestinales leves en algunos ejemplares.",
  "Multivitamínico": "**Composición:** Vitaminas A, D3, E, B12, Aminoácidos y Minerales. \n**Uso:** Estimulante del apetito y mejora de la conversión alimenticia. \n**Dosis:** 1-5 ml según especie y peso. IM. \n**Precauciones:** Agitar bien antes de usar. No exceder la dosis recomendada.",
  "Desinfectante Instrumental": "**Composición:** Amonio Cuaternario o Glutaraldehído. \n**Uso:** Sanitización de equipos veterinarios, jeringas y áreas de ordeño. \n**Dosis:** Dilución al 1:500 o 1:1000 según carga orgánica existente. \n**Precauciones:** Evitar contacto directo con ojos y mucosas. No ingerir.",
  "Electrolitos": "**Composición:** Sodio, Potasio, Cloro, Magnesio y Dextrosa. \n**Uso:** Rehidratación oral para animales con diarrea o agotamiento por calor. \n**Dosis:** Disolver un sobre en 20 litros de agua de bebida. \n**Precauciones:** Preparar diariamente para asegurar la estabilidad de los componentes.",
  "Calcio Inyectable": "**Composición:** Borogluconato de Calcio al 25%. \n**Uso:** Tratamiento de fiebre de leche (hipocalcemia) y deficiencias de calcio. \n**Dosis:** 250-500 ml vía IV lenta en vacas adultas. \n**Precauciones:** Administrar a temperatura corporal. Vigilar ritmo cardíaco durante aplicación."
};

export const getGenericDescription = (name: string, category: string): string => {
  const n = (name || "").toLowerCase();
  const c = (category || "").toLowerCase();

  // Mapeo inteligente basado en palabras clave del producto
  if (n.includes('oxitetra') || n.includes('tecnimicina') || n.includes('oxiplus') || n.includes('oxi')) return PRODUCT_KNOWLEDGE_BASE["Oxitetraciclina"];
  if (n.includes('penici') || n.includes('tilosin') || n.includes('broximici') || n.includes('trimsulfa') || n.includes('tigent')) return PRODUCT_KNOWLEDGE_BASE["Amoxicilina"];
  if (n.includes('iverplus') || n.includes('ivermect') || n.includes('albendazol') || n.includes('lombrifin') || n.includes('vermimax')) return PRODUCT_KNOWLEDGE_BASE["Ivermectina"];
  if (n.includes('vitamina') || n.includes('complejo b') || n.includes('vita b12') || n.includes('vitel') || n.includes('proteizoo') || n.includes('instavit')) return PRODUCT_KNOWLEDGE_BASE["Complejo B"];
  if (n.includes('multivita') || n.includes('multipack') || n.includes('reconstituyente')) return PRODUCT_KNOWLEDGE_BASE["Multivitamínico"];
  if (n.includes('glifosato') || n.includes('revolver') || n.includes('sementhal') || n.includes('torban') || n.includes('cegar')) return PRODUCT_KNOWLEDGE_BASE["Glifosato"];
  if (n.includes('terraquat') || n.includes('duplexone') || n.includes('paraquat')) return PRODUCT_KNOWLEDGE_BASE["Paraquat"];
  if (n.includes('nitróg') || n.includes('urea') || n.includes('fertilizante')) return PRODUCT_KNOWLEDGE_BASE["Urea"];
  if (n.includes('15-15-15') || n.includes('foliar plus') || c.includes('abono')) return PRODUCT_KNOWLEDGE_BASE["Triple 15"];
  if (n.includes('alimento') || n.includes('crecimiento') || n.includes('engorde')) return PRODUCT_KNOWLEDGE_BASE["Alimento Crecimiento"];
  if (n.includes('vacuna') || n.includes('newcastle') || n.includes('cepa')) return PRODUCT_KNOWLEDGE_BASE["Vacuna Newcastle"];
  if (n.includes('cipermetr') || n.includes('nuvan') || n.includes('insecticida') || n.includes('blindage') || n.includes('pikudo')) return PRODUCT_KNOWLEDGE_BASE["Cipermetrina"];
  if (n.includes('electro') || n.includes('chemiestress')) return PRODUCT_KNOWLEDGE_BASE["Electrolitos"];
  if (n.includes('calcio') || n.includes('borogl')) return PRODUCT_KNOWLEDGE_BASE["Calcio Inyectable"];
  if (n.includes('matagusano') || n.includes('curabichera') || n.includes('jabón pet') || n.includes('shampoo')) return PRODUCT_KNOWLEDGE_BASE["Desinfectante Instrumental"];

  // Fallback por categorías
  if (c.includes('antib')) return PRODUCT_KNOWLEDGE_BASE["Amoxicilina"];
  if (c.includes('despara')) return PRODUCT_KNOWLEDGE_BASE["Ivermectina"];
  if (c.includes('vitam') || c.includes('suplemento')) return PRODUCT_KNOWLEDGE_BASE["Multivitamínico"];
  if (c.includes('agroqu') || c.includes('herb')) return PRODUCT_KNOWLEDGE_BASE["Glifosato"];
  if (c.includes('fertil')) return PRODUCT_KNOWLEDGE_BASE["Triple 15"];

  return `**Uso:** Producto especializado para el sector ${c.includes('agrícola') ? 'agrícola' : 'veterinario'}. \n**Recomendación:** El artículo "${name}" ha sido seleccionado por Agricovet por su comprobada eficiencia. Se recomienda leer la etiqueta completa y ajustar la dosis según las necesidades específicas de su producción o animal. \n**Precauciones:** Almacenar en un lugar seco y fuera del alcance de los niños. Consulte a su asesor técnico de Agricovet para un plan de manejo integral.`;
};
