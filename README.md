# 🌾 Molinos de Colombia S.A.S. - Sistema Backend

Este es el repositorio del servidor backend desarrollado en **Node.js (TypeScript)** para **Molinos de Colombia S.A.S.** El objetivo principal de este sistema es centralizar y digitalizar todas las operaciones de la compañía, exponiendo una API REST robusta y escalable que se comunica con una base de datos **MySQL** y está documentada mediante **Swagger**.

---

## 🚀 Propósito del Proyecto

Molinos de Colombia S.A.S. requiere modernizar y unificar el flujo de sus datos y procesos operativos. Este backend servirá como el núcleo lógico del negocio, gestionando de forma centralizada:
* El control de llegada de materias primas (volquetas, material de mina).
* El registro de análisis de laboratorio y cálculo dinámico de precios y costos (fases del negocio).
* La gestión de servicios externos (Agua para la planta, liquidaciones).
* Autenticación, gestión de empleados y roles.

---

## 🛠️ Stack Tecnológico

El backend se construye bajo estándares modernos de la industria para garantizar rendimiento y mantenibilidad:

| Componente | Tecnología | Descripción |
| :--- | :--- | :--- |
| **Lenguaje** | Node.js con TypeScript | Elegido por su ecosistema robusto y tipado estático que evita errores en tiempo de ejecución. |
| **Framework Web** | [Express.js](https://expressjs.com/) | Framework minimalista y de alto rendimiento para APIs REST. |
| **Base de Datos** | MySQL | Motor relacional robusto. Toda la lógica del negocio está respaldada por esquemas estrictos. |
| **Acceso a Datos** | `mysql2` | Driver de MySQL para consultas raw. Implementamos queries transaccionales nativos. |
| **Autenticación** | JWT (JSON Web Tokens) | Protocolo seguro y sin estado para la autenticación de usuarios. |
| **Documentación** | Swagger UI (`swagger-ui-express`) | Documentación gráfica e interactiva para facilitar la integración con el frontend. |

---

## 📐 Arquitectura del Software (Clean Architecture)

Para asegurar la separación de responsabilidades, un alto acoplamiento lógico y permitir la mantenibilidad a largo plazo, utilizamos **Clean Architecture** estructurada por capas y **Puertos / Adaptadores**:

```mermaid
graph TD
    SubGraph1[Controladores / Rutas (Express)] --> SubGraph2[Puertos (Interfaces de Inyección)]
    SubGraph2 --> SubGraph3[Servicios (Casos de Uso / Lógica de Negocio)]
    SubGraph3 --> SubGraph4[Repositorios (Consultas SQL MySQL)]
    
    style SubGraph2 fill:#f9f,stroke:#333,stroke-width:2px
```

### Inyección de Dependencias y Factories

Hemos adoptado un modelo estricto de **Inyección de Dependencias (DI)**. 
- Los **Controladores** solo reciben **Servicios** a través de su constructor.
- Los **Servicios** solo reciben **Repositorios** u otros servicios a través de su constructor.
- La instanciación de todas las clases y la inyección de dependencias está centralizada en los archivos `src/config/factories/` y `src/config/factory.ts`.

### Estructura de Directorios

```text
├── src/
│   ├── config/             # Carga y gestión global (Database, variables, Swagger)
│   ├── controllers/        # Controladores HTTP (Req, Res) por módulo funcional
│   ├── helpers/            # Funciones utilitarias (fechas, parseos)
│   ├── models/             # Modelos (SQL DTOs, Entidades TypeScript)
│   ├── ports/              # Clean Architecture: Interfaces para inyección de dependencias
│   │   ├── repository_port/  # Interfaces de los repositorios
│   │   └── service_port/     # Interfaces de los servicios
│   ├── repositories/       # Abstracción directa hacia la BD (Queries SQL y Transacciones)
│   ├── routes/             # Enrutadores principales de la API (Endpoints)
│   ├── services/           # Reglas del negocio y orquestación
│   └── app.ts              # Inicialización de la aplicación de Express
├── @molinos_coments_v4.sql # Esquema maestro y reglas nativas de la base de datos
├── .clinerules             # Reglas para agentes de IA que asisten en el desarrollo
└── package.json            # Dependencias del proyecto
```

---

## 📌 Módulos Principales del Sistema

1. **Gestión de Autenticación (`auth/`)**
   * Registro, login, emisión de tokens JWT.
2. **Gestión de Materiales y Costos (`material/`)**
   * Registro de llegada de volquetas a la planta (Fase 1).
   * Ingreso de Análisis de Laboratorio y detonación de la lógica de negocio (Fases 2 a 5).
   * Consultas al sistema de Precios Activos por minero/zona.
   * Gestión del Agua Planta (registro de viajes, consolidación por dueño de volqueta).
3. **Módulo de Nómina (`nomina/`)**
   * Empleados y control de turnos.
4. **Cuentas por Pagar (`pagos/`)**
   * Gestión de proveedores y flujo de cuentas.

---

## 📋 Documentación de la API (Swagger)

Toda la documentación detallada de cada endpoint, sus parámetros, tipos y respuestas está autogenerada en una interfaz gráfica. 

Una vez iniciado el servidor, dirígete a:
**`http://localhost:3000/api-docs`**

Allí encontrarás todo el detalle de rutas como:
* `/api/v1/material/entrada`
* `/api/v1/material/analisis`
* `/api/v1/material/agua`
* Y podrás ejecutar peticiones de prueba directo desde el navegador.

---

## 🛠️ Configuración y Ejecución Local

### Prerrequisitos
* **Node.js** (Versión 18 o superior recomendada)
* **MySQL** (Con la base de datos `molinos` creada)
* Un cliente HTTP o simplemente el navegador usando Swagger.

### Pasos para iniciar

1. **Clonar el repositorio e instalar dependencias:**
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd MolinosBack/Molinos
   npm install
   ```

2. **Configuración de Entorno:**
   Duplicar el archivo `.env.example` y renombrarlo a `.env`.
   Asegúrate de llenar las credenciales de la BD MySQL:
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=tu_password
   DB_NAME=molinos
   JWT_SECRET=tu_secreto_seguro
   ```

3. **Ejecutar el servidor en modo desarrollo:**
   ```bash
   npm run dev
   ```
   *El servidor iniciará por defecto en el puerto configurado (ej. 3000) y aplicará 'watch' para recargar los cambios.*

4. **Compilación a Producción:**
   ```bash
   npm run build
   npm run start
   ```

---

## 🤖 Reglas para Agentes de IA (`.clinerules`)

El desarrollo de este proyecto se apoya en agentes de IA. Cualquier contribuyente o agente (Cursor, Cline, Antigravity) debe referirse estrictamente al archivo `.clinerules` presente en la raíz antes de agregar, modificar o renombrar directorios y lógicas. El principio máximo es la **separación por funcionalidades (Módulos)** y el respeto por el patrón de **Ports and Adapters**.
