-- Dos bases: haycancha_dev (la app en local) y haycancha_test (los tests, se borra y rearma).
CREATE DATABASE haycancha_dev;

-- Igual que en Supabase: las extensiones viven en el esquema `extensions`
-- (lo crea la migración 0001) y ese esquema está en el search_path.
ALTER DATABASE haycancha_test SET search_path = "$user", public, extensions;
ALTER DATABASE haycancha_dev SET search_path = "$user", public, extensions;
