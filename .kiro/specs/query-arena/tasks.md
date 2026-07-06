# Implementation Plan: QueryArena

## Overview

Implementación incremental de QueryArena siguiendo la arquitectura hexagonal: primero la infraestructura y el dominio puro (entidades, puertos, use cases), luego los adaptadores de salida (repositorios PostgreSQL, BcryptAdapter, JWTAdapter), después los adaptadores de entrada (middlewares, controllers, routes Express), y finalmente el frontend React. Cada capa se testea de forma aislada usando mocks de puertos antes de conectar la siguiente capa.

## Tasks

- [x] 1. Configuración del proyecto e infraestructura base
  - [x] 1.1 Inicializar monorepo y configurar TypeScript, ESLint, Jest y fast-check
    - Crear `tsconfig.json`, `jest.config.ts`, `.eslintrc`, `package.json` con dependencias exactas (express, pg, bcrypt, jsonwebtoken, fast-check, jest, ts-jest, supertest, playwright)
    - Configurar scripts `build`, `test`, `test:coverage`, `dev`
    - _Requirements: 16.1, 16.2_

  - [x] 1.2 Crear `src/infrastructure/env.ts` con validación de variables de entorno
    - Leer y validar `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `BCRYPT_COST`
    - Lanzar error descriptivo al inicio si falta alguna variable
    - _Requirements: 16.1_

  - [x] 1.3 Crear `src/infrastructure/database.ts` con pool de conexiones PostgreSQL
    - Usar `pg.Pool` con la `DATABASE_URL` de `env.ts`
    - Exportar función `query(sql, params)` y `getClient()` para transacciones
    - _Requirements: 16.1_

  - [x] 1.4 Crear el script de migraciones SQL con el esquema completo de la base de datos
    - Tablas: `users`, `levels`, `categories`, `exercises`, `attempts`, `rankings` con constraints, índices y FK según el diagrama ER
    - _Requirements: 5.1, 6.1, 8.2, 16.1_


- [x] 2. Entidades del dominio y puertos de salida
  - [x] 2.1 Crear entidades TypeScript en `src/domain/entities/`
    - `User.ts`, `Exercise.ts`, `Attempt.ts`, `Ranking.ts` con tipos estrictos (sin dependencias externas)
    - _Requirements: 16.1_

  - [x] 2.2 Crear puertos de salida en `src/domain/ports/out/`
    - `IUserRepository.ts`, `IExerciseRepository.ts`, `IAttemptRepository.ts`, `IRankingRepository.ts`
    - `IHashPort.ts` (hash/compare), `ITokenPort.ts` (sign/verify)
    - _Requirements: 16.1_

  - [x] 2.3 Crear puertos de entrada en `src/domain/ports/in/`
    - `IAuthUseCase.ts`, `IUserUseCase.ts`, `IExerciseUseCase.ts`, `IAttemptUseCase.ts`
    - `IResultUseCase.ts`, `IRankingUseCase.ts`, `IDashboardUseCase.ts`, `IAdminUseCase.ts`
    - _Requirements: 16.1_


- [x] 3. Use Case: AuthUseCase (registro e inicio de sesión)
  - [x] 3.1 Implementar `src/domain/use-cases/AuthUseCase.ts`
    - Método `register(username, email, password)`: validar campos, verificar unicidad vía `IUserRepository`, hashear con `IHashPort` (coste ≥ 10), persistir con rol `student`
    - Método `login(email, password)`: validar campos, buscar usuario, comparar hash, emitir JWT con `ITokenPort` incluyendo `user_id`, `role` y `exp`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.2 Escribir unit tests para AuthUseCase en `tests/unit/auth.use-case.spec.ts`
    - Registro exitoso, username duplicado, email duplicado, hash falla
    - Login exitoso, email no registrado, password incorrecta, campos vacíos
    - _Requirements: 1.1, 1.5, 1.6, 1.9, 2.1, 2.2, 2.3_

  - [x] 3.3 Escribir PBT para AuthUseCase — Properties 1, 2, 3, 4, 5, 6
    - **Property 1**: Registro con datos válidos asigna rol student — `// Feature: query-arena, Property 1`
    - **Property 2**: Password corta (0–7 chars) rechazada siempre — `// Feature: query-arena, Property 2`
    - **Property 3**: Username o email duplicado rechazado — `// Feature: query-arena, Property 3`
    - **Property 4**: Hash almacenado verificable con bcrypt coste ≥ 10 — `// Feature: query-arena, Property 4`
    - **Property 5**: Login exitoso produce JWT con claims correctas — `// Feature: query-arena, Property 5`
    - **Property 6**: Credenciales incorrectas nunca emiten JWT — `// Feature: query-arena, Property 6`
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.8, 2.1, 2.2, 2.3, 2.6_


- [x] 4. Use Case: UserUseCase (perfil de usuario)
  - [x] 4.1 Implementar `src/domain/use-cases/UserUseCase.ts`
    - Método `getProfile(userId)`: devolver `username`, `email`, `created_at`, `role`
    - Método `updateProfile(userId, {username?, email?})`: validar no vacíos, verificar unicidad, persistir y devolver datos actualizados
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

  - [x] 4.2 Escribir unit tests para UserUseCase en `tests/unit/user.use-case.spec.ts`
    - Perfil completo devuelto, username duplicado de otro usuario rechazado, email duplicado rechazado, campo vacío rechazado
    - _Requirements: 3.1, 3.3, 3.4, 3.6_

  - [x] 4.3 Escribir PBT para UserUseCase — Properties 7, 8
    - **Property 7**: Perfil devuelto es completo y consistente — `// Feature: query-arena, Property 7`
    - **Property 8**: Actualización de perfil respeta unicidad — `// Feature: query-arena, Property 8`
    - _Requirements: 3.1, 3.3, 3.4_


- [x] 5. Use Case: ExerciseUseCase (catálogo de ejercicios)
  - [x] 5.1 Implementar `src/domain/use-cases/ExerciseUseCase.ts`
    - Método `listExercises({level_id?, category_id?})`: devolver solo `is_active = true` con título, descripción, nivel, categoría; aplicar filtros opcionales
    - Método `getExerciseById(exerciseId)`: devolver detalle completo; lanzar `EXERCISE_NOT_FOUND` si no existe
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 5.2 Escribir unit tests para ExerciseUseCase en `tests/unit/exercise.use-case.spec.ts`
    - Catálogo sin filtros devuelve solo activos, filtro por level_id, filtro por category_id, ejercicio no encontrado
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [x] 5.3 Escribir PBT para ExerciseUseCase — Properties 9, 10
    - **Property 9**: Catálogo devuelve solo ejercicios activos con campos completos — `// Feature: query-arena, Property 9`
    - **Property 10**: Filtrado por nivel o categoría es exhaustivo y exclusivo — `// Feature: query-arena, Property 10`
    - _Requirements: 4.1, 4.2, 4.3_


- [x] 6. Use Cases: ResultUseCase y AttemptUseCase (resolución y registro de intentos)
  - [x] 6.1 Implementar `src/domain/use-cases/ResultUseCase.ts`
    - Método `evaluateAttempt(attemptId, querySent, expectedSolution)`: comparar queries, detectar errores de sintaxis/ejecución, retornar `{status, score, hint}`
    - Invariante: `status=correct → score=puntaje_ejercicio > 0`; `status=incorrect|error → score=0`
    - Generar mensaje orientador para estados `incorrect`/`error` sin revelar solución
    - _Requirements: 5.2, 5.3, 5.4, 7.1, 7.2, 7.3, 7.4_

  - [x] 6.2 Implementar `src/domain/use-cases/AttemptUseCase.ts`
    - Método `submitAttempt(userId, exerciseId, querySent, resolution_time_ms)`: validar query no vacía, verificar ejercicio existe, persistir intento, llamar a `ResultUseCase.evaluateAttempt`, registrar tiempo, devolver resultado
    - Método `getAttemptHistory(userId, exerciseId?)`: devolver intentos ordenados por `created_at` DESC
    - _Requirements: 5.1, 5.5, 5.6, 5.7, 5.8, 6.1, 6.2, 6.3, 6.4_

  - [x] 6.3 Escribir unit tests para ResultUseCase en `tests/unit/result.use-case.spec.ts`
    - Query correcta → correcto+puntaje, query incorrecta → incorrecto+0, sintaxis inválida → error+0+hint, hint no revela solución
    - _Requirements: 5.3, 5.4, 7.2, 7.3, 7.4_

  - [x] 6.4 Escribir PBT para ResultUseCase y AttemptUseCase — Properties 11, 12, 13
    - **Property 11**: Intento registrado contiene todos los campos requeridos — `// Feature: query-arena, Property 11`
    - **Property 12**: Estado y puntaje del intento son siempre consistentes — `// Feature: query-arena, Property 12`
    - **Property 13**: Historial de intentos ordenado por fecha descendente — `// Feature: query-arena, Property 13`
    - _Requirements: 5.1, 5.3, 5.4, 6.1, 6.2, 6.3_


- [x] 7. Use Cases: RankingUseCase y DashboardUseCase
  - [x] 7.1 Implementar `src/domain/use-cases/RankingUseCase.ts`
    - Método `updateScore(userId, score)`: incrementar `accumulated_score` y actualizar `last_correct_at` en `IRankingRepository`; reintentar de forma asíncrona si falla sin bloquear al estudiante
    - Método `getRanking()`: devolver lista ordenada por `accumulated_score` DESC, desempate por `last_correct_at` ASC; incluir posición, username y puntaje; estudiantes sin puntos incluidos con score 0
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 10.1, 10.2, 10.3_

  - [x] 7.2 Implementar `src/domain/use-cases/DashboardUseCase.ts`
    - Método `getSummary(userId)`: total intentados, total correctos, puntaje acumulado, posición en ranking
    - Método `getProgressByLevel(userId)` y `getProgressByCategory(userId)`: conteos agrupados
    - Método `getRecentHistory(userId)`: últimos 10 intentos con nombre ejercicio, estado, puntaje y fecha
    - Devolver contadores reales (no errores) cuando el estudiante no tiene intentos
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 7.3 Escribir unit tests para RankingUseCase y DashboardUseCase en `tests/unit/`
    - Estudiante sin intentos → dashboard con contadores en 0 y lista vacía (no error)
    - Historial reciente limitado a 10 elementos
    - Puntaje acumulado = suma de intentos correctos
    - _Requirements: 8.2, 9.1, 9.4, 9.5, 10.3_

  - [x] 7.4 Escribir PBT para RankingUseCase y DashboardUseCase — Properties 14, 15, 16, 17
    - **Property 14**: Puntaje acumulado = suma de intentos correctos — `// Feature: query-arena, Property 14`
    - **Property 15**: Ranking ordenado + desempate por fecha — `// Feature: query-arena, Property 15`
    - **Property 16**: Dashboard refleja datos reales del estudiante — `// Feature: query-arena, Property 16`
    - **Property 17**: Progreso por nivel/categoría exacto — `// Feature: query-arena, Property 17`
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 9.1, 9.2, 9.3, 10.1, 10.2_


- [x] 8. Use Case: AdminUseCase (gestión de niveles, categorías y ejercicios)
  - [x] 8.1 Implementar `src/domain/use-cases/AdminUseCase.ts` — Niveles
    - CRUD de niveles: crear (nombre único), editar, eliminar (rechazar si tiene ejercicios asociados de forma atómica)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 8.2 Implementar AdminUseCase — Categorías
    - CRUD de categorías: crear (nombre único), editar, eliminar (rechazar si tiene ejercicios, retornar estado FALLIDA)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 8.3 Implementar AdminUseCase — Ejercicios
    - CRUD de ejercicios: crear (validar todos los campos obligatorios, verificar level_id y category_id existentes), editar, eliminar (rechazar si tiene intentos)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [x] 8.4 Escribir unit tests para AdminUseCase en `tests/unit/admin.use-case.spec.ts`
    - Creación exitosa de nivel, categoría y ejercicio
    - Eliminación de nivel con ejercicios → rechazada; sin ejercicios → éxito
    - Eliminación de ejercicio con intentos → rechazada
    - level_id/category_id inexistente en creación de ejercicio → rechazado
    - _Requirements: 11.1, 11.3, 11.4, 12.1, 12.3, 12.4, 13.1, 13.3, 13.4, 13.5, 13.6_

  - [x] 8.5 Escribir PBT para AdminUseCase — Property 18
    - **Property 18**: Eliminación con dependencias es atómica y siempre rechazada — `// Feature: query-arena, Property 18`
    - _Requirements: 11.4, 12.4, 13.4_


- [x] 9. Checkpoint — Dominio completo
  - Asegurarse de que todos los use cases tienen tests pasando. Ejecutar `jest --testPathPattern="tests/unit" --coverage`. Consultar al usuario si hay dudas antes de continuar.

- [x] 10. Adaptadores de salida — Seguridad (BcryptAdapter y JWTAdapter)
  - [x] 10.1 Implementar `src/adapters/out/security/BcryptAdapter.ts`
    - Implementar `IHashPort`: método `hash(plain)` con coste ≥ 10 desde `env.ts`, método `compare(plain, hash)`
    - _Requirements: 1.8, 1.9_

  - [x] 10.2 Implementar `src/adapters/out/security/JWTAdapter.ts`
    - Implementar `ITokenPort`: método `sign({userId, role})` con `exp`, método `verify(token)` que lanza si expirado o firma inválida
    - _Requirements: 2.1, 2.6, 14.1, 14.4, 14.5_

  - [x] 10.3 Escribir unit tests para BcryptAdapter y JWTAdapter en `tests/unit/`
    - Hash generado verifica con bcrypt, coste correcto; JWT verificable, expirado rechazado, firma adulterada rechazada
    - _Requirements: 1.8, 2.6, 14.4, 14.5_


- [x] 11. Adaptadores de salida — Repositorios PostgreSQL
  - [x] 11.1 Implementar `src/adapters/out/persistence/postgres/PostgresUserRepository.ts` y `user.mapper.ts`
    - Implementar `IUserRepository`: findByEmail, findByUsername, findById, create, update
    - _Requirements: 1.1, 1.5, 1.6, 3.1, 3.2, 3.3, 3.4_

  - [x] 11.2 Implementar `PostgresExerciseRepository.ts` y `exercise.mapper.ts`
    - Implementar `IExerciseRepository`: findAll(filters), findById, create, update, delete, countByLevel, countByCategory
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 11.4, 12.4, 13.3_

  - [x] 11.3 Implementar `PostgresAttemptRepository.ts` y `attempt.mapper.ts`
    - Implementar `IAttemptRepository`: create, findByUser(userId, exerciseId?), update, countByExercise
    - _Requirements: 5.1, 6.1, 6.2, 6.3, 6.4, 13.4_

  - [x] 11.4 Implementar `PostgresRankingRepository.ts`
    - Implementar `IRankingRepository`: upsert(userId, scoreIncrement), findAll (ordenado por accumulated_score DESC, last_correct_at ASC), findByUser(userId)
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 10.1, 10.2, 10.3_

  - [x] 11.5 Implementar `src/adapters/out/logger/WinstonLogger.ts`
    - Logger con niveles info/warn/error; log de errores incluye ruta, tipo y timestamp
    - _Requirements: 6.4, 8.4, 16.3_


- [x] 12. Inyección de dependencias y bootstrap de la aplicación
  - [x] 12.1 Implementar `src/infrastructure/container.ts`
    - Instanciar adaptadores de salida e inyectarlos en los use cases; exportar instancias listas para inyectar en controllers
    - _Requirements: 16.1_

  - [x] 12.2 Implementar `src/app.ts` con bootstrap Express
    - Registrar middlewares globales (JSON body parser, CORS, errorHandler), montar todos los routers bajo `/api`
    - _Requirements: 16.1, 16.3_


- [x] 13. Adaptadores de entrada — Middlewares Express
  - [x] 13.1 Implementar `src/adapters/in/http/middlewares/authenticate.ts`
    - Extraer JWT del header `Authorization: Bearer <token>`, verificar con `ITokenPort.verify()`
    - Devolver 401 `UNAUTHORIZED` si falta o es inválido; 401 `SESSION_EXPIRED` si expirado
    - Adjuntar `{userId, role}` a `req.user`
    - _Requirements: 14.1, 14.4, 14.5_

  - [x] 13.2 Implementar `src/adapters/in/http/middlewares/authorize.ts`
    - Factory `authorize(...roles)`: rechazar con 403 `FORBIDDEN` si `req.user.role` no está en los roles permitidos
    - _Requirements: 14.2, 14.3, 11.6, 12.6, 13.8_

  - [x] 13.3 Implementar `src/adapters/in/http/middlewares/errorHandler.ts`
    - Capturar cualquier error no controlado, loguearlo con ruta+tipo+timestamp vía WinstonLogger, devolver 500 genérico al cliente
    - _Requirements: 16.3_

  - [x] 13.4 Escribir PBT para middlewares — Properties 19, 20, 21, 22
    - **Property 19**: Solicitudes sin JWT válido → 401 — `// Feature: query-arena, Property 19`
    - **Property 20**: JWT con firma adulterada → 401 — `// Feature: query-arena, Property 20`
    - **Property 21**: Cross-role access → 403 — `// Feature: query-arena, Property 21`
    - **Property 22**: Logs registran errores con metadatos completos — `// Feature: query-arena, Property 22`
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 16.3_


- [x] 14. Adaptadores de entrada — Controllers y Routes
  - [x] 14.1 Implementar `auth.controller.ts` y `auth.routes.ts`
    - `POST /api/auth/register`: validar campos, delegar a `IAuthUseCase.register()`, devolver 201
    - `POST /api/auth/login`: validar campos, delegar a `IAuthUseCase.login()`, devolver 200 con JWT y datos de usuario
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 2.1, 2.4, 2.5_

  - [x] 14.2 Implementar `user.controller.ts` y `user.routes.ts`
    - `GET /api/users/me` (authenticate): delegar a `IUserUseCase.getProfile()`
    - `PATCH /api/users/me` (authenticate): delegar a `IUserUseCase.updateProfile()`, validar campos no vacíos
    - _Requirements: 3.1, 3.2, 3.5, 3.6_

  - [x] 14.3 Implementar `exercise.controller.ts` y `exercise.routes.ts`
    - `GET /api/exercises` (authenticate + student): delegar a `IExerciseUseCase.listExercises()` con filtros de query string
    - `GET /api/exercises/:id` (authenticate + student): delegar a `IExerciseUseCase.getExerciseById()`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 14.4 Implementar `attempt.controller.ts` y `attempt.routes.ts`
    - `POST /api/attempts` (authenticate + student): validar query no vacía, delegar a `IAttemptUseCase.submitAttempt()`, devolver resultado con status/score/time/hint
    - `GET /api/attempts` (authenticate + student): delegar a `IAttemptUseCase.getAttemptHistory()` con filtro opcional por `exercise_id`
    - _Requirements: 5.1, 5.6, 5.7, 5.8, 6.2, 6.3, 6.5_

  - [x] 14.5 Implementar `ranking.controller.ts`, `dashboard.controller.ts` y sus routes
    - `GET /api/ranking` (authenticate): delegar a `IRankingUseCase.getRanking()`
    - `GET /api/dashboard`, `/by-level`, `/by-category`, `/recent` (authenticate + student): delegar a `IDashboardUseCase`
    - _Requirements: 8.3, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 10.1, 10.4_

  - [x] 14.6 Implementar `admin.controller.ts` y `admin.routes.ts`
    - CRUD `/api/admin/levels`, `/api/admin/categories`, `/api/admin/exercises` (authenticate + admin)
    - Delegar a `IAdminUseCase`; aplicar `authorize('admin')` en todas las rutas
    - _Requirements: 11.1, 11.2, 11.3, 11.6, 11.7, 12.1, 12.2, 12.3, 12.6, 13.1, 13.2, 13.3, 13.8_


- [x] 15. Checkpoint — Backend completo
  - Ejecutar `jest --coverage` y verificar que todos los tests pasan. Ejecutar `tsc --noEmit` sin errores. Consultar al usuario si hay dudas.

- [x] 16. Tests de integración del backend
  - [x] 16.1 Escribir tests de integración en `tests/integration/` con Supertest + base de datos de test
    - Flujo completo: registro → login → submit intento correcto → verificar ranking actualizado
    - Flujo admin: login admin → crear nivel → crear categoría → crear ejercicio → verificar en catálogo
    - Actualización asíncrona del ranking completa sin error
    - _Requirements: 1.1, 2.1, 5.1, 5.2, 8.1, 8.2, 11.1, 12.1, 13.1_

  - [x] 16.2 Escribir tests de integración para casos de error y seguridad
    - Ruta protegida sin token → 401, student en ruta admin → 403, admin en ruta student → 403
    - Eliminar nivel con ejercicios → 409, eliminar ejercicio con intentos → 409
    - _Requirements: 11.4, 12.4, 13.4, 14.1, 14.2, 14.3_


- [x] 17. Frontend — Estructura base y capa API
  - [x] 17.1 Configurar proyecto React + TypeScript con Vite
    - Estructura de carpetas: `components/`, `pages/`, `hooks/`, `context/`, `api/`, `types/`, `utils/`
    - Configurar React Router, axios (o fetch wrapper) y tipos compartidos con el backend
    - _Requirements: 16.1, 16.2_

  - [x] 17.2 Implementar `src/api/` — capa de llamadas HTTP
    - `authApi.ts`: `register()`, `login()`
    - `exercisesApi.ts`: `listExercises()`, `getExercise()`
    - `attemptsApi.ts`: `submitAttempt()`, `getHistory()`
    - `rankingApi.ts`: `getRanking()`
    - `dashboardApi.ts`: `getSummary()`, `getByLevel()`, `getByCategory()`, `getRecent()`
    - `adminApi.ts`: CRUD de niveles, categorías y ejercicios
    - _Requirements: 16.2_

  - [x] 17.3 Implementar `AuthContext` y hook `useAuth`
    - Guardar JWT en localStorage, proveer `user`, `login()`, `logout()`, `isAuthenticated`
    - Adjuntar token en cada petición; redirigir al login si 401
    - _Requirements: 2.1, 14.1_


- [x] 18. Frontend — Páginas de autenticación y perfil
  - [x] 18.1 Implementar páginas `Register` y `Login` con validación del lado del cliente
    - Validar campos obligatorios no vacíos, formato de email, contraseña ≥ 8 caracteres antes del envío
    - Mostrar mensajes de error junto al campo correspondiente con el mismo vocabulario que el backend
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [x] 18.2 Implementar página `Profile` con formulario de actualización
    - Mostrar username, email, fecha de registro; permitir editar username y email con validación previa al envío
    - _Requirements: 3.1, 3.2, 15.1, 15.2_

  - [x] 18.3 Escribir unit tests de componentes con React Testing Library
    - Formulario registro: campo vacío → mensaje de error, email inválido → mensaje, password corta → mensaje
    - _Requirements: 15.1, 15.2, 15.3_


- [x] 19. Frontend — Catálogo y resolución de ejercicios
  - [x] 19.1 Implementar página `Exercises` con catálogo y filtros
    - Listar ejercicios con título, nivel y categoría; controles de filtro por nivel y categoría
    - Navegar al detalle del ejercicio al hacer clic
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 19.2 Implementar página `ExerciseDetail` con editor SQL y envío de solución
    - Mostrar enunciado completo; campo de texto para la consulta SQL con validación de no vacío
    - Capturar tiempo de inicio; enviar `{exercise_id, query, resolution_time_ms}`; mostrar resultado (estado, puntaje, hint)
    - _Requirements: 4.4, 5.1, 5.5, 7.1, 7.4, 15.1_

  - [x] 19.3 Implementar página `History` con historial de intentos del estudiante
    - Tabla con ejercicio, estado, puntaje, fecha; filtro por ejercicio opcional; orden descendente
    - _Requirements: 6.2, 6.3_


- [x] 20. Frontend — Dashboard y Ranking
  - [x] 20.1 Implementar página `Dashboard`
    - Mostrar resumen (total intentados, total correctos, puntaje, posición ranking)
    - Secciones de progreso por nivel, por categoría e historial reciente (últimos 10)
    - Manejar estudiante sin intentos: mostrar contadores en cero y lista vacía, sin mensaje de error
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 20.2 Implementar página `Ranking`
    - Tabla con posición, username y puntaje acumulado; resaltar la fila del usuario actual
    - Incluir estudiantes con puntaje cero; misma posición para puntajes iguales
    - _Requirements: 10.1, 10.2, 10.3_


- [x] 21. Frontend — Panel de administrador
  - [x] 21.1 Implementar página `AdminLevels` con CRUD de niveles
    - Tabla de niveles con botones crear, editar, eliminar; formulario en modal con validación de nombre no vacío y único
    - Mostrar error descriptivo si el nivel tiene ejercicios asociados al intentar eliminarlo
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 21.2 Implementar página `AdminCategories` con CRUD de categorías
    - Igual estructura que AdminLevels; mostrar error si categoría tiene ejercicios al eliminar
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 21.3 Implementar página `AdminExercises` con CRUD de ejercicios
    - Formulario con título, enunciado, solución esperada, selectores de nivel y categoría
    - Validar todos los campos obligatorios antes del envío; mostrar error si el ejercicio tiene intentos al eliminar
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.7_

  - [x] 21.4 Implementar rutas protegidas por rol en el frontend
    - `PrivateRoute` que redirige al login si no autenticado; `AdminRoute` que redirige con error 403 si rol no es admin
    - _Requirements: 14.2, 14.3_


- [x] 22. Checkpoint — Frontend completo
  - Ejecutar `tsc --noEmit` en el proyecto frontend sin errores. Ejecutar tests de componentes con `jest --run`. Consultar al usuario si hay dudas.

- [x] 23. Tests E2E con Playwright
  - [x] 23.1 Implementar tests E2E de validaciones de formulario del cliente
    - Campo vacío en registro → mensaje de error visible; email inválido → mensaje; password < 8 chars → mensaje
    - _Requirements: 15.1, 15.2, 15.3_

  - [x] 23.2 Implementar tests E2E del flujo completo de estudiante
    - Registro → login → navegar catálogo → resolver ejercicio correcto → verificar resultado → ver dashboard → ver ranking con posición
    - _Requirements: 1.1, 2.1, 4.1, 5.1, 7.1, 8.3, 9.1, 10.1_

  - [x] 23.3 Implementar tests E2E del flujo de administrador
    - Login como admin → crear nivel → crear categoría → crear ejercicio → verificar ejercicio en catálogo (como student)
    - _Requirements: 11.1, 12.1, 13.1, 4.1_

- [x] 24. Checkpoint final — Sistema integrado
  - Ejecutar suite completa: `jest --coverage` (backend), tests de componentes, Playwright E2E. Verificar cobertura de las 22 propiedades PBT. Consultar al usuario si hay dudas o ajustes antes de marcar como completado.


## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido, pero cubren las 22 propiedades de corrección definidas en el diseño.
- El orden de implementación respeta el flujo de dependencias de la arquitectura hexagonal: infraestructura → dominio → adaptadores de salida → adaptadores de entrada → frontend.
- Cada use case del dominio se testea con mocks de puertos antes de conectar los adaptadores reales, garantizando que la lógica de negocio es independiente del framework.
- Las propiedades PBT usan fast-check con mínimo 100 iteraciones y etiqueta `// Feature: query-arena, Property N`.
- Los tests de integración requieren una base de datos PostgreSQL de test (puede usarse Docker: `docker run -e POSTGRES_DB=queryarena_test ...`).
- Los tests E2E con Playwright requieren que tanto el backend como el frontend estén corriendo; usar `playwright.config.ts` con `webServer` para automatizar el arranque.
- Los repositorios PostgreSQL asumen que las migraciones (tarea 1.4) ya fueron ejecutadas antes de correr los tests de integración.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3"] },
    { "id": 4, "tasks": ["3.1", "4.1", "5.1", "6.1", "7.1", "7.2", "8.1", "8.2", "8.3"] },
    { "id": 5, "tasks": ["3.2", "3.3", "4.2", "4.3", "5.2", "5.3", "6.2", "6.3", "7.3", "7.4", "8.4", "8.5"] },
    { "id": 6, "tasks": ["10.1", "10.2", "11.1", "11.2", "11.3", "11.4", "11.5"] },
    { "id": 7, "tasks": ["10.3", "12.1", "12.2"] },
    { "id": 8, "tasks": ["13.1", "13.2", "13.3"] },
    { "id": 9, "tasks": ["13.4", "14.1", "14.2", "14.3", "14.4", "14.5", "14.6"] },
    { "id": 10, "tasks": ["16.1", "16.2"] },
    { "id": 11, "tasks": ["17.1"] },
    { "id": 12, "tasks": ["17.2", "17.3"] },
    { "id": 13, "tasks": ["18.1", "18.2"] },
    { "id": 14, "tasks": ["18.3", "19.1", "19.2", "19.3"] },
    { "id": 15, "tasks": ["20.1", "20.2", "21.1", "21.2", "21.3"] },
    { "id": 16, "tasks": ["21.4"] },
    { "id": 17, "tasks": ["23.1", "23.2", "23.3"] }
  ]
}
```
