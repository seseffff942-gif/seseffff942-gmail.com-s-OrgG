-- CREAR BUCKET (Carpeta de almacenamiento)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('productos', 'productos', true)
ON CONFLICT (id) DO NOTHING;

-- PERMITIR VER LAS IMAGENES A TODO EL MUNDO
CREATE POLICY "Imagenes publicas" ON storage.objects FOR SELECT USING (bucket_id = 'productos');

-- PERMITIR SUBIR IMAGENES SIN AUTENTICACION COMPLEJA (Solo para facilitar el desarrollo)
CREATE POLICY "Permitir subida" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'productos');

-- PERMITIR ACTUALIZAR IMAGENES
CREATE POLICY "Permitir update" ON storage.objects FOR UPDATE USING (bucket_id = 'productos');
