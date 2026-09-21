import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

# Asset paths
BASE_ASSETS = os.path.join(os.getcwd(), "presentation_assets")
BRAIN_ASSETS = r"C:\Users\sesef\.gemini\antigravity-ide\brain\509906f2-9a3c-418d-bd1e-f90eef3f5416"

IMG_ADVISOR = os.path.join(BRAIN_ASSETS, "field_advisor_gps_1789670442100.jpg")
IMG_OFFLINE = os.path.join(BRAIN_ASSETS, "offline_sync_tech_1789670473483.jpg")

# Real web platform screenshots
SHOT_LOGIN = os.path.join(BASE_ASSETS, "01_login_asesor.png")
SHOT_MAIN_MAP = os.path.join(BASE_ASSETS, "02_pantalla_principal_visitas.png")
SHOT_MARK_MODAL = os.path.join(BASE_ASSETS, "03_modal_fijar_gps_cliente.png")
SHOT_MARK_SEARCH = os.path.join(BASE_ASSETS, "04_busqueda_cliente_para_marcar.png")
SHOT_REG_MODAL = os.path.join(BASE_ASSETS, "05_modal_registrar_visita.png")
SHOT_REG_FORM = os.path.join(BASE_ASSETS, "05b_formulario_visita_desplegado.png")
SHOT_CARTERA_FREQ = os.path.join(BASE_ASSETS, "06b_cartera_frecuencia_visitas.png")
SHOT_ROUTES_AUDIT = os.path.join(BASE_ASSETS, "07_auditoria_rutas_visitas.png")
SHOT_MOBILE_MAP = os.path.join(BASE_ASSETS, "08_vista_movil_mapa.png")
SHOT_MOBILE_MARK = os.path.join(BASE_ASSETS, "09_movil_modal_marcar.png")

def create_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # AgricoVet Premium Color Palette
    PRIMARY_DARK = RGBColor(15, 23, 42)      # Slate 900
    TEAL_DARK = RGBColor(15, 118, 110)       # Teal 700
    TEAL_PRIMARY = RGBColor(13, 148, 136)    # Teal 600
    TEAL_LIGHT = RGBColor(204, 251, 241)     # Teal 100
    EMERALD = RGBColor(16, 185, 129)         # Emerald 500
    EMERALD_LIGHT = RGBColor(236, 253, 245)  # Emerald 50
    CARD_BG = RGBColor(248, 250, 252)        # Slate 50
    CARD_BORDER = RGBColor(226, 232, 240)    # Slate 200
    TEXT_MAIN = RGBColor(30, 41, 59)         # Slate 800
    TEXT_MUTED = RGBColor(100, 116, 139)     # Slate 500
    WHITE = RGBColor(255, 255, 255)
    AMBER = RGBColor(245, 158, 11)           # Amber 500
    AMBER_LIGHT = RGBColor(254, 243, 199)    # Amber 100
    BLUE = RGBColor(59, 130, 246)            # Blue 500
    BLUE_LIGHT = RGBColor(239, 246, 255)     # Blue 50
    PURPLE = RGBColor(139, 92, 246)          # Purple 500
    PURPLE_LIGHT = RGBColor(245, 243, 255)   # Purple 50
    ROSE = RGBColor(225, 29, 72)             # Rose 600
    ROSE_LIGHT = RGBColor(255, 241, 242)     # Rose 50

    def add_header(slide, title_text, subtitle_text, category="MÓDULO DE GESTIÓN DE VISITAS"):
        # Header accent band
        band = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(0.08))
        band.fill.solid()
        band.fill.fore_color.rgb = TEAL_PRIMARY
        band.line.fill.background()

        # Category pill
        pill = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.32), Inches(3.8), Inches(0.32))
        pill.fill.solid()
        pill.fill.fore_color.rgb = TEAL_LIGHT
        pill.line.color.rgb = TEAL_PRIMARY
        pill.line.width = Pt(1)
        tf_pill = pill.text_frame
        tf_pill.word_wrap = False
        tf_pill.margin_left = Inches(0.15)
        tf_pill.margin_top = Inches(0.02)
        p_pill = tf_pill.paragraphs[0]
        p_pill.text = f"AGRICOMET  •  {category.upper()}"
        p_pill.font.size = Pt(9.5)
        p_pill.font.bold = True
        p_pill.font.color.rgb = TEAL_DARK

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.68), Inches(11.7), Inches(0.65))
        tf = title_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.text = title_text
        p.font.size = Pt(24)
        p.font.bold = True
        p.font.color.rgb = PRIMARY_DARK

        # Subtitle
        sub_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.30), Inches(11.7), Inches(0.40))
        tf = sub_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.text = subtitle_text
        p.font.size = Pt(11.5)
        p.font.color.rgb = TEXT_MUTED

    def add_card(slide, left, top, width, height, title, items, badge_text=None, border_color=CARD_BORDER, bg_color=WHITE, accent_bar_color=None):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = bg_color
        card.line.color.rgb = border_color
        card.line.width = Pt(1.5)

        if accent_bar_color:
            top_bar = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, Inches(0.10))
            top_bar.fill.solid()
            top_bar.fill.fore_color.rgb = accent_bar_color
            top_bar.line.fill.background()

        tf = card.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.22)
        tf.margin_right = Inches(0.22)
        tf.margin_top = Inches(0.22)
        tf.margin_bottom = Inches(0.20)

        if badge_text:
            p_badge = tf.paragraphs[0]
            p_badge.text = badge_text.upper()
            p_badge.font.size = Pt(8.5)
            p_badge.font.bold = True
            p_badge.font.color.rgb = accent_bar_color if accent_bar_color else TEAL_PRIMARY
            p_badge.space_after = Pt(3)
            p_title = tf.add_paragraph()
        else:
            p_title = tf.paragraphs[0]

        p_title.text = title
        p_title.font.size = Pt(14)
        p_title.font.bold = True
        p_title.font.color.rgb = PRIMARY_DARK
        p_title.space_after = Pt(6)

        for item in items:
            p_item = tf.add_paragraph()
            p_item.text = f"•  {item}"
            p_item.font.size = Pt(10.5)
            p_item.font.color.rgb = TEXT_MAIN
            p_item.space_after = Pt(4)

        return card

    def add_screenshot_slide(slide, title, subtitle, img_path, steps, category="GUÍA PASO A PASO"):
        add_header(slide, title, subtitle, category=category)

        # Left Column: Step Cards & Instructions
        left_width = Inches(5.8)
        left_pos = Inches(0.8)
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left_pos, Inches(1.85), left_width, Inches(5.2))
        card.fill.solid()
        card.fill.fore_color.rgb = WHITE
        card.line.color.rgb = CARD_BORDER
        card.line.width = Pt(1.5)

        tf = card.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.3)
        tf.margin_right = Inches(0.3)
        tf.margin_top = Inches(0.25)

        p_h = tf.paragraphs[0]
        p_h.text = "INSTRUCCIONES DE OPERACIÓN:"
        p_h.font.size = Pt(12)
        p_h.font.bold = True
        p_h.font.color.rgb = TEAL_DARK
        p_h.space_after = Pt(8)

        for step_title, step_desc, step_badge in steps:
            p_s = tf.add_paragraph()
            p_s.text = f"{step_badge}  {step_title}"
            p_s.font.size = Pt(11.5)
            p_s.font.bold = True
            p_s.font.color.rgb = PRIMARY_DARK
            p_s.space_after = Pt(2)

            p_d = tf.add_paragraph()
            p_d.text = step_desc
            p_d.font.size = Pt(10)
            p_d.font.color.rgb = TEXT_MAIN
            p_d.space_after = Pt(8)

        # Right Column: Real Web Platform Screenshot
        if os.path.exists(img_path):
            img_box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.85), Inches(1.85), Inches(5.7), Inches(5.2))
            img_box.fill.solid()
            img_box.fill.fore_color.rgb = PRIMARY_DARK
            img_box.line.color.rgb = TEAL_PRIMARY
            img_box.line.width = Pt(2)

            slide.shapes.add_picture(img_path, Inches(6.9), Inches(1.9), width=Inches(5.6))

    # ==========================================
    # SLIDE 1: PORTADA IMPACTANTE CON ILUSTRACIÓN 3D
    # ==========================================
    slide1 = prs.slides.add_slide(blank_layout)
    bg1 = slide1.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
    bg1.fill.solid()
    bg1.fill.fore_color.rgb = PRIMARY_DARK
    bg1.line.fill.background()

    tb = slide1.shapes.add_textbox(Inches(0.9), Inches(1.3), Inches(6.2), Inches(5.0))
    tf = tb.text_frame
    tf.word_wrap = True

    p0 = tf.paragraphs[0]
    p0.text = "AGRICOMET DE GUATEMALA"
    p0.font.size = Pt(13)
    p0.font.bold = True
    p0.font.color.rgb = EMERALD
    p0.space_after = Pt(14)

    p1 = tf.add_paragraph()
    p1.text = "Módulo de Rutas y Visitas a Clientes"
    p1.font.size = Pt(36)
    p1.font.bold = True
    p1.font.color.rgb = WHITE
    p1.space_after = Pt(14)

    p2 = tf.add_paragraph()
    p2.text = "Capacitación Operativa Paso a Paso: Desde la Primera Asignación hasta el Hábito Rutinario"
    p2.font.size = Pt(15)
    p2.font.color.rgb = RGBColor(148, 163, 184)
    p2.space_after = Pt(24)

    p3 = tf.add_paragraph()
    p3.text = "📍 Georreferenciación Satelital  •  📸 Evidencia en Terreno  •  🤝 Gestión de Cartera"
    p3.font.size = Pt(11)
    p3.font.color.rgb = TEAL_LIGHT

    if os.path.exists(IMG_ADVISOR):
        slide1.shapes.add_picture(IMG_ADVISOR, Inches(7.4), Inches(0.85), width=Inches(5.3))

    # ==========================================
    # SLIDE 2: POR QUÉ IMPLEMENTAMOS ESTE MÓDULO
    # ==========================================
    slide2 = prs.slides.add_slide(blank_layout)
    add_header(slide2, "¿Por qué implementamos este Módulo de Visitas?", "Beneficios directos tanto para tu trabajo diario en carretera como para la empresa.")

    cards_data = [
        ("Para Ti como Asesor", [
            "Respaldo 100% oficial de tus horas y kilómetros recorridos.",
            "Cero reclamos: Cada visita queda certificada con hora, fecha y foto.",
            "Cartera Inteligente: Tu teléfono te dice quién está cerca de ti.",
            "Menos tiempo en carretera y mayor efectividad en cada viaje."
        ], "RESPALDO TOTAL", TEAL_PRIMARY),
        ("Para la Empresa", [
            "Mapeo comercial completo de agropecuarias y fincas del país.",
            "Medición real de frecuencia de atención y servicio.",
            "Cero clientes olvidados o abandonados en ruta.",
            "Reportes automáticos sin necesidad de bitácoras manuales en papel."
        ], "TRANSPARENCIA", BLUE),
        ("Para el Cliente", [
            "Atención técnica puntual y asesoría constante en su negocio.",
            "Resolución inmediata de pedidos, saldos y entregas.",
            "Seguimiento profesional directo con su asesor de confianza.",
            "Directamente sincronizado con ventas y recibos de caja."
        ], "MÁS VENTAS", EMERALD)
    ]
    for i, (title, items, badge, accent_color) in enumerate(cards_data):
        add_card(slide2, Inches(0.8 + i * 4.0), Inches(2.0), Inches(3.7), Inches(4.8), title, items, badge, accent_bar_color=accent_color)

    # ==========================================
    # SLIDE 3: PASO CERO: ACTIVAR GPS EN EL TELÉFONO
    # ==========================================
    slide3 = prs.slides.add_slide(blank_layout)
    add_header(slide3, "Paso Cero: Activar el GPS en tu Teléfono", "La aplicación necesita tu ubicación precisa para marcar clientes y certificar visitas.")

    add_card(slide3, Inches(0.8), Inches(2.0), Inches(5.7), Inches(4.8), "📱 En Teléfonos Android", [
        "Desliza hacia abajo la barra superior y activa 'Ubicación' (GPS).",
        "Abre la app de AgricoVet o ingresa a https://agricovet.lat.",
        "Cuando el navegador pregunte: '¿Permitir ubicación?', elige 'Permitir mientras se usa la app'.",
        "Ajustes > Apps > Chrome/AgricoVet > Permisos: Activa 'Ubicación precisa'.",
        "✅ Si ves tu punto azul en el mapa, tu GPS está listo y sincronizado."
    ], "ANDROID PASO A PASO", accent_bar_color=EMERALD)

    add_card(slide3, Inches(6.8), Inches(2.0), Inches(5.7), Inches(4.8), "🍎 En Teléfonos iPhone (iOS)", [
        "Ve a Configuración > Privacidad y Seguridad > Localización.",
        "Asegúrate de que 'Localización' esté ENCENDIDA (Verde).",
        "Busca Safari (o Chrome) en la lista de aplicaciones.",
        "Selecciona 'Al usar la app' y enciende el interruptor 'Ubicación precisa'.",
        "Al entrar a la app, toca 'Permitir al usar el sitio web'.",
        "💡 Consejo: Evita usar navegación privada para mantener tu sesión."
    ], "IPHONE / IOS PASO A PASO", accent_bar_color=BLUE)

    # ==========================================
    # SLIDE 4: TU PRIMER INGRESO A LA PLATAFORMA (FOTO REAL LOGIN)
    # ==========================================
    slide4 = prs.slides.add_slide(blank_layout)
    add_screenshot_slide(
        slide4,
        "Tu Primer Ingreso: Acceso Seguro Corporativo",
        "Ingresa con tus credenciales asignadas una sola vez; la app recordará tu sesión.",
        SHOT_LOGIN,
        [
            ("Paso 1: Abrir el Enlace", "Ingresa desde tu teléfono o computadora a https://agricovet.lat/#visits.", "[PASO 1]"),
            ("Paso 2: Código de Vendedor", "Digita tu código de 4 dígitos proporcionado por Administración.", "[PASO 2]"),
            ("Paso 3: Token de Acceso", "Ingresa tu token seguro o clave asignada para activar el dispositivo.", "[PASO 3]"),
            ("Paso 4: Toca 'Ingresar al Sistema'", "La plataforma autentica tu rol de Asesor y mantiene tu sesión activa durante 180 días sin pedirte clave a cada rato.", "[PASO 4]")
        ],
        category="FASE 1: PRIMER INGRESO"
    )

    # ==========================================
    # SLIDE 5: CONOCIENDO EL CENTRO DE COMANDO (FOTO REAL MAPA)
    # ==========================================
    slide5 = prs.slides.add_slide(blank_layout)
    add_screenshot_slide(
        slide5,
        "Centro de Comando: Pantalla Principal de Visitas",
        "Tu panel visual donde verás tus clientes en Guatemala, estado de visitas y accesos rápidos.",
        SHOT_MAIN_MAP,
        [
            ("Indicador GPS en Vivo", "Muestra 'GPS Conectado' con tus coordenadas exactas y precisión en metros (±8m). Si está en verde, estás listo.", "[GPS SATELITAL]"),
            ("Tarjetas de Resumen", "Muestra 'Visitas de Hoy', 'Clientes con GPS' y 'Radar >15 Días' para clientes que requieren atención urgente.", "[MÉTRICAS DEL DÍA]"),
            ("Botón 'Fijar GPS Cliente'", "Úsalo la PRIMERA VEZ que visitas un cliente nuevo o sin coordenadas.", "[ACCIÓN 1]"),
            ("Botón 'Registrar Visita GPS'", "Úsalo de forma RUTINARIA cada vez que atiendas a un cliente en su local.", "[ACCIÓN 2]")
        ],
        category="FASE 1: INDUCCIÓN AL MAPA"
    )

    # ==========================================
    # SLIDE 6: PASO A PASO INICIAL 1: LLEGAR AL LOCAL Y TOCAR FIJAR GPS (FOTO REAL MODAL MARCAR)
    # ==========================================
    slide6 = prs.slides.add_slide(blank_layout)
    add_screenshot_slide(
        slide6,
        "Asignar Cliente (Paso 1): Llegar al Negocio y Tocar 'Fijar GPS'",
        "Este proceso se realiza UNA SOLA VEZ por cliente para posicionarlo en el mapa para siempre.",
        SHOT_MARK_MODAL,
        [
            ("Regla de Oro en Terreno", "Párate físicamente frente a la puerta, mostrador o entrada de la agropecuaria, farmacia o finca.", "[REGLA DE ORO]"),
            ("Toca 'Fijar GPS Cliente'", "Presiona el botón blanco con icono de pin de mapa en la parte superior.", "[BOTÓN DIRECTO]"),
            ("Verificación Satelital", "La ventana emergente 'Marcar Cliente Aquí' confirmará tus coordenadas actuales en verde: 'Excelente (±8m)'.", "[PRECISIÓN SATELITAL]"),
            ("Listado de Clientes", "Verás la lista de todos los clientes de la empresa listos para ser vinculados a tu ubicación.", "[DIRECTORIO EN VIVO]")
        ],
        category="PASO A PASO: PRIMERA VEZ"
    )

    # ==========================================
    # SLIDE 7: PASO A PASO INICIAL 2: BUSCAR AL CLIENTE (FOTO REAL BÚSQUEDA)
    # ==========================================
    slide7 = prs.slides.add_slide(blank_layout)
    add_screenshot_slide(
        slide7,
        "Asignar Cliente (Paso 2): Buscar al Cliente en el Directorio",
        "Encuentra rápidamente al cliente escribiendo su nombre, código o establecimiento.",
        SHOT_MARK_SEARCH,
        [
            ("Escribe en la Barra de Búsqueda", "Escribe las primeras letras del nombre (ej. 'Agro') o el código del cliente.", "[BÚSQUEDA RÁPIDA]"),
            ("Filtro Inteligente Inmediato", "La lista filtra al instante: muestra nombre fiscal, nombre comercial (ej. 'Agroservicios el Jona') y teléfono.", "[DATOS DEL CLIENTE]"),
            ("Selecciona el Cliente", "Toca la tarjeta del cliente que tienes enfrente para marcarlo con el círculo de selección.", "[SELECCIÓN]"),
            ("Confirmación de Datos", "Asegúrate de que la dirección mostrada coincida con el municipio o aldea donde te encuentras.", "[VERIFICACIÓN]")
        ],
        category="PASO A PASO: PRIMERA VEZ"
    )

    # ==========================================
    # SLIDE 8: PASO A PASO INICIAL 3: FIJAR UBICACIÓN DEFINITIVA
    # ==========================================
    slide8 = prs.slides.add_slide(blank_layout)
    add_screenshot_slide(
        slide8,
        "Asignar Cliente (Paso 3): Guardar Ubicación Definitiva",
        "Con un solo toque, el cliente queda georreferenciado y visible para toda la empresa.",
        SHOT_MARK_MODAL,
        [
            ("Presiona 'Fijar Ubicación Aquí'", "Toca el botón azul en la esquina inferior derecha del modal.", "[GUARDAR COORDENADAS]"),
            ("Certificación Instantánea", "El sistema almacena la latitud y longitud exactas en el servidor central.", "[SINCRONIZADO]"),
            ("Aparición de Pin Verde", "En el mapa aparecerá un nuevo pin verde en tu posición exacta.", "[PIN PERMANENTE]"),
            ("¡Listo para Siempre!", "Nunca más tendrás que georreferenciar a este cliente. A partir de hoy, la app calculará distancias en kilómetros automáticamente hacia él.", "[ÉXITO OPERATIVO]")
        ],
        category="PASO A PASO: PRIMERA VEZ"
    )

    # ==========================================
    # SLIDE 9: FLUJO RUTINARIO 1: INICIAR JORNADA DE RUTA (FOTO REAL AUDITORÍA RUTAS)
    # ==========================================
    slide9 = prs.slides.add_slide(blank_layout)
    add_screenshot_slide(
        slide9,
        "Flujo Rutinario (Mañana): Iniciar tu Jornada de Trabajo",
        "Al subir a tu vehículo o moto por la mañana, activa tu jornada oficial.",
        SHOT_ROUTES_AUDIT,
        [
            ("Activar al Salir", "En la sección de Visitas, pulsa 'Iniciar Ruta del Día' para registrar tu hora de partida.", "[INICIO DE JORNADA]"),
            ("Auditoría en Tiempo Real", "El sistema registra checkpoints GPS, kilómetros recorridos y paradas realizadas.", "[TRAZABILIDAD]"),
            ("Métricas de Rendimiento", "Muestra tu tiempo promedio por parada (~103 min) y ciclo de retorno entre clientes.", "[EFICIENCIA COMERCIAL]"),
            ("Respaldo Laboral", "Respalda tus horas trabajadas en carretera ante la gerencia de ventas sin necesidad de reportes manuales.", "[TRANSPARENCIA]")
        ],
        category="FLUJO RUTINARIO DIARIO"
    )

    # ==========================================
    # SLIDE 10: FLUJO RUTINARIO 2: REGISTRAR VISITA EN TERRENO (FOTO REAL MODAL REGISTRO)
    # ==========================================
    slide10 = prs.slides.add_slide(blank_layout)
    add_screenshot_slide(
        slide10,
        "Flujo Rutinario (En Local): Tocar 'Registrar Visita GPS'",
        "Cada vez que te estaciones y entres con el cliente, registra la visita en 30 segundos.",
        SHOT_REG_MODAL,
        [
            ("Toca 'Registrar Visita GPS'", "Presiona el botón verde con el icono '+' en la barra superior o flotante.", "[NUEVA PARADA]"),
            ("Ubicación Certificada", "La app valida que estás en el lugar y vincula el GPS del vendedor en vivo.", "[VALIDACIÓN EN CAMPO]"),
            ("Selecciona el Cliente", "Elige al cliente que estás atendiendo del listado rápido o buscador.", "[IDENTIFICACIÓN]"),
            ("Clasifica el Motivo", "Selecciona entre los 5 motivos oficiales: Cobro, Pedido, Rutina, Prospección o Entrega.", "[CATEGORÍA COMERCIAL]")
        ],
        category="FLUJO RUTINARIO DIARIO"
    )

    # ==========================================
    # SLIDE 11: FLUJO RUTINARIO 3: FORMULARIO COMPLETO Y FOTO (FOTO REAL FORM DESPLEGADO)
    # ==========================================
    slide11 = prs.slides.add_slide(blank_layout)
    add_screenshot_slide(
        slide11,
        "Flujo Rutinario: Foto Obligatoria y Notas Rápidas",
        "La evidencia fotográfica es el sello de garantía de que la visita se ejecutó en terreno.",
        SHOT_REG_FORM,
        [
            ("Foto de Comprobante / Fachada", "Toca el botón rojo '📷 Tomar Foto Ahora'. Toma foto a la fachada, mostrador, o boleta firmada.", "[FOTO OBLIGATORIA]"),
            ("Compresión Inteligente", "La app comprime la foto automáticamente a formato ultra-ligero para no gastar tus datos móviles.", "[CUIDA TUS DATOS]"),
            ("Notas y Acuerdos Comerciales", "Toca los chips rápidos ('Pedido tomado', 'Cobro recibido', 'Stock en orden') o escribe observaciones.", "[CHIPS RÁPIDOS]"),
            ("Toca 'Guardar Visita con Foto'", "¡Listo! La visita queda grabada en tu historial con hora, fecha, coordenadas y fotografía.", "[CERTIFICACIÓN]")
        ],
        category="FLUJO RUTINARIO DIARIO"
    )

    # ==========================================
    # SLIDE 12: FLUJO RUTINARIO 4: CARTERA Y SEMÁFORO DE FRECUENCIA (FOTO REAL TABLA FRECUENCIA)
    # ==========================================
    slide12 = prs.slides.add_slide(blank_layout)
    add_screenshot_slide(
        slide12,
        "Flujo Rutinario: 'Mi Cartera' Ordenada por Cercanía",
        "Tu teléfono te asiste para que nunca viajes en vano y visites a los clientes que tienes cerca.",
        SHOT_CARTERA_FREQ,
        [
            ("Cálculo de Distancia GPS", "Ordena tus clientes desde el más cercano (ej. a 800m) hasta el más lejano en carretera.", "[CERCANÍA INTELIGENTE]"),
            ("Navegación Guiada con Waze / Maps", "Toca el botón 'Waze' o 'Maps' en la ficha del cliente para abrir navegación por voz hasta su puerta.", "[GPS PASO A PASO]"),
            ("Semáforo de Frecuencia", "🔴 URGENTE (> 15 días sin visita): Clientes en riesgo de desatención. 🟢 AL DÍA: Atendidos recientemente.", "[SEMÁFORO COMERCIAL]"),
            ("Filtros por Asesor", "Visualiza exclusivamente tu cartera asignada o la de todo el equipo comercial.", "[CONTROL DE CARTERA]")
        ],
        category="FLUJO RUTINARIO DIARIO"
    )

    # ==========================================
    # SLIDE 13: OPERACIÓN EN SMARTPHONES (FOTO REAL MÓVIL)
    # ==========================================
    slide13 = prs.slides.add_slide(blank_layout)
    add_screenshot_slide(
        slide13,
        "Operación en el Teléfono Móvil del Asesor",
        "Diseño táctil ultra-rápido optimizado para usar con una sola mano bajo el sol de campo.",
        SHOT_MOBILE_MAP,
        [
            ("Barra Inferior Rápida", "Accesos directos a 'Inicio', 'Ventas', 'Ventas Diarias' y 'Visitas' siempre a mano.", "[NAVEGACIÓN TÁCTIL]"),
            ("Botones de Gran Tamaño", "'Fijar GPS Cliente' y 'Registrar Visita GPS' visibles en la parte superior sin menús escondidos.", "[BOTONES ACCIÓN]"),
            ("Rendimiento con Pantalla Apagada", "No necesitas mantener la app abierta todo el viaje; solo ábrela al llegar a cada cliente.", "[AHORRO DE BATERÍA]"),
            ("Compatible con Android y iPhone", "Funciona directamente en Google Chrome y Safari como una app nativa.", "[PWA INSTALABLE]")
        ],
        category="EXPERIENCIA MÓVIL"
    )

    # ==========================================
    # SLIDE 14: QUÉ PASA SI NO HAY SEÑAL DE INTERNET (MODO OFFLINE 3D)
    # ==========================================
    slide14 = prs.slides.add_slide(blank_layout)
    add_header(slide14, "¿Qué pasa si no hay señal de internet en la finca?", "El sistema está diseñado para trabajar en campo abierto sin cobertura móvil.")

    add_card(slide14, Inches(0.8), Inches(2.0), Inches(5.5), Inches(4.8), "Tecnología Satelital Offline", [
        "1. El GPS SÍ Funciona sin Internet: El chip GPS de tu teléfono conecta directo a satélites en el espacio sin consumir datos.",
        "2. Guardado Local Seguro: La visita y foto se guardan en la memoria interna de tu teléfono con icono '📡 Guardada sin conexión'.",
        "3. Auto-Sincronización Silenciosa: Al volver a carretera o zona con señal 3G/4G/Wi-Fi, la app sube todo automáticamente al servidor.",
        "4. Cero Pérdida de Información: Tus visitas no se pierden aunque se apague el teléfono o se quede sin batería."
    ], "CERO PÉRDIDA DE DATOS", accent_bar_color=EMERALD)

    if os.path.exists(IMG_OFFLINE):
        slide14.shapes.add_picture(IMG_OFFLINE, Inches(6.8), Inches(2.0), width=Inches(5.7))

    # ==========================================
    # SLIDE 15: LOS 5 MANDAMIENTOS DEL ASESOR
    # ==========================================
    slide15 = prs.slides.add_slide(blank_layout)
    add_header(slide15, "Los 5 Mandamientos del Asesor en Campo", "Reglas operativas de oro para una jornada impecable y sin fricciones.")

    rules = [
        ("1. Sal de Casa con GPS Activo", "Verifica la barra superior de tu teléfono antes de arrancar la jornada.", EMERALD),
        ("2. Marca al Cliente UNA Sola Vez", "Fija la ubicación la primera vez que visites el local; quedará guardada permanentemente.", TEAL_PRIMARY),
        ("3. Registra la Visita FRENTE al Negocio", "El sistema valida la distancia real; no registres visitas desde el hotel o tu casa.", BLUE),
        ("4. Foto Clara y Sin Excusas", "Toma foto de fachada, mostrador o recibo. La app la comprime sola y no gasta tu plan de datos.", AMBER),
        ("5. Finaliza tu Ruta al Terminar el Día", "Cierra tu jornada para que tus reportes queden consolidados y auditados ante gerencia.", PURPLE)
    ]
    for i, (r_title, r_desc, accent) in enumerate(rules):
        top_pos = Inches(2.0 + i * 0.96)
        card = slide15.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), top_pos, Inches(11.7), Inches(0.82))
        card.fill.solid()
        card.fill.fore_color.rgb = WHITE
        card.line.color.rgb = CARD_BORDER
        card.line.width = Pt(1.5)

        num_circle = slide15.shapes.add_shape(MSO_SHAPE.OVAL, Inches(1.0), top_pos + Inches(0.16), Inches(0.5), Inches(0.5))
        num_circle.fill.solid()
        num_circle.fill.fore_color.rgb = accent
        num_circle.line.fill.background()
        tf_num = num_circle.text_frame
        p_num = tf_num.paragraphs[0]
        p_num.alignment = PP_ALIGN.CENTER
        p_num.text = str(i + 1)
        p_num.font.size = Pt(14)
        p_num.font.bold = True
        p_num.font.color.rgb = WHITE

        tf = card.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.85)
        tf.margin_top = Inches(0.12)
        p = tf.paragraphs[0]
        p.text = f"{r_title}:  "
        p.font.size = Pt(13)
        p.font.bold = True
        p.font.color.rgb = accent
        run = p.add_run()
        run.text = r_desc
        run.font.size = Pt(11.5)
        run.font.bold = False
        run.font.color.rgb = TEXT_MAIN

    # ==========================================
    # SLIDE 16: CIERRE Y DINÁMICA PRÁCTICA DEL LUNES
    # ==========================================
    slide16 = prs.slides.add_slide(blank_layout)
    bg16 = slide16.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
    bg16.fill.solid()
    bg16.fill.fore_color.rgb = PRIMARY_DARK
    bg16.line.fill.background()

    tb_c = slide16.shapes.add_textbox(Inches(1.0), Inches(1.0), Inches(11.333), Inches(5.5))
    tf_c = tb_c.text_frame
    tf_c.word_wrap = True

    p = tf_c.paragraphs[0]
    p.text = "DINÁMICA PRÁCTICA EN VIVO"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = EMERALD
    p.space_after = Pt(10)

    p = tf_c.add_paragraph()
    p.text = "¡Ahora es tu Turno de Probarlo!"
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.space_after = Pt(20)

    instructions = [
        "1. Abre tu teléfono en este instante e ingresa a https://agricovet.lat/#visits.",
        "2. Inicia sesión con tu código de asesor.",
        "3. Verifica que tu punto azul aparezca en el mapa de la sala de reuniones.",
        "4. Presiona 'Fijar GPS Cliente' y haz una simulación marcando un cliente de prueba.",
        "5. Toma una foto a tu compañero y registra tu primera visita de prueba."
    ]
    for ins in instructions:
        p = tf_c.add_paragraph()
        p.text = f"👉  {ins}"
        p.font.size = Pt(15)
        p.font.color.rgb = TEAL_LIGHT
        p.space_after = Pt(10)

    p = tf_c.add_paragraph()
    p.text = "\n¿Preguntas o Dudas?  •  ¡El equipo de AgricoVet está listo para el terreno!"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = RGBColor(148, 163, 184)

    output_path = os.path.join(os.getcwd(), "Presentacion_Modulo_Visitas_AgricoVet.pptx")
    prs.save(output_path)
    print(f"Presentation saved successfully to: {output_path}")

    # Also copy to Windows Desktop for immediate access
    desktop_path = r"C:\Users\sesef\Desktop\Presentacion_Modulo_Visitas_AgricoVet.pptx"
    try:
        prs.save(desktop_path)
        print(f"Presentation also saved to Desktop: {desktop_path}")
    except Exception as e:
        print(f"Could not save to desktop: {e}")

if __name__ == "__main__":
    create_deck()
