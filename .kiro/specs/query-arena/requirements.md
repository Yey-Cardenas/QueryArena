# Requirements Document

## Introduction

QueryArena es una aplicación full stack que permite a estudiantes practicar ejercicios de SQL de forma estructurada. Los estudiantes pueden registrarse, autenticarse, resolver ejercicios categorizados por nivel y categoría, visualizar su historial de intentos, consultar su progreso en un dashboard personalizado y compararse con otros estudiantes a través de un ranking. Los administradores pueden gestionar el catálogo de ejercicios, niveles y categorías desde un panel dedicado.

El sistema está compuesto por un frontend en React, un backend en Node.js con Express y una base de datos relacional (PostgreSQL o SQL Server). La autenticación se gestiona mediante JWT.

---

## Glossary

- **System**: El sistema QueryArena en su conjunto.
- **Auth_Service**: El componente del backend responsable de autenticación y autorización.
- **User_Service**: El componente encargado de la gestión de perfiles de usuario.
- **Exercise_Service**: El componente encargado del catálogo de ejercicios SQL.
- **Attempt_Service**: El componente encargado de registrar y evaluar intentos de resolución.
- **Result_Service**: El componente que calcula y almacena los resultados de cada intento.
- **Ranking_Service**: El componente que calcula y actualiza el ranking de estudiantes.
- **Dashboard_Service**: El componente que agrega y expone métricas de progreso del estudiante.
- **Admin_Service**: El componente que gestiona recursos administrativos (ejercicios, niveles, categorías).
- **Student**: Usuario autenticado con rol `student` que puede resolver ejercicios y ver su progreso.
- **Admin**: Usuario autenticado con rol `admin` que puede gestionar el catálogo y la plataforma.
- **Exercise**: Enunciado de un problema SQL con una solución esperada, perteneciente a una categoría y un nivel.
- **Category**: Agrupación temática de ejercicios (ej. SELECT, JOIN, subqueries).
- **Level**: Grado de dificultad de un ejercicio (ej. básico, intermedio, avanzado).
- **Attempt**: Registro de una ejecución de un ejercicio por parte de un estudiante, que incluye la consulta enviada, fecha, estado, puntaje y tiempo de resolución.
- **Result**: Evaluación del resultado de un intento (correcto/incorrecto, puntaje asignado).
- **Ranking**: Lista ordenada de estudiantes según su puntaje acumulado.
- **Dashboard**: Vista personal del estudiante con su historial de intentos, progreso por nivel y categoría.
- **JWT**: JSON Web Token usado como mecanismo de autenticación stateless.
- **Active_User**: Usuario cuya cuenta está habilitada y no ha sido suspendida o eliminada.

---

## Requirements

---

### Requirement 1: Registro de usuario

**User Story:** Como visitante, quiero registrarme con un nombre de usuario único, email único y contraseña segura, para poder acceder a la plataforma como estudiante.

#### Acceptance Criteria

1. WHEN un visitante envía el formulario de registro con un `username`, `email` y `password` válidos, THE Auth_Service SHALL crear una cuenta de usuario con rol `student` y devolver una respuesta de éxito.
2. THE Auth_Service SHALL requerir que el campo `username` esté presente y no vacío en toda solicitud de registro.
3. THE Auth_Service SHALL requerir que el campo `email` esté presente, no vacío y tenga formato de dirección de correo electrónico válida en toda solicitud de registro.
4. THE Auth_Service SHALL requerir que el campo `password` tenga un mínimo de 8 caracteres en toda solicitud de registro.
5. IF el `username` enviado ya existe en la base de datos, THEN THE Auth_Service SHALL rechazar la solicitud y devolver un mensaje de error indicando que el nombre de usuario no está disponible.
6. IF el `email` enviado ya existe en la base de datos, THEN THE Auth_Service SHALL rechazar la solicitud y devolver un mensaje de error indicando que el email ya está registrado.
7. IF cualquier campo obligatorio del formulario de registro está vacío o ausente, THEN THE Auth_Service SHALL rechazar la solicitud y devolver un mensaje de error indicando el campo faltante.
8. WHEN el registro es exitoso, THE System SHALL almacenar la contraseña del usuario en la base de datos usando un algoritmo de hash seguro (bcrypt con factor de coste mínimo de 10).
9. IF el proceso de hash de la contraseña falla durante el registro, THEN THE Auth_Service SHALL cancelar la creación de la cuenta y devolver un mensaje de error indicando que el registro no pudo completarse.

---

### Requirement 2: Inicio de sesión

**User Story:** Como usuario registrado, quiero iniciar sesión con mis credenciales, para obtener acceso autenticado a las funcionalidades de la plataforma.

#### Acceptance Criteria

1. WHEN un usuario envía el formulario de login con `email` y `password` correctos correspondientes a una cuenta activa, THE Auth_Service SHALL devolver un JWT válido con el identificador del usuario y su rol.
2. IF el `email` enviado no corresponde a ninguna cuenta registrada, THEN THE Auth_Service SHALL rechazar la solicitud y devolver un mensaje de error genérico indicando que las credenciales son inválidas, sin emitir ningún JWT.
3. IF la `password` enviada no coincide con la contraseña almacenada para el email proporcionado, THEN THE Auth_Service SHALL rechazar la solicitud y devolver un mensaje de error genérico indicando que las credenciales son inválidas, sin emitir ningún JWT.
4. THE Auth_Service SHALL requerir que los campos `email` y `password` estén presentes y no vacíos en toda solicitud de login.
5. IF cualquier campo obligatorio del formulario de login está vacío o ausente, THEN THE Auth_Service SHALL rechazar la solicitud y devolver un mensaje de error indicando el campo faltante.
6. WHEN el Auth_Service emite un JWT, THE Auth_Service SHALL incluir en el token la fecha de expiración, el identificador de usuario y el rol del usuario.

---

### Requirement 3: Gestión de perfil de usuario

**User Story:** Como estudiante autenticado, quiero ver y actualizar los datos de mi perfil, para mantener mi información personal actualizada.

#### Acceptance Criteria

1. WHEN un Student autenticado solicita su perfil, THE User_Service SHALL devolver el `username`, `email`, fecha de registro y rol del usuario.
2. WHEN un Student autenticado envía una solicitud de actualización de perfil con datos válidos, no vacíos, con `username` y `email` únicos, y con autenticación activa, THE User_Service SHALL actualizar únicamente los campos permitidos (username, email) y devolver los datos actualizados.
3. IF el nuevo `username` solicitado ya existe en la base de datos para un usuario diferente, THEN THE User_Service SHALL rechazar la solicitud y devolver un mensaje de error indicando que el nombre de usuario no está disponible.
4. IF el nuevo `email` solicitado ya existe en la base de datos para un usuario diferente, THEN THE User_Service SHALL rechazar la solicitud y devolver un mensaje de error indicando que el email ya está en uso.
5. IF un usuario no autenticado solicita ver o actualizar un perfil, THEN THE Auth_Service SHALL rechazar la solicitud con un error de autorización antes de que llegue al User_Service.
6. THE User_Service SHALL requerir que los campos enviados en una solicitud de actualización de perfil no estén vacíos.

---

### Requirement 4: Catálogo de ejercicios SQL

**User Story:** Como estudiante autenticado, quiero explorar el catálogo de ejercicios disponibles, para elegir qué practicar según mi nivel o área de interés.

#### Acceptance Criteria

1. WHEN un Student autenticado solicita el catálogo de ejercicios, THE Exercise_Service SHALL devolver la lista completa de ejercicios activos incluyendo título, descripción, nivel y categoría de cada uno.
2. WHEN un Student autenticado solicita ejercicios filtrados por `level_id`, THE Exercise_Service SHALL devolver únicamente los ejercicios activos correspondientes a ese nivel.
3. WHEN un Student autenticado solicita ejercicios filtrados por `category_id`, THE Exercise_Service SHALL devolver únicamente los ejercicios activos correspondientes a esa categoría.
4. WHEN un Student autenticado solicita el detalle de un ejercicio específico por su `exercise_id`, THE Exercise_Service SHALL devolver el título, descripción, nivel, categoría y enunciado completo del ejercicio.
5. IF el `exercise_id` solicitado no existe en la base de datos, THEN THE Exercise_Service SHALL devolver un mensaje de error indicando que el ejercicio no fue encontrado.
6. IF un usuario no autenticado solicita acceso al catálogo, THEN THE Auth_Service SHALL rechazar la solicitud con un error de autorización.

---

### Requirement 5: Resolución de ejercicios

**User Story:** Como estudiante autenticado, quiero enviar mi consulta SQL como respuesta a un ejercicio, para obtener retroalimentación inmediata sobre si mi solución es correcta.

#### Acceptance Criteria

1. WHEN un Student autenticado envía una consulta SQL para un `exercise_id` válido, THE Attempt_Service SHALL registrar el intento con la consulta enviada, fecha y hora, identificador del estudiante e identificador del ejercicio.
2. WHEN el Attempt_Service registra un intento, THE Result_Service SHALL evaluar la consulta enviada contra la solución esperada del ejercicio y almacenar el resultado.
3. WHEN el Result_Service evalúa un intento como correcto, THE Result_Service SHALL asignar el puntaje definido para ese ejercicio y marcar el intento con estado `correcto`, garantizando que el estado y el puntaje asignado sean siempre consistentes con la evaluación.
4. WHEN el Result_Service evalúa un intento como incorrecto, THE Result_Service SHALL asignar puntaje cero y marcar el intento con estado `incorrecto`, garantizando que el estado y el puntaje asignado sean siempre consistentes con la evaluación.
5. WHEN un intento es evaluado, THE Attempt_Service SHALL registrar el tiempo de resolución transcurrido desde que el estudiante abrió el ejercicio hasta que envió la consulta.
6. IF el `exercise_id` enviado no existe en la base de datos, THEN THE Attempt_Service SHALL rechazar la solicitud y devolver un mensaje de error indicando que el ejercicio no existe.
7. IF un usuario no autenticado intenta enviar una solución, THEN THE Auth_Service SHALL rechazar la solicitud con un error de autorización.
8. IF el campo de consulta SQL enviado está vacío, THEN THE Attempt_Service SHALL rechazar la solicitud y devolver un mensaje de error indicando que la consulta no puede estar vacía.

---

### Requirement 6: Registro y trazabilidad de intentos

**User Story:** Como estudiante autenticado, quiero que todos mis intentos queden registrados, para poder revisar mi historial y ver cómo he progresado en cada ejercicio.

#### Acceptance Criteria

1. THE Attempt_Service SHALL persistir cada intento en la base de datos con los campos: identificador único, `user_id`, `exercise_id`, consulta enviada, fecha y hora, estado (correcto/incorrecto/error), puntaje y tiempo de resolución.
2. WHEN un Student autenticado solicita su historial de intentos, THE Attempt_Service SHALL devolver todos los intentos del estudiante ordenados por fecha descendente.
3. WHEN un Student autenticado solicita su historial de intentos filtrado por `exercise_id`, THE Attempt_Service SHALL devolver únicamente los intentos de ese estudiante para ese ejercicio, ordenados por fecha descendente.
4. IF ocurre un error técnico al persistir un intento en la base de datos, THEN THE Attempt_Service SHALL registrar el evento en el log del sistema y devolver un mensaje de error al estudiante indicando que el intento no pudo ser guardado.
5. IF un usuario no autenticado solicita el historial de intentos, THEN THE Auth_Service SHALL rechazar la solicitud con un error de autorización.

---

### Requirement 7: Evaluación de resultados

**User Story:** Como estudiante autenticado, quiero recibir el resultado de mi intento inmediatamente después de enviarlo, para saber si mi consulta SQL es correcta y cuántos puntos obtuve.

#### Acceptance Criteria

1. WHEN el Result_Service completa la evaluación de un intento, THE System SHALL devolver al estudiante el estado del intento (correcto/incorrecto), el puntaje obtenido y el tiempo de resolución registrado.
2. IF la consulta SQL enviada produce un error de ejecución en el motor de base de datos, THEN THE Result_Service SHALL marcar el intento con estado `error`, asignar puntaje cero y devolver al estudiante un mensaje descriptivo indicando el tipo de error de ejecución.
3. IF la consulta SQL enviada produce un error de validación de sintaxis antes de ejecutarse, THEN THE Result_Service SHALL marcar el intento con estado `error`, asignar puntaje cero y devolver al estudiante un mensaje indicando que la consulta tiene un error de sintaxis.
4. WHEN el Result_Service evalúa un intento con estado `error` o `incorrecto`, THE Result_Service SHALL incluir en la respuesta un único mensaje orientador que aborde todos los tipos de error presentes (de sintaxis y/o de ejecución) sin revelar la solución esperada.

---

### Requirement 8: Actualización del ranking

**User Story:** Como estudiante autenticado, quiero que mi puntaje acumulado se refleje en el ranking general, para poder compararme con otros estudiantes.

#### Acceptance Criteria

1. WHEN un intento es evaluado con estado `correcto`, THE Ranking_Service SHALL incrementar el puntaje acumulado del estudiante en el ranking con el puntaje obtenido en ese intento.
2. THE Ranking_Service SHALL mantener el puntaje acumulado de cada estudiante como la suma de los puntajes de todos sus intentos con estado `correcto`.
3. WHEN un Student autenticado solicita el ranking, THE Ranking_Service SHALL devolver la lista de estudiantes ordenada de mayor a menor puntaje acumulado, incluyendo posición, username y puntaje.
4. IF ocurre un error al actualizar el puntaje acumulado en el ranking tras un intento correcto, THEN THE Ranking_Service SHALL registrar el evento en el log del sistema y reintentar la operación de actualización de forma asíncrona, sin bloquear la respuesta al estudiante.
5. WHILE el puntaje acumulado de dos o más estudiantes es igual, THE Ranking_Service SHALL ordenarlos por la fecha del último intento correcto de forma ascendente (quien lo alcanzó primero aparece primero); estudiantes con puntajes distintos pueden aparecer en cualquier orden relativo siempre que los de mayor puntaje precedan a los de menor puntaje.

---

### Requirement 9: Dashboard de progreso del estudiante

**User Story:** Como estudiante autenticado, quiero ver un dashboard con mi progreso, para entender en qué áreas he mejorado y cuáles necesito reforzar.

#### Acceptance Criteria

1. WHEN un Student autenticado solicita su dashboard, THE Dashboard_Service SHALL devolver el total de ejercicios intentados, el total de ejercicios resueltos correctamente, el puntaje acumulado y la posición actual en el ranking.
2. WHEN un Student autenticado solicita su progreso por nivel, THE Dashboard_Service SHALL devolver para cada nivel el número de ejercicios intentados y el número de ejercicios resueltos correctamente.
3. WHEN un Student autenticado solicita su progreso por categoría, THE Dashboard_Service SHALL devolver para cada categoría el número de ejercicios intentados y el número de ejercicios resueltos correctamente.
4. WHEN un Student autenticado solicita su historial reciente, THE Dashboard_Service SHALL devolver los últimos 10 intentos del estudiante con el nombre del ejercicio, estado, puntaje y fecha.
5. WHILE un Student autenticado no ha realizado ningún intento, THE Dashboard_Service SHALL devolver los contadores con sus valores reales actuales y la lista de historial reciente vacía, sin devolver un error.
6. IF un usuario no autenticado solicita el dashboard, THEN THE Auth_Service SHALL rechazar la solicitud con un error de autorización.

---

### Requirement 10: Ranking público de estudiantes

**User Story:** Como estudiante autenticado, quiero ver el ranking general de estudiantes, para conocer mi posición relativa en comparación con mis compañeros.

#### Acceptance Criteria

1. WHEN un Student autenticado solicita el ranking, THE Ranking_Service SHALL devolver la lista completa de estudiantes activos ordenada de mayor a menor puntaje acumulado.
2. THE Ranking_Service SHALL incluir en cada entrada del ranking la posición numérica, el `username` del estudiante y el puntaje acumulado.
3. WHILE un estudiante no ha obtenido ningún punto, THE Ranking_Service SHALL incluir al estudiante en el ranking con puntaje cero, y todos los estudiantes con puntaje cero podrán compartir la misma posición en el ranking.
4. IF un usuario no autenticado solicita el ranking, THEN THE Auth_Service SHALL rechazar la solicitud con un error de autorización.

---

### Requirement 11: Panel de administrador — Gestión de niveles

**User Story:** Como administrador, quiero crear, editar y eliminar niveles de dificultad, para organizar el catálogo de ejercicios según su complejidad.

#### Acceptance Criteria

1. WHEN un Admin autenticado envía una solicitud de creación de nivel con un nombre único y válido, THE Admin_Service SHALL persistir el nuevo nivel y devolverlo con su identificador asignado.
2. WHEN un Admin autenticado envía una solicitud de edición de un nivel existente con datos válidos, THE Admin_Service SHALL actualizar el nivel y devolver los datos actualizados.
3. WHEN un Admin autenticado envía una solicitud de eliminación de un nivel que no tiene ejercicios asociados, THE Admin_Service SHALL eliminar el nivel y devolver una confirmación de éxito.
4. IF un Admin autenticado intenta eliminar un nivel que tiene ejercicios asociados, THEN THE Admin_Service SHALL rechazar la solicitud, devolver un mensaje de error indicando que el nivel tiene ejercicios asociados y no puede eliminarse, y garantizar que la operación de eliminación no se ejecute incluso si el mecanismo de reporte de errores falla.
5. IF un Admin autenticado intenta crear un nivel con un nombre que ya existe, THEN THE Admin_Service SHALL rechazar la solicitud y devolver un mensaje de error indicando que el nombre del nivel ya está en uso.
6. IF un usuario con rol `student` intenta acceder a los endpoints del Admin_Service, THEN THE Auth_Service SHALL rechazar la solicitud con un error de autorización antes de que llegue al Admin_Service.
7. IF un usuario no autenticado intenta acceder a los endpoints del Admin_Service, THEN THE Auth_Service SHALL rechazar la solicitud con un error de autorización.

---

### Requirement 12: Panel de administrador — Gestión de categorías

**User Story:** Como administrador, quiero crear, editar y eliminar categorías temáticas, para estructurar el catálogo de ejercicios por áreas de conocimiento SQL.

#### Acceptance Criteria

1. WHEN un Admin autenticado envía una solicitud de creación de categoría con un nombre único y válido, THE Admin_Service SHALL persistir la nueva categoría y devolverla con su identificador asignado.
2. WHEN un Admin autenticado envía una solicitud de edición de una categoría existente con datos válidos, THE Admin_Service SHALL actualizar la categoría y devolver los datos actualizados.
3. WHEN un Admin autenticado envía una solicitud de eliminación de una categoría que no tiene ejercicios asociados, THE Admin_Service SHALL eliminar la categoría y devolver una confirmación de éxito.
4. IF un Admin autenticado intenta eliminar una categoría que tiene ejercicios asociados, THEN THE Admin_Service SHALL rechazar la solicitud, devolver un mensaje de error indicando que la categoría tiene ejercicios asociados y no puede eliminarse, y retornar un estado de operación FALLIDA.
5. IF un Admin autenticado intenta crear una categoría con un nombre que ya existe, THEN THE Admin_Service SHALL rechazar la solicitud y devolver un mensaje de error indicando que el nombre de la categoría ya está en uso.
6. IF un usuario con rol `student` intenta acceder a los endpoints de gestión de categorías del Admin_Service, THEN THE Auth_Service SHALL rechazar la solicitud con un error de autorización.

---

### Requirement 13: Panel de administrador — Gestión de ejercicios

**User Story:** Como administrador, quiero crear, editar y eliminar ejercicios SQL, para mantener el catálogo actualizado y relevante.

#### Acceptance Criteria

1. WHEN un Admin autenticado envía una solicitud de creación de ejercicio con título, enunciado, solución esperada, `level_id` y `category_id` válidos, THE Admin_Service SHALL persistir el ejercicio y devolverlo con su identificador asignado.
2. WHEN un Admin autenticado envía una solicitud de edición de un ejercicio existente con datos válidos, THE Admin_Service SHALL actualizar el ejercicio y devolver los datos actualizados.
3. WHEN un Admin autenticado envía una solicitud de eliminación de un ejercicio que no tiene intentos asociados, THE Admin_Service SHALL eliminar el ejercicio y devolver una confirmación de éxito.
4. IF un Admin autenticado intenta eliminar un ejercicio que tiene intentos asociados, THEN THE Admin_Service SHALL rechazar la solicitud y devolver un mensaje de error indicando que el ejercicio tiene intentos registrados y no puede eliminarse.
5. IF el `level_id` enviado en la creación o edición de un ejercicio no corresponde a un nivel existente, THEN THE Admin_Service SHALL rechazar la solicitud y devolver un mensaje de error indicando que el nivel especificado no existe.
6. IF el `category_id` enviado en la creación o edición de un ejercicio no corresponde a una categoría existente, THEN THE Admin_Service SHALL rechazar la solicitud y devolver un mensaje de error indicando que la categoría especificada no existe.
7. IF cualquier campo obligatorio (título, enunciado, solución esperada, `level_id`, `category_id`) está ausente o vacío en la creación de un ejercicio, THEN THE Admin_Service SHALL rechazar la solicitud y devolver un mensaje de error indicando el campo faltante.
8. IF un usuario con rol `student` intenta acceder a los endpoints de gestión de ejercicios del Admin_Service, THEN THE Auth_Service SHALL rechazar la solicitud con un error de autorización, permitiendo que el intento llegue al sistema pero siendo rechazado antes de ejecutar la operación.

---

### Requirement 14: Autorización y control de acceso

**User Story:** Como administrador del sistema, quiero que las rutas protegidas solo sean accesibles con un token válido y el rol correcto, para garantizar la seguridad e integridad de los datos.

#### Acceptance Criteria

1. WHILE una solicitud a una ruta protegida no incluye un JWT válido y no expirado en el encabezado de autorización, THE Auth_Service SHALL rechazar la solicitud con un código de error 401 y un mensaje indicando que la autenticación es requerida.
2. WHILE un Student autenticado intenta acceder a una ruta exclusiva de Admin, THE Auth_Service SHALL rechazar la solicitud con un código de error 403 y un mensaje indicando que el acceso no está autorizado para su rol.
3. WHILE un Admin autenticado intenta acceder a las rutas de resolución de ejercicios reservadas para estudiantes, THE Auth_Service SHALL rechazar la solicitud con un código de error 403 y un mensaje indicando que la operación no está disponible para el rol admin.
4. WHEN el JWT de un usuario expira, THE Auth_Service SHALL rechazar cualquier solicitud que use ese token con un código de error 401 y un mensaje indicando que la sesión ha expirado.
5. THE Auth_Service SHALL validar la firma del JWT en cada solicitud a una ruta protegida para garantizar que el token no ha sido alterado.

---

### Requirement 15: Validaciones del lado del cliente

**User Story:** Como estudiante o administrador usando la interfaz web, quiero recibir mensajes de error inmediatos en los formularios antes de enviarlos al servidor, para corregir errores sin esperar respuesta del backend.

#### Acceptance Criteria

1. WHEN un usuario deja vacío un campo obligatorio en un formulario y intenta enviarlo, THE System SHALL mostrar un mensaje de error descriptivo junto al campo correspondiente antes de realizar la solicitud al servidor.
2. WHEN un usuario ingresa un formato de email inválido en el formulario de registro o actualización de perfil, THE System SHALL mostrar un mensaje de error indicando que el formato del email no es válido antes de enviar la solicitud.
3. WHEN un usuario ingresa una contraseña de menos de 8 caracteres en el formulario de registro, THE System SHALL mostrar un mensaje de error indicando el requisito mínimo de longitud antes de enviar la solicitud.
4. THE System SHALL mantener la consistencia entre los mensajes de validación del cliente y los mensajes de error devueltos por el servidor, usando el mismo vocabulario y nivel de detalle.

---

### Requirement 16: Trazabilidad y mantenibilidad del sistema

**User Story:** Como desarrollador del sistema, quiero que la arquitectura esté separada en capas bien definidas, para que el sistema sea mantenible y escalable a lo largo del tiempo.

#### Acceptance Criteria

1. THE System SHALL organizar el código del backend en capas independientes: rutas, controladores, servicios y acceso a datos, de forma que cada capa tenga una única responsabilidad.
2. THE System SHALL organizar el código del frontend en componentes reutilizables separados de la lógica de negocio y de las llamadas a la API.
3. THE System SHALL registrar en el log del sistema cualquier error no controlado que ocurra en el backend, incluyendo la ruta afectada, el tipo de error y el timestamp.
4. WHEN se agrega un nuevo tipo de ejercicio o una nueva categoría, THE System SHALL permitir incorporarlo sin modificar la lógica central de evaluación de intentos.
