import re

text = """
RAINBOW
Leñador 16 EW galón 10 Q575.00 Q5,750.00
Terraquat 20 SL galón 14 Q121.75 Q1,704.50
torban 30.4 sl litro 5 Q240.00 Q1,200.00
Anorak 60 EC litro 20 Q270.00 Q5,400.00
Revolver 36 5 SL litro 16 Q42.00 Q672.00
Kaindor plus 30 SC litro 11 Q350.00 Q3,850.00
Dimaxine 72 SL CANECA 25 Q578.00 Q14,450.00
Dimaxine 72 SL litro 6 Q39.80 Q238.80
Semental 16.5 SL litro 17 Q35.00 Q595.00
Cegar 15 SL litro 17 Q48.00 Q816.00
Cegar 15 SL galon 8 Q174.00 Q1,392.00
Azotela Max 85 3 Q82.50 Q247.50
Podador 60 WG 10X10gr 63 Q45.00 Q2,835.00
Lasonate 90 SP 100 gr 53 Q25.00 Q1,325.00
BAYER/TECUN
BLINDAGE 60 FS 310 Q97.00 Q30,070.00
SEMEVIN 35 FS 554 Q58.50 Q32,409.00
SEMEVIN 35 FS LITRO 6 Q443.00 Q2,658.00
CERTERO NORMAL 250 ML 10 Q110.00 Q1,100.00
CERTERO DUO 48 SC 13 Q85.00 Q1,105.00
VAYEGO 20 SC 1 Q312.00 Q312.00
CIPERMECTRINA 100 ML 14 Q13.50 Q189.00
CIPERMECTRINA 250 ML 65 Q20.84 Q1,354.60
CIPERMECTRINA 500 ML 0 Q39.55 Q0.00
CIPERMECTRINA LITRO 18 Q65.00 Q1,170.00
CPF 2DP LIBRA 260 Q9.75 Q2,535.00
FORAGRO
FORZA 60 WP 100 GRAMOS 442 Q45.50 Q20,111.00
PIKUDO 20 SC 100 ML 272 Q58.00 Q15,776.00
FORANEX 25.7 SL 1 LITRO 60 Q85.00 Q5,100.00
FOLIAR PLUS 1 LITRO 17 Q38.50 Q654.50
SISTEMAS AGROPECUARIOS
TILOSIN PLUS 10 GR 189 Q14.00 Q2,646.00
Coriplus 10 gr 443 Q9.25 Q4,097.75
Lombrifin 10 gr 720 Q7.25 Q5,220.00
Oxiplus Vitaminado 10 gr 592 Q7.25 Q4,292.00
Socofin BD 10gr 386 Q13.00 Q5,018.00
Vita vet plus 10gr 1246 Q7.50 Q9,345.00
Chemiestress 10gr 227 Q7.50 Q1,702.50
Tilosin plus 25 gr 7 Q20.00 Q140.00
Oxiplus Vitaminado 25 gr 40 Q20.00 Q800.00
Tilosin plus 100 gr 142 Q63.00 Q8,946.00
Cori plus 100 gr 169 Q35.25 Q5,957.25
Socofin BD 100 gr 172 Q62.75 Q10,793.00
Vita vet Plus 100 gr 252 Q23.00 Q5,796.00
Lombrifin 100 gr 135 Q25.00 Q3,375.00
Chemiestress 100gr 54 Q20.00 Q1,080.00
Oxiplus Vitaminado 100 gr 179 Q25.00 Q4,475.00
Tilosin 10 ml 849 Q14.50 Q12,310.50
Socofin drog 10 ml 806 Q13.50 Q10,881.00
Tilosin 25 ml 1 Q22.50 Q22.50
Socofin drog 25 ml 63 Q21.25 Q1,338.75
Tilosin 100 ml 196 Q73.00 Q14,308.00
Nexlabel LA 30.1-60kg 15 Q110.00 Q1,650.00
Nexlabel LA 7.6-15kg 28 Q85.00 Q2,380.00
Nexlabel LA 15-30kg 44 Q95.00 Q4,180.00
Curabichera 400 ml 132 Q65.00 Q8,580.00
Crecebest 500 ml 29 Q277.50 Q8,047.50
Crecebest 100 ml 28 Q78.00 Q2,184.00
enrotil 25 ml 28 Q23.00 Q644.00
sana soco RS 25 ml 6 Q22.00 Q132.00
enrotil 10 gr 4 Q13.00 Q52.00
socofin bd 25 gr 0 Q22.00 Q0.00
enrotil 100 gr 22 Q63.00 Q1,386.00
sana soco RS 100gr 1 Q77.00 Q77.00
AVINDUSTRIAS
Vitel 100 gr 121 Q35.00 Q4,235.00
Vitel 15 gr 456 Q8.50 Q3,876.00
Multipack 26/52 150 gr 39 Q140.20 Q5,467.80
Multipack 26 52 15 gr 62 Q22.50 Q1,395.00
Trimsulfa plus 150 gr 110 Q35.25 Q3,877.50
Trinsulfa Plus 15 gr 255 Q9.25 Q2,358.75
MALLO
Electrolitos y Vitaminas 100 gr 695 Q15.00 Q10,425.00
Electrolitos y Vitaminas 20 gr 260 Q8.00 Q2,080.00
Broximicina 100 gr 137 Q63.00 Q8,631.00
Shampoo Pets 250ml 13 Q17.00 Q221.00
Vermimax plus 100 Tabletas 7 Q275.00 Q1,925.00
Jabón PET Gold Barra 5 Q20.00 Q100.00
Simparica trio 5-10kg 12 Q116.00 Q1,392.00
WELLCO
Broncowell 100 gr 232 Q35.00 Q8,120.00
Oxyfarm con electrolitos 100 gr 107 Q25.00 Q2,675.00
Caja oxyfarm 20 grs 12 Q250.00 Q3,000.00
All Trompa 454 gr 83 Q55.00 Q4,565.00
All Trompa 100 gr 55 Q25.00 Q1,375.00
Oxyfarm inyectable 10 ml 62 Q14.50 Q899.00
Oxyfarm inyectable 50ml 54 Q32.50 Q1,755.00
Oxyfarm inyectable 100 ml 19 Q49.25 Q935.75
Oxyfarm inyectable 250 ml 99 Q74.00 Q7,326.00
Pujantex 250 ml 3 Q75.00 Q225.00
Vita B12 con fósforo 250 ml 72 Q115.00 Q8,280.00
Ferradox plus 100 ml 16 Q71.50 Q1,144.00
Ferradox plus 10 ml 73 Q21.50 Q1,569.50
Neocan 120ml 0 Q17.75 Q0.00
Neocan 240ml 63 Q29.75 Q1,874.25
Defender 10ml 95 Q18.00 Q1,710.00
Defender 50 ml 82 Q45.50 Q3,731.00
Defender 100 ml 31 Q69.00 Q2,139.00
BIOZOO
Tigent 20 ml 5 Q37.00 Q185.00
Tigent 100ml 50 Q145.00 Q7,250.00
Proteizoo plus 20ml 103 Q14.25 Q1,467.75
Proteizoo Plus 250ml 12 Q120.00 Q1,440.00
Ganazoo DP 20ml 13 Q50.25 Q653.25
Bioxil 7% 500ml 8 Q143.00 Q1,144.00
LAVET
Dipiron 500 30 ml 72 Q28.00 Q2,016.00
Labimin 500 ml 37 Q75.00 Q2,775.00
TECNIAGRO
Iverplus La 10ml 1% 40 Q12.00 Q480.00
Iverplus la 100 ml 1% 10 Q42.75 Q427.50
Iverplus La 500ml 1% 14 Q94.00 Q1,316.00
Farma-tecnimicina 50ml 53 Q28.75 Q1,523.75
Farma-tecnimicina 100ml 66 Q39.75 Q2,623.50
Farma-tecnimicina LA 50ml 9 Q44.00 Q396.00
Farma-tecnimicina LA 100ml 15 Q60.00 Q900.00
INSUMOS MODERNOS
Oxitetraciclina plus 250ml 79 Q94.00 Q7,426.00
Oxitetraciclina plus 100 ml 97 Q42.50 Q4,122.50
Oxitetraciclina plus 50ml 107 Q27.50 Q2,942.50
Oxitetraciclina plus 10ml 226 Q15.50 Q3,503.00
Verrugan 20 ml 19 Q25.00 Q475.00
Verrugan plus 30 ml 35 Q32.50 Q1,137.50
Oxitocina 10ml 212 Q15.50 Q3,286.00
Ectogan Pipeta Spot on 0 Q15.50 Q0.00
Ectogan pour On LITRO 35 Q170.00 Q5,950.00
Borogluconato de calcio 250 ml 12 Q35.00 Q420.00
AGRONORSA
Instavit 500ml 50 Q210.00 Q10,500.00
Nuvan 1L 10 Q415.00 Q4,150.00
Nuvan 100ml 64 Q68.75 Q4,400.00
AGROSONA
Rata Quilla Sb caja 140 Q97.00 Q13,580.00
BOTICA GANADERA
JB Matagusano 140 Q70.00 Q9,800.00
Impacto spray 175 Q66.00 Q11,550.00
MODERNA
Jeringa 1 ml 100U 800 Q1.00 Q800.00
Jeringa 3 ml 100U 0 Q0.65 Q0.00
Jeringa 5 ml 100U 1100 Q0.65 Q715.00
Jeringa 10ml 100U 600 Q0.95 Q570.00
DUWEST
Lannate 100 ml 83 Q27.00 Q2,241.00
Mirex 250 gramos 10 Q35.50 Q355.00
Mirex 500 gramos 50 Q59.00 Q2,950.00
OTROS
Broncobion maxx 30 ml 267 Q22.00 Q5,874.00
Mielita Vip 20 Q225.00 Q4,500.00
Anticion anticonceptivo 360 Q19.00 Q6,840.00
"""

lines = text.split('\n')
total = 0
for line in lines:
    line = line.strip()
    if line.startswith('Q'):
        continue
    if not line:
        continue
    # look for Q..., Q...
    match = re.search(r'Q([\d,.]+)\s*Q([\d,.]+)', line)
    if match:
        val = match.group(2).replace(',', '')
        total += float(val)

print("Total calculated:", total)
