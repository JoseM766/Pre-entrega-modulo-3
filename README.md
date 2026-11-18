# ShipNow — API Backend (Pre-entregas Módulos 3)

API REST de **ShipNow**, construida por módulos del curso:

- **Módulo 1** — arquitectura por capas (**Router → Controller → Service → Repository → Model**), configuración de entorno validada al arranque y constantes del dominio.
- **Módulo 2** — mocking y carga de datos de prueba (`/api/mocks`).
- **Módulo 3** — manejo profesional y centralizado de errores (errores personalizados, diccionario de errores y middleware global).

Entidades: **Products**, **Users**, **Orders** y **Deliveries**.

## Tecnologías

- Node.js + Express
- MongoDB + Mongoose
- Passport.js (`passport-local` para register/login, `passport-jwt` para la sesión)
- JWT en cookie `httpOnly`, bcrypt, dotenv, cookie-parser

## Cómo correr el proyecto localmente

Requisitos: Node.js 18+ y una instancia de MongoDB corriendo (local o Atlas).

```bash
git clone <url-del-repositorio>
cd shipnow
npm install
cp .env.example .env     # completá los valores (sobre todo JWT_SECRET)
npm run seed             # opcional: crea usuarios y productos de prueba
npm run dev              # servidor con reinicio automático
```

El servidor queda en `http://localhost:8080` (o el `PORT` que configures). `GET /api/health` confirma que está arriba.

Otros comandos: `npm start` (modo normal), `npm run seed` (datos de prueba).

## Variables de entorno (Módulo 1)

El archivo `.env` **no se sube al repo** (está en `.gitignore`). `.env.example` documenta las claves necesarias.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `PORT` | Sí | Puerto del servidor (ej: `8080`) |
| `NODE_ENV` | Sí | `development`, `production` o `test` |
| `MONGODB_URI` | Sí | Cadena de conexión a MongoDB |
| `JWT_SECRET` | Sí | Secreto para firmar el JWT |
| `JWT_EXPIRES_IN` | No | Expiración del JWT (por defecto `1h`) |

### Configuración validada al arranque

`src/config/env.config.js` es el **único archivo que lee `process.env`**. Carga `dotenv`, valida las variables y exporta un objeto `config` congelado que usa el resto de la app (`import { config } from "./config/index.js"`).

Si falta una variable obligatoria, la app **no arranca** y muestra un error descriptivo:

```
Error: Faltan variables de entorno obligatorias: MONGODB_URI. Revisá tu archivo .env (podés copiar .env.example).
```

También valida que `PORT` sea un entero positivo y que `NODE_ENV` tenga un valor permitido.

### Constantes del dominio

`src/constants/index.js` define con `Object.freeze` los valores fijos del negocio, sin strings sueltos por el código:

```js
USER_ROLES        // ADMIN, USER (cliente), DRIVER (repartidor)
PRODUCT_STATUS    // AVAILABLE, OUT_OF_STOCK
ORDER_STATUS      // CREATED, ASSIGNED, PICKED_UP, IN_TRANSIT, DELIVERED, CANCELLED
DELIVERY_STATUS   // ASSIGNED, PICKED_UP, IN_TRANSIT, DELIVERED
DELIVERY_PRIORITY // LOW, NORMAL, HIGH, URGENT
MOCK_LIMITS       // DEFAULT_QTY (10), MAX_QTY (100)
NODE_ENVIRONMENTS // DEVELOPMENT, PRODUCTION, TEST
```

Uso: `authorize([USER_ROLES.ADMIN])`, `status: PRODUCT_STATUS.AVAILABLE`. (`src/utils/constants.js` re-exporta el mismo archivo.)

## Arquitectura en capas (Módulo 1)

```
Request → Router → Controller → Service → Repository → Modelo (Mongoose) → MongoDB
                       ↑
                     DTO (da forma a la respuesta, nunca expone password)
```

- **Router** (`src/routes`): solo conecta el path (y sus middlewares de acceso) con el método del controller.
- **Controller** (`src/controllers`): único punto de entrada HTTP. Lee `req`, llama al service, arma la respuesta y devuelve el status code. **Nunca importa Mongoose, modelos ni repositories.**
- **Service** (`src/services`): lógica de negocio y validaciones. Lanza errores del dominio. Solo conoce repositories; nunca Mongoose ni `req`/`res`.
- **Repository** (`src/repositories`): **único lugar que conoce Mongoose/MongoDB.**
- **Model** (`src/models`): solo define el esquema.
- **DTO** (`src/dto`): controla qué campos viajan en la respuesta.
- **Errors** (`src/errors`): errores personalizados y diccionario de errores (ver Módulo 3).
- **Middlewares** (`src/middlewares`): `auth`, `authorize` y `passport` (derivan sus fallos al middleware global) y `error` (único que responde errores).

## Por qué separé la lógica entre Service y Repository (Módulo 1)

**Repository = cómo se guardan y se buscan los datos.** Es el único archivo que importa los modelos y decide cosas de acceso, no de negocio:
- Qué campos se devuelven: por defecto nunca viene `password` ni `__v`. Solo el login pide el hash, con un método aparte (`findUserByEmailWithPassword`).
- Orden por defecto de los productos (más nuevos primero), `.lean()` y proyecciones.
- Qué pasa con un id mal formado (`/api/products/abc`): devuelve `null` en vez de dejar explotar a Mongoose con un `CastError`.

**Service = qué reglas del negocio se aplican.** No sabe si los datos están en MongoDB, en otra base o en memoria. Por eso acá vive:
- El **estado del producto según su stock**: `stock > 0` → `AVAILABLE`, `stock = 0` → `OUT_OF_STOCK`. Se recalcula solo al crear o editar; nadie lo manda a mano.
- El **filtro por defecto del listado**: solo se muestran productos disponibles (con stock); los agotados se piden con `?status=out_of_stock`.
- Las validaciones (precio, stock entero ≥ 0, nombre duplicado) y convertir "el repository devolvió `null`" en el error de negocio correcto (`PRODUCT_NOT_FOUND`, `USER_NOT_FOUND`).

Así, si cambia la base de datos solo se toca el repository, y si cambia una regla (por ejemplo, qué se considera "agotado") solo se toca el service.

## Modelos

**User**: `first_name`, `last_name`, `email` (único), `password` (hasheada), `role` (`user` | `admin`).

**Product**: `name` (único), `description`, `category`, `price`, `stock`, `status` (`available` | `out_of_stock`).

## Endpoints

### Sesiones

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/api/sessions/register` | Público | Registrar usuario (rol siempre `user`) |
| POST | `/api/sessions/login` | Público | Login, setea cookie JWT |
| GET | `/api/sessions/current` | Autenticado | Usuario actual |
| POST | `/api/sessions/logout` | Público | Cierra sesión |

### Productos

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/products` | Público | Listado (solo disponibles por defecto). Filtros: `status`, `category`. Paginación: `page`, `limit`. Orden: `sort` (ej. `-price`) |
| GET | `/api/products/:id` | Público | Detalle de un producto |
| POST | `/api/products` | admin | Crear producto |
| PUT | `/api/products/:id` | admin | Editar producto (el `status` se recalcula según el `stock`) |
| DELETE | `/api/products/:id` | admin | Eliminar producto |

### Usuarios

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/users` | admin | Listado de usuarios (sin `password`) |
| GET | `/api/users/:id` | admin | Detalle de un usuario |

## Usuarios y productos de prueba

`npm run seed` crea (si no existen):

| Email | Contraseña | Rol |
|---|---|---|
| `admin@shipnow.com` | `admin1234` | admin |
| `user@shipnow.com` | `user1234` | user |

Y tres productos de ejemplo (uno de ellos sin stock). El registro público siempre crea usuarios con rol `user`, por seguridad.

## Ejemplo de uso

```bash
# login como admin (guarda la cookie)
curl -X POST http://localhost:8080/api/sessions/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@shipnow.com","password":"admin1234"}' -c cookies.txt

# crear un producto
curl -X POST http://localhost:8080/api/products -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"name":"Bolsa courier","description":"Bolsa para envíos","category":"embalaje","price":150,"stock":200}'

# listar productos disponibles, más caros primero
curl "http://localhost:8080/api/products?sort=-price&limit=5"
```

## Manejo de errores (Módulo 3)

Todos los errores esperados de la API salen con la misma estructura, desde un único lugar.

```
Service detecta el problema → lanza un error del dominio (ej. UserNotFoundError)
Controller / middleware     → next(error)  (nunca arman una respuesta de error)
errorHandler (middleware global) → { status, error, message } con el status HTTP del diccionario
```

### Estructura de la respuesta de error

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

### Piezas de la capa de errores (`src/errors`)

- `error-dictionary.js`: **diccionario de errores**. Define cada código con su status HTTP y su mensaje por defecto.
- `app-error.js`: clase base `AppError` (código, status, mensaje, detalle opcional).
- `domain-errors.js`: errores personalizados del dominio (`UserNotFoundError`, `ProductNotFoundError`, `InvalidMockAmountError`, `MockGenerationError`, etc.). Se lanzan así: `throw new UserNotFoundError()`.
- `middlewares/error.middleware.js`: `errorHandler` (respuesta final) y `notFoundHandler` (rutas inexistentes). Además traduce errores de Express y Mongoose (JSON mal formado, claves duplicadas, errores de MongoDB) a errores conocidos.

### Diccionario de errores

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

### Cómo probar los errores

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

## Mocking y carga de datos de prueba (Módulo 2)

Router `/api/mocks`, pensado solo para desarrollo: **no se monta si `NODE_ENV=production`** (responde 404). Usa `@faker-js/faker` en español y respeta la arquitectura por capas:

```
mocks.router → mocks.controller → mocks.service → repositories (users / orders / deliveries)
                                       ↓
                                  src/mocks/ (generadores puros, no tocan la base)
```

### Qué datos se generan

- **Usuarios**: `first_name`, `last_name`, `email` (`@test.com`), `role` (`USER` o `DRIVER`). Los repartidores llevan `isAvailable`. La contraseña de todos los usuarios insertados es `coder123` (guardada hasheada con bcrypt).
- **Pedidos**: `customer` (usuario real), `items` (nombre, cantidad, precio), `deliveryAddress`, `total` (suma de los items), `status` (`ORDER_STATUS`) y `priority` (`DELIVERY_PRIORITY`).
- **Entregas**: `order` (pedido real), `driver` (usuario con rol `DRIVER`), `status` (el que corresponde al estado del pedido) y `priority` (la del pedido). Solo los pedidos asignados, retirados, en tránsito o entregados tienen entrega; uno `CREATED` o `CANCELLED` no.

### Endpoints que NO guardan en la base

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/mocks/users?qty=2` | Usuarios falsos (mezcla de clientes y repartidores). Opcional: `&role=driver` o `&role=user`. Alias: `/mockingusers` |
| GET | `/api/mocks/orders?qty=3` | Pedidos falsos con ids de cliente inventados. Alias: `/mockingorders` |
| GET | `/api/mocks/deliveries?qty=3` | Entregas falsas, cada una asociada a un pedido y a un repartidor inventados |

`qty` es opcional (por defecto 10, máximo 100).

### Endpoints que SÍ insertan en MongoDB

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/mocks/seed?qty=10` | Inserta 10 usuarios (clientes y repartidores). Responde `{ "insertados": 10, "coleccion": "users" }` |
| POST | `/api/mocks/generateData` | Inserta usuarios, repartidores, pedidos y entregas relacionados entre sí |

Body de `generateData` (todos opcionales, enteros de 0 a 100, al menos uno mayor a 0):

```json
{ "users": 5, "drivers": 3, "orders": 20, "deliveries": 8 }
```

Respuesta `201`:

```json
{ "status": "success", "insertados": { "users": 5, "drivers": 3, "orders": 20, "deliveries": 8 } }
```

Reglas: se crean en orden (usuarios → pedidos → entregas) para que las relaciones sean reales. Los pedidos usan los clientes recién creados o, si no se pidió ninguno, los que ya existan en la base. Las entregas usan repartidores nuevos o existentes. No puede haber más entregas que pedidos. Si no hay clientes o repartidores disponibles, responde `400` con un mensaje claro.

### Cómo probarlo

```bash
npm run dev
# ver datos falsos (no guarda nada)
curl "http://localhost:8080/api/mocks/users?qty=2"
# cargar datos de prueba
curl -X POST http://localhost:8080/api/mocks/generateData \
  -H "Content-Type: application/json" \
  -d '{"users":5,"drivers":3,"orders":20,"deliveries":8}'
```

Después se pueden ver las colecciones `users`, `orders` y `deliveries` en MongoDB Atlas o Compass.

## Estructura del proyecto

```
src/
├── app.js                    # configuración de Express y montaje de routers (notFound + errorHandler al final)
├── server.js                 # conecta a la DB y arranca el servidor
├── config/
│   ├── env.config.js         # dotenv + validación (único lugar con process.env)
│   ├── index.js              # exporta el objeto config
│   ├── db.config.js          # abre/cierra la conexión a MongoDB
│   └── passport.config.js    # estrategias register / login / current
├── errors/                   # (Módulo 3) error-dictionary, app-error, domain-errors
├── constants/index.js        # USER_ROLES, PRODUCT_STATUS, NODE_ENVIRONMENTS (Object.freeze)
├── models/                   # User, Product, Order, Delivery (solo esquemas)
├── mocks/                    # generadores de datos falsos (users, orders, deliveries)
├── repositories/             # único lugar que habla con Mongoose
├── services/                 # lógica de negocio
├── controllers/              # solo HTTP: req → service → res
├── dto/                      # forma de las respuestas
├── routes/                   # solo conectan path con controller
├── middlewares/              # auth, authorize, passport, error (errorHandler global)
└── utils/                    # hash, jwt, validators, constants, seed
```
