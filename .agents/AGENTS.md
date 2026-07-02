# Arquitectura y Reglas de Diseño del Proyecto Molinos

Este documento establece la arquitectura completa, las reglas de diseño y las convenciones que deben seguir estrictamente todos los agentes (Antigravity, Claude, Cursor, Cline, etc.) al trabajar en el repositorio.

## 1. Arquitectura General y Módulos

El proyecto está diseñado bajo una arquitectura en capas, donde la lógica de negocio se distribuye en módulos funcionales transversales. La carpeta principal es `src/`.

### Estructura de Capas
- `config/`: Configuración global de la aplicación (base de datos, variables de entorno, etc.).
- `controllers/`: Controladores que manejan las peticiones HTTP y envían las respuestas.
- `helpers/`: Funciones auxiliares y utilidades compartidas.
- `interfaces/`: Definiciones de tipos e interfaces de TypeScript.
- `models/`: Definiciones de las estructuras de datos y entidades. Subdividido en:
  - `app/`: Modelos para el uso interno de la aplicación.
  - `sql/`: Modelos mapeados directamente a las tablas de la BD.
  - `dto/`: Objetos de Transferencia de Datos (Data Transfer Objects).
- `repositories/`: Capa de abstracción de datos para comunicarse de forma directa con la base de datos (consultas SQL).
- `routes/`: Definición de los endpoints y enrutamiento de la API.
- `services/`: Lógica de negocio de la aplicación.

### Módulos Funcionales
Dentro de las capas principales (`controllers`, `interfaces`, `models`, `repositories`, `routes`, `services`), el código SIEMPRE se subdivide en los siguientes **módulos por funcionalidad**:
- `auth/`: Autenticación y autorización.
- `material/`: Gestión de materiales (volquetas, plantas, análisis).
- `nomina/`: Gestión de nómina, empleados y turnos.
- `pagos/`: Gestión de pagos (cuentas por pagar).

**REGLA:** Nunca se deben crear archivos sueltos en la raíz de una capa. Siempre ubica tu archivo dentro del módulo funcional correspondiente.

## 2. Definición de la Base de Datos

- **Archivo Maestro**: Toda la estructura, comentarios y definición del esquema de la base de datos se encuentra especificada en el archivo `@molinos_coments_v4` (`molinos_coments_v4.sql`) ubicado en la raíz del proyecto. 
- Al crear nuevas entidades, modelos o repositorios, SIEMPRE lee y básate en `@molinos_coments_v4` para entender los tipos de datos, llaves foráneas y reglas de negocio reales de la base de datos.

## 3. Convención de Nombres de Archivos

- Se utiliza el estándar de nombramiento en formato `.tipo.ts` (también conocido como `.carpeta.ts`), alineado con la capa arquitectónica de la entidad.
- **Ejemplos por capa:**
  - Rutas: `src/routes/nomina/turno.routes.ts`
  - Controladores: `src/controllers/material/aguaPlanta.controller.ts`
  - Modelos SQL: `src/models/material/sql/analisis.sql.ts`
  - Repositorios: `src/repositories/pagos/cxp.repository.ts`

## 4. Diseño de Entidades (Models y Repositories)

- **Regla Estricta (No escatimar en archivos)**: Por cada entidad en la base de datos, debes crear de forma independiente y aislada:
  - **1 archivo en `models`** (dentro del módulo correspondiente).
  - **1 archivo en `repositories`** (dentro del módulo correspondiente).
- **Prohibido:** Agrupar múltiples entidades de base de datos en un solo archivo. Aunque los archivos queden pequeños, mantener la separación de responsabilidades 1:1 entre Entidad de BD y Archivo en código es la mejor práctica y la arquitectura deseada para este proyecto.
