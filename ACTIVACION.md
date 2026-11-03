# Activación inicial — Control de Combustible GBB

## 1. Crear usuarios en Supabase
En el proyecto `Combustible-cmdic`, abrir **Authentication > Users > Add user** y crear estas dos cuentas con contraseñas temporales seguras, marcando la confirmación de correo cuando corresponda:
- `gvernal@geotec.cl` (administrador)
- `dromero@geotec.cl` (conductor)

No introducir contraseñas en este repositorio. Cambiar las contraseñas iniciales antes de producción.

## 2. Asignar perfiles
Ejecutar en SQL Editor, después de crear ambas cuentas:

```sql
insert into public.profiles (id,full_name,role,active)
select id,'Gvernal','admin',true from auth.users where lower(email)='gvernal@geotec.cl'
on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,active=true;

insert into public.profiles (id,full_name,role,active)
select id,'Dromero','driver',true from auth.users where lower(email)='dromero@geotec.cl'
on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,active=true;
```

## 3. Configuración del frontend
En `config.js`, sustituir `REEMPLAZAR_CON_CLAVE_PUBLICABLE` por la **publishable key** del proyecto Supabase (Settings > API Keys). Es una clave pública de frontend; nunca usar `service_role` ni contraseña de base de datos.

## 4. Publicación
Publicar los archivos estáticos mediante hosting HTTPS, por ejemplo GitHub Pages si la política del repositorio privado lo permite, o Cloudflare Pages. La app debe ejecutarse bajo HTTPS para instalarse como PWA.

## 5. Pruebas antes de usar en faena
1. Iniciar sesión conectado con ambos usuarios.
2. Agregar camiones reales con administrador y confirmar que conductor no puede administrarlos.
3. Guardar carga con internet.
4. Activar modo avión, guardar otra carga y verificar estado pendiente.
5. Reconectar, sincronizar, verificar que aparece exactamente una vez.
6. Intentar editar una carga como conductor: debe rechazarse.
7. Comprobar edición por administrador y su registro de auditoría.

**Estado actual:** las cuentas Auth aún requieren creación, la clave publicable aún no está aplicada al frontend y no se ha publicado ni probado en dispositivo.
