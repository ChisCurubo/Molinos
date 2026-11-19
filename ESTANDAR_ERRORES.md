# Estándar de errores — Backend y Frontend

Un solo contrato. Backend y frontend lo manejan igual. Código en `src/errors/`.

## 1. Cuerpo de toda respuesta de error

```json
{
  "success": false,
  "error": "El abono supera el saldo pendiente",
  "message": "El abono supera el saldo pendiente",
  "code": "BUSINESS_RULE",
  "status": 400,
  "details": [{ "field": "valor", "message": "debe ser mayor a 0" }],
  "requestId": "3f2a9c1e-..."
}
```

| Campo | Para qué |
|---|---|
| `error` | Texto para mostrar al usuario. **El front lee este.** (`message` es igual, por compatibilidad). |
| `code` | Estable. El front decide qué hacer con un `switch (code)`. Nunca cambia. |
| `status` | El mismo estado HTTP. |
| `details` | Solo en `VALIDATION_ERROR`: un item por campo. |
| `requestId` | Referencia de soporte. Igual a la cabecera `X-Request-Id`. |

Catálogo vivo y completo: `GET /api/v1/info/errores` (código, estado, significado y acción sugerida al front).

## 2. Regla clave: 4xx vs 5xx

- **4xx** → el cliente lo puede corregir. `error` ya viene redactado para el usuario: se muestra tal cual.
- **5xx** → falla del servidor. `error` es **siempre genérico**; el detalle técnico NUNCA sale al cliente, solo al log con el `requestId`.

## 3. Cómo depurar (el flujo)

1. El usuario reporta (o el front loguea) el `requestId`.
2. Se busca ese id en el log del servidor: aparece `[ERR] {requestId, metodo, ruta, usuario, status, code}`.
   - `[ERR] inesperado` = 5xx, con stack completo.
   - `[ERR]` (warn) = error previsto 4xx, con el mensaje.
3. El mismo id está en el log de accesos (morgan) → se sigue la petición de punta a punta.
4. Si el front ya manda `X-Request-Id` (8-64 caracteres `A-Za-z0-9._-`), el servidor lo respeta.

## 4. Backend: cómo lanzar y responder errores

**Servicios** lanzan errores previstos con `AppError` (mensaje en español, legible por el usuario):

```ts
throw AppError.noEncontrado('Cuenta por pagar no encontrada');   // 404
throw AppError.reglaNegocio('El abono supera el saldo pendiente'); // 400
throw AppError.validacion('Datos inválidos', [{ field: 'valor', message: 'debe ser mayor a 0' }]);
throw AppError.duplicado('Ya existe un empleado con ese documento'); // 409
throw AppError.enUso('No se puede borrar: tiene pagos asociados');   // 409
throw AppError.referenciaInvalida('El proveedor no existe');         // 400
```

Un `new Error('texto')` plano sigue funcionando (se trata como `BUSINESS_RULE` 400, o 404 si dice "no encontrado"), pero **para código nuevo usa `AppError`**.

**Controladores**: una sola forma de responder error:

```ts
try { ... } catch (e) { return fail(res, e); }
```

`fail` normaliza cualquier cosa lanzada (AppError, errores de MySQL por errno, Zod, JWT, Multer, red) → cuerpo estándar + log. Prohibido `res.status(4xx/5xx).json(...)` a mano (el middleware `estandarizarRespuesta` lo corrige como red de seguridad, pero no depender de eso).

**Mensajes buenos**: dicen *qué* falló y *con qué dato* ("Cuenta por pagar 45 no encontrada", no "No encontrado"); en español; sin SQL ni nombres de tablas; sin culpar al usuario.

**Comentarios**: en cada `catch` que no sea el `fail` estándar, un comentario de por qué se traga o transforma el error. Código de dominio específico (p. ej. `'STOCK_INSUFICIENTE'`) permitido vía `new AppError('STOCK_INSUFICIENTE', msg, { status: 409 })`; documentarlo en `codigos.ts` si el front debe reaccionar a él.

## 5. Frontend: cómo manejarlo

Un único punto (interceptor de axios/fetch) que convierte toda respuesta de error en un objeto `ApiError`:

```ts
export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number,
              public details: {field: string; message: string}[] = [], public requestId?: string) { super(message); }
}

// interceptor de respuesta
(err) => {
  const b = err.response?.data;
  if (!err.response) throw new ApiError('NETWORK', 'Sin conexión con el servidor', 0);
  throw new ApiError(b?.code ?? 'INTERNAL_ERROR', b?.error ?? b?.message ?? 'Error inesperado',
                     err.response.status, b?.details, b?.requestId ?? err.response.headers['x-request-id']);
}
```

Reglas de UI:

| `code` | Qué hace el front |
|---|---|
| `VALIDATION_ERROR` | Pintar cada `details[].field` con su `message` en el formulario. |
| `BUSINESS_RULE`, `DUPLICATE_ENTRY`, `RECORD_IN_USE`, `INVALID_REFERENCE` | Toast/alerta con `error` tal cual. |
| `UNAUTHENTICATED`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `USER_INACTIVE` | Limpiar sesión y redirigir a login. |
| `FORBIDDEN` | Mensaje "sin permiso". |
| `NOT_FOUND` | "No encontrado"; refrescar la lista. |
| `RATE_LIMITED`, `SERVICE_BUSY`, `SERVICE_UNAVAILABLE` | Avisar y reintentar tras `Retry-After`; no en bucle. |
| `INTERNAL_ERROR` | Mensaje genérico + mostrar **"Código de referencia: {requestId}"** (con botón copiar). |

Siempre `console.error` del `ApiError` completo (incluye `requestId`) para depurar.

## 6. Agregar un código nuevo

1. Añadirlo a `src/errors/codigos.ts` (estado, descripción, acción del front).
2. Aparece solo en `GET /info/errores`.
3. Avisar al front para que lo agregue a su `switch`.
