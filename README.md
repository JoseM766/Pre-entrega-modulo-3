# ShipNow — Pre-entrega Módulo 3: Manejo profesional de errores

Capa centralizada de manejo de errores para la API ShipNow: errores personalizados del dominio, un diccionario de errores y un middleware global que devuelve siempre respuestas con la misma estructura. Se aplica a toda la API, incluido el módulo de mocks (`/api/mocks`).

## Cómo correr el proyecto

```bash
npm install
cp .env.example .env     # completar MONGODB_URI y JWT_SECRET
npm run dev
```

El servidor queda en `http://localhost:8080`.

## Cómo funciona

```
Service detecta el problema   → lanza un error del dominio (ej. UserNotFoundError)
Controller / middlewares      → next(error)  (nunca arman una respuesta de error)
errorHandler (middleware global) → responde { status, error, message } con el status del diccionario
```

Los errores se detectan en la capa que corresponde (sobre todo en los services), pero la respuesta al cliente sale **únicamente** del middleware global.

## Estructura de la respuesta de error

```json
{
  "status": "error",
  "error": "USER_NOT_FOUND",
  "message": "El usuario no existe"
}
```

| Campo | Descripción |
|---|---|
| `status` | Siempre `"error"` |
| `error` | Código interno estable (ver tabla). Sirve para tests y para el frontend |
| `message` | Mensaje claro para el cliente |
| `details` | Solo fuera de producción: información extra para debugging (ej. el valor recibido). **Nunca se envía en `production`** |

Los errores inesperados (`500`) responden siempre con un mensaje genérico; el error real solo se registra en consola del servidor.

## Piezas de la capa de errores

- `error-dictionary.js`: **diccionario de errores**. Define cada código con su status HTTP y su mensaje por defecto.
- `app-error.js`: clase base `AppError` (código, status, mensaje, detalle opcional).
- `domain-errors.js`: errores personalizados del dominio (`UserNotFoundError`, `ProductNotFoundError`, `InvalidMockAmountError`, `MockGenerationError`, etc.). Se lanzan así: `throw new UserNotFoundError()`.
- `src/errors/` contiene las tres primeras piezas.
- `src/middlewares/error.middleware.js`: `errorHandler` (respuesta final) y `notFoundHandler` (rutas inexistentes). Además traduce errores de Express y Mongoose (JSON mal formado, claves duplicadas, errores de MongoDB) a errores conocidos.

## Diccionario de errores

| Código | HTTP | Cuándo |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Datos inválidos (también errores de validación de Mongoose) |
| `MISSING_FIELDS` | 400 | Faltan campos obligatorios |
| `INVALID_EMAIL` / `INVALID_PASSWORD` | 400 | Email o contraseña con formato inválido |
| `INVALID_JSON` | 400 | El body no es un JSON válido |
| `INVALID_PRICE` / `INVALID_STOCK` | 400 | Precio o stock inválido |
| `INVALID_PRODUCT_STATUS` | 400 | Estado de producto inexistente |
| `INVALID_ORDER_STATUS` | 400 | Estado de pedido inexistente (reservado para los endpoints de pedidos) |
| `INVALID_MOCK_AMOUNT` | 400 | Cantidad de mocks no numérica, decimal, negativa, mayor a 100, todas en 0 o más entregas que pedidos |
| `INVALID_MOCK_ROLE` | 400 | Rol inválido al generar usuarios de prueba |
| `MOCK_NO_CUSTOMERS` / `MOCK_NO_DRIVERS` | 400 | No hay clientes / repartidores para relacionar los pedidos / entregas |
| `UNAUTHORIZED` | 401 | No autenticado |
| `INVALID_CREDENTIALS` | 401 | Login con credenciales incorrectas |
| `FORBIDDEN` | 403 | Sin permisos para la acción |
| `USER_NOT_FOUND` / `PRODUCT_NOT_FOUND` / `ORDER_NOT_FOUND` | 404 | Recurso inexistente (`ORDER_NOT_FOUND` reservado para pedidos) |
| `ROUTE_NOT_FOUND` | 404 | Ruta inexistente |
| `EMAIL_EXISTS` / `PRODUCT_EXISTS` / `DUPLICATE_KEY` | 409 | Conflicto: dato repetido |
| `MOCK_GENERATION_ERROR` | 500 | Falló la carga de datos de prueba en MongoDB |
| `DATABASE_ERROR` | 500 | Error de base de datos |
| `INTERNAL_SERVER_ERROR` | 500 | Error inesperado |

## Cómo probar los errores

Con el servidor corriendo (`npm run dev`), en Postman o con `curl` (el cuerpo siempre tiene la misma forma):

| Caso | Petición | Respuesta esperada |
|---|---|---|
| Ruta inexistente | `GET /api/nada` | `404` `ROUTE_NOT_FOUND` |
| JSON roto | `POST /api/sessions/login` con body `{malo` | `400` `INVALID_JSON` |
| Login incorrecto | `POST /api/sessions/login` con email/contraseña falsos | `401` `INVALID_CREDENTIALS` |
| Registro incompleto | `POST /api/sessions/register` con `{"email":"a@a.com"}` | `400` `MISSING_FIELDS` |
| Sin sesión | `GET /api/sessions/current` | `401` `UNAUTHORIZED` |
| Sin permisos | `POST /api/products` logueado como `user` | `403` `FORBIDDEN` |
| Producto inexistente | `GET /api/products/abc` | `404` `PRODUCT_NOT_FOUND` |
| Precio inválido | `POST /api/products` (admin) con `"price": -1` | `400` `INVALID_PRICE` |
| Usuario inexistente | `GET /api/users/zzz` (admin) | `404` `USER_NOT_FOUND` |

**Casos inválidos del módulo de mocks:**

| Caso | Petición | Respuesta esperada |
|---|---|---|
| Cantidad no numérica | `GET /api/mocks/users?qty=abc` | `400` `INVALID_MOCK_AMOUNT` — `"qty" debe ser un número entero` |
| Cantidad negativa | `GET /api/mocks/users?qty=-5` | `400` `INVALID_MOCK_AMOUNT` — `"qty" no puede ser negativo` |
| Cantidad excesiva | `GET /api/mocks/orders?qty=1000` | `400` `INVALID_MOCK_AMOUNT` — `"qty" no puede superar 100` |
| Rol inválido | `GET /api/mocks/users?role=admin` | `400` `INVALID_MOCK_ROLE` |
| Todo en cero | `POST /api/mocks/generateData` con `{}` | `400` `INVALID_MOCK_AMOUNT` |
| Valor no numérico | `POST /api/mocks/generateData` con `{"users":"muchos"}` | `400` `INVALID_MOCK_AMOUNT` |
| Valor negativo | `POST /api/mocks/generateData` con `{"users":-1}` | `400` `INVALID_MOCK_AMOUNT` |
| Más entregas que pedidos | `{"orders":2,"deliveries":5}` | `400` `INVALID_MOCK_AMOUNT` |
| Entregas sin repartidores | `{"orders":3,"deliveries":1}` con la base sin repartidores | `400` `MOCK_NO_DRIVERS` (no se inserta nada) |
| Pedidos sin clientes | `{"orders":2}` con la base sin clientes | `400` `MOCK_NO_CUSTOMERS` |
| Falla de MongoDB al cargar | `POST /api/mocks/seed?qty=3` con MongoDB caído | `500` `MOCK_GENERATION_ERROR` |

Ejemplo (`GET /api/mocks/users?qty=-5`, en desarrollo):

```json
{
  "status": "error",
  "error": "INVALID_MOCK_AMOUNT",
  "message": "\"qty\" no puede ser negativo",
  "details": "Valor recibido: -5"
}
```

## Archivos de esta entrega

```
src/
├── errors/
│   ├── error-dictionary.js   # códigos, status HTTP y mensajes
│   ├── app-error.js          # clase base AppError
│   ├── domain-errors.js      # errores personalizados del dominio
│   └── index.js
├── middlewares/error.middleware.js   # errorHandler + notFoundHandler
└── services/mocks.service.js         # validaciones y errores del módulo de mocks
```
