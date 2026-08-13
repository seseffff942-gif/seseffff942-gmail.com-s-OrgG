const a={Oxitetraciclina:`**Composición:** Oxitetraciclina Clorhidrato. 
**Uso:** Antibiótico de amplio espectro contra bacterias Gram(+) y Gram(-). 
**Dosis:** 10-20 mg/kg de peso vivo vía IM profunda o IV lenta. 
**Precauciones:** No usar en animales con hipersensibilidad a tetraciclinas. Tiempo de retiro en carne: 28 días.`,Ivermectina:`**Composición:** Ivermectina al 1% o 4%. 
**Uso:** Endectocida para el control de parásitos internos (nematodos) y externos (garrapatas, ácaros). 
**Dosis:** 1 ml por cada 50 kg de peso (1%) o según concentración. SC únicamente. 
**Precauciones:** No administrar en vacas en lactancia cuya leche se destine a consumo humano.`,"Complejo B":`**Composición:** Vitaminas B1, B2, B6, B12 y Niacinamida. 
**Uso:** Reconstituyente vitamínico para estados de debilidad, anemia y estrés. 
**Dosis:** 5-10 ml en animales grandes, 1-2 ml en pequeños. Vía IM o SC. 
**Precauciones:** Mantener en lugar fresco y protegido de la luz solar.`,Glifosato:`**Composición:** Glifosato (Sal isopropilamina). 
**Uso:** Herbicida sistémico no selectivo para el control de malezas anuales y perennes. 
**Dosis:** 1.5 a 3.0 litros por hectárea según la densidad de maleza. 
**Precauciones:** Evitar la deriva hacia cultivos deseados. Usar equipo de protección completo.`,Paraquat:`**Composición:** Dicloruro de Paraquat. 
**Uso:** Herbicida de contacto para quema rápida de malezas. 
**Dosis:** 1.5 a 2.0 litros por manzana con suficiente agua. 
**Precauciones:** Altamente tóxico. No inhalar. Almacenar bajo llave lejos de alimentos.`,Urea:`**Composición:** Nitrógeno 46%. 
**Uso:** Fertilizante nitrogenado para promover el crecimiento vegetativo y verdor del cultivo. 
**Dosis:** Según análisis de suelo, generalmente 2-4 quintales por manzana. 
**Precauciones:** Incorporar al suelo inmediatamente después de aplicar para evitar volatilización.`,"Triple 15":`**Composición:** Nitrógeno 15%, Fósforo 15%, Potasio 15%. 
**Uso:** Fertilizante completo para mantenimiento nutritivo balanceado en diversos cultivos. 
**Dosis:** Aplicar en la zona de goteo de la planta según edad y requerimiento técnico. 
**Precauciones:** Distanciar del tallo principal para evitar quemaduras radiculares.`,"Alimento Crecimiento":`**Composición:** Mezcla balanceada de cereales, proteínas vegetales y minerales. 
**Uso:** Alimentación completa para la etapa de desarrollo acelerado en aves o cerdos. 
**Dosis:** Suministrar a voluntad (ad-libitum) asegurando agua limpia constante. 
**Precauciones:** Almacenar sobre tarimas en lugar seco para evitar hongos y micotoxinas.`,"Vacuna Newcastle":`**Composición:** Virus vivo atenuado (Cepa LaSota). 
**Uso:** Inmunización activa contra la enfermedad de Newcastle en aves. 
**Dosis:** Una gota vía ocular o nasal, o mediante el agua de bebida según edad. 
**Precauciones:** Mantener estrictamente la cadena de frío (2-8°C). Vacunar solo animales sanos.`,Cipermetrina:`**Composición:** Cipermetrina Concentrado Emulsionable. 
**Uso:** Insecticida y acaricida de amplio espectro por contacto e ingestión. 
**Dosis:** Diluir 1 ml por cada litro de agua para pulverización en instalaciones o ganado. 
**Precauciones:** Producto moderadamente tóxico. No contaminar fuentes de agua.`,Amoxicilina:`**Composición:** Amoxicilina Trihidrato. 
**Uso:** Antibiótico bactericida para infecciones respiratorias, urogenitales y cutáneas. 
**Dosis:** 15 mg/kg cada 24 horas por 3 a 5 días. 
**Precauciones:** Puede causar trastornos gastrointestinales leves en algunos ejemplares.`,Multivitamínico:`**Composición:** Vitaminas A, D3, E, B12, Aminoácidos y Minerales. 
**Uso:** Estimulante del apetito y mejora de la conversión alimenticia. 
**Dosis:** 1-5 ml según especie y peso. IM. 
**Precauciones:** Agitar bien antes de usar. No exceder la dosis recomendada.`,"Desinfectante Instrumental":`**Composición:** Amonio Cuaternario o Glutaraldehído. 
**Uso:** Sanitización de equipos veterinarios, jeringas y áreas de ordeño. 
**Dosis:** Dilución al 1:500 o 1:1000 según carga orgánica existente. 
**Precauciones:** Evitar contacto directo con ojos y mucosas. No ingerir.`,Electrolitos:`**Composición:** Sodio, Potasio, Cloro, Magnesio y Dextrosa. 
**Uso:** Rehidratación oral para animales con diarrea o agotamiento por calor. 
**Dosis:** Disolver un sobre en 20 litros de agua de bebida. 
**Precauciones:** Preparar diariamente para asegurar la estabilidad de los componentes.`,"Calcio Inyectable":`**Composición:** Borogluconato de Calcio al 25%. 
**Uso:** Tratamiento de fiebre de leche (hipocalcemia) y deficiencias de calcio. 
**Dosis:** 250-500 ml vía IV lenta en vacas adultas. 
**Precauciones:** Administrar a temperatura corporal. Vigilar ritmo cardíaco durante aplicación.`},s=(n,o)=>{const e=(n||"").toLowerCase(),i=(o||"").toLowerCase();return e.includes("oxitetra")||e.includes("tecnimicina")||e.includes("oxiplus")||e.includes("oxi")?a.Oxitetraciclina:e.includes("penici")||e.includes("tilosin")||e.includes("broximici")||e.includes("trimsulfa")||e.includes("tigent")?a.Amoxicilina:e.includes("iverplus")||e.includes("ivermect")||e.includes("albendazol")||e.includes("lombrifin")||e.includes("vermimax")?a.Ivermectina:e.includes("vitamina")||e.includes("complejo b")||e.includes("vita b12")||e.includes("vitel")||e.includes("proteizoo")||e.includes("instavit")?a["Complejo B"]:e.includes("multivita")||e.includes("multipack")||e.includes("reconstituyente")?a.Multivitamínico:e.includes("glifosato")||e.includes("revolver")||e.includes("sementhal")||e.includes("torban")||e.includes("cegar")?a.Glifosato:e.includes("terraquat")||e.includes("duplexone")||e.includes("paraquat")?a.Paraquat:e.includes("nitróg")||e.includes("urea")||e.includes("fertilizante")?a.Urea:e.includes("15-15-15")||e.includes("foliar plus")||i.includes("abono")?a["Triple 15"]:e.includes("alimento")||e.includes("crecimiento")||e.includes("engorde")?a["Alimento Crecimiento"]:e.includes("vacuna")||e.includes("newcastle")||e.includes("cepa")?a["Vacuna Newcastle"]:e.includes("cipermetr")||e.includes("nuvan")||e.includes("insecticida")||e.includes("blindage")||e.includes("pikudo")?a.Cipermetrina:e.includes("electro")||e.includes("chemiestress")?a.Electrolitos:e.includes("calcio")||e.includes("borogl")?a["Calcio Inyectable"]:e.includes("matagusano")||e.includes("curabichera")||e.includes("jabón pet")||e.includes("shampoo")?a["Desinfectante Instrumental"]:i.includes("antib")?a.Amoxicilina:i.includes("despara")?a.Ivermectina:i.includes("vitam")||i.includes("suplemento")?a.Multivitamínico:i.includes("agroqu")||i.includes("herb")?a.Glifosato:i.includes("fertil")?a["Triple 15"]:`**Uso:** Producto especializado para el sector ${i.includes("agrícola")?"agrícola":"veterinario"}. 
**Recomendación:** El artículo "${n}" ha sido seleccionado por Agricovet por su comprobada eficiencia. Se recomienda leer la etiqueta completa y ajustar la dosis según las necesidades específicas de su producción o animal. 
**Precauciones:** Almacenar en un lugar seco y fuera del alcance de los niños. Consulte a su asesor técnico de Agricovet para un plan de manejo integral.`};export{a as PRODUCT_KNOWLEDGE_BASE,s as getGenericDescription};
