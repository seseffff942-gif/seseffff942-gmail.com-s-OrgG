import json
import xlsxwriter
import shutil
import os

output_filename = 'Reporte_Conciliacion_Ventas_Libreta_Folio_809.xlsx'
desktop_path = r'C:\Users\sesef\Desktop\Reporte_Conciliacion_Ventas_Libreta_Folio_809.xlsx'

wb = xlsxwriter.Workbook(output_filename)

# Paleta de Colores Corporativa Ejecutiva
TEAL_DARK = '#004f50'
TEAL_MAIN = '#00696a'
TEAL_LIGHT = '#e6f4f4'
EMERALD = '#10b981'
EMERALD_LIGHT = '#ecfdf5'
EMERALD_TEXT = '#065f46'
AMBER = '#d97706'
AMBER_LIGHT = '#fffbeb'
AMBER_TEXT = '#92400e'
GRAY_BG = '#f8fafc'
GRAY_BORDER = '#cbd5e1'
WHITE = '#ffffff'

# Formatos
fmt_title = wb.add_format({
    'font_name': 'Segoe UI', 'font_size': 16, 'bold': True, 'font_color': WHITE,
    'bg_color': TEAL_MAIN, 'align': 'left', 'valign': 'vcenter'
})
fmt_subtitle = wb.add_format({
    'font_name': 'Segoe UI', 'font_size': 10, 'italic': True, 'font_color': WHITE,
    'bg_color': TEAL_MAIN, 'align': 'left', 'valign': 'vcenter'
})
fmt_kpi_label = wb.add_format({
    'font_name': 'Segoe UI', 'font_size': 9, 'bold': True, 'font_color': '#64748b',
    'bg_color': GRAY_BG, 'align': 'center', 'valign': 'vcenter', 'top': 1, 'left': 1, 'right': 1,
    'border_color': GRAY_BORDER
})
fmt_kpi_val_currency = wb.add_format({
    'font_name': 'Segoe UI', 'font_size': 16, 'bold': True, 'font_color': TEAL_DARK,
    'bg_color': GRAY_BG, 'align': 'center', 'valign': 'vcenter', 'bottom': 1, 'left': 1, 'right': 1,
    'border_color': GRAY_BORDER, 'num_format': '"Q "#,##0.00'
})
fmt_kpi_val_num = wb.add_format({
    'font_name': 'Segoe UI', 'font_size': 16, 'bold': True, 'font_color': '#0f172a',
    'bg_color': GRAY_BG, 'align': 'center', 'valign': 'vcenter', 'bottom': 1, 'left': 1, 'right': 1,
    'border_color': GRAY_BORDER
})
fmt_kpi_val_amber = wb.add_format({
    'font_name': 'Segoe UI', 'font_size': 16, 'bold': True, 'font_color': AMBER,
    'bg_color': AMBER_LIGHT, 'align': 'center', 'valign': 'vcenter', 'bottom': 1, 'left': 1, 'right': 1,
    'border_color': '#fde68a'
})
fmt_th = wb.add_format({
    'font_name': 'Segoe UI', 'font_size': 10, 'bold': True, 'font_color': WHITE,
    'bg_color': TEAL_MAIN, 'align': 'center', 'valign': 'vcenter', 'border': 1,
    'border_color': TEAL_DARK
})
fmt_td = wb.add_format({
    'font_name': 'Segoe UI', 'font_size': 9, 'valign': 'vcenter', 'border': 1,
    'border_color': '#e2e8f0'
})
fmt_td_wrap = wb.add_format({
    'font_name': 'Segoe UI', 'font_size': 8.5, 'valign': 'vcenter', 'border': 1,
    'border_color': '#e2e8f0', 'text_wrap': True
})
fmt_td_center = wb.add_format({
    'font_name': 'Segoe UI', 'font_size': 9, 'align': 'center', 'valign': 'vcenter', 'border': 1,
    'border_color': '#e2e8f0'
})
fmt_td_currency = wb.add_format({
    'font_name': 'Segoe UI', 'font_size': 9, 'align': 'right', 'valign': 'vcenter', 'border': 1,
    'border_color': '#e2e8f0', 'num_format': '"Q "#,##0.00'
})
fmt_status_efectivo = wb.add_format({
    'font_name': 'Segoe UI', 'font_size': 9, 'bold': True, 'font_color': EMERALD_TEXT,
    'bg_color': EMERALD_LIGHT, 'align': 'center', 'valign': 'vcenter', 'border': 1, 'border_color': '#a7f3d0'
})
fmt_status_pendiente = wb.add_format({
    'font_name': 'Segoe UI', 'font_size': 9, 'bold': True, 'font_color': AMBER_TEXT,
    'bg_color': AMBER_LIGHT, 'align': 'center', 'valign': 'vcenter', 'border': 1, 'border_color': '#fde68a'
})
fmt_total_row = wb.add_format({
    'font_name': 'Segoe UI', 'font_size': 10, 'bold': True, 'bg_color': '#f1f5f9',
    'valign': 'vcenter', 'border': 1, 'border_color': GRAY_BORDER
})
fmt_total_center = wb.add_format({
    'font_name': 'Segoe UI', 'font_size': 10, 'bold': True, 'bg_color': '#f1f5f9',
    'align': 'center', 'valign': 'vcenter', 'border': 1, 'border_color': GRAY_BORDER
})
fmt_total_currency = wb.add_format({
    'font_name': 'Segoe UI', 'font_size': 10, 'bold': True, 'bg_color': '#f1f5f9',
    'align': 'right', 'valign': 'vcenter', 'border': 1, 'border_color': GRAY_BORDER, 'num_format': '"Q "#,##0.00'
})

# Cargar datos consolidados
with open('scripts/clean_master_audit_52.json', 'r', encoding='utf-8') as f:
    clients_data = json.load(f)

with open('scripts/master_invoices_detail_52.json', 'r', encoding='utf-8') as f:
    invoices_data = json.load(f)

# ==============================================================================
# HOJA 1: CONCILIACIÓN Y AUDITORÍA MASTER
# ==============================================================================
ws1 = wb.add_worksheet('Conciliación y Auditoría')
ws1.set_zoom(90)
ws1.hide_gridlines(0)

# Configuración Profesional de Impresión
ws1.set_landscape()
ws1.set_paper(1)  # Carta / Letter
ws1.fit_to_pages(1, 0)  # Ajustar a 1 página de ancho, alto automático
ws1.set_margins(left=0.25, right=0.25, top=0.4, bottom=0.4)
ws1.center_horizontally()
ws1.repeat_rows(8)  # Repetir encabezados de tabla en cada página impresa
ws1.set_footer('&LReporte Ejecutivo de Conciliación - Folio 809&C&P de &N&R&D')

# Anchos de columna optimizados para imprimir sin recortes
ws1.set_column('A:A', 1.5)
ws1.set_column('B:B', 5)    # ID
ws1.set_column('C:C', 23)   # Cliente Libreta
ws1.set_column('D:D', 18)   # Ubicación
ws1.set_column('E:E', 13)   # Periodo Libreta
ws1.set_column('F:F', 19)   # Estado
ws1.set_column('G:G', 9)    # Facturas
ws1.set_column('H:H', 15)   # Facturado (Q)
ws1.set_column('I:I', 18)   # Folios
ws1.set_column('J:J', 14)   # Vendedor
ws1.set_column('K:K', 38)   # Diagnóstico

# Título
ws1.merge_range('B2:K2', ' INFORME EJECUTIVO: CONCILIACIÓN DE CLIENTES DE RUTA (PETÉN)', fmt_title)
ws1.merge_range('B3:K3', ' Auditoría de seguimiento comercial: Cartera asignada a Erick Juárez desde Folio 809 (Enero - Junio)', fmt_subtitle)
ws1.set_row(1, 28)
ws1.set_row(2, 18)

# Métricas Principales (KPI Cards)
tot_clientes = len(clients_data)
activos_count = sum(1 for x in clients_data if x['estado'] == 'ACTIVO')
pendientes_count = sum(1 for x in clients_data if x['estado'] == 'PENDIENTE')
total_erick = sum(x['totalErick'] for x in clients_data)
total_facturas = sum(x['facturasErick'] for x in clients_data)

# KPI 1: Total Asignados
ws1.merge_range('B5:C5', 'TOTAL CLIENTES AUDITADOS', fmt_kpi_label)
ws1.merge_range('B6:C6', tot_clientes, fmt_kpi_val_num)

# KPI 2: Con Venta Efectiva
ws1.merge_range('D5:E5', 'ACTIVOS (CON VENTA REGISTRADA)', fmt_kpi_label)
ws1.merge_range('D6:E6', f'{activos_count} ({((activos_count/tot_clientes)*100):.1f}%)', fmt_kpi_val_num)

# KPI 3: Pendientes de Visita
ws1.merge_range('F5:G5', 'PENDIENTES DE VISITA / SIN VENTA', fmt_kpi_label)
ws1.merge_range('F6:G6', f'{pendientes_count} ({((pendientes_count/tot_clientes)*100):.1f}%)', fmt_kpi_val_amber)

# KPI 4: Total Facturado Erick
ws1.merge_range('H5:I5', 'FACTURACIÓN TOTAL ERICK JUÁREZ', fmt_kpi_label)
ws1.merge_range('H6:I6', total_erick, fmt_kpi_val_currency)

# KPI 5: Facturas Emitidas
ws1.merge_range('J5:K5', 'TOTAL FACTURAS PROCESADAS', fmt_kpi_label)
ws1.merge_range('J6:K6', f'{total_facturas} Facturas', fmt_kpi_val_num)

ws1.set_row(4, 18)
ws1.set_row(5, 26)

# Encabezados de Tabla
tbl_start = 8
ws1.write(tbl_start, 1, 'No.', fmt_th)
ws1.write(tbl_start, 2, 'Cliente según Libreta', fmt_th)
ws1.write(tbl_start, 3, 'Ubicación / Municipio', fmt_th)
ws1.write(tbl_start, 4, 'Periodo Libreta', fmt_th)
ws1.write(tbl_start, 5, 'Estado de Gestión', fmt_th)
ws1.write(tbl_start, 6, 'Facturas', fmt_th)
ws1.write(tbl_start, 7, 'Facturado Erick (Q)', fmt_th)
ws1.write(tbl_start, 8, 'Folios Registrados', fmt_th)
ws1.write(tbl_start, 9, 'Vendedor Asignado', fmt_th)
ws1.write(tbl_start, 10, 'Diagnóstico y Recomendación Comercial', fmt_th)
ws1.set_row(tbl_start, 24)

row_idx = tbl_start + 1
for c in clients_data:
    ws1.write(row_idx, 1, c['id'], fmt_td_center)
    ws1.write(row_idx, 2, c['nombre'], fmt_td)
    ws1.write(row_idx, 3, c['lugar'], fmt_td)
    ws1.write(row_idx, 4, c['periodo'], fmt_td_center)
    
    if c['estado'] == 'ACTIVO':
        ws1.write(row_idx, 5, 'ACTIVO (CON VENTA)', fmt_status_efectivo)
    else:
        ws1.write(row_idx, 5, 'PENDIENTE DE VISITA', fmt_status_pendiente)
        
    ws1.write(row_idx, 6, c['facturasErick'], fmt_td_center)
    ws1.write(row_idx, 7, c['totalErick'], fmt_td_currency)
    ws1.write(row_idx, 8, c['folios'], fmt_td_center)
    ws1.write(row_idx, 9, c['vendedor'], fmt_td_center)
    ws1.write(row_idx, 10, c['diagnostico'], fmt_td_wrap)
    ws1.set_row(row_idx, 28)
    row_idx += 1

# Fila de Totales
ws1.write(row_idx, 1, 'TOTAL', fmt_total_row)
ws1.write(row_idx, 2, f'{tot_clientes} Clientes Auditados', fmt_total_row)
ws1.write(row_idx, 3, '', fmt_total_row)
ws1.write(row_idx, 4, '', fmt_total_row)
ws1.write(row_idx, 5, f'{activos_count} Activos / {pendientes_count} Pend.', fmt_total_center)
ws1.write_formula(row_idx, 6, f'=SUM(G{tbl_start+2}:G{row_idx})', fmt_total_center)
ws1.write_formula(row_idx, 7, f'=SUM(H{tbl_start+2}:H{row_idx})', fmt_total_currency)
ws1.write(row_idx, 8, f'{total_facturas} Facturas', fmt_total_center)
ws1.write(row_idx, 9, '', fmt_total_row)
ws1.write(row_idx, 10, '', fmt_total_row)
ws1.set_row(row_idx, 24)

# ==============================================================================
# HOJA 2: DETALLE DE FACTURAS EMITIDAS
# ==============================================================================
ws2 = wb.add_worksheet('Detalle Facturas')
ws2.set_zoom(90)
ws2.hide_gridlines(0)

# Configuración Profesional de Impresión
ws2.set_landscape()
ws2.set_paper(1)  # Carta / Letter
ws2.fit_to_pages(1, 0)  # Ajustar a 1 página de ancho
ws2.set_margins(left=0.25, right=0.25, top=0.4, bottom=0.4)
ws2.center_horizontally()
ws2.repeat_rows(5)  # Repetir encabezados en cada página
ws2.set_footer('&LDetalle de Facturas Emitidas - Erick Juárez&C&P de &N&R&D')

ws2.set_column('A:A', 1.5)
ws2.set_column('B:B', 8)   # Folio
ws2.set_column('C:C', 12)  # Fecha
ws2.set_column('D:D', 22)  # Cliente Libreta
ws2.set_column('E:E', 34)  # Razón Social Factura
ws2.set_column('F:F', 20)  # Lugar
ws2.set_column('G:G', 14)  # Monto (Q)
ws2.set_column('H:H', 18)  # Vendedor

ws2.merge_range('B2:H2', ' DETALLE DE FACTURAS EMITIDAS POR ERICK JUÁREZ', fmt_title)
ws2.merge_range('B3:H3', f' Relación completa de {len(invoices_data)} comprobantes fiscales emitidos a la cartera asignada (Folio 809 en adelante)', fmt_subtitle)
ws2.set_row(1, 28)
ws2.set_row(2, 18)

f_start = 5
ws2.write(f_start, 1, 'Folio', fmt_th)
ws2.write(f_start, 2, 'Fecha', fmt_th)
ws2.write(f_start, 3, 'Cliente Libreta', fmt_th)
ws2.write(f_start, 4, 'Cliente Facturado (Razón Social)', fmt_th)
ws2.write(f_start, 5, 'Municipio / Zona', fmt_th)
ws2.write(f_start, 6, 'Total Factura (Q)', fmt_th)
ws2.write(f_start, 7, 'Vendedor Responsable', fmt_th)
ws2.set_row(f_start, 22)

f_row = f_start + 1
for fact in invoices_data:
    ws2.write(f_row, 1, fact['folio'], fmt_td_center)
    ws2.write(f_row, 2, fact['fecha'], fmt_td_center)
    ws2.write(f_row, 3, fact['refLibreta'], fmt_td)
    ws2.write(f_row, 4, fact['clienteFactura'], fmt_td_wrap)
    ws2.write(f_row, 5, fact['lugar'], fmt_td)
    ws2.write(f_row, 6, fact['monto'], fmt_td_currency)
    ws2.write(f_row, 7, fact['vendedor'], fmt_td_center)
    ws2.set_row(f_row, 22)
    f_row += 1

ws2.write(f_row, 1, 'TOTAL', fmt_total_row)
ws2.write(f_row, 2, f'{len(invoices_data)} Facturas', fmt_total_row)
ws2.write(f_row, 3, '', fmt_total_row)
ws2.write(f_row, 4, '', fmt_total_row)
ws2.write(f_row, 5, '', fmt_total_row)
ws2.write_formula(f_row, 6, f'=SUM(G{f_start+2}:G{f_row})', fmt_total_currency)
ws2.write(f_row, 7, '', fmt_total_row)
ws2.set_row(f_row, 24)
ws2.print_area(1, 1, f_row, 7)

# ==============================================================================
# HOJA 3: DATOS PARA GRÁFICAS Y ANALÍTICA
# ==============================================================================
ws3 = wb.add_worksheet('Analitica y Graficas')
ws3.set_zoom(90)
ws3.hide_gridlines(0)

# Configuración de Impresión para Hoja 3
ws3.set_portrait()
ws3.set_paper(1)
ws3.fit_to_pages(1, 1)
ws3.set_margins(left=0.4, right=0.4, top=0.4, bottom=0.4)
ws3.center_horizontally()

ws3.set_column('A:A', 4)
ws3.set_column('B:B', 30)
ws3.set_column('C:C', 20)
ws3.set_column('E:E', 25)
ws3.set_column('F:F', 18)

ws3.merge_range('B2:F2', ' TABLAS AUXILIARES DE ANALÍTICA Y GRÁFICAS', fmt_title)
ws3.merge_range('B3:F3', ' Base de soporte para las visualizaciones del Dashboard Ejecutivo', fmt_subtitle)
ws3.set_row(1, 28)
ws3.set_row(2, 18)

# Ranking de clientes activos ordenados de mayor a menor monto
ranking_clients = [x for x in clients_data if x['estado'] == 'ACTIVO']
ranking_clients.sort(key=lambda x: x['totalErick'], reverse=True)

ws3.write(5, 1, 'Cliente Asignado', fmt_th)
ws3.write(5, 2, 'Facturación Erick (Q)', fmt_th)
ws3.set_row(5, 22)

c_row = 6
for c in ranking_clients:
    ws3.write(c_row, 1, c['nombre'], fmt_td)
    ws3.write(c_row, 2, c['totalErick'], fmt_td_currency)
    c_row += 1

# Tabla de Cobertura
ws3.write(5, 4, 'Estado de Cartera', fmt_th)
ws3.write(5, 5, 'Cantidad Clientes', fmt_th)
ws3.write(6, 4, 'Activo (Con Venta)', fmt_td)
ws3.write(6, 5, activos_count, fmt_td_center)
ws3.write(7, 4, 'Pendiente de Visita', fmt_td)
ws3.write(7, 5, pendientes_count, fmt_td_center)

# Tabla de Distribución por Municipio / Zona
zone_counts = {}
for c in clients_data:
    z = c['lugar'].split('/')[0].strip()
    zone_counts[z] = zone_counts.get(z, 0) + 1

ws3.write(10, 4, 'Zona / Municipio', fmt_th)
ws3.write(10, 5, 'Clientes Asignados', fmt_th)
z_row = 11
for z, cnt in sorted(zone_counts.items(), key=lambda x: x[1], reverse=True)[:8]:
    ws3.write(z_row, 4, z, fmt_td)
    ws3.write(z_row, 5, cnt, fmt_td_center)
    z_row += 1

# ==============================================================================
# INSERCIÓN DE GRÁFICAS EN HOJA 1 (DEBAJO DE LA TABLA)
# ==============================================================================
charts_start_row = row_idx + 3
ws1.set_h_pagebreaks([charts_start_row - 1])
ws1.print_area(1, 1, charts_start_row + 27, 10)

# 1. Gráfica de Barras Horizontal: Top 15 Clientes por Facturación (B a G)
chart_bar = wb.add_chart({'type': 'bar'})
top_n = min(15, len(ranking_clients))
chart_bar.add_series({
    'name': 'Facturación Erick (Q)',
    'categories': ['Analitica y Graficas', 6, 1, 6 + top_n - 1, 1],
    'values':     ['Analitica y Graficas', 6, 2, 6 + top_n - 1, 2],
    'fill':       {'color': TEAL_MAIN},
    'data_labels': {
        'value': True,
        'num_format': '"Q "#,##0',
        'font': {'size': 8.5, 'bold': True, 'color': '#1e293b'}
    }
})
chart_bar.set_title({
    'name': 'Top 15 Clientes con Mayor Facturación (Quetzales)',
    'name_font': {'size': 11, 'bold': True, 'color': TEAL_DARK}
})
chart_bar.set_plotarea({
    'layout': {
        'x': 0.28,
        'y': 0.10,
        'width': 0.66,
        'height': 0.78
    }
})
chart_bar.set_y_axis({
    'reverse': True,
    'crossing': 'max',
    'num_font': {'size': 8.5, 'color': '#334155'}
})
chart_bar.set_x_axis({
    'num_format': '"Q "#,##0',
    'num_font': {'size': 8.5, 'color': '#64748b'},
    'major_gridlines': {'visible': True, 'line': {'color': '#e2e8f0', 'dash_type': 'dash'}}
})
chart_bar.set_legend({'none': True})
chart_bar.set_size({'width': 640, 'height': 500})

ws1.insert_chart(f'B{charts_start_row}', chart_bar)

# 2. Gráfica de Anillo: Cobertura Comercial (H a K)
chart_donut = wb.add_chart({'type': 'doughnut'})
chart_donut.add_series({
    'name': 'Efectividad de Cartera',
    'categories': ['Analitica y Graficas', 6, 4, 7, 4],
    'values':     ['Analitica y Graficas', 6, 5, 7, 5],
    'points': [
        {'fill': {'color': EMERALD}},
        {'fill': {'color': AMBER}},
    ],
    'data_labels': {
        'value': False,
        'percentage': True,
        'font': {'size': 10, 'bold': True, 'color': WHITE}
    },
    'hole_size': 58
})
chart_donut.set_title({
    'name': 'Cobertura Comercial de la Cartera',
    'name_font': {'size': 11, 'bold': True, 'color': TEAL_DARK}
})
chart_donut.set_legend({
    'position': 'bottom',
    'font': {'size': 9, 'color': '#334155'}
})
chart_donut.set_size({'width': 440, 'height': 245})

ws1.insert_chart(f'H{charts_start_row}', chart_donut)

# 3. Gráfica Circular: Distribución de Clientes por Municipio / Zona (H a K)
chart_pie_zone = wb.add_chart({'type': 'pie'})
chart_pie_zone.add_series({
    'name': 'Distribución por Zona',
    'categories': ['Analitica y Graficas', 11, 4, z_row - 1, 4],
    'values':     ['Analitica y Graficas', 11, 5, z_row - 1, 5],
    'points': [
        {'fill': {'color': '#00696a'}},
        {'fill': {'color': '#0d9488'}},
        {'fill': {'color': '#14b8a6'}},
        {'fill': {'color': '#2dd4bf'}},
        {'fill': {'color': '#5eead4'}},
        {'fill': {'color': '#99f6e4'}},
        {'fill': {'color': '#cbd5e1'}},
        {'fill': {'color': '#94a3b8'}},
    ],
    'data_labels': {
        'value': True,
        'font': {'size': 9, 'bold': True}
    }
})
chart_pie_zone.set_title({
    'name': 'Distribución por Municipios Principales',
    'name_font': {'size': 11, 'bold': True, 'color': TEAL_DARK}
})
chart_pie_zone.set_legend({
    'position': 'bottom',
    'font': {'size': 8.5, 'color': '#334155'}
})
chart_pie_zone.set_size({'width': 440, 'height': 245})

ws1.insert_chart(f'H{charts_start_row + 13}', chart_pie_zone)

wb.close()
print(f"[OK] Archivo Excel generado: {output_filename}")

# Copiar a Desktop
shutil.copyfile(output_filename, desktop_path)
print(f"[OK] Copiado exitosamente a: {desktop_path}")
