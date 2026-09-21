import json
import xlsxwriter
import shutil

# Master list of UNIQUE clients from ALL notebook photos provided:
# Image 1 (Enero), Image 2 (Final Enero & Febrero), Image 3 (Febrero cont. & Marzo)

MASTER_CLIENTS = [
    # --- De la primera foto (Enero) ---
    {"nombre": "Hector Mendoza", "lugar": "El Remate", "periodo": "Enero", "notas_libreta": "El Remate"},
    {"nombre": "Eider Guerra", "lugar": "El Zapote / Ixlu", "periodo": "Enero / Feb", "notas_libreta": "El Zapote Ixlu"},
    {"nombre": "Marlon Garrido", "lugar": "El Caoba", "periodo": "Enero / Feb", "notas_libreta": "El Caoba (Mailon/Marlon)"},
    {"nombre": "Cesar Lopez", "lugar": "San Benito", "periodo": "Enero", "notas_libreta": "San Benito"},
    {"nombre": "Iris Reyes", "lugar": "Santa Elena", "periodo": "Enero / Feb", "notas_libreta": "Santa Elena"},
    {"nombre": "Wilman Chonay", "lugar": "Dolores", "periodo": "Enero / Feb / Mar", "notas_libreta": "Dolores (Chonay)"},
    {"nombre": "Lidia Felipe Rashel", "lugar": "Dolores (Mopán)", "periodo": "Enero / Mar", "notas_libreta": "Dolores Calzada Mopán"},
    {"nombre": "Luis Espina", "lugar": "Poptun", "periodo": "Enero", "notas_libreta": "Poptún"},
    {"nombre": "Geovany Hernandez", "lugar": "Santa Elena", "periodo": "Enero", "notas_libreta": "Santa Elena (Cordero)"},
    {"nombre": "Erick Hernandez", "lugar": "Ixlu", "periodo": "Enero", "notas_libreta": "Ixlu (Efinagro)"},
    {"nombre": "Fredy Vicente", "lugar": "Santa Ana", "periodo": "Enero", "notas_libreta": "Santa Ana"},
    {"nombre": "Hever Tello (Eber Bello)", "lugar": "San Francisco", "periodo": "Enero / Feb", "notas_libreta": "San Francisco"},
    {"nombre": "Rony Vicente", "lugar": "Santa Elena", "periodo": "Enero", "notas_libreta": "Santa Elena (El Sembrador)"},
    {"nombre": "Leonidas Giron", "lugar": "Mopan Dolores", "periodo": "Enero", "notas_libreta": "Mopán Dolores"},
    {"nombre": "Eliel Betancourt", "lugar": "Sayaxche / Chacte", "periodo": "Enero / Feb", "notas_libreta": "Sayaxché / La Cumbre Chacté"},
    {"nombre": "Israel España", "lugar": "El Chal", "periodo": "Enero", "notas_libreta": "El Chal (Angel España)"},
    {"nombre": "Walter Molina", "lugar": "El Chal", "periodo": "Enero", "notas_libreta": "El Chal"},

    # --- De las nuevas fotos (Página 1 y 2: Enero cont., Febrero y Marzo) ---
    {"nombre": "Hugo Sutuj", "lugar": "El Chal", "periodo": "Enero", "notas_libreta": "El Chal (Agro El Corral)"},
    {"nombre": "Hary Campos", "lugar": "El Chal", "periodo": "Enero", "notas_libreta": "El Chal (Agro. El Rejo)"},
    {"nombre": "Ervin Hernandez", "lugar": "Sacpuy San Andres", "periodo": "Enero / Feb", "notas_libreta": "Sacpuy San Andrés"},
    {"nombre": "Ermides Recinos", "lugar": "El Naranjo La Libertad", "periodo": "Enero", "notas_libreta": "El Naranjo La Libertad"},
    {"nombre": "Sherlina Marroquin", "lugar": "Santa Ana", "periodo": "Enero / Feb", "notas_libreta": "Santa Ana (Agro. Sherlina)"},
    {"nombre": "Eber de Leon", "lugar": "Las Cruces Peten", "periodo": "Enero", "notas_libreta": "Las Cruces Petén"},
    {"nombre": "Jose Elias Polanco", "lugar": "San Luis", "periodo": "Enero", "notas_libreta": "San Luis Petén"},
    {"nombre": "Cesar Noyola", "lugar": "Aldea La Maquina", "periodo": "Febrero", "notas_libreta": "Aldea La Máquina"},
    {"nombre": "Brenda Duarte", "lugar": "Cruce dos Aguadas San Andres", "periodo": "Febrero", "notas_libreta": "Cruce dos Aguadas (Los 3 Hermanos)"},
    {"nombre": "Eliberto Cortez", "lugar": "Sacpuy San Andres", "periodo": "Febrero", "notas_libreta": "Sacpuy San Andrés"},
    {"nombre": "Jose Alejandro Ordoñez", "lugar": "San Luis", "periodo": "Febrero", "notas_libreta": "San Luis Petén"},
    {"nombre": "Wilder Lemus", "lugar": "Poptun", "periodo": "Febrero", "notas_libreta": "Poptún (Agro. Lemus)"},
    {"nombre": "David de Jesus", "lugar": "San Luis Peten", "periodo": "Febrero", "notas_libreta": "San Luis Petén"},
    {"nombre": "Fernando Valdez", "lugar": "San Luis", "periodo": "Febrero / Mar", "notas_libreta": "San Luis Petén"},
    {"nombre": "Mildred Salazar", "lugar": "La Libertad", "periodo": "Febrero", "notas_libreta": "La Libertad Petén"},
    {"nombre": "Noe Garcia", "lugar": "El Chal", "periodo": "Febrero", "notas_libreta": "El Chal (Geovany Noe García)"},
    {"nombre": "Elio Arreaza", "lugar": "Poptun", "periodo": "Marzo", "notas_libreta": "Poptún (Agro El Potro)"},
    {"nombre": "Sara Ipiña", "lugar": "Chacalte San Luis", "periodo": "Marzo", "notas_libreta": "Chacalte San Luis"},
    {"nombre": "Edwin Hernandez", "lugar": "San Luis Peten", "periodo": "Marzo", "notas_libreta": "San Luis Petén"},
    {"nombre": "Luis Carranza", "lugar": "Dolores", "periodo": "Marzo", "notas_libreta": "Dolores (Agro. El Ganadero)"},
    {"nombre": "Edwin Lopez", "lugar": "Sabaneta Dolores", "periodo": "Marzo", "notas_libreta": "Sabaneta Dolores (El Campesino)"}
]

print(f"Total Unique Clients: {len(MASTER_CLIENTS)}")
