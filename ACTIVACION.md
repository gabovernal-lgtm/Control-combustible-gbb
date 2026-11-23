# Control de Combustible GBB — perfiles y QR

## Acceso

Al abrir se elige **Receptor de combustible** o **Camión surtidor**. El perfil lo asigna el administrador: elegir un botón no concede permisos. Una cuenta del perfil equivocado vuelve al menú. El administrador entra por Camión surtidor.

## Crear cuentas desde la app

1. Entrar con una cuenta administradora por Camión surtidor.
2. Abrir Administrar → Usuarios y perfiles.
3. Completar nombre, correo, contraseña inicial de al menos 10 caracteres y perfil.
4. Pulsar Crear usuario. El usuario entra con ese correo y contraseña; esta creación no envía correo de recuperación.
5. Para modificar el perfil o desactivar la cuenta: Actualizar usuarios → Editar perfil → Guardar perfil. El administrador no puede quitarse su propio acceso desde esta pantalla.

No compartir contraseñas en capturas o chats. Las cuentas existentes continúan habilitadas con su perfil actual.

| Perfil | Acceso inicial | Funciones |
|---|---|---|
| Receptor | Receptor de combustible | Activar su celular, generar un QR nuevo por carga sin conexión y consultar sus recepciones sincronizadas. No registra litros ni administra usuarios. |
| Conductor | Camión surtidor | Seleccionar camión, registrar cargas, escanear QR, guardar sin conexión, sincronizar y consultar/descargar sus registros. No crea usuarios ni modifica catálogos. |
| Administrador | Camión surtidor | Funciones del conductor, reportes generales, camiones, equipos, categorías, correcciones auditadas, usuarios/perfiles y consulta de conflictos QR. |

## Preparación antes de salir sin internet

1. Actualizar/abrir la app con internet en ambos celulares.
2. El receptor entra una vez y espera “Celular activado”. Su clave de firma queda guardada en ese navegador/celular.
3. Después de esa activación, el conductor pulsa “Actualizar receptores” con internet. Esto descarga el directorio necesario para verificar los QR sin conexión.
4. Si se borra el almacenamiento, se cambia de navegador o se reinstala borrando datos, hay que activar nuevamente al receptor y actualizar el directorio del conductor.

## Entrega sin conexión — un solo QR

1. El receptor pulsa “Generar QR para una carga” y lo muestra.
2. El conductor completa litros/equipo/camión y pulsa “Escanear QR del receptor”. Puede usar cámara, imagen del QR o código compartido.
3. La app verifica firma, receptor conocido, vigencia de 24 horas y uso previo en ese celular.
4. El conductor revisa la entrega con el nombre del receptor y confirma. Se guarda la carga y el uso del QR en una misma transacción local.
5. La carga queda validada localmente y pendiente de sincronización. El receptor no necesita conexión durante esta entrega.
6. Con internet y sesión válida, el conductor sincroniza automáticamente. El servidor comprueba nuevamente receptor/dispositivo y registra un único uso global del QR.

El QR identifica al receptor. El conductor lo asocia a los litros y equipo; el receptor no firma esos datos desde su pantalla. Generar un nuevo QR no revoca una fotografía del anterior mientras todos están sin conexión. Dos conductores desconectados pueden leer la misma copia: el primer uso sincronizado queda registrado y el otro aparece como conflicto, sin validarse automáticamente. El administrador lo ve en Administrar → Conflictos QR. La carga en conflicto permanece en el celular del conductor para revisión.

Durante la transición se permite guardar una carga sin QR, identificada como sin validación por QR.

## Actualización

Si la app instalada avisa que hay una nueva versión, finalizar la carga en curso y pulsar Actualizar ahora. No borrar los datos del navegador si hay cargas pendientes.

## Validación realizada

- Firma, QR alterado, vencimiento y receptor inactivo/desconocido.
- Generación y decodificación real de imagen QR.
- Persistencia real de clave y cargas en IndexedDB y bloqueo de reutilización tras retirar una carga ya sincronizada.
- Servidor: unicidad, reintento idempotente y bloqueo del uso de la función de registro por clientes sin privilegios.
- Elección de perfil y apertura offline usando el acceso previamente guardado.

La lectura con cámaras de dos teléfonos físicos debe comprobarse con una primera entrega controlada.
