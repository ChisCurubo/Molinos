-- ====================================================================
--  SISTEMA ERP — MOLINOS DE COLOMBIA  ·  ESQUEMA v4  (CON COMENTARIOS)
--  MySQL 8.0.16+  |  utf8mb4
-- --------------------------------------------------------------------
--  Cambios desde v3
--  ─────────────────────────────────────────────────────────────────
--  RENOMBRES:
--   · Pagos            → Cuentas_Por_Pagar
--   · Abonos_Pagos     → Abonos_CxP
--   · Pago_Relacion    → Cuentas_Por_Pagar_Relacion
--   · Categorias_Pago  → Categorias_CxP
--
--  TABLAS NUEVAS:
--   · Planta_Procesos             — áreas/procesos específicos de cada planta
--   · Empleados_Salario           — configuración salarial por empleado
--   · Categorias_CxC              — tipos de cuentas por cobrar
--   · Cuentas_Por_Cobrar          — lo que terceros deben a la empresa
--   · Abonos_CxC                  — cobros recibidos
--   · Cuentas_Por_Cobrar_Relacion — FK explícitas al dominio de CxC
--   · Saldo_A_Favor               — crédito por sobrepago a un tercero
--
--  Tablas totales: 54  |  Vistas: 12
-- ====================================================================

CREATE DATABASE IF NOT EXISTS molinos_erp_v4
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci; -- Cambio clave para evitar conflictos de collation
USE molinos_erp_v4;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES   = 0;


-- ====================================================================
--  MÓDULO 1 · CATÁLOGOS
-- ====================================================================

CREATE TABLE Planta (
    id        INT          AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único de la sede o planta',
    nombre    VARCHAR(150) NOT NULL                   COMMENT 'Nombre de la instalación (Ej: PLANTA GRANDE, PLANTA CASA, PLANTA BARRANQUILLA)',
    ubicacion VARCHAR(255)                            COMMENT 'Dirección física, municipio o descripción de la ubicación de la planta'
) COMMENT='Sedes o instalaciones físicas de procesamiento. Base para asignar procesos en Planta_Procesos y asistencias en Turnos.';


CREATE TABLE Planta_Procesos (
    id          INT          AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único del proceso o área de trabajo',
    planta_id   INT          NOT NULL                   COMMENT 'Planta a la que pertenece este proceso — ver Planta',
    nombre      VARCHAR(100) NOT NULL                   COMMENT 'Nombre del proceso o área (Ej: Molienda, Flotación, Filtroprensa, Planta Eléctrica, Secado)',
    descripcion VARCHAR(255)                            COMMENT 'Descripción de la actividad que se realiza en este proceso o área',
    activo      BOOLEAN      DEFAULT TRUE               COMMENT 'Indica si el proceso está en operación actualmente (1=activo, 0=suspendido)',
    FOREIGN KEY (planta_id) REFERENCES Planta(id) ON DELETE CASCADE,
    INDEX idx_procesos_planta (planta_id)
) COMMENT='Áreas o procesos específicos dentro de cada planta (Molienda, Flotación, Filtroprensa, etc.). Permite asignar turnos de empleados a un proceso concreto en lugar de solo a la sede.';


CREATE TABLE Materiales (
    id            INT          AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único del mineral en el catálogo',
    nombre        VARCHAR(150) NOT NULL                   COMMENT 'Nombre del mineral o material (Ej: Oro (Au), Plata (Ag), Concentrado de Au)',
    descripcion   VARCHAR(255)                            COMMENT 'Pureza esperada, presentación o características relevantes del material',
    unidad_medida VARCHAR(50)                             COMMENT 'Unidad de medida para cotizaciones (Ej: Gramos, Onzas Troy, Kilogramos, Toneladas)'
) COMMENT='Catálogo de minerales y materiales usados en el módulo de cotizaciones. No confundir con Tipos_Material, que clasifica el material físico que llega a planta.';


CREATE TABLE Tipos_Material (
    id          INT          AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del tipo de material',
    nombre      VARCHAR(50)  NOT NULL UNIQUE             COMMENT 'Nombre del tipo (Concentrado, Roca, Lamas, Relave, Lodos, Otro)',
    descripcion VARCHAR(150)                             COMMENT 'Descripción del tipo de material y sus características físicas principales'
) COMMENT='Catálogo de tipos de material físico para clasificar entradas en planta e inventario. El tipo se registra por entrada en material_planta_entrada, no en la Mina.';

INSERT INTO Tipos_Material (nombre, descripcion) VALUES
('Concentrado','Material procesado con alto contenido de mineral'),
('Roca',       'Material bruto extraído directamente de la mina'),
('Lamas',      'Material fino y húmedo producto del lavado'),
('Relave',     'Desecho sólido del proceso de beneficio'),
('Lodos',      'Material con alta concentración de agua'),
('Otro',       'Material que no encaja en las categorías existentes');


CREATE TABLE Tipos_Gasto_Operativo (
    id          INT          AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del tipo de gasto operativo',
    nombre      VARCHAR(50)  NOT NULL UNIQUE             COMMENT 'Código del tipo de gasto (cargue, bascula, viatico, acpm, adelanto_volqueta, muestreo, acompanamiento, etc.)',
    descripcion VARCHAR(150)                             COMMENT 'Descripción del tipo de gasto y en qué situación de campo se genera'
) COMMENT='Catálogo extensible de tipos de gasto para clasificar las salidas de efectivo de la caja menor (Gasto_Operativo). Nuevos tipos se agregan aquí sin tocar el código.';

INSERT INTO Tipos_Gasto_Operativo (nombre, descripcion) VALUES
('cargue',            'Pago por carga de material en la mina'),
('bascula',           'Pago por servicio de pesaje en báscula'),
('viatico',           'Gastos de viáticos y alimentación'),
('acpm',              'Compra de ACPM para vehículos o maquinaria'),
('adelanto_volqueta', 'Adelanto al transportador antes del pago formal'),
('muestreo',          'Toma de muestra para análisis de laboratorio'),
('acompanamiento',    'Pago por acompañamiento o custodia del material'),
('buscar_agua',       'Servicio de abastecimiento de agua'),
('insumos_quimicos',  'Cianuro, zinc, reactivos y similares'),
('mantenimiento',     'Repuestos y arreglos de equipos'),
('otro',              'Gasto operativo no clasificado');


CREATE TABLE Tipos_Turno (
    id          INT         AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único del horario de turno',
    nombre      VARCHAR(50) NOT NULL                   COMMENT 'Nombre descriptivo del turno (TURNO 1=mañana 6-14h, TURNO 2=tarde 14-22h, TURNO 3=noche 22-6h)',
    hora_inicio TIME        NOT NULL                   COMMENT 'Hora de inicio del turno en formato HH:MM:SS (Ej: 06:00:00)',
    hora_fin    TIME        NOT NULL                   COMMENT 'Hora de finalización del turno en formato HH:MM:SS (Ej: 14:00:00)'
) COMMENT='Catálogo estático de horarios de operación de la planta. Los tres turnos cubren las 24 horas del día corrido.';

INSERT INTO Tipos_Turno (nombre, hora_inicio, hora_fin) VALUES
('TURNO 1','06:00:00','14:00:00'),
('TURNO 2','14:00:00','22:00:00'),
('TURNO 3','22:00:00','06:00:00');


CREATE TABLE Tipos_Alquiler (
    id     INT          AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único del tipo o categoría de alquiler',
    nombre VARCHAR(100) NOT NULL                   COMMENT 'Categoría del alquiler (Vehículos y Transporte, Maquinaria Pesada, Herramientas y Equipos)'
) COMMENT='Catálogo para clasificar los contratos de alquiler de equipos, vehículos y herramientas de la operación minera.';

INSERT INTO Tipos_Alquiler (nombre) VALUES
('Vehículos y Transporte'),('Maquinaria Pesada'),('Herramientas y Equipos');


CREATE TABLE Tipos_Analisis (
    id          INT          AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del tipo de análisis de laboratorio',
    nombre      VARCHAR(50)  NOT NULL UNIQUE             COMMENT 'Nombre del tipo: Cabeza (oficial de entrada), Concentrado, Colas, Concentrado_Colas, Colas_Colas',
    descripcion VARCHAR(150)                             COMMENT 'Descripción del tipo de análisis, su posición en el proceso metalúrgico y qué certifica'
) COMMENT='Catálogo de tipos de análisis de laboratorio. El tipo Cabeza es el oficial que define tenor y humedad para costear el material al minero.';

INSERT INTO Tipos_Analisis (nombre, descripcion) VALUES
('Cabeza',            'Análisis de entrada. Define tenor y humedad oficiales'),
('Concentrado',       'Análisis del concentrado obtenido'),
('Colas',             'Análisis de las colas o relaves'),
('Concentrado_Colas', 'Concentrado obtenido al reprocesar colas'),
('Colas_Colas',       'Colas resultantes de reprocesar colas');


CREATE TABLE Categorias_Proveedor (
    id          INT          AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único de la categoría de proveedor',
    nombre      VARCHAR(100) NOT NULL                    COMMENT 'Nombre de la categoría (Dotación, Laboratorio, Combustible, Maquinaria, Procesamiento, Transporte_Mula, Quimicos, Otro)',
    descripcion VARCHAR(255)                             COMMENT 'Descripción del tipo de productos o servicios que abarca esta categoría de proveedor'
) COMMENT='Catálogo para clasificar proveedores por tipo de servicio. Excluye mineros y dueños de volqueta que tienen sus propias tablas (Minero y Dueno_Volqueta).';

INSERT INTO Categorias_Proveedor (nombre, descripcion) VALUES
('Dotación',        'Ropa, calzado y EPP'),
('Laboratorio',     'Servicios de análisis de minerales'),
('Combustible',     'Estaciones de servicio / gasolineras'),
('Maquinaria',      'Alquiler o mantenimiento de equipos pesados'),
('Procesamiento',   'Plantas externas de maquila'),
('Transporte_Mula', 'Empresa transportadora de salida a Barranquilla'),
('Quimicos',        'Insumos químicos y reactivos'),
('Otro',            'Proveedor no clasificado');


CREATE TABLE Categorias_CxP (
    id          INT          AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único de la categoría de cuenta por pagar',
    nombre      VARCHAR(100) NOT NULL                    COMMENT 'Nombre de la categoría de CxP (Material, Flete volqueta, Maquila, Nómina, Combustible, etc.)',
    descripcion VARCHAR(255)                             COMMENT 'Descripción del tipo de obligación de pago que representa esta categoría',
    color       VARCHAR(10)                              COMMENT 'Color hexadecimal para identificación visual en la interfaz web (Ej: #1D9E75). Facilita reconocimiento rápido.'
) COMMENT='Tipos de Cuenta por Pagar. Clasifica cada obligación de pago de la empresa. Excedente removido en v4: es ingreso de la empresa, no un pago.';

INSERT INTO Categorias_CxP (nombre, descripcion, color) VALUES
('Material',              'Pago al minero por el material entregado',           '#1D9E75'),
('Flete volqueta',        'Pago al dueño de volqueta por el acarreo',           '#0F6E56'),
('Deuda proveedor',       'Abono a deuda histórica de un tercero',              '#E24B4A'),
('Cargue',                'Pago por servicio de cargue',                        '#7F77DD'),
('Báscula',               'Pago por pesaje en báscula',                         '#7F77DD'),
('Combustible',           'Pago a la gasolinera (ACPM/gasolina)',               '#D85A30'),
('Agua',                  'Pago de agua a la planta',                           '#85B7EB'),
('Mula',                  'Pago a la transportadora de salida (Barranquilla)',  '#534AB7'),
('Análisis',              'Pago al laboratorio por análisis',                   '#97C459'),
('Alquiler',              'Pago por alquiler de maquinaria/vehículos',          '#888780'),
('Nómina',                'Pago de salarios y jornales',                        '#639922'),
('Préstamo empleado',     'Desembolso de un préstamo a empleado',               '#D4537E'),
('Préstamo financiero',   'Abono de obligación financiera (banco)',              '#A32D2D'),
('Gasto de viaje',        'Gastos de viaje distintos de la maquila',            '#5C6BC0'),
('Anticipo',              'Desembolso de anticipo a tercero',                   '#EF9F27'),
('Compra proveedor',      'Compra o servicio directo a un proveedor',           '#6D8B3C'),
('Distribución excedente','Distribución de excedente de la empresa',            '#BA7517'),
('Devolución sobrepago',  'Reintegro al tercero por pago en exceso',            '#E24B4A'),
('Otro',                  'Gasto no clasificado',                               '#888780');


CREATE TABLE Categorias_CxC (
    id          INT          AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único de la categoría de cuenta por cobrar',
    nombre      VARCHAR(100) NOT NULL                    COMMENT 'Nombre de la categoría (Préstamo empleado, Combustible cargado, Anticipo recuperable, Excedente empresa, Otro cobro)',
    descripcion VARCHAR(255)                             COMMENT 'Descripción del tipo de cobro que representa esta categoría de CxC',
    color       VARCHAR(10)                              COMMENT 'Color hexadecimal para identificación visual en la interfaz (Ej: #D4537E)'
) COMMENT='Tipos de Cuenta por Cobrar. Clasifica lo que terceros le deben a la empresa (préstamos a empleados, combustible adelantado, anticipos, excedentes reconocidos).';

INSERT INTO Categorias_CxC (nombre, descripcion, color) VALUES
('Préstamo empleado',    'Dinero prestado al personal a descontar de nómina',    '#D4537E'),
('Combustible cargado',  'Combustible adelantado a dueño de volqueta',           '#D85A30'),
('Anticipo recuperable', 'Anticipo entregado a tercero que debe recuperarse',     '#EF9F27'),
('Excedente empresa',    'Excedente generado por una entrada (ingreso)',          '#1D9E75'),
('Otro cobro',           'Cobro no categorizado',                                '#888780');


CREATE TABLE Tarifas_Calculo (
    id            INT           AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único de la tarifa de cálculo',
    codigo        VARCHAR(50)   NOT NULL UNIQUE            COMMENT 'Clave única de la tarifa usada en triggers y SP (Ej: flete_ton_seca, retencion_mula_pct)',
    valor         DECIMAL(14,2) NOT NULL                   COMMENT 'Valor de la tarifa: pesos por tonelada o porcentaje, según el código (Ej: 100000, 1.00)',
    descripcion   VARCHAR(150)                             COMMENT 'Explicación de para qué se usa esta tarifa y cómo se interpreta su valor',
    vigente_desde DATE          NOT NULL DEFAULT (CURRENT_DATE) COMMENT 'Fecha desde la cual aplica este valor. Permite historial de cambios de tarifa.',
    updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la última modificación del registro'
) COMMENT='Tarifas globales configurables usadas en cálculos automáticos (triggers, SP). Editar aquí sin tocar el código de la aplicación. flete_ton_seca es el fallback cuando la mina no tiene zona asignada.';

INSERT INTO Tarifas_Calculo (codigo, valor, descripcion) VALUES
('flete_ton_seca',     100000, 'Flete por tonelada seca (fallback si mina sin zona)'),
('retencion_mula_pct', 1.00,   'Porcentaje de retención sobre valor mulas');


-- ====================================================================
--  MÓDULO 2 · ZONAS Y TARIFAS
-- ====================================================================

CREATE TABLE Zona (
    id          INT          AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único de la zona geográfica',
    nombre      VARCHAR(100) NOT NULL UNIQUE             COMMENT 'Nombre de la zona (Ej: Zona Sur, Zona Alta, Sin zona). Identifica el área de origen de las minas.',
    descripcion VARCHAR(255)                             COMMENT 'Descripción: distancia aproximada a la planta, municipios que cubre, características del acceso',
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de creación del registro'
) COMMENT='Zonas geográficas de origen del material. Define la lejanía de la mina a la planta y por ende el costo del flete. Cada mina se asigna a una zona en la tabla Mina.';

INSERT INTO Zona (nombre, descripcion) VALUES
('Sin zona','Pendiente de asignar');


CREATE TABLE Tarifa_Zona (
    id             INT           AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único de la tarifa por zona',
    id_zona        INT           NOT NULL                   COMMENT 'Zona geográfica a la que aplica esta tarifa — ver Zona',
    valor_tonelada DECIMAL(14,2) NOT NULL                   COMMENT 'Costo de flete en pesos por tonelada seca de material transportado desde esa zona hasta la planta',
    vigente_desde  DATE          NOT NULL DEFAULT (CURRENT_DATE) COMMENT 'Fecha desde la cual aplica esta tarifa de flete',
    vigente_hasta  DATE          NULL                       COMMENT 'Fecha hasta la cual aplica. NULL = tarifa vigente actualmente sin vencimiento definido.',
    activo         BOOLEAN       NOT NULL DEFAULT TRUE      COMMENT 'Indica si esta tarifa está vigente para nuevos cálculos (1=activa, 0=histórica reemplazada)',
    created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
    FOREIGN KEY (id_zona) REFERENCES Zona(id),
    INDEX idx_tarifa_zona (id_zona, activo)
) COMMENT='Tarifa de flete por tonelada seca para cada zona geográfica. Permite manejar múltiples tarifas en el tiempo. El trigger usa la tarifa activa vigente al calcular costo_volqueta en material_planta_entrada.';


-- ====================================================================
--  MÓDULO 3 · TERCEROS DEL NEGOCIO
-- ====================================================================

CREATE TABLE Minero (
    id             INT          AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del minero',
    nombre         VARCHAR(150) NOT NULL                    COMMENT 'Nombre completo o razón social del minero (Ej: NAUM, OMAR MINA 80, LEONEL NAVARRO, JEFERSON)',
    titular        VARCHAR(150) NULL                        COMMENT 'Nombre del titular de la cuenta bancaria. Puede diferir del nombre del minero si cobra a través de un familiar.',
    cc             VARCHAR(20)  NULL UNIQUE                 COMMENT 'Cédula de ciudadanía del titular de la cuenta. Requerida para verificación en transferencias bancarias.',
    alias          VARCHAR(60)                              COMMENT 'Apodo o nombre corto con el que se le conoce en la operación (Ej: Omar, Naum, Leonel, Jeferson)',
    telefono       VARCHAR(20)                              COMMENT 'Número de contacto del minero',
    ciudad         VARCHAR(100)                             COMMENT 'Ciudad o municipio de residencia o de operación del minero',
    banco          VARCHAR(80)  NULL                        COMMENT 'Entidad bancaria donde recibe los pagos (Ej: Bancolombia, Davivienda, Nequi)',
    numero_cuenta  VARCHAR(40)  NULL                        COMMENT 'Número de cuenta de ahorro o corriente para transferencias de pago',
    nequi          BOOLEAN      DEFAULT FALSE               COMMENT 'Indica si el minero prefiere recibir pagos por Nequi (1=Sí, 0=No)',
    metodo_calculo ENUM('por_gramo','por_tonelada') NOT NULL DEFAULT 'por_tonelada'
                   COMMENT 'Cómo se calcula el pago: por_gramo=pago por gramos de Au totales (concentrado), por_tonelada=pago por tonelada seca (roca, lodos)',
    estado         ENUM('activo','inactivo') NOT NULL DEFAULT 'activo'
                   COMMENT 'Estado del minero en el sistema (activo=operando y vigente, inactivo=suspendido o retirado)',
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de creación del registro',
    updated_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                   COMMENT 'Fecha y hora de la última actualización del registro',
    INDEX idx_minero_nombre (nombre)
) COMMENT='Personas que extraen y proveen material de sus minas a la planta. El pago se calcula según metodo_calculo (por gramo de Au o por tonelada seca). Separado de Proveedores para trazabilidad específica del material.';


CREATE TABLE Dueno_Volqueta (
    id            INT          AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del dueño de volqueta',
    nombre        VARCHAR(150) NOT NULL                    COMMENT 'Nombre o alias operativo del dueño (Ej: ANIBAL, CARLOS, MANUEL, GEIBER). Nombre con el que se le conoce en la operación.',
    titular       VARCHAR(150) NULL                        COMMENT 'Nombre completo del titular de la cuenta bancaria (puede ser un familiar o tercero autorizado)',
    cc            VARCHAR(20)  NULL UNIQUE                 COMMENT 'Cédula del titular de la cuenta bancaria. Requerida para verificación en transferencias.',
    banco         VARCHAR(80)  NULL                        COMMENT 'Entidad bancaria donde recibe los pagos de flete (Ej: Bancolombia)',
    numero_cuenta VARCHAR(40)  NULL                        COMMENT 'Número de cuenta de ahorro o corriente para transferencias de flete',
    alias         VARCHAR(60)                              COMMENT 'Apodo corto para uso interno en la interfaz (Ej: Pata de palo, Clixman, Amarilla)',
    telefono      VARCHAR(20)                              COMMENT 'Número de contacto del dueño del vehículo',
    ciudad        VARCHAR(100)                             COMMENT 'Ciudad o municipio de residencia del dueño del vehículo',
    nequi         BOOLEAN      DEFAULT FALSE               COMMENT 'Indica si el dueño prefiere recibir pagos de flete por Nequi (1=Sí, 0=No)',
    estado        ENUM('activo','inactivo') NOT NULL DEFAULT 'activo'
                  COMMENT 'Estado del dueño en el sistema (activo=vigente, inactivo=suspendido o retirado)',
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro en el sistema',
    updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                  COMMENT 'Fecha y hora de la última modificación del registro',
    INDEX idx_dueno_nombre (nombre)
) COMMENT='Propietarios de los vehículos (volquetas/camiones) que transportan material desde las minas hasta la planta. Reciben pago por flete según tarifa de zona. Sus vehículos se registran en Volqueta_Vehiculo.';


CREATE TABLE Volqueta_Vehiculo (
    id                INT          AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del vehículo',
    id_dueno_volqueta INT          NOT NULL                    COMMENT 'Propietario del vehículo — ver Dueno_Volqueta',
    placa             VARCHAR(15)  NOT NULL UNIQUE             COMMENT 'Placa oficial del vehículo. Identificador físico único del camión (Ej: ABC123, SWK-756)',
    tipo_vehiculo     VARCHAR(60)                              COMMENT 'Tipo o configuración del vehículo (Ej: Doble troque, Sencillo, Tracto-camión, Volco)',
    conductor         VARCHAR(150)                             COMMENT 'Nombre del conductor habitual asignado al vehículo',
    conductor_cc      VARCHAR(20)                              COMMENT 'Cédula de ciudadanía del conductor habitual del vehículo',
    capacidad_ton     DECIMAL(8,2) NULL                        COMMENT 'Capacidad máxima de carga del vehículo en toneladas métricas. Referencia para validar pesos al recibir.',
    fecha             DATE         NULL                        COMMENT 'Fecha de primer registro del vehículo o fecha del último viaje registrado',
    estado_pago       ENUM('pendiente','parcial','pagado','no_aplica') NOT NULL DEFAULT 'no_aplica'
                      COMMENT 'Estado de la cuenta corriente de flete de este vehículo. Actualizado automáticamente por trigger al abonar CxP con subtipo=flete.',
    activo            BOOLEAN      NOT NULL DEFAULT TRUE       COMMENT 'Indica si el vehículo está operativo (1=activo en operación, 0=dado de baja o retirado)',
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro del vehículo en el sistema',
    FOREIGN KEY (id_dueno_volqueta) REFERENCES Dueno_Volqueta(id),
    INDEX idx_vehiculo_dueno  (id_dueno_volqueta),
    INDEX idx_vehiculo_placa  (placa),
    INDEX idx_vehiculo_estado (estado_pago)
) COMMENT='Vehículo físico de transporte. Cada camión/volqueta tiene su registro con placa, conductor y propietario. Enlace central con material_planta_entrada.id_vehiculo para derivar el dueño del flete.';


CREATE TABLE Mina (
    id         INT          AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único de la mina o frente de extracción',
    nombre     VARCHAR(150) NOT NULL                    COMMENT 'Nombre del frente de extracción (Ej: MINA 80, MINA 30, CULO ALZADO, SAN ISIDRO, MINA MARLON)',
    id_minero  INT          NULL                        COMMENT 'Minero que habitualmente provee material de esta mina — ver Minero. NULL si el proveedor es variable.',
    id_zona    INT          NULL                        COMMENT 'Zona geográfica que define la tarifa de flete — ver Zona. NULL usa el fallback de Tarifas_Calculo.',
    ubicacion  VARCHAR(255)                             COMMENT 'Coordenadas GPS, vereda, municipio o descripción del acceso físico a la mina',
    estado     ENUM('activa','inactiva') NOT NULL DEFAULT 'activa'
               COMMENT 'Estado operativo (activa=en producción, inactiva=suspendida o agotada)',
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de creación del registro',
    updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
               COMMENT 'Fecha y hora de la última actualización del registro',
    FOREIGN KEY (id_minero) REFERENCES Minero(id) ON DELETE SET NULL,
    FOREIGN KEY (id_zona)   REFERENCES Zona(id)   ON DELETE SET NULL,
    INDEX idx_mina_minero (id_minero)
) COMMENT='Frentes de extracción de material. id_tipo_material eliminado en v4: una mina puede aportar distintos tipos de material por entrada. El tipo se registra en material_planta_entrada, no aquí.';


CREATE TABLE Empleados (
    id         INT          AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del empleado',
    nombre     VARCHAR(100) NOT NULL                    COMMENT 'Nombres del empleado',
    apellido   VARCHAR(100)                             COMMENT 'Apellidos del empleado. NULL si el dato no está disponible.',
    cc         VARCHAR(20)  NOT NULL UNIQUE             COMMENT 'Cédula de ciudadanía del empleado. Identificador único para nómina, acceso al sistema y préstamos.',
    cuenta     VARCHAR(50)                              COMMENT 'Número de cuenta bancaria para el pago de salario o jornal',
    nequi      BOOLEAN      DEFAULT FALSE               COMMENT 'Indica si el empleado prefiere cobrar su salario por Nequi (1=Sí, 0=No)',
    labor      VARCHAR(100)                             COMMENT 'Cargo o función del empleado (Ej: OPERACION PLANTA - LIDER, SECADO, SOLDADOR, MATERIAL - CARGUES)',
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de ingreso del empleado al sistema',
    INDEX idx_empleados_cc (cc)
) COMMENT='Maestro de todo el personal de la empresa. Base para nómina (Turnos, Empleados_Salario), préstamos (Prestamos_Empleados) y vinculación de usuarios del sistema (Usuarios.id_empleado).';


CREATE TABLE Empleados_Salario (
    id                INT           AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único del registro de configuración salarial',
    empleado_id       INT           NOT NULL                   COMMENT 'Empleado al que aplica esta configuración — ver Empleados',
    tipo_pago         ENUM('FIJO_MENSUAL','POR_DIAS','POR_HORAS') NOT NULL
                      COMMENT 'Modalidad: FIJO_MENSUAL=salario mensual fijo, POR_DIAS=jornal por día trabajado, POR_HORAS=valor por hora',
    tarifa_monto      DECIMAL(12,2) NOT NULL                   COMMENT 'Monto en pesos según tipo_pago: salario mensual, valor del jornal diario o valor por hora trabajada',
    aplica_aux_transp BOOLEAN       DEFAULT FALSE              COMMENT 'Indica si el empleado tiene derecho al auxilio de transporte legal vigente (1=Sí, 0=No)',
    fecha_inicio      DATE          NOT NULL                   COMMENT 'Fecha desde la que aplica esta configuración. Un empleado puede tener varias vigencias históricas.',
    activo            BOOLEAN       DEFAULT TRUE               COMMENT 'Indica si esta es la configuración salarial vigente (1=activa, 0=histórica reemplazada por una nueva)',
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
    FOREIGN KEY (empleado_id) REFERENCES Empleados(id) ON DELETE CASCADE,
    INDEX idx_salario_empleado (empleado_id),
    INDEX idx_salario_activo   (activo)
) COMMENT='Configuración salarial de cada empleado con soporte de múltiples vigencias. Permite cambiar tarifa sin perder historial. Solo la fila con activo=1 es la vigente para liquidación de nómina actual.';


CREATE TABLE Proveedores (
    id               INT          AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del proveedor',
    nombre           VARCHAR(150) NOT NULL                    COMMENT 'Razón social o nombre completo del proveedor (Ej: AHK LABORATORIO, CONSURRECON COMBUSTIBLE)',
    id_categoria     INT                                      COMMENT 'Categoría de servicio del proveedor — ver Categorias_Proveedor',
    contacto         VARCHAR(150)                             COMMENT 'Nombre de la persona de contacto o representante comercial del proveedor',
    telefono         VARCHAR(20)                              COMMENT 'Número de teléfono de contacto',
    ciudad           VARCHAR(100)                             COMMENT 'Ciudad base de operación o ubicación principal del proveedor',
    alias            VARCHAR(60)                              COMMENT 'Nombre corto para uso interno (Ej: AHK, SGS, Consurrecon, INSUMINER)',
    nequi            BOOLEAN      DEFAULT FALSE               COMMENT 'Indica si el proveedor acepta pagos por Nequi (1=Sí, 0=No)',
    compra_realizada VARCHAR(255)                             COMMENT 'Descripción del producto o servicio que normalmente se le adquiere (Ej: ACPM, Análisis de minerales)',
    estado           ENUM('activo','inactivo') NOT NULL DEFAULT 'activo'
                     COMMENT 'Estado del proveedor (activo=vigente y disponible, inactivo=suspendido)',
    created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro en el sistema',
    updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                     COMMENT 'Fecha y hora de la última actualización del registro',
    FOREIGN KEY (id_categoria) REFERENCES Categorias_Proveedor(id),
    INDEX idx_proveedores_nombre (nombre)
) COMMENT='Directorio de proveedores externos: laboratorios, gasolineras, maquinaria, transportadoras y químicos. Excluye mineros y dueños de volqueta, que tienen sus propias tablas con datos bancarios específicos.';


-- ====================================================================
--  MÓDULO 4 · SEGURIDAD
-- ====================================================================

CREATE TABLE Roles (
    id          INT         AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único del rol',
    nombre      VARCHAR(50) NOT NULL UNIQUE            COMMENT 'Nombre del rol (Ej: Gerencia, Tesoreria, Planta)',
    descripcion TEXT                                   COMMENT 'Descripción de los módulos, funciones y nivel de acceso que tiene este rol dentro del ERP'
) COMMENT='Catálogo de roles del sistema. Actualmente: Gerencia (acceso total), Tesoreria (módulo Juliana: pagos/nómina), Planta (módulo Victoria: entradas/inventario). Permisos granulares en Rol_Permiso.';


CREATE TABLE Permisos (
    id          INT         AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único del permiso',
    codigo      VARCHAR(50) NOT NULL UNIQUE            COMMENT 'Código único de la acción protegida (Ej: crear_entrada, ver_cuentas_pagar, admin_catalogos, eliminar_registro)',
    descripcion VARCHAR(150)                           COMMENT 'Descripción legible en español de qué permite hacer este permiso dentro del sistema'
) COMMENT='Catálogo de permisos individuales del sistema. Cada permiso representa una acción específica sobre un módulo. Se asignan a roles en Rol_Permiso.';


CREATE TABLE Rol_Permiso (
    id_rol     INT NOT NULL COMMENT 'Rol al que se asigna el permiso — ver Roles',
    id_permiso INT NOT NULL COMMENT 'Permiso otorgado al rol — ver Permisos',
    PRIMARY KEY (id_rol, id_permiso),
    FOREIGN KEY (id_rol)     REFERENCES Roles(id)    ON DELETE CASCADE,
    FOREIGN KEY (id_permiso) REFERENCES Permisos(id) ON DELETE CASCADE
) COMMENT='Tabla de unión entre Roles y Permisos. Un rol puede tener múltiples permisos. Al eliminar un rol o permiso, sus relaciones se eliminan automáticamente (CASCADE).';


CREATE TABLE Usuarios (
    id            INT          AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único del usuario del sistema',
    username      VARCHAR(50)  NOT NULL UNIQUE            COMMENT 'Nombre de usuario para inicio de sesión. Único en el sistema (Ej: david, juliana, victoria).',
    password_hash VARCHAR(255) NOT NULL                   COMMENT 'Contraseña encriptada con bcrypt/argon2. NUNCA almacenar texto plano aquí. El backend gestiona la encriptación.',
    id_rol        INT          NOT NULL                   COMMENT 'Rol asignado al usuario que define sus permisos — ver Roles',
    id_empleado   INT          NULL                       COMMENT 'Empleado físico vinculado a este usuario (opcional). Permite auditar qué persona registró movimientos — ver Empleados',
    activo        BOOLEAN      DEFAULT TRUE               COMMENT 'Indica si el usuario puede iniciar sesión (1=habilitado, 0=suspendido o bloqueado)',
    ultimo_acceso DATETIME     NULL                       COMMENT 'Fecha y hora del último inicio de sesión exitoso. Útil para auditoría de actividad y sesiones inactivas.',
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación de la cuenta de usuario',
    FOREIGN KEY (id_rol)      REFERENCES Roles(id),
    FOREIGN KEY (id_empleado) REFERENCES Empleados(id)
) COMMENT='Usuarios con acceso al sistema ERP. Cada usuario tiene exactamente un rol. Las contraseñas siempre se almacenan hasheadas (el backend en Go gestiona la encriptación).';


-- ====================================================================
--  MÓDULO 5 · OPERACIÓN GENERAL
-- ====================================================================

CREATE TABLE Cotizaciones_Materiales (
    id               INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único de la cotización',
    id_material      INT           NOT NULL                    COMMENT 'Mineral cotizado — ver Materiales',
    id_proveedor     INT           NULL                        COMMENT 'Proveedor o cliente con quien se realizó la negociación — ver Proveedores',
    fecha_cotizacion DATE          NOT NULL                    COMMENT 'Fecha en que se acordó o registró el precio de referencia',
    fecha_necesidad  DATE                                      COMMENT 'Fecha límite para disponer del material (cuándo se necesita el despacho)',
    valor_bolsa      DECIMAL(15,2) NOT NULL                    COMMENT 'Precio internacional de referencia (precio spot bolsa) del mineral en la fecha de cotización',
    valor_cliente    DECIMAL(15,2) NOT NULL                    COMMENT 'Precio final negociado con el cliente o proveedor en pesos colombianos',
    lugar_uso        VARCHAR(255)                              COMMENT 'Destino o uso previsto del material (Ej: Planta principal, Exportación, Maquila Barranquilla)',
    observaciones    TEXT                                      COMMENT 'Condiciones especiales, descuentos pactados, notas de la negociación o términos de entrega',
    created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro de la cotización',
    FOREIGN KEY (id_material)  REFERENCES Materiales(id)  ON DELETE CASCADE,
    FOREIGN KEY (id_proveedor) REFERENCES Proveedores(id) ON DELETE SET NULL,
    INDEX idx_cotizaciones_fecha (fecha_cotizacion)
) COMMENT='Historial de cotizaciones de minerales. Registra el precio spot de referencia y el precio negociado en cada operación. Sirve de base para configurar precios en Precio_Material.';


CREATE TABLE Precio_Material (
    id                  INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del precio',
    id_minero           INT           NULL                        COMMENT 'Minero al que aplica este precio. NULL = precio global para todos los mineros.',
    id_zona             INT           NULL                        COMMENT 'Zona a la que aplica este precio. NULL = aplica independientemente de la zona.',
    metodo              ENUM('por_gramo','por_tonelada') NOT NULL DEFAULT 'por_tonelada'
                        COMMENT 'Método de cálculo: por_gramo=paga por gramos de Au totales, por_tonelada=paga por toneladas secas de material',
    precio_por_gramo    DECIMAL(14,2)                             COMMENT 'Precio en pesos por gramo de Au. Activo cuando metodo=por_gramo (Ej: 72000 = $72.000/gr Au)',
    precio_por_tonelada DECIMAL(14,2)                             COMMENT 'Precio en pesos por tonelada seca. Activo cuando metodo=por_tonelada (Ej: 650000 = $650.000/ton)',
    intervalo_tenor_min DECIMAL(8,4)  NOT NULL DEFAULT 0          COMMENT 'Tenor mínimo del rango en gr Au/ton seca al que aplica este precio (inclusive)',
    intervalo_tenor_max DECIMAL(8,4)  NOT NULL DEFAULT 9999       COMMENT 'Tenor máximo del rango en gr Au/ton seca al que aplica este precio (inclusive)',
    fecha_inicio        DATE          NOT NULL                    COMMENT 'Fecha desde la que está vigente este precio',
    fecha_fin           DATE                                      COMMENT 'Fecha hasta la que aplica. NULL = precio vigente actualmente sin fecha de vencimiento.',
    activo              BOOLEAN       NOT NULL DEFAULT TRUE       COMMENT 'Indica si este precio está activo para nuevos cálculos (1=vigente, 0=histórico reemplazado)',
    created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de creación del registro',
    FOREIGN KEY (id_minero) REFERENCES Minero(id) ON DELETE CASCADE,
    FOREIGN KEY (id_zona)   REFERENCES Zona(id)   ON DELETE CASCADE,
    INDEX idx_precio_minero (id_minero, activo),
    INDEX idx_precio_zona   (id_zona, activo)
) COMMENT='Escala de precios de compra de material por rango de tenor (gr Au/ton). Puede ser global (id_minero/id_zona NULL), específico por minero o por zona. El trigger busca el precio activo según el tenor de la entrada.';


CREATE TABLE Alquileres (
    id           INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del contrato de alquiler',
    id_tipo      INT                                       COMMENT 'Categoría del alquiler (Vehículos, Maquinaria Pesada, Herramientas) — ver Tipos_Alquiler',
    id_proveedor INT                                       COMMENT 'Empresa o persona que arrienda el equipo o vehículo — ver Proveedores',
    fecha_inicio DATE          NOT NULL                    COMMENT 'Fecha de inicio del período de alquiler facturado',
    concepto     VARCHAR(255)  NOT NULL                    COMMENT 'Descripción detallada del equipo o vehículo alquilado (Ej: ALQUILER CAMIONETA ABRIL FAC 363)',
    valor        DECIMAL(15,2) NOT NULL                    COMMENT 'Costo total pactado del alquiler en pesos colombianos',
    created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro del alquiler en el sistema',
    deleted_at   TIMESTAMP     NULL DEFAULT NULL           COMMENT 'Borrado lógico: con fecha = alquiler anulado; NULL = alquiler vigente. El registro nunca se elimina.',
    FOREIGN KEY (id_tipo)      REFERENCES Tipos_Alquiler(id),
    FOREIGN KEY (id_proveedor) REFERENCES Proveedores(id),
    INDEX idx_alquileres_fecha (fecha_inicio)
) COMMENT='Contratos de alquiler de equipos, vehículos y maquinaria. El estado de pago no se almacena aquí para evitar desincronización; se consulta dinámicamente en la vista v_estado_alquileres.';


CREATE TABLE Turnos (
    id                INT           AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único del registro de turno',
    fecha             DATE          NOT NULL                   COMMENT 'Día calendario en que se laboró el turno',
    id_empleado       INT           NOT NULL                   COMMENT 'Empleado asignado a este turno — ver Empleados',
    id_tipo_turno     INT           NOT NULL                   COMMENT 'Horario del turno (mañana/tarde/noche) — ver Tipos_Turno',
    id_planta_proceso INT           NULL                       COMMENT 'Proceso o área específica donde laboró (Ej: Molienda, Flotación, Secado) — ver Planta_Procesos',
    horas_trabajadas  DECIMAL(5,2)  DEFAULT 0                 COMMENT 'Horas efectivas trabajadas durante el turno. Base para cálculo de nómina cuando tipo_pago=POR_HORAS.',
    comentarios       TEXT                                     COMMENT 'Novedades, ausencias parciales, paros, incidencias u anomalías del turno',
    quincena          INT GENERATED ALWAYS AS (CASE WHEN DAY(fecha) <= 15 THEN 1 ELSE 2 END) STORED
                      COMMENT 'Período de nómina calculado automáticamente: 1=días 1 al 15 del mes, 2=días 16 al 31. No editable.',
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de registro del turno en el sistema',
    FOREIGN KEY (id_empleado)       REFERENCES Empleados(id),
    FOREIGN KEY (id_tipo_turno)     REFERENCES Tipos_Turno(id),
    FOREIGN KEY (id_planta_proceso) REFERENCES Planta_Procesos(id),
    INDEX idx_turnos_fecha (fecha)
) COMMENT='Registro diario de asistencia y turnos del personal de planta. La columna quincena se calcula sola para facilitar la liquidación de nómina por período. Permite filtrar por empleado, área o proceso.';


CREATE TABLE Combustible (
    id                         INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del registro de combustible',
    id_gasolinera              INT           NOT NULL                    COMMENT 'Proveedor (gasolinera o estación de servicio) que suministró el combustible. Categoría=Combustible — ver Proveedores',
    tipo_consumo               ENUM('vehiculo','planta','maquinaria','otro') NOT NULL DEFAULT 'vehiculo'
                               COMMENT 'Destino del combustible: vehiculo=tanqueo de camión, planta=tambores para uso interno de planta, maquinaria=retroexcavadora u otro equipo, otro=sin clasificar',
    id_dueno_volqueta          INT           NULL                        COMMENT 'Dueño del vehículo al que se carga el combustible a crédito. El costo se descuenta del flete — ver Dueno_Volqueta',
    id_vehiculo                INT           NULL                        COMMENT 'Vehículo físico que tanqueó (cuando tipo_consumo=vehiculo) — ver Volqueta_Vehiculo',
    id_planta                  INT           NULL                        COMMENT 'Planta que consumió el combustible en tambores o equipos internos — ver Planta',
    id_material_planta_entrada INT           NULL                        COMMENT 'Entrada de material específica a la que se atribuye este consumo de combustible (opcional)',
    fecha                      DATE          NOT NULL                    COMMENT 'Fecha del tanqueo o suministro de combustible',
    descripcion                VARCHAR(255)                              COMMENT 'Detalle del consumo: galones, placa del vehículo, tipo de combustible (ACPM/gasolina)',
    valor                      DECIMAL(15,2) NOT NULL                    COMMENT 'Costo total del suministro de combustible en pesos colombianos',
    comprobante_url            VARCHAR(512)                              COMMENT 'URL o ruta de la foto del comprobante del tanqueo o factura de combustible',
    created_at                 TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro de la transacción',
    FOREIGN KEY (id_gasolinera)     REFERENCES Proveedores(id),
    FOREIGN KEY (id_dueno_volqueta) REFERENCES Dueno_Volqueta(id),
    FOREIGN KEY (id_vehiculo)       REFERENCES Volqueta_Vehiculo(id),
    FOREIGN KEY (id_planta)         REFERENCES Planta(id),
    CONSTRAINT chk_combustible_tipo CHECK (
        (tipo_consumo = 'vehiculo' AND (id_vehiculo IS NOT NULL OR id_dueno_volqueta IS NOT NULL))
        OR tipo_consumo IN ('planta','maquinaria','otro')
    ),
    INDEX idx_combustible_gasolinera (id_gasolinera),
    INDEX idx_combustible_volqueta   (id_dueno_volqueta),
    INDEX idx_combustible_fecha      (fecha)
) COMMENT='Registro de tanqueos y suministros de combustible. tipo_consumo diferencia vehículo (ACPM camión) vs planta (tambores) vs maquinaria. Estado de pago a la gasolinera → v_estado_combustible.';


CREATE TABLE Prestamos_Financieros (
    id                INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del préstamo financiero',
    nombre_prestamo   VARCHAR(150)  NOT NULL                    COMMENT 'Nombre descriptivo del préstamo (Ej: TRAFIGURA ROTATIVO, PRESTAMO BANCARIO DAVIVIENDA)',
    fecha_adquisicion DATE          NOT NULL                    COMMENT 'Fecha en que se desembolsó el capital del préstamo a la empresa',
    monto_principal   DECIMAL(15,2) NOT NULL                    COMMENT 'Capital total recibido de la entidad financiera en pesos colombianos',
    tasa_interes      DECIMAL(5,2)  NOT NULL                    COMMENT 'Tasa de interés mensual pactada en porcentaje (Ej: 2.00 = 2% mensual)',
    saldo_pendiente   DECIMAL(15,2) NOT NULL                    COMMENT 'Saldo actual pendiente incluyendo capital e intereses acumulados',
    activo            BOOLEAN       DEFAULT TRUE                COMMENT 'Estado del préstamo (1=deuda vigente pendiente, 0=cancelado o pagado completamente)',
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro del préstamo en el sistema'
) COMMENT='Obligaciones financieras de la empresa con entidades bancarias o fondos de inversión (Ej: Trafigura rotativo, Davivienda). Cada registro es un préstamo independiente con capital, tasa y saldo.';


CREATE TABLE Prestamos_Empleados (
    id          INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del préstamo al empleado',
    id_empleado INT           NOT NULL                    COMMENT 'Empleado que recibe el préstamo — ver Empleados',
    fecha       DATE          NOT NULL                    COMMENT 'Fecha en que se desembolsó el dinero al empleado',
    concepto    VARCHAR(255)                              COMMENT 'Motivo o destino del préstamo (Ej: COMPRA MOTO NUEVA, Emergencia médica, Vivienda)',
    valor       DECIMAL(15,2) NOT NULL                    COMMENT 'Monto total prestado al empleado en pesos colombianos',
    cuotas      INT           DEFAULT 1                   COMMENT 'Número de quincenas en que se descuenta de la nómina. Cuota = valor / cuotas por período.',
    created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro del préstamo',
    FOREIGN KEY (id_empleado) REFERENCES Empleados(id),
    INDEX idx_prestamos_empleado (id_empleado)
) COMMENT='Préstamos desembolsados al personal. El saldo real pendiente (CxC) se consulta en v_saldo_prestamos_empleado. Al desembolsar genera automáticamente una Cuentas_Por_Cobrar categoría Préstamo empleado.';


-- ====================================================================
--  MÓDULO 6 · CAJA MENOR
-- ====================================================================

CREATE TABLE Deposito (
    id               INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del depósito de caja menor',
    fecha            DATE          NOT NULL                    COMMENT 'Fecha en que se realizó el depósito o transferencia a la caja de planta',
    monto            DECIMAL(14,2) NOT NULL                    COMMENT 'Monto depositado o transferido en pesos colombianos',
    descripcion      VARCHAR(255)                              COMMENT 'Referencia del depósito (Ej: DEPOSITO 10 DE ABRIL, Fondeo caja menor Mauricio)',
    saldo_anterior   DECIMAL(14,2) NOT NULL DEFAULT 0          COMMENT 'Saldo disponible en caja ANTES de sumar este depósito. Para trazabilidad del flujo de caja.',
    saldo_resultante DECIMAL(14,2) NOT NULL                    COMMENT 'Saldo disponible en caja DESPUÉS del depósito (saldo_anterior + monto)',
    created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro del depósito'
) COMMENT='Fondos enviados a la caja menor de planta. Cada fila incrementa el saldo disponible para gastos operativos. Los egresos se registran en Gasto_Operativo, que descuenta del saldo.';


CREATE TABLE Gasto_Operativo (
    id                         INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del gasto operativo de caja menor',
    id_deposito                INT           NOT NULL                    COMMENT 'Depósito (fondo de caja) del que sale este gasto — ver Deposito',
    id_tipo_gasto              INT           NOT NULL                    COMMENT 'Clasificación del gasto: cargue, báscula, viático, ACPM, etc. — ver Tipos_Gasto_Operativo',
    id_material_planta_entrada INT           NULL                        COMMENT 'Entrada de material a la que se atribuye este gasto (opcional) — ver material_planta_entrada',
    id_viaje                   INT           NULL                        COMMENT 'Viaje al que se atribuye este gasto (opcional) — ver Viaje',
    fecha                      DATE          NOT NULL                    COMMENT 'Fecha en que se realizó el gasto en campo',
    concepto                   VARCHAR(150)  NOT NULL                    COMMENT 'Descripción libre del gasto (Ej: Cargue volqueta #42, Muestreo mina San Isidro, Viático conductor)',
    monto                      DECIMAL(14,2) NOT NULL                    COMMENT 'Valor del gasto en pesos colombianos',
    saldo_resultante           DECIMAL(14,2) NOT NULL                    COMMENT 'Saldo de caja disponible DESPUÉS de descontar este gasto. Para auditoría del flujo de efectivo.',
    mensaje_mauricio           TEXT                                      COMMENT 'Mensaje o autorización enviada por Mauricio (coordinador de campo) vía WhatsApp como respaldo del gasto',
    created_at                 TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro del gasto',
    FOREIGN KEY (id_deposito)   REFERENCES Deposito(id),
    FOREIGN KEY (id_tipo_gasto) REFERENCES Tipos_Gasto_Operativo(id),
    INDEX idx_gasto_deposito (id_deposito),
    INDEX idx_gasto_entrada  (id_material_planta_entrada)
) COMMENT='Egresos de la caja menor de planta. Cada gasto reduce el saldo del Deposito. No generan Cuentas_Por_Pagar; el control es directo sobre el efectivo disponible en campo.';


-- ====================================================================
--  MÓDULO 7 · RECEPCIÓN DE MATERIAL
-- ====================================================================

CREATE TABLE material_planta_entrada (
    id                      INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único de la entrada de material a planta',
    numero_volqueta         INT           NOT NULL                    COMMENT 'Número de secuencia de la volqueta asignado por la planta al recibir (1, 2, 3...) para identificar el orden de llegada',
    id_mina                 INT           NOT NULL                    COMMENT 'Mina de origen del material — ver Mina. El minero se deriva: id_mina → Mina.id_minero',
    id_vehiculo             INT           NULL                        COMMENT 'Vehículo que llegó y descargó. El dueño del flete se deriva: id_vehiculo → Volqueta_Vehiculo.id_dueno_volqueta',
    id_tipo_material        INT           NOT NULL                    COMMENT 'Tipo de material recibido (Concentrado, Roca, Lamas, Relave, Lodos) — ver Tipos_Material',
  
    fecha_llegada           DATE          NOT NULL                    COMMENT 'Fecha en que el vehículo llegó a la planta, descargó y se realizó el pesaje inicial',
    peso_llegada_planta     DECIMAL(10,4) NOT NULL                    COMMENT 'Peso bruto del material al llegar a la planta en toneladas métricas (incluye la humedad)',
    porcentaje_humedad      DECIMAL(6,4)  NOT NULL                    COMMENT 'Porcentaje de humedad del material en decimal (Ej: 0.0800 = 8.00%)',
    gramos_humedad          DECIMAL(10,4)                             COMMENT 'Toneladas equivalentes a la humedad (peso_llegada_planta × porcentaje_humedad)',
    tenor                   DECIMAL(8,4)                              COMMENT 'Tenor de Au en gramos por tonelada seca (gr Au/ton). Determina el rango de precio a aplicar.',
    total_material_seco     DECIMAL(10,4)                             COMMENT 'Toneladas de material seco efectivo (peso_llegada_planta − gramos_humedad). Base para calcular gramos y flete.',
    total_gramos            DECIMAL(12,4)                             COMMENT 'Total de gramos de Au en el material (total_material_seco × tenor). Base del pago cuando metodo=por_gramo.',

    precio_por_gramo        DECIMAL(14,2)                             COMMENT 'Precio pactado en pesos por gramo de Au. Activo cuando metodo=por_gramo (concentrado).',
    precio_por_tonelada     DECIMAL(14,2)                             COMMENT 'Precio pactado en pesos por tonelada seca. Activo cuando metodo=por_tonelada (roca, lodos).',
    precio_total            DECIMAL(14,2)                             COMMENT 'Valor total a pagar al minero por este material (precio × gramos ó precio × toneladas secas)',
    excedente_calculado     DECIMAL(14,2)                             COMMENT 'Excedente estimado = beneficio neto de la empresa en esta entrada. Se registra en tabla Excedente al confirmar.',

    costo_cargue            DECIMAL(14,2) DEFAULT 0                   COMMENT 'Costo del servicio de cargue del material en la mina en pesos',
    costo_bascula           DECIMAL(14,2) DEFAULT 0                   COMMENT 'Costo del servicio de pesaje en báscula en pesos',
    costo_maquila           DECIMAL(14,2) DEFAULT 0                   COMMENT 'Costo de procesamiento (maquila) asignado proporcionalmente a esta entrada en pesos. Se actualiza al cerrar Maquila.',
    costo_adicional         DECIMAL(14,2) DEFAULT 0                   COMMENT 'Otros costos: muestreo, acompañamiento, transporte especial, etc., en pesos',
    costo_volqueta          DECIMAL(14,2) DEFAULT 0                   COMMENT 'Flete al transportador = total_material_seco × tarifa de zona. Calculado por trigger al registrar la entrada.',
    total_costos_operativos DECIMAL(14,2)                             COMMENT 'Suma de todos los costos operativos: cargue + báscula + maquila + adicional + volqueta',
    total_material          DECIMAL(14,2)                             COMMENT 'Valor total de la entrada = precio_total + total_costos_operativos',

    estado                  ENUM('pendiente','en_proceso','pagada','incluida_viaje','cancelada') NOT NULL DEFAULT 'pendiente'
                            COMMENT 'Estado en planta: pendiente=recién llegado, en_proceso=en molienda, pagada=pago al minero cancelado, incluida_viaje=despachado a Barranquilla, cancelada=anulada',
    estado_pago_flete       ENUM('pendiente','parcial','pagado','no_aplica') NOT NULL DEFAULT 'pendiente'
                            COMMENT 'Estado del pago del flete al dueño del vehículo. Actualizado por trigger al abonar CxP de categoría Flete volqueta.',
    comentarios             TEXT                                      COMMENT 'Observaciones sobre la condición del material, novedades al recibirlo o acuerdos especiales del minero',
    created_at              TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro de la entrada de material',
    updated_at              TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                            COMMENT 'Fecha y hora de la última modificación del registro',

    FOREIGN KEY (id_mina)          REFERENCES Mina(id),
    FOREIGN KEY (id_vehiculo)      REFERENCES Volqueta_Vehiculo(id),
    FOREIGN KEY (id_tipo_material) REFERENCES Tipos_Material(id),
    INDEX idx_mpe_mina     (id_mina),
    INDEX idx_mpe_vehiculo (id_vehiculo),
    INDEX idx_mpe_fecha    (fecha_llegada),
    INDEX idx_mpe_estado   (estado),
    INDEX idx_mpe_flete    (estado_pago_flete)
) COMMENT='Tabla central de entradas de material a planta (ex tabla "volqueta" en v1/v2). Cada fila es una descarga de un camión con análisis físico y costos. Minero vía id_mina→Mina. Flete vía id_vehiculo→Volqueta_Vehiculo.';


ALTER TABLE Gasto_Operativo
    ADD CONSTRAINT fk_gasto_entrada
    FOREIGN KEY (id_material_planta_entrada) REFERENCES material_planta_entrada(id) ON DELETE SET NULL;

ALTER TABLE Combustible
    ADD CONSTRAINT fk_combustible_entrada
    FOREIGN KEY (id_material_planta_entrada) REFERENCES material_planta_entrada(id) ON DELETE SET NULL;


CREATE TABLE Excedente (
    id                   INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del excedente',
    id_entrada           INT           NOT NULL                    COMMENT 'Entrada de material que generó este excedente — ver material_planta_entrada',
    valor_excedente      DECIMAL(14,2) NOT NULL                    COMMENT 'Ingreso neto de la empresa en esta entrada (precio de venta implícito − costos totales pagados al minero)',
    monto_distribuido    DECIMAL(14,2) NOT NULL DEFAULT 0          COMMENT 'Cuánto de este excedente ya fue distribuido o pagado (sale como Cuentas_Por_Pagar categoría Distribución excedente)',
    saldo_por_distribuir DECIMAL(14,2) AS (valor_excedente - monto_distribuido) STORED
                         COMMENT 'Saldo pendiente de distribuir (valor_excedente − monto_distribuido). Columna calculada automáticamente.',
    fecha_calculo        DATE          NOT NULL                    COMMENT 'Fecha en que se calculó y registró el excedente',
    concepto             VARCHAR(255)  NULL                        COMMENT 'Descripción del excedente (Ej: Excedente viaje 11-1, Excedente entrada #42 roca Naum)',
    estado_distribucion  ENUM('pendiente','parcial','distribuido') NOT NULL DEFAULT 'pendiente'
                         COMMENT 'Estado de distribución: pendiente=no distribuido, parcial=distribuido en parte, distribuido=100% ya salió como CxP',
    notas                TEXT                                      COMMENT 'Notas sobre la distribución, acuerdos o aclaraciones contables sobre este excedente',
    created_at           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de creación del registro',
    updated_at           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                         COMMENT 'Fecha y hora de la última actualización del registro',
    FOREIGN KEY (id_entrada) REFERENCES material_planta_entrada(id),
    INDEX idx_excedente_entrada (id_entrada),
    INDEX idx_excedente_estado  (estado_distribucion)
) COMMENT='Ingresos netos (excedentes) de la empresa por cada entrada de material. Al distribuirlos se crean Cuentas_Por_Pagar (categoría Distribución excedente) enlazadas via Cuentas_Por_Pagar_Relacion.id_excedente.';


CREATE TABLE Anticipos_Terceros (
    id                INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del anticipo entregado',
    id_minero         INT           NULL                        COMMENT 'Minero que recibió el anticipo (excluyente con los otros dos) — ver Minero',
    id_dueno_volqueta INT           NULL                        COMMENT 'Dueño de volqueta que recibió el anticipo (excluyente) — ver Dueno_Volqueta',
    id_proveedor      INT           NULL                        COMMENT 'Proveedor que recibió el anticipo (excluyente) — ver Proveedores',
    fecha             DATE          NOT NULL                    COMMENT 'Fecha en que se entregó el anticipo al tercero',
    monto_inicial     DECIMAL(14,2) NOT NULL                    COMMENT 'Monto total del anticipo entregado en pesos. Se descuenta de pagos futuros.',
    monto_usado       DECIMAL(14,2) DEFAULT 0                   COMMENT 'Monto ya descontado de pagos posteriores al tercero',
    saldo_disponible  DECIMAL(14,2) AS (monto_inicial - monto_usado) STORED
                      COMMENT 'Saldo pendiente de descontar (monto_inicial − monto_usado). Columna calculada.',
    descripcion       VARCHAR(255)                              COMMENT 'Descripción o motivo del anticipo (Ej: Adelanto para combustible campo, Anticipo material próxima entrada)',
    estado            ENUM('disponible','agotado') DEFAULT 'disponible'
                      COMMENT 'disponible=hay saldo pendiente de descontar | agotado=el anticipo fue consumido en su totalidad',
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro del anticipo',
    FOREIGN KEY (id_minero)         REFERENCES Minero(id),
    FOREIGN KEY (id_dueno_volqueta) REFERENCES Dueno_Volqueta(id),
    FOREIGN KEY (id_proveedor)      REFERENCES Proveedores(id),
    CONSTRAINT chk_anticipo_tercero CHECK (
        (id_minero IS NOT NULL) + (id_dueno_volqueta IS NOT NULL) + (id_proveedor IS NOT NULL) = 1
    )
) COMMENT='Anticipos de dinero entregados a mineros, dueños de volqueta o proveedores. El monto se descuenta de pagos futuros. Exactamente un tipo de tercero por registro (CHECK garantiza). Los descuentos se auditan en Historial_Descuentos_Anticipos.';


CREATE TABLE Historial_Descuentos_Anticipos (
    id               INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del descuento aplicado',
    id_anticipo      INT           NOT NULL                    COMMENT 'Anticipo del que se realizó el descuento — ver Anticipos_Terceros',
    id_entrada       INT           NOT NULL                    COMMENT 'Entrada de material en la que se aplicó el descuento al tercero — ver material_planta_entrada',
    fecha            DATE          NOT NULL                    COMMENT 'Fecha en que se aplicó el descuento',
    monto_descontado DECIMAL(14,2) NOT NULL                    COMMENT 'Monto descontado en esta operación específica en pesos',
    nota             VARCHAR(255)                              COMMENT 'Observación o acuerdo sobre el descuento (Ej: Descuento pactado $300.000, Acuerdo verbal con Omar)',
    created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro del descuento',
    FOREIGN KEY (id_anticipo) REFERENCES Anticipos_Terceros(id),
    FOREIGN KEY (id_entrada)  REFERENCES material_planta_entrada(id)
) COMMENT='Historial inmutable de descuentos aplicados sobre anticipos. Permite auditar en qué entrada exactamente se le descontó la deuda al tercero y generar el extracto de anticipos.';


CREATE TABLE Analisis (
    id                 INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del análisis de laboratorio',
    id_entrada         INT           NULL                        COMMENT 'Entrada de material analizada. NULL si es un análisis de muestra compuesta sin entrada asociada — ver material_planta_entrada',
    id_material_concentrado INT           NULL                        COMMENT 'Lote de concentrado analizado (tabla de Ginna con tenores del concentrado). NULL si es analisis de materia prima. Mutuamente exclusivo con id_entrada — ver material_concentrado',
    id_tipo_analisis   INT           NOT NULL                    COMMENT 'Tipo de análisis (Cabeza, Concentrado, Colas, etc.) — ver Tipos_Analisis',
    id_mina            INT           NULL                        COMMENT 'Mina de origen. Solo requerida si id_entrada IS NULL (análisis sin entrada directa) — ver Mina',
    id_minero          INT           NULL                        COMMENT 'Minero asociado. Solo requerido si id_entrada IS NULL — ver Minero',
    id_tipo_material   INT           NULL                        COMMENT 'Tipo de material. Solo requerido si id_entrada IS NULL — ver Tipos_Material',
    id_laboratorio     INT           NULL                        COMMENT 'Laboratorio que realizó el análisis (proveedor categoría Laboratorio) — ver Proveedores',
    numero_analisis    VARCHAR(50)                               COMMENT 'Código o número de referencia del análisis asignado por el laboratorio (puede ser compuesto: 3211+3212+3216)',
    au_concentrado     DECIMAL(10,4)                             COMMENT 'Total de gramos de Au en la muestra analizada',
    ag_concentrado     DECIMAL(10,4)                             COMMENT 'Total de gramos de Ag en la muestra analizada',
    ton                DECIMAL(10,4)                             COMMENT 'Toneladas de material analizadas en la muestra',
    porcentaje_humedad DECIMAL(6,4)                              COMMENT 'Humedad certificada por el laboratorio en decimal (Ej: 0.0800 = 8%). Dato oficial para cálculos de pago.',
    toneladas_humedas  DECIMAL(10,4)                             COMMENT 'Peso total con humedad en toneladas, certificado por el laboratorio',
    toneladas_secas    DECIMAL(10,4)                             COMMENT 'Peso seco certificado por el laboratorio en toneladas. Dato oficial para el cálculo del pago al minero.',
    au_gr_x_ton        DECIMAL(10,4)                             COMMENT 'Tenor de Au certificado: gramos de Au por tonelada seca (gr Au/ton). Define el precio/gramo a aplicar.',
    au_falso           DECIMAL(10,4) NULL                        COMMENT 'Tenor de Au ajustado para mostrar al minero (generalmente menor al real). Aplica cuando hay acuerdo de no revelar el tenor completo.',
    ag_gr_x_ton        DECIMAL(10,4)                             COMMENT 'Tenor de Ag certificado: gramos de Ag por tonelada seca (gr Ag/ton)',
    valor_analisis     DECIMAL(14,2) NULL                        COMMENT 'Costo cobrado por el laboratorio en pesos. Se paga como CxP categoría Análisis.',
    estado_pago        ENUM('pendiente','parcial','pagado','no_aplica') NOT NULL DEFAULT 'no_aplica'
                       COMMENT 'Estado del pago al laboratorio por este análisis. no_aplica cuando el costo está incluido en un contrato marco.',
    fecha_salida       DATE                                      COMMENT 'Fecha en que el material salió de la planta hacia Barranquilla para procesamiento externo',
    comentarios        TEXT                                      COMMENT 'Diferencias con la medición interna de planta, aclaraciones técnicas u observaciones del laboratorio',
    created_at         TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro del análisis',
    FOREIGN KEY (id_entrada)       REFERENCES material_planta_entrada(id),
    FOREIGN KEY (id_tipo_analisis) REFERENCES Tipos_Analisis(id),
    FOREIGN KEY (id_mina)          REFERENCES Mina(id),
    FOREIGN KEY (id_minero)        REFERENCES Minero(id),
    FOREIGN KEY (id_tipo_material) REFERENCES Tipos_Material(id),
    FOREIGN KEY (id_laboratorio)   REFERENCES Proveedores(id),
    CONSTRAINT chk_analisis_refs CHECK (
        id_entrada IS NOT NULL
        OR (id_mina IS NOT NULL AND id_tipo_material IS NOT NULL)
    ),
    INDEX idx_analisis_entrada (id_entrada),
    FOREIGN KEY (id_material_concentrado) REFERENCES material_concentrado(id)
) COMMENT='Resultados de laboratorio por entrada de material. El tipo Cabeza es el oficial que define tenor y humedad para el pago al minero. Ver v_analisis_completo para datos siempre resueltos con referencias completas.';
-- 1. Borramos la regla antigua
ALTER TABLE analisis DROP CHECK chk_analisis_refs;

-- 2. Creamos la regla actualizada incluyendo el nuevo flujo de concentrado
ALTER TABLE analisis ADD CONSTRAINT chk_analisis_refs CHECK (
    id_entrada IS NOT NULL
    OR id_material_concentrado IS NOT NULL
    OR (id_mina IS NOT NULL AND id_tipo_material IS NOT NULL)
);

-- ====================================================================
--  MÓDULO 8 · AGUA Y MULAS
-- ====================================================================

CREATE TABLE Agua_Planta (
    id                INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del registro de suministro de agua',
    id_dueno_volqueta INT           NOT NULL                    COMMENT 'Dueño del vehículo cisterna que transportó el agua a la planta — ver Dueno_Volqueta',
    fecha             DATE          NOT NULL                    COMMENT 'Fecha del suministro de agua a la planta',
    valor_viaje       DECIMAL(14,2) NOT NULL                    COMMENT 'Valor pactado en pesos por cada viaje de agua',
    cantidad_viajes   INT           NOT NULL DEFAULT 1          COMMENT 'Número de viajes de agua realizados en este registro',
    acpm              DECIMAL(14,2) DEFAULT 0                   COMMENT 'Descuento en pesos por combustible ACPM que la empresa proveyó al transportador para el viaje de agua',
    valor_total       DECIMAL(14,2) AS (valor_viaje * cantidad_viajes - IFNULL(acpm,0)) STORED
                      COMMENT 'Valor total a pagar al dueño (valor_viaje × cantidad_viajes − acpm). Columna calculada automáticamente.',
    comprobante_url   VARCHAR(512)                              COMMENT 'URL o ruta del comprobante fotográfico del pago de agua',
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro',
    FOREIGN KEY (id_dueno_volqueta) REFERENCES Dueno_Volqueta(id),
    INDEX idx_agua_volqueta (id_dueno_volqueta),
    INDEX idx_agua_fecha    (fecha)
) COMMENT='Registro de suministros de agua a la planta en vehículos cisterna de dueños de volqueta. El valor_total se calcula automáticamente. Estado de pago → v_estado_agua.';


CREATE TABLE Mulas (
    id               INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del despacho de mula a Barranquilla',
    id_proveedor     INT           NOT NULL                    COMMENT 'Empresa transportadora que realizó el despacho (categoría Transporte_Mula) — ver Proveedores',
    id_viaje         INT           NULL                        COMMENT 'Viaje al que está asociado este despacho — ver Viaje. NULL si aún no se ha vinculado al viaje.',
    fecha            DATE          NOT NULL                    COMMENT 'Fecha del despacho del material hacia Barranquilla para procesamiento externo',
    concepto         VARCHAR(255)                              COMMENT 'Descripción del despacho: contenido, toneladas, destino y condiciones del transporte',
    factura_num      VARCHAR(50)                               COMMENT 'Número de factura de la empresa transportadora para este servicio',
    foto_factura_url VARCHAR(512)                              COMMENT 'URL o ruta de la foto de la factura del servicio de transporte',
    valor            DECIMAL(14,2) NOT NULL                    COMMENT 'Valor total del flete de la mula (costo del transporte) en pesos colombianos',
    comprobante_url  VARCHAR(512)                              COMMENT 'URL o ruta del comprobante de pago del flete de la mula',
    created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro del despacho',
    FOREIGN KEY (id_proveedor) REFERENCES Proveedores(id),
    INDEX idx_mulas_proveedor (id_proveedor),
    INDEX idx_mulas_fecha     (fecha)
) COMMENT='Despachos de concentrado a Barranquilla para procesamiento externo. La retención sobre el valor se calcula en v_mulas (tarifa retencion_mula_pct). Estado de pago → v_estado_mulas.';


-- ====================================================================
--  MÓDULO 9 · VIAJES Y PROCESAMIENTO
-- ====================================================================


-- ====================================================================
--  MÓDULO 9B · TARIFAS Y PROCESAMIENTO DE CONCENTRADO
-- ====================================================================

CREATE TABLE tarifas_proceso (
    id          INT           AUTO_INCREMENT PRIMARY KEY
                COMMENT 'Identificador único de la tarifa',
    codigo      VARCHAR(30)   NOT NULL
                COMMENT 'Código que usan los triggers para leer la tarifa. '
                        'PROCESO_NORMAL = molienda+flotacion+filtroprensa ($400k/ton). '
                        'PROCESO_RELAVE = +relave ($560k/ton). '
                        'SOLO_FILTROPRENSA = solo filtroprensa ($100k/ton). '
                        'UMBRAL_FILTROPRENSA = % humedad de referencia',
    descripcion VARCHAR(150)  NULL
                COMMENT 'Descripción legible para pantalla y reportes',
    valor       DECIMAL(14,4) NOT NULL
                COMMENT 'Valor de la tarifa. COP/ton o decimal según unidad',
    unidad      VARCHAR(20)   NOT NULL DEFAULT 'COP/ton'
                COMMENT 'Unidad del valor: COP/ton para precios, porcentaje para umbrales',
    fecha_desde DATE          NOT NULL
                COMMENT 'Fecha desde que aplica esta tarifa',
    fecha_hasta DATE          NULL
                COMMENT 'Fecha hasta que fue válida. NULL = aún vigente',
    activo      TINYINT(1)    NOT NULL DEFAULT 1
                COMMENT '1=vigente usada por triggers. 0=histórica. NUNCA borrar filas',
    created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_tarifa_codigo_activo (codigo, activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tarifas de maquila y parámetros del proceso de concentración. Similar a Precio_Material pero para costos de procesamiento. 
  Para actualizar anualmente: desactivar vigente e insertar nueva. Triggers usan: WHERE codigo=X AND activo=1 ORDER BY fecha_desde DESC LIMIT 1';

INSERT INTO tarifas_proceso (codigo, descripcion, valor, unidad, fecha_desde) VALUES
('PROCESO_NORMAL',     'Molienda + Flotacion + Filtroprensa',                   400000, 'COP/ton',    CURDATE()),
('PROCESO_RELAVE',     'Molienda + Flotacion + Relave + Filtroprensa',           560000, 'COP/ton',    CURDATE()),
('SOLO_FILTROPRENSA',  'Solo Filtroprensa (concentrado comprado o alta humedad)', 100000, 'COP/ton',    CURDATE()),
('UMBRAL_FILTROPRENSA','Humedad minima de referencia para filtroprensa',             0.15, 'porcentaje', CURDATE());


CREATE TABLE material_concentrado (
    id                     int(11)       NOT NULL AUTO_INCREMENT
                           COMMENT 'Identificador único del lote de concentrado',
    codigo                 VARCHAR(30)   NOT NULL
                           COMMENT 'Código interno del lote (Ej: LC-2026-001)',
    fecha_inicio           DATE          NULL
                           COMMENT 'Fecha en que el primer material entró al molino',
    fecha_fin              DATE          NULL
                           COMMENT 'Fecha en que salió el concentrado del filtroprensa. NULL si aún en proceso',
    hizo_molienda          TINYINT(1)    NOT NULL DEFAULT 0,
    hizo_flotacion         TINYINT(1)    NOT NULL DEFAULT 0,
    hizo_relave            TINYINT(1)    NOT NULL DEFAULT 0,
    hizo_filtroprensa      TINYINT(1)    NOT NULL DEFAULT 0,
    toneladas_humedo       DECIMAL(10,4) NULL
                           COMMENT 'Toneladas húmedas del concentrado al salir del proceso',
    porcentaje_humedad     DECIMAL(6,4)  NULL
                           COMMENT 'Humedad del concentrado (Ej: 0.1300 = 13%)',
    toneladas_seco         DECIMAL(10,4) NULL
                           COMMENT 'Toneladas secas = toneladas_humedo × (1 - porcentaje_humedad). '
                                   'Base para calcular maquila y para la tabla de Ginna',
	material_seco_procesado DECIMAL(10,4) NULL COMMENT 'Total toneladas secas materia prima. Útil para calcular merma.',
    merma_seco             DECIMAL(10,4) DEFAULT 0.0000
                           COMMENT 'Toneladas secas perdidas en el proceso (polvo, derrames, etc.). '
                                   'Se descuenta del disponible real.',
    toneladas_disponibles  DECIMAL(10,4) NOT NULL DEFAULT 0
                           COMMENT 'Concentrado seco disponible en planta DESPUÉS de descontar la merma y los viajes. '
                                   'Se actualiza manualmente o con un procedimiento, ya que el trigger de viaje fue eliminado.',
    ubicacion_canoa        VARCHAR(100)  NULL,
    precio_maquila_por_ton DECIMAL(14,2) NULL,
    maquila_total          DECIMAL(14,2) NULL,
    estado                 ENUM('en_proceso','en_canoa','parcialmente_enviado','enviado_completo')
                           NOT NULL DEFAULT 'en_proceso',
    comentarios            TEXT          NULL,
    created_at             TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Lote de concentrado. La disponibilidad física ahora debe calcularse como:
           toneladas_seco - merma_seco - SUM(viaje_material.concentrado_seco).';


CREATE TABLE procesamiento_material (
    id                       int(11)       NOT NULL AUTO_INCREMENT
                             COMMENT 'Identificador único del vínculo entrada-concentrado',
    id_material_concentrado  int(11)       NOT NULL
                             COMMENT 'Lote al que aportó este material — ver material_concentrado. N filas por lote',
    id_entrada               int(11)       NOT NULL
                             COMMENT 'Camión (entrada) que fue al proceso — ver material_planta_entrada',
    toneladas_aportadas      DECIMAL(10,4) NOT NULL
                             COMMENT 'Toneladas brutas de esta entrada que entraron al molino',
    toneladas_seco_aportadas DECIMAL(10,4) NULL
                             COMMENT 'Toneladas secas = toneladas_aportadas × (1 - pct_humedad). '
                                     'Base para la distribución proporcional',
    concentrado_proporcional DECIMAL(10,4) NULL
                             COMMENT 'Toneladas de concentrado que corresponden a esta entrada. '
                                     'Calculado por trigger al cerrar el lote: '
                                     '(ton_seco_aportadas / total_seco_lote) × toneladas_seco',
    maquila_proporcional     DECIMAL(14,2) NULL
                             COMMENT 'Costo de maquila de esta entrada en pesos. '
                                     'Calculado por trigger: (ton_seco_aportadas / total_seco_lote) × maquila_total. '
                                     'Propagado a material_planta_entrada.costo_maquila',
    PRIMARY KEY (id),
    UNIQUE KEY uq_conc_ent (id_material_concentrado, id_entrada),
    KEY fk_pm_mc_idx  (id_material_concentrado),
    KEY fk_pm_ent_idx (id_entrada),
    CONSTRAINT fk_pm_mc      FOREIGN KEY (id_material_concentrado) REFERENCES material_concentrado(id),
    CONSTRAINT fk_pm_entrada FOREIGN KEY (id_entrada)              REFERENCES material_planta_entrada(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tabla puente: que entradas (camiones) alimentaron cada lote de concentrado. 
  Al INSERT un camion: trigger marca inventario en_proceso y kardex SALIDA_PROCESO. Al cerrar el lote: trigger calcula concentrado_proporcional y maquila_proporcional.';

CREATE TABLE Viaje (
    id                   INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del viaje',
    numero_viaje         VARCHAR(20)   NOT NULL                    COMMENT 'Código del viaje según nomenclatura de Transfigura (Ej: 11-1, 11-2, 12-3). Formato: semana-consecutivo.',
    fecha                DATE          NOT NULL                    COMMENT 'Fecha de salida del material de la planta hacia Barranquilla',
    total_costo_material DECIMAL(14,2)                             COMMENT 'Suma del costo de todo el material incluido en el viaje (sum de precio_total de cada entrada)',
    maquila              DECIMAL(14,2)                             COMMENT 'Costo total de maquila del viaje. Calculado como SUMA de viaje_material.costo_maquila. Actualizado por trg_after_insert_viaje_material al asignar concentrado al viaje. El costo de maquila nace en material_concentrado al cerrar el batch (en_proceso->en_canoa)',
    total_viaje          DECIMAL(14,2)                             COMMENT 'Costo total del viaje: material + maquila + otros gastos asociados',
    au_promedio_compra   DECIMAL(10,4)                             COMMENT 'Precio promedio ponderado de compra de Au en pesos por gramo, calculado sobre todas las entradas del viaje',
    tenor_au_venta       DECIMAL(10,4)                             COMMENT 'Tenor de Au al momento de venta en Barranquilla en gr/ton, certificado por el comprador',
    total_grs_au_venta   DECIMAL(10,4)                             COMMENT 'Total de gramos de Au efectivamente vendidos y certificados en el destino',
    tenor_ag             DECIMAL(10,4)                             COMMENT 'Tenor de Ag del material del viaje en gr/ton',
    total_grs_ag_venta   DECIMAL(10,4)                             COMMENT 'Total de gramos de Ag efectivamente vendidos en el destino',
    comentarios          TEXT                                      COMMENT 'Novedades, diferencias en destino, condiciones de venta o incidencias del transporte',
    created_at           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de creación del viaje en el sistema',
    updated_at           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                         COMMENT 'Fecha y hora de la última actualización del viaje'
) COMMENT='Registro de cada despacho de material a Barranquilla para procesamiento externo (maquila). Agrupa múltiples entradas de planta en un solo envío. Las entradas participantes se enlistan en viaje_material.';


ALTER TABLE Mulas
    ADD CONSTRAINT fk_mulas_viaje
    FOREIGN KEY (id_viaje) REFERENCES Viaje(id) ON DELETE SET NULL;

ALTER TABLE Gasto_Operativo
    ADD CONSTRAINT fk_gasto_viaje
    FOREIGN KEY (id_viaje) REFERENCES Viaje(id) ON DELETE SET NULL;


CREATE TABLE viaje_material (
    id                       INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del registro de participación de un lote de concentrado en un viaje',
    id_viaje                 INT           NOT NULL                    COMMENT 'Viaje al que pertenece esta línea — ver Viaje',
    id_material_concentrado  INT           NULL                        COMMENT 'Lote de concentrado incluido en este viaje — ver material_concentrado. '
                                                                               'Al INSERT, el trigger decrementa toneladas_disponibles del lote y actualiza kardex e inventario',
    es_remanente             BOOLEAN       NOT NULL DEFAULT FALSE      COMMENT 'Indica si este concentrado fue costeado (maquila) en un viaje anterior. '
                                                                               '1=remanente (costo_maquila=0 aquí). 0=material nuevo de este viaje',
    id_viaje_origen          INT           NULL                        COMMENT 'Viaje en que se costeó originalmente este remanente. NULL si es material nuevo del viaje actual',
    concepto                 VARCHAR(150)                              COMMENT 'Descripción del lote (Ej: LC-2026-001 Omar Mina80, Concentrado Naum nv=3,4)',
    total_material           DECIMAL(10,4)                             COMMENT 'Toneladas brutas del lote incluidas en el viaje',
    total_concentrado_humedo DECIMAL(10,4)                             COMMENT 'Toneladas de concentrado húmedo que este lote aporta al viaje',
    porcentaje_humedad       DECIMAL(6,4)                              COMMENT 'Porcentaje de humedad del concentrado al momento del despacho (Ej: 0.13 = 13%)',
    peso_humedad             DECIMAL(10,4)                             COMMENT 'Toneladas de agua en el concentrado húmedo aportado por este lote',
    concentrado_seco         DECIMAL(10,4)                             COMMENT 'Toneladas de concentrado seco efectivo de este lote en el viaje. '
                                                                               'Base para el cálculo proporcional de la maquila',
    -- Costos
    costo_maquila            DECIMAL(14,2) NULL                        COMMENT 'Costo de maquila de este lote = (concentrado_seco / mc.toneladas_seco) × mc.maquila_total. '
                                                                               'Calculado por trigger al insertar. '
                                                                               'Es 0 si es_remanente=1 (ya se costeó en el viaje de origen). '
                                                                               'Es 0 si es concentrado comprado sin proceso (a menos que hizo_filtroprensa=1)',
    valor_total_con_gastos   DECIMAL(14,2)                             COMMENT 'Valor total de este lote en el viaje incluyendo todos sus costos operativos',
    -- Detalle de Au y Ag por lote (para reportes y liquidación)
    au_promedio_compra       DECIMAL(10,4) NULL                        COMMENT 'Precio promedio ponderado de compra de Au en pesos por gramo para este lote. '
                                                                               'Calculado por el backend desde procesamiento_material → material_planta_entrada',
    tenor_au_venta           DECIMAL(10,4) NULL                        COMMENT 'Tenor de Au del concentrado en gr/ton (del analisis de Ginna vinculado al material_concentrado). '
                                                                               'El que Transfigura usa para liquidar',
    total_grs_au_venta       DECIMAL(10,4) NULL                        COMMENT 'Total gramos de Au de este lote = concentrado_seco × tenor_au_venta. '
                                                                               'Gramos que Transfigura reconoce de este lote',
    tenor_ag                 DECIMAL(10,4) NULL                        COMMENT 'Tenor de Ag del concentrado en gr/ton (del analisis de Ginna)',
    total_grs_ag_venta       DECIMAL(10,4) NULL                        COMMENT 'Total gramos de Ag de este lote = concentrado_seco × tenor_ag',
    created_at               TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de creación del registro',
    FOREIGN KEY (id_viaje)               REFERENCES Viaje(id),
    FOREIGN KEY (id_material_concentrado) REFERENCES material_concentrado(id),
    FOREIGN KEY (id_viaje_origen)        REFERENCES Viaje(id),
    INDEX idx_vm_viaje (id_viaje),
    INDEX idx_vm_mc    (id_material_concentrado)
) COMMENT='Lotes de concentrado que componen cada viaje. Cada fila es un lote de material_concentrado asignado al viaje. 
Flujo: el trigger BEFORE INSERT calcula costo_maquila; el trigger AFTER INSERT actualiza inventario, kardex y viaje.maquila.El Au/Ag detail (tenor_au_venta, etc.) lo llena el backend desde el analisis de Ginna.';




CREATE TABLE Peso_Final_Transfigura (
    id                   INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del registro de peso y tenor final',
    id_viaje             INT           NOT NULL                    COMMENT 'Viaje que originó este despacho — ver Viaje',
    fecha                DATE          NOT NULL                    COMMENT 'Fecha de consolidación del pesaje o certificación de tenores en destino',
    peso_neto            DECIMAL(15,4)                             COMMENT 'Peso bruto total del material despachado en kilogramos, según medición en destino',
    peso_seco            DECIMAL(15,4)                             COMMENT 'Peso seco total certificado en kilogramos (descontada la humedad) en destino',
    infopath_au          DECIMAL(10,4)                             COMMENT 'Ley de Au en gr/ton medida por el sistema Infopath interno de la empresa (referencia propia)',
    infopath_ag          DECIMAL(10,4)                             COMMENT 'Ley de Ag en gr/ton medida por el sistema Infopath de la empresa',
    tenor_inicial_sgs_au DECIMAL(10,4)                             COMMENT 'Ley de Au en gr/ton certificada por SGS en el punto de origen antes del despacho',
    tenor_inicial_sgs_ag DECIMAL(10,4)                             COMMENT 'Ley de Ag en gr/ton certificada por SGS en punto de origen',
    tenor_inicial_sgs_cu DECIMAL(10,4)                             COMMENT 'Ley de Cu (cobre) en gr/ton certificada por SGS. Puede generar bonificaciones o penalidades.',
    tenor_final_peru_au  DECIMAL(10,4)                             COMMENT 'Ley de Au en gr/ton confirmada en el destino final (Perú) por el comprador. Dato definitivo de liquidación.',
    tenor_final_peru_ag  DECIMAL(10,4)                             COMMENT 'Ley de Ag en gr/ton confirmada en destino final (Perú) por el comprador',
    arsenico_final_peru  DECIMAL(10,4)                             COMMENT 'Concentración de Arsénico en gr/ton medida en destino. Por encima del límite genera penalidades sobre el precio.',
    created_at           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro',
    FOREIGN KEY (id_viaje) REFERENCES Viaje(id),
    INDEX idx_peso_viaje (id_viaje)
) COMMENT='Registro técnico-metalúrgico de pesos y tenores finales de cada despacho. Captura los datos certificados por Infopath (interno), SGS (origen) y el comprador en Perú (destino) para conciliación y liquidación definitiva.';


-- ====================================================================
--  MÓDULO 10 · INVENTARIO Y KARDEX
-- ====================================================================

CREATE TABLE Inventario_Lotes (
    id                    INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del lote de inventario en planta',
    id_entrada            INT           NULL                    COMMENT 'Entrada de material que origina este lote de materia prima. NULL para lotes de concentrado — ver material_planta_entrada',
    id_material_concentrado INT           NULL                        COMMENT 'Lote de concentrado que origina este registro. NULL para lotes de materia prima. Mutuamente exclusivo con id_entrada — ver material_concentrado',
    id_mina               INT           NULL                    COMMENT 'Mina de origen del lote. NULL para lotes de concentrado (pueden ser mezcla de minas) — ver Mina',
    id_tipo_material      INT           NULL                    COMMENT 'Tipo de material del lote. NULL para lotes de concentrado — ver Tipos_Material',
    condicion_material    ENUM('Humedo','Seco') NOT NULL            COMMENT 'Condición física del material al momento de su ingreso al inventario de planta',
    porcentaje_humedad    DECIMAL(5,4)  DEFAULT 0.0000              COMMENT 'Porcentaje de humedad del lote al ingresar al inventario (Ej: 0.1500 = 15.00%)',
    toneladas_iniciales   DECIMAL(10,4) NOT NULL                    COMMENT 'Toneladas con las que ingresó el lote. Este campo no cambia; es el registro histórico de la cantidad inicial.',
    toneladas_disponibles DECIMAL(10,4) NOT NULL                    COMMENT 'Toneladas disponibles en planta hoy. Se actualiza automáticamente por trigger al mover o consumir material.',
    estado                ENUM('almacenado','en_proceso','agotado','faltante') DEFAULT 'almacenado'
                          COMMENT 'Estado actual: almacenado=en planta disponible, en_proceso=en molienda, agotado=consumido/despachado, faltante=diferencia física detectada',
    ubicacion             VARCHAR(100)  NULL                        COMMENT 'Ubicación física dentro de la planta donde está almacenado el lote (Ej: Patio norte, Bodega 2, Canoa 3)',
    fecha_ingreso         DATETIME      DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora en que el lote ingresó formalmente al inventario de planta',
    FOREIGN KEY (id_entrada)       REFERENCES material_planta_entrada(id),
    FOREIGN KEY (id_material_concentrado) REFERENCES material_concentrado(id),
    FOREIGN KEY (id_mina)          REFERENCES Mina(id),
    FOREIGN KEY (id_tipo_material) REFERENCES Tipos_Material(id),
    INDEX idx_inv_entrada    (id_entrada),
    INDEX idx_inv_disponible (toneladas_disponibles, estado)
) COMMENT='Stock de material en planta organizado por lote de entrada. Se crea automáticamente por trigger al insertar en material_planta_entrada. Cada cambio de toneladas_disponibles queda auditado en Kardex_Movimientos.';


CREATE TABLE Kardex_Movimientos (
    id                 INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único e inmutable del movimiento de inventario',
    id_lote            INT           NOT NULL                    COMMENT 'Lote de inventario afectado por este movimiento — ver Inventario_Lotes',
    fecha              DATETIME      DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora exacta del movimiento de material',
    tipo_movimiento    ENUM('ENTRADA_PLANTA','SALIDA_PROCESO','ENTRADA_CONCENTRADO','SALIDA_VIAJE','AJUSTE_MERMA') NOT NULL
                       COMMENT 'Tipo: ENTRADA_PLANTA=llegada de material a planta, SALIDA_PROCESO=ingresa a molienda, SALIDA_VIAJE=despacho a Barranquilla, AJUSTE_MERMA=corrección por diferencia física',
    toneladas_movidas  DECIMAL(10,4) NOT NULL                    COMMENT 'Toneladas involucradas en el movimiento (siempre positivo). La dirección la define tipo_movimiento.',
    destino_referencia VARCHAR(100)                              COMMENT 'A dónde fue el material o por qué se movió (Ej: Viaje 11-1, Molienda Turno Mañana, Ajuste secado)',
    id_usuario         INT                                       COMMENT 'Usuario que registró el movimiento — ver Usuarios. NULL si fue generado automáticamente por trigger.',
    comentarios        TEXT                                      COMMENT 'Observaciones, motivo del ajuste o notas adicionales sobre el movimiento de inventario',
    FOREIGN KEY (id_lote)    REFERENCES Inventario_Lotes(id),
    FOREIGN KEY (id_usuario) REFERENCES Usuarios(id),
    INDEX idx_kardex_lote  (id_lote),
    INDEX idx_kardex_fecha (fecha)
) COMMENT='Historial inmutable de todos los movimientos de material en planta. Escrito por triggers al modificar Inventario_Lotes. Permite auditar cualquier cambio de stock en cualquier momento histórico.';


-- ====================================================================
--  MÓDULO 11 · CUENTAS POR PAGAR
-- ====================================================================

CREATE TABLE Cuentas_Por_Pagar (
    id                INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único de la cuenta por pagar',
    id_categoria      INT           NOT NULL                    COMMENT 'Tipo de obligación de pago (Material, Flete volqueta, Maquila, Nómina, etc.) — ver Categorias_CxP',
    concepto          VARCHAR(255)  NOT NULL                    COMMENT 'Descripción de la obligación (Ej: Pago material Omar Mina 80 volqueta 15, Nómina primera quincena mayo)',
    id_proveedor      INT           NULL                        COMMENT 'Proveedor beneficiario del pago. Excluyente con empleado/minero/dueno_volqueta — ver Proveedores',
    id_empleado       INT           NULL                        COMMENT 'Empleado beneficiario del pago. Excluyente con proveedor/minero/dueno_volqueta — ver Empleados',
    id_minero         INT           NULL                        COMMENT 'Minero beneficiario del pago. Excluyente con proveedor/empleado/dueno_volqueta — ver Minero',
    id_dueno_volqueta INT           NULL                        COMMENT 'Dueño de volqueta beneficiario del pago de flete. Excluyente con los demás — ver Dueno_Volqueta',
    valor_total       DECIMAL(14,2) NOT NULL                    COMMENT 'Monto total de la obligación de pago en pesos colombianos',
    valor_pagado      DECIMAL(14,2) NOT NULL DEFAULT 0          COMMENT 'Suma acumulada de todos los abonos. Actualizado automáticamente por trigger trg_after_abono_cxp.',
    saldo             DECIMAL(14,2) AS (valor_total - valor_pagado) STORED
                      COMMENT 'Saldo pendiente (valor_total − valor_pagado). Columna calculada automáticamente.',
    estado            ENUM('pendiente','parcial','pagado','anulado') NOT NULL DEFAULT 'pendiente'
                      COMMENT 'Estado: pendiente=sin pagar, parcial=abonado en parte, pagado=obligación cancelada, anulado=eliminada lógicamente',
    fecha_creacion    DATE          NOT NULL DEFAULT (CURRENT_DATE) COMMENT 'Fecha en que nació la obligación de pago',
    fecha_limite      DATE                                      COMMENT 'Fecha comprometida para completar el pago (opcional). Base para alertas de vencimiento.',
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de creación del registro',
    updated_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                      COMMENT 'Fecha y hora de la última modificación del registro',
    deleted_at        TIMESTAMP     NULL DEFAULT NULL           COMMENT 'Borrado lógico: con fecha = CxP anulada. El registro se conserva para auditoría contable; no se elimina físicamente.',
    FOREIGN KEY (id_categoria)      REFERENCES Categorias_CxP(id),
    FOREIGN KEY (id_proveedor)      REFERENCES Proveedores(id),
    FOREIGN KEY (id_empleado)       REFERENCES Empleados(id),
    FOREIGN KEY (id_minero)         REFERENCES Minero(id),
    FOREIGN KEY (id_dueno_volqueta) REFERENCES Dueno_Volqueta(id),
    CONSTRAINT chk_cxp_un_beneficiario CHECK (
        (id_proveedor IS NOT NULL) + (id_empleado IS NOT NULL) +
        (id_minero IS NOT NULL) + (id_dueno_volqueta IS NOT NULL) <= 1
    ),
    INDEX idx_cxp_estado (estado),
    INDEX idx_cxp_fecha  (fecha_creacion)
) COMMENT='Tabla central de obligaciones de pago de la empresa. Todo lo que la empresa debe pagar nace aquí. Los abonos en Abonos_CxP. La relación con entradas/viajes/etc. en Cuentas_Por_Pagar_Relacion.';


CREATE TABLE Abonos_CxP (
    id              INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del abono o pago efectuado',
    id_cuenta_pagar INT           NOT NULL                    COMMENT 'Cuenta por pagar a la que se aplica este abono — ver Cuentas_Por_Pagar',
    fecha_abono     DATE          NOT NULL                    COMMENT 'Fecha en que se realizó el pago o abono al beneficiario',
    valor           DECIMAL(14,2) NOT NULL                    COMMENT 'Monto del abono en pesos colombianos',
    metodo_pago     ENUM('efectivo','consignacion','transferencia','nequi',
                         'descuento_nomina','saldo_a_favor','otro') NOT NULL DEFAULT 'efectivo'
                    COMMENT 'Método: efectivo, consignacion, transferencia bancaria, nequi, descuento_nomina (empleados), saldo_a_favor (usa crédito por sobrepago), otro',
    id_saldo_favor  INT           NULL                        COMMENT 'Solo cuando metodo_pago=saldo_a_favor: referencia al crédito por sobrepago que se consume — ver Saldo_A_Favor',
    comprobante_url VARCHAR(512)                              COMMENT 'URL o ruta del comprobante (captura de transferencia, foto del recibo, número de confirmación)',
    observaciones   TEXT                                      COMMENT 'Notas adicionales (Ej: Pagado con fondos rotativo Trafigura, Abono parcial acordado con Camilo)',
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro del abono en el sistema',
    FOREIGN KEY (id_cuenta_pagar) REFERENCES Cuentas_Por_Pagar(id) ON DELETE CASCADE,
    CONSTRAINT chk_saldo_favor_metodo CHECK (
        (metodo_pago = 'saldo_a_favor') = (id_saldo_favor IS NOT NULL)
    ),
    INDEX idx_abonos_cxp_cuenta (id_cuenta_pagar),
    INDEX idx_abonos_cxp_fecha  (fecha_abono)
) COMMENT='Abonos realizados sobre Cuentas_Por_Pagar. El trigger trg_after_abono_cxp actualiza valor_pagado y estado en CxP, y Saldo_A_Favor.monto_aplicado cuando metodo=saldo_a_favor.';


CREATE TABLE Cuentas_Por_Pagar_Relacion (
    id                  INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del enlace CxP ↔ dominio',
    id_cuenta_pagar     INT           NOT NULL                    COMMENT 'Cuenta por pagar vinculada a un registro del dominio — ver Cuentas_Por_Pagar',

    -- Exactamente UNA de estas FKs debe ser NOT NULL (CHECK garantiza):
    id_entrada          INT           NULL                        COMMENT 'Entrada de material asociada (pagos de material al minero o flete al transportador) — ver material_planta_entrada',
    id_viaje            INT           NULL                        COMMENT 'Viaje asociado (pagos de mulas o gastos de viaje) — ver Viaje',
    id_alquiler         INT           NULL                        COMMENT 'Alquiler asociado (pago de equipo o vehículo arrendado) — ver Alquileres',
    id_combustible      INT           NULL                        COMMENT 'Registro de combustible asociado (pago a la gasolinera) — ver Combustible',
    id_prestamo_emp     INT           NULL                        COMMENT 'Préstamo a empleado asociado (desembolso) — ver Prestamos_Empleados',
    id_prestamo_fin     INT           NULL                        COMMENT 'Préstamo financiero asociado (abono a banco o fondo de inversión) — ver Prestamos_Financieros',
    id_deposito         INT           NULL                        COMMENT 'Depósito asociado (fondeo de la caja menor de planta) — ver Deposito',
    id_anticipo         INT           NULL                        COMMENT 'Anticipo a tercero asociado (desembolso del anticipo) — ver Anticipos_Terceros',
    id_agua             INT           NULL                        COMMENT 'Suministro de agua asociado (pago al transportador de agua) — ver Agua_Planta',
    id_mula             INT           NULL                        COMMENT 'Despacho de mula asociado (pago al transportador de Barranquilla) — ver Mulas',
    id_analisis         INT           NULL                        COMMENT 'Análisis de laboratorio asociado (pago al laboratorio) — ver Analisis',
    id_excedente        INT           NULL                        COMMENT 'Excedente asociado (distribución del beneficio de la empresa al beneficiario) — ver Excedente',

    subtipo             ENUM('material','flete') NULL             COMMENT 'Solo cuando id_entrada IS NOT NULL: material=pago al minero por el mineral, flete=pago al dueño de volqueta por el acarreo',
    monto_aplicado      DECIMAL(14,2)                             COMMENT 'Porción de la CxP que corresponde a esta entidad específica en pesos',
    concepto            VARCHAR(255)                              COMMENT 'Descripción del vínculo (Ej: Pago volqueta 17 - Naum MINA 30, Flete roca entrada 8)',
    fecha               DATE          NOT NULL DEFAULT (CURRENT_DATE) COMMENT 'Fecha de registro del enlace',
    nota                VARCHAR(255)                              COMMENT 'Nota adicional (Ej: Descuento anticipo previo $300.000, Pago parcial acordado)',
    created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de creación del enlace',

    FOREIGN KEY (id_cuenta_pagar) REFERENCES Cuentas_Por_Pagar(id) ON DELETE CASCADE,
    FOREIGN KEY (id_entrada)      REFERENCES material_planta_entrada(id),
    FOREIGN KEY (id_viaje)        REFERENCES Viaje(id),
    FOREIGN KEY (id_alquiler)     REFERENCES Alquileres(id),
    FOREIGN KEY (id_combustible)  REFERENCES Combustible(id),
    FOREIGN KEY (id_prestamo_emp) REFERENCES Prestamos_Empleados(id),
    FOREIGN KEY (id_prestamo_fin) REFERENCES Prestamos_Financieros(id),
    FOREIGN KEY (id_deposito)     REFERENCES Deposito(id),
    FOREIGN KEY (id_anticipo)     REFERENCES Anticipos_Terceros(id),
    FOREIGN KEY (id_agua)         REFERENCES Agua_Planta(id),
    FOREIGN KEY (id_mula)         REFERENCES Mulas(id),
    FOREIGN KEY (id_analisis)     REFERENCES Analisis(id),
    FOREIGN KEY (id_excedente)    REFERENCES Excedente(id),

    CONSTRAINT chk_cxpr_exactamente_uno CHECK (
        (id_entrada      IS NOT NULL) + (id_viaje        IS NOT NULL) +
        (id_alquiler     IS NOT NULL) + (id_combustible   IS NOT NULL) +
        (id_prestamo_emp IS NOT NULL) + (id_prestamo_fin  IS NOT NULL) + (id_deposito      IS NOT NULL) +
        (id_anticipo     IS NOT NULL) + (id_agua          IS NOT NULL) +
        (id_mula         IS NOT NULL) + (id_analisis      IS NOT NULL) +
        (id_excedente    IS NOT NULL) = 1
    ),
    CONSTRAINT chk_cxpr_subtipo CHECK (
        subtipo IS NULL OR id_entrada IS NOT NULL
    ),
    INDEX idx_cxpr_cuenta    (id_cuenta_pagar),
    INDEX idx_cxpr_entrada   (id_entrada),
    INDEX idx_cxpr_excedente (id_excedente)
) COMMENT='Enlace CxP ↔ dominio con FK explícita por cada tabla. Reemplaza el diseño polimórfico de v3. El CHECK garantiza exactamente 1 FK activa por fila. subtipo diferencia si el pago de una entrada es por material (al minero) o por flete (al volquetero).';


-- FK diferida: Abonos_CxP.id_saldo_favor → Saldo_A_Favor (tabla creada en Módulo 13)
ALTER TABLE Abonos_CxP
    ADD CONSTRAINT fk_abonos_saldo_favor
    FOREIGN KEY (id_saldo_favor) REFERENCES Saldo_A_Favor(id) ON DELETE RESTRICT;


-- ====================================================================
--  MÓDULO 12 · CUENTAS POR COBRAR
-- ====================================================================

CREATE TABLE Cuentas_Por_Cobrar (
    id                INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único de la cuenta por cobrar',
    id_categoria      INT           NOT NULL                    COMMENT 'Tipo de cobro (Préstamo empleado, Combustible cargado, Anticipo recuperable, etc.) — ver Categorias_CxC',
    concepto          VARCHAR(255)  NOT NULL                    COMMENT 'Descripción de lo que se debe cobrar (Ej: Préstamo moto Mauricio Giraldo, Combustible adelantado Camilo)',
    id_empleado       INT           NULL                        COMMENT 'Empleado que le debe dinero a la empresa. Excluyente con los demás deudores — ver Empleados',
    id_minero         INT           NULL                        COMMENT 'Minero que le debe dinero a la empresa. Excluyente — ver Minero',
    id_dueno_volqueta INT           NULL                        COMMENT 'Dueño de volqueta que le debe dinero a la empresa. Excluyente — ver Dueno_Volqueta',
    id_proveedor      INT           NULL                        COMMENT 'Proveedor que le debe dinero a la empresa. Excluyente — ver Proveedores',
    valor_total       DECIMAL(14,2) NOT NULL                    COMMENT 'Monto total que el tercero debe a la empresa en pesos',
    valor_cobrado     DECIMAL(14,2) NOT NULL DEFAULT 0          COMMENT 'Total cobrado al tercero hasta la fecha. Actualizado por trigger trg_after_abono_cxc.',
    saldo             DECIMAL(14,2) AS (valor_total - valor_cobrado) STORED
                      COMMENT 'Saldo pendiente de cobrar (valor_total − valor_cobrado). Columna calculada automáticamente.',
    estado            ENUM('pendiente','parcial','cobrado','anulado') NOT NULL DEFAULT 'pendiente'
                      COMMENT 'Estado: pendiente=sin cobrar, parcial=cobrado en parte, cobrado=recuperado totalmente, anulado=cancelado',
    fecha_creacion    DATE          NOT NULL DEFAULT (CURRENT_DATE) COMMENT 'Fecha en que se originó la deuda del tercero',
    fecha_limite      DATE          NULL                        COMMENT 'Fecha límite pactada para recuperar el dinero (opcional)',
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de creación del registro',
    updated_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                      COMMENT 'Fecha y hora de la última actualización del registro',
    FOREIGN KEY (id_categoria)      REFERENCES Categorias_CxC(id),
    FOREIGN KEY (id_empleado)       REFERENCES Empleados(id),
    FOREIGN KEY (id_minero)         REFERENCES Minero(id),
    FOREIGN KEY (id_dueno_volqueta) REFERENCES Dueno_Volqueta(id),
    FOREIGN KEY (id_proveedor)      REFERENCES Proveedores(id),
    CONSTRAINT chk_cxc_un_deudor CHECK (
        (id_empleado IS NOT NULL) + (id_minero IS NOT NULL) +
        (id_dueno_volqueta IS NOT NULL) + (id_proveedor IS NOT NULL) <= 1
    ),
    INDEX idx_cxc_estado (estado),
    INDEX idx_cxc_fecha  (fecha_creacion)
) COMMENT='Lo que terceros deben a la empresa: préstamos a empleados, combustible adelantado a volqueteros, anticipos recuperables, excedentes reconocidos. Los cobros se registran en Abonos_CxC.';


CREATE TABLE Abonos_CxC (
    id              INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del cobro realizado a un tercero',
    id_cxc          INT           NOT NULL                    COMMENT 'Cuenta por cobrar a la que se aplica este cobro — ver Cuentas_Por_Cobrar',
    fecha_cobro     DATE          NOT NULL                    COMMENT 'Fecha en que se recibió el pago del tercero deudor',
    valor           DECIMAL(14,2) NOT NULL                    COMMENT 'Monto cobrado al tercero en pesos colombianos',
    metodo          ENUM('efectivo','transferencia','descuento_flete',
                         'descuento_nomina','otro') NOT NULL DEFAULT 'efectivo'
                    COMMENT 'Método de recaudo: efectivo, transferencia, descuento_flete (se rebaja del pago de flete), descuento_nomina (se rebaja del salario), otro',
    comprobante_url VARCHAR(512)                              COMMENT 'URL o ruta del comprobante del cobro recibido',
    observaciones   TEXT                                      COMMENT 'Notas adicionales o circunstancias del recaudo',
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro del cobro',
    FOREIGN KEY (id_cxc) REFERENCES Cuentas_Por_Cobrar(id) ON DELETE CASCADE,
    INDEX idx_abonos_cxc_cuenta (id_cxc),
    INDEX idx_abonos_cxc_fecha  (fecha_cobro)
) COMMENT='Cobros recibidos sobre Cuentas_Por_Cobrar. El trigger trg_after_abono_cxc actualiza valor_cobrado y estado. descuento_flete y descuento_nomina permiten el descuento automático en el momento del pago.';


CREATE TABLE Cuentas_Por_Cobrar_Relacion (
    id              INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del enlace CxC ↔ dominio',
    id_cxc          INT           NOT NULL                    COMMENT 'Cuenta por cobrar que se está vinculando al registro del dominio — ver Cuentas_Por_Cobrar',

    -- Exactamente UNA de estas FKs debe ser NOT NULL:
    id_prestamo_emp INT           NULL                        COMMENT 'Préstamo a empleado que originó esta CxC — ver Prestamos_Empleados',
    id_combustible  INT           NULL                        COMMENT 'Combustible cargado a crédito al dueño de volqueta — ver Combustible',
    id_anticipo     INT           NULL                        COMMENT 'Anticipo recuperable que originó esta CxC — ver Anticipos_Terceros',
    id_excedente    INT           NULL                        COMMENT 'Excedente reconocido como CxC de la empresa — ver Excedente',

    monto_aplicado  DECIMAL(14,2)                             COMMENT 'Porción del cobro que corresponde a esta entidad específica en pesos',
    concepto        VARCHAR(255)                              COMMENT 'Descripción del vínculo (Ej: Préstamo moto - cuota 1 de 4, Combustible adelantado semana 20)',
    fecha           DATE          NOT NULL DEFAULT (CURRENT_DATE) COMMENT 'Fecha de registro del enlace',
    nota            VARCHAR(255)                              COMMENT 'Nota adicional sobre la relación o acuerdos de cobro',
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de creación del enlace',

    FOREIGN KEY (id_cxc)          REFERENCES Cuentas_Por_Cobrar(id) ON DELETE CASCADE,
    FOREIGN KEY (id_prestamo_emp) REFERENCES Prestamos_Empleados(id),
    FOREIGN KEY (id_combustible)  REFERENCES Combustible(id),
    FOREIGN KEY (id_anticipo)     REFERENCES Anticipos_Terceros(id),
    FOREIGN KEY (id_excedente)    REFERENCES Excedente(id),

    CONSTRAINT chk_cxcr_exactamente_uno CHECK (
        (id_prestamo_emp IS NOT NULL) + (id_combustible IS NOT NULL) +
        (id_anticipo IS NOT NULL) + (id_excedente IS NOT NULL) = 1
    ),
    INDEX idx_cxcr_cxc (id_cxc)
) COMMENT='Enlace CxC ↔ dominio con FK explícita. Registra qué evento originó cada cuenta por cobrar. El CHECK garantiza exactamente 1 FK activa por fila, manteniendo integridad referencial sin diseño polimórfico.';


-- ====================================================================
--  MÓDULO 13 · SALDO A FAVOR (SOBREPAGO)
-- ====================================================================

CREATE TABLE Saldo_A_Favor (
    id                INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del crédito por sobrepago',
    origen            ENUM('pago_excedido','ajuste_manual') NOT NULL
                      COMMENT 'Origen: pago_excedido=valor_pagado superó valor_total en un Abono_CxP, ajuste_manual=corrección contable manual',
    id_abono_cxp_orig INT           NULL                        COMMENT 'Abono que generó el sobrepago cuando origen=pago_excedido — ver Abonos_CxP',

    -- Exactamente UNO de estos beneficiarios (CHECK garantiza):
    id_minero         INT           NULL                        COMMENT 'Minero que recibió de más y tiene crédito a su favor — ver Minero',
    id_dueno_volqueta INT           NULL                        COMMENT 'Dueño de volqueta que recibió de más y tiene crédito a su favor — ver Dueno_Volqueta',
    id_proveedor      INT           NULL                        COMMENT 'Proveedor que recibió de más y tiene crédito a su favor — ver Proveedores',
    id_empleado       INT           NULL                        COMMENT 'Empleado que recibió de más y tiene crédito a su favor — ver Empleados',

    id_cuenta_pagar   INT           NULL                        COMMENT 'Cuenta por pagar que fue sobrepagada, que originó este saldo a favor — ver Cuentas_Por_Pagar',

    monto_original    DECIMAL(14,2) NOT NULL                    COMMENT 'Monto pagado en exceso que quedó como crédito disponible para el tercero, en pesos',
    monto_aplicado    DECIMAL(14,2) NOT NULL DEFAULT 0          COMMENT 'Cuánto de este crédito ya fue usado (descontado en pago futuro) o devuelto por el tercero',
    saldo_disponible  DECIMAL(14,2) AS (monto_original - monto_aplicado) STORED
                      COMMENT 'Crédito disponible para aplicar (monto_original − monto_aplicado). Columna calculada automáticamente.',

    tipo_resolucion   ENUM('pendiente','descontar_futuro','devolucion') NOT NULL DEFAULT 'pendiente'
                      COMMENT 'Decisión: pendiente=sin decidir, descontar_futuro=se rebajará del próximo pago al tercero, devolucion=el tercero devolverá el dinero en efectivo',
    estado            ENUM('disponible','parcial','agotado','devuelto') NOT NULL DEFAULT 'disponible'
                      COMMENT 'Estado: disponible=crédito sin usar, parcial=usado parcialmente, agotado=consumido totalmente en descuentos, devuelto=el tercero devolvió el exceso',

    fecha             DATE          NOT NULL DEFAULT (CURRENT_DATE) COMMENT 'Fecha en que se detectó y registró el sobrepago o se creó el ajuste manual',
    descripcion       VARCHAR(255)                              COMMENT 'Descripción del error o motivo del ajuste (Ej: Error liquidación volqueta 42, Ajuste contable mes mayo)',
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de creación del registro',
    updated_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                      COMMENT 'Fecha y hora de la última actualización del registro',

    FOREIGN KEY (id_minero)         REFERENCES Minero(id),
    FOREIGN KEY (id_dueno_volqueta) REFERENCES Dueno_Volqueta(id),
    FOREIGN KEY (id_proveedor)      REFERENCES Proveedores(id),
    FOREIGN KEY (id_empleado)       REFERENCES Empleados(id),
    FOREIGN KEY (id_cuenta_pagar)   REFERENCES Cuentas_Por_Pagar(id),
    CONSTRAINT chk_saf_un_beneficiario CHECK (
        (id_minero IS NOT NULL) + (id_dueno_volqueta IS NOT NULL) +
        (id_proveedor IS NOT NULL) + (id_empleado IS NOT NULL) = 1
    ),
    INDEX idx_saf_minero    (id_minero),
    INDEX idx_saf_volqueta  (id_dueno_volqueta),
    INDEX idx_saf_proveedor (id_proveedor),
    INDEX idx_saf_estado    (estado)
) COMMENT='Créditos por sobrepago a un tercero. Cuando se paga de más, el exceso queda como saldo a favor. Se resuelve descontando del próximo pago (metodo=saldo_a_favor en Abonos_CxP) o con devolución del tercero.';


-- ====================================================================
--  MÓDULO 14 · VISTAS CALCULADAS
-- ====================================================================

CREATE VIEW v_estado_pago_material AS
SELECT
    mpe.id                                                         AS id_entrada,
    mn.nombre                                                      AS minero,
    mpe.precio_total                                               AS valor_total,
    COALESCE(SUM(ab.valor), 0)                                     AS total_pagado,
    GREATEST(mpe.precio_total - COALESCE(SUM(ab.valor), 0), 0)    AS saldo_pendiente,
    CASE
        WHEN COALESCE(SUM(ab.valor), 0) <= 0                THEN 'pendiente'
        WHEN COALESCE(SUM(ab.valor), 0) >= mpe.precio_total THEN 'pagado'
        ELSE 'parcial'
    END AS estado_pago
FROM      material_planta_entrada mpe
JOIN      Mina    mi ON mi.id  = mpe.id_mina
LEFT JOIN Minero  mn ON mn.id  = mi.id_minero
LEFT JOIN Cuentas_Por_Pagar_Relacion cpr
       ON cpr.id_entrada = mpe.id AND cpr.subtipo = 'material'
LEFT JOIN Cuentas_Por_Pagar cp  ON cp.id = cpr.id_cuenta_pagar AND cp.estado != 'anulado'
LEFT JOIN Abonos_CxP         ab ON ab.id_cuenta_pagar = cp.id
GROUP BY  mpe.id, mn.nombre, mpe.precio_total;


CREATE VIEW v_estado_pago_flete AS
SELECT
    mpe.id                                                            AS id_entrada,
    vv.placa,
    dv.nombre                                                         AS dueno_volqueta,
    mpe.costo_volqueta                                                AS valor_total,
    COALESCE(SUM(ab.valor), 0)                                        AS total_pagado,
    GREATEST(mpe.costo_volqueta - COALESCE(SUM(ab.valor), 0), 0)     AS saldo_pendiente,
    CASE
        WHEN COALESCE(SUM(ab.valor), 0) <= 0                  THEN 'pendiente'
        WHEN COALESCE(SUM(ab.valor), 0) >= mpe.costo_volqueta THEN 'pagado'
        ELSE 'parcial'
    END AS estado_pago
FROM      material_planta_entrada mpe
LEFT JOIN Volqueta_Vehiculo vv ON vv.id = mpe.id_vehiculo
LEFT JOIN Dueno_Volqueta    dv ON dv.id = vv.id_dueno_volqueta
LEFT JOIN Cuentas_Por_Pagar_Relacion cpr
       ON cpr.id_entrada = mpe.id AND cpr.subtipo = 'flete'
LEFT JOIN Cuentas_Por_Pagar cp  ON cp.id = cpr.id_cuenta_pagar AND cp.estado != 'anulado'
LEFT JOIN Abonos_CxP        ab  ON ab.id_cuenta_pagar = cp.id
GROUP BY  mpe.id, vv.placa, dv.nombre, mpe.costo_volqueta;


CREATE VIEW v_excedente_por_vehiculo AS
SELECT
    vv.id                                                             AS id_vehiculo,
    vv.placa,
    dv.nombre                                                         AS dueno,
    COUNT(e.id)                                                       AS num_excedentes,
    SUM(e.valor_excedente)                                            AS total_excedentes,
    SUM(e.monto_distribuido)                                          AS total_distribuido,
    SUM(e.saldo_por_distribuir)                                       AS pendiente_distribuir,
    SUM(CASE WHEN e.estado_distribucion = 'pendiente'   THEN 1 ELSE 0 END) AS pendientes,
    SUM(CASE WHEN e.estado_distribucion = 'parcial'     THEN 1 ELSE 0 END) AS parciales,
    SUM(CASE WHEN e.estado_distribucion = 'distribuido' THEN 1 ELSE 0 END) AS distribuidos
FROM      Volqueta_Vehiculo       vv
JOIN      Dueno_Volqueta          dv  ON dv.id  = vv.id_dueno_volqueta
JOIN      material_planta_entrada mpe ON mpe.id_vehiculo = vv.id
JOIN      Excedente               e   ON e.id_entrada    = mpe.id
GROUP BY  vv.id, vv.placa, dv.nombre;


CREATE VIEW v_excedente_empresa AS
SELECT
    e.id,
    e.id_entrada,
    mpe.fecha_llegada,
    mpe.numero_volqueta,
    mi.nombre               AS mina,
    mn.nombre               AS minero,
    vv.placa                AS vehiculo,
    dv.nombre               AS dueno_volqueta,
    mpe.excedente_calculado AS excedente_estimado,
    e.valor_excedente       AS excedente_registrado,
    e.monto_distribuido,
    e.saldo_por_distribuir,
    e.concepto,
    e.estado_distribucion,
    e.fecha_calculo
FROM      Excedente e
JOIN      material_planta_entrada mpe ON mpe.id = e.id_entrada
JOIN      Mina                   mi  ON mi.id   = mpe.id_mina
LEFT JOIN Minero                 mn  ON mn.id   = mi.id_minero
LEFT JOIN Volqueta_Vehiculo      vv  ON vv.id   = mpe.id_vehiculo
LEFT JOIN Dueno_Volqueta         dv  ON dv.id   = vv.id_dueno_volqueta;


CREATE VIEW v_saldos_a_favor_disponibles AS
SELECT
    saf.id,
    saf.tipo_resolucion,
    saf.estado,
    saf.monto_original,
    saf.monto_aplicado,
    saf.saldo_disponible,
    saf.fecha,
    saf.descripcion,
    COALESCE(mn.nombre, dv.nombre, pr.nombre, em.nombre) AS beneficiario,
    CASE
        WHEN saf.id_minero IS NOT NULL         THEN 'minero'
        WHEN saf.id_dueno_volqueta IS NOT NULL THEN 'volquetero'
        WHEN saf.id_proveedor IS NOT NULL      THEN 'proveedor'
        WHEN saf.id_empleado IS NOT NULL       THEN 'empleado'
    END AS tipo_beneficiario
FROM      Saldo_A_Favor  saf
LEFT JOIN Minero         mn  ON mn.id = saf.id_minero
LEFT JOIN Dueno_Volqueta dv  ON dv.id = saf.id_dueno_volqueta
LEFT JOIN Proveedores    pr  ON pr.id = saf.id_proveedor
LEFT JOIN Empleados      em  ON em.id = saf.id_empleado
WHERE saf.estado IN ('disponible','parcial');


CREATE VIEW v_mulas AS
SELECT
    m.*,
    tc.valor                                       AS pct_retencion,
    ROUND(m.valor * tc.valor / 100, 2)             AS retencion,
    m.valor - ROUND(m.valor * tc.valor / 100, 2)  AS abono_neto
FROM       Mulas           m
CROSS JOIN Tarifas_Calculo tc
WHERE      tc.codigo = 'retencion_mula_pct';


CREATE VIEW v_estado_alquileres AS
SELECT
    al.id, al.valor AS valor_total,
    COALESCE(SUM(ab.valor),0) AS total_pagado,
    GREATEST(al.valor - COALESCE(SUM(ab.valor),0), 0) AS saldo_pendiente,
    CASE WHEN COALESCE(SUM(ab.valor),0)<=0 THEN 'pendiente'
         WHEN COALESCE(SUM(ab.valor),0)>=al.valor THEN 'pagado' ELSE 'parcial' END AS estado_pago
FROM Alquileres al
LEFT JOIN Cuentas_Por_Pagar_Relacion cpr ON cpr.id_alquiler = al.id
LEFT JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar AND cp.estado!='anulado'
LEFT JOIN Abonos_CxP ab ON ab.id_cuenta_pagar = cp.id
GROUP BY al.id, al.valor;


CREATE VIEW v_estado_combustible AS
SELECT
    c.id, c.valor AS valor_total,
    COALESCE(SUM(ab.valor),0) AS total_pagado,
    GREATEST(c.valor - COALESCE(SUM(ab.valor),0), 0) AS saldo_pendiente,
    CASE WHEN COALESCE(SUM(ab.valor),0)<=0 THEN 'pendiente'
         WHEN COALESCE(SUM(ab.valor),0)>=c.valor THEN 'pagado' ELSE 'parcial' END AS estado_pago
FROM Combustible c
LEFT JOIN Cuentas_Por_Pagar_Relacion cpr ON cpr.id_combustible = c.id
LEFT JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar AND cp.estado!='anulado'
LEFT JOIN Abonos_CxP ab ON ab.id_cuenta_pagar = cp.id
GROUP BY c.id, c.valor;


CREATE VIEW v_estado_agua AS
SELECT
    ag.id, ag.valor_total,
    COALESCE(SUM(ab.valor),0) AS total_pagado,
    GREATEST(ag.valor_total - COALESCE(SUM(ab.valor),0), 0) AS saldo_pendiente,
    CASE WHEN COALESCE(SUM(ab.valor),0)<=0 THEN 'pendiente'
         WHEN COALESCE(SUM(ab.valor),0)>=ag.valor_total THEN 'pagado' ELSE 'parcial' END AS estado_pago
FROM Agua_Planta ag
LEFT JOIN Cuentas_Por_Pagar_Relacion cpr ON cpr.id_agua = ag.id
LEFT JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar AND cp.estado!='anulado'
LEFT JOIN Abonos_CxP ab ON ab.id_cuenta_pagar = cp.id
GROUP BY ag.id, ag.valor_total;


CREATE VIEW v_estado_mulas AS
SELECT
    m.id, m.valor AS valor_total,
    COALESCE(SUM(ab.valor),0) AS total_pagado,
    GREATEST(m.valor - COALESCE(SUM(ab.valor),0), 0) AS saldo_pendiente,
    CASE WHEN COALESCE(SUM(ab.valor),0)<=0 THEN 'pendiente'
         WHEN COALESCE(SUM(ab.valor),0)>=m.valor THEN 'pagado' ELSE 'parcial' END AS estado_pago
FROM Mulas m
LEFT JOIN Cuentas_Por_Pagar_Relacion cpr ON cpr.id_mula = m.id
LEFT JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar AND cp.estado!='anulado'
LEFT JOIN Abonos_CxP ab ON ab.id_cuenta_pagar = cp.id
GROUP BY m.id, m.valor;


CREATE VIEW v_saldo_prestamos_empleado AS
SELECT
    pe.id, pe.id_empleado, pe.valor AS monto_prestamo,
    COALESCE(SUM(ab.valor),0) AS total_abonado,
    GREATEST(pe.valor - COALESCE(SUM(ab.valor),0), 0) AS saldo_pendiente,
    CASE WHEN COALESCE(SUM(ab.valor),0)<=0 THEN 'pendiente'
         WHEN COALESCE(SUM(ab.valor),0)>=pe.valor THEN 'pagado' ELSE 'parcial' END AS estado
FROM Prestamos_Empleados pe
LEFT JOIN Cuentas_Por_Pagar_Relacion cpr ON cpr.id_prestamo_emp = pe.id
LEFT JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar AND cp.estado!='anulado'
LEFT JOIN Abonos_CxP ab ON ab.id_cuenta_pagar = cp.id
GROUP BY pe.id, pe.id_empleado, pe.valor;


-- 1. Vista de Análisis (Corregida la lógica del JOIN de la Mina)
CREATE OR REPLACE VIEW v_analisis_completo AS
SELECT
    a.*,
    COALESCE(a.id_mina,          mpe.id_mina)          AS id_mina_resuelto,
    COALESCE(a.id_minero,        mi.id_minero)         AS id_minero_resuelto,
    COALESCE(a.id_tipo_material, mpe.id_tipo_material) AS tipo_mat_resuelto
FROM      Analisis a
LEFT JOIN material_planta_entrada mpe ON mpe.id = a.id_entrada
-- CORRECCIÓN: La unión a Mina se debe hacer usando la función COALESCE para que atrape
-- el id_mina directo del análisis si no hay entrada.
LEFT JOIN Mina                    mi  ON mi.id = COALESCE(a.id_mina, mpe.id_mina);


-- 2. Ejemplo de corrección de Collation en las vistas de estado (Aplica a todas)
CREATE OR REPLACE VIEW v_estado_pago_material AS
SELECT
    mpe.id                                                         AS id_entrada,
    mn.nombre                                                      AS minero,
    mpe.precio_total                                               AS valor_total,
    COALESCE(SUM(ab.valor), 0)                                     AS total_pagado,
    GREATEST(mpe.precio_total - COALESCE(SUM(ab.valor), 0), 0)     AS saldo_pendiente,
    CASE
        WHEN COALESCE(SUM(ab.valor), 0) <= 0                THEN 'pendiente'
        WHEN COALESCE(SUM(ab.valor), 0) >= mpe.precio_total THEN 'pagado'
        ELSE 'parcial'
    END AS estado_pago
FROM      material_planta_entrada mpe
JOIN      Mina    mi ON mi.id  = mpe.id_mina
LEFT JOIN Minero  mn ON mn.id  = mi.id_minero
-- Forzamos el COLLATE en las cadenas de texto para evitar el choque con el servidor
LEFT JOIN Cuentas_Por_Pagar_Relacion cpr
       ON cpr.id_entrada = mpe.id AND cpr.subtipo = 'material' COLLATE utf8mb4_unicode_ci
LEFT JOIN Cuentas_Por_Pagar cp  
       ON cp.id = cpr.id_cuenta_pagar AND cp.estado != 'anulado' COLLATE utf8mb4_unicode_ci
LEFT JOIN Abonos_CxP         ab ON ab.id_cuenta_pagar = cp.id
GROUP BY  mpe.id, mn.nombre, mpe.precio_total;

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES   = 1;

-- ====================================================================
--  FIN DEL ESQUEMA v4  ·  54 tablas · 12 vistas  ·  CON COMENTARIOS
-- --------------------------------------------------------------------
--  Triggers pendientes (archivo separado triggers_v4.sql):
--   · trg_after_abono_cxp
--       → actualiza Cuentas_Por_Pagar.valor_pagado y estado
--       → actualiza Volqueta_Vehiculo.estado_pago cuando subtipo='flete'
--       → actualiza Saldo_A_Favor.monto_aplicado y estado cuando metodo='saldo_a_favor'
--   · trg_after_abono_cxc
--       → actualiza Cuentas_Por_Cobrar.valor_cobrado y estado
--   · trg_after_insert_mpe
--       → crea Inventario_Lotes automáticamente
--       → crea Excedente si excedente_calculado > 0
--   · trg_after_close_maquila
--       → distribuye costo_maquila en viaje_material.costo_maquila
--       → actualiza material_planta_entrada.costo_maquila por entrada
-- --------------------------------------------------------------------
--  Flujo de SOBREPAGO (resumen):
--   1. Se detecta: valor_pagado > valor_total en una CxP
--   2. INSERT Saldo_A_Favor (monto_original = exceso, beneficiario = quien recibió de más)
--   3a. Devolucion: UPDATE tipo_resolucion='devolucion', estado='devuelto'
--       + registrar ingreso en Deposito
--   3b. Descontar: próximo Abono_CxP con metodo='saldo_a_favor', id_saldo_favor = SAF.id
--       → trigger actualiza SAF.monto_aplicado y estado automáticamente
-- ====================================================================

-- ====================================================================
--  TRIGGERS (estado final v5)
-- ====================================================================
--
--  MAPA COMPLETO:
--  material_planta_entrada   INSERT         trg_after_insert_mpe                    OK sin cambios
--  material_planta_entrada   UPDATE         trg_after_update_mpe                    OK sin cambios
--  procesamiento_material    INSERT         trg_after_insert_procesamiento_material NUEVO
--  material_concentrado      BEFORE UPDATE  trg_before_update_material_concentrado  NUEVO
--  material_concentrado      AFTER UPDATE   trg_after_update_material_concentrado   NUEVO
--  viaje_material            BEFORE INSERT  trg_before_insert_viaje_material        NUEVO (calcula costo_maquila)
--  viaje_material            AFTER INSERT   trg_after_insert_viaje_material         MODIFICADO
--  viaje_material            DELETE         trg_after_delete_viaje_material         MODIFICADO
--  abonos_cxp                INSERT         trg_after_abono_cxp                     Pendiente
--  abonos_cxc                INSERT         trg_after_abono_cxc                     Pendiente
--
-- ====================================================================
DELIMITER $$

DROP TRIGGER IF EXISTS trg_after_insert_mpe$$
CREATE TRIGGER trg_after_insert_mpe
AFTER INSERT ON material_planta_entrada
FOR EACH ROW
BEGIN
    DECLARE v_id_lote   INT           DEFAULT NULL;
    DECLARE v_toneladas DECIMAL(10,4) DEFAULT 0;
    DECLARE v_condicion VARCHAR(10)   DEFAULT 'Humedo';

    SET v_toneladas = COALESCE(NEW.total_material_seco, NEW.peso_llegada_planta, 0);
    SET v_condicion = CASE WHEN NEW.porcentaje_humedad > 0 THEN 'Humedo' ELSE 'Seco' END;

    -- ── 1. Crear lote de inventario ──────────────────────────────
    IF NEW.id_mina IS NOT NULL AND NEW.id_tipo_material IS NOT NULL AND v_toneladas > 0 THEN

        INSERT INTO Inventario_Lotes (
            id_entrada, id_mina, id_tipo_material,
            condicion_material, porcentaje_humedad,
            toneladas_iniciales, toneladas_disponibles,
            estado, fecha_ingreso
        ) VALUES (
            NEW.id, NEW.id_mina, NEW.id_tipo_material,
            v_condicion, NEW.porcentaje_humedad,
            v_toneladas, v_toneladas,
            'almacenado', NOW()
        );

        SET v_id_lote = LAST_INSERT_ID();

        -- ── 2. Kardex: movimiento de entrada ─────────────────────
        INSERT INTO Kardex_Movimientos (
            id_lote, fecha, tipo_movimiento,
            toneladas_movidas, destino_referencia
        ) VALUES (
            v_id_lote, NOW(), 'ENTRADA_PLANTA',
            v_toneladas,
            CONCAT('Entrada MPE #', NEW.id, ' | Vol:', NEW.numero_volqueta,
                   ' | ', NEW.fecha_llegada)
        );

    END IF;

    -- ── 3. Crear Excedente si hay ganancia calculada ─────────────
    IF NEW.excedente_calculado IS NOT NULL AND NEW.excedente_calculado > 0 THEN
        INSERT INTO Excedente (
            id_entrada, valor_excedente, monto_distribuido,
            fecha_calculo, concepto, estado_distribucion
        ) VALUES (
            NEW.id, NEW.excedente_calculado, 0,
            NEW.fecha_llegada,
            CONCAT('Auto-generado — MPE #', NEW.id),
            'pendiente'
        );
    END IF;
END$$

-- ====================================================================
--  TRIGGER 1 de 2 — trg_after_update_mpe
-- ====================================================================
--  Dispara : AFTER UPDATE ON material_planta_entrada
--  Cuándo  : Solo cuando total_material_seco cambia de 0/NULL a un
--             valor real (FASE 3: backend vincula el análisis)
--  Qué hace:
--    1. Busca el lote de inventario_lotes de esa entrada
--    2a. Si el lote NO ha tenido salidas todavía (toneladas_disponibles
--        == toneladas_iniciales): corrige ambas al peso seco real
--    2b. Si ya hubo salidas parciales: solo actualiza la condición y
--        el porcentaje de humedad (las toneladas salidas ya son reales)
--    3. Escribe un Kardex de AJUSTE_MERMA explicando la corrección
--       (peso bruto → peso seco)
--
--  Ejemplo:
--    MPE id=5, peso_llegada=12.0 ton, humedad=13%
--    FASE 1 → inventario crea lote con 12.0 ton
--    FASE 3 → total_material_seco = 10.44 ton (12 × 0.87)
--    Este trigger → lote se corrige a 10.44 ton, kardex registra -1.56 ton
-- ====================================================================

DROP TRIGGER IF EXISTS trg_after_update_mpe$$
CREATE TRIGGER trg_after_update_mpe
AFTER UPDATE ON material_planta_entrada
FOR EACH ROW
BEGIN
    DECLARE v_id_lote     INT           DEFAULT NULL;
    DECLARE v_ton_ini     DECIMAL(10,4) DEFAULT 0;
    DECLARE v_ton_disp    DECIMAL(10,4) DEFAULT 0;
    DECLARE v_ton_nuevo   DECIMAL(10,4) DEFAULT 0;
    DECLARE v_condicion   VARCHAR(10)   DEFAULT 'Seco';
    DECLARE v_diferencia  DECIMAL(10,4) DEFAULT 0;

    -- Solo dispara cuando total_material_seco pasa de 0/NULL a un valor real
    -- (es decir, cuando FASE 3 actualiza con el dato del análisis)
    IF ( OLD.total_material_seco IS NULL OR OLD.total_material_seco = 0 )
       AND NEW.total_material_seco IS NOT NULL
       AND NEW.total_material_seco > 0
    THEN

        SET v_ton_nuevo = NEW.total_material_seco;
        SET v_condicion = CASE
            WHEN NEW.porcentaje_humedad > 0 THEN 'Humedo'
            ELSE 'Seco'
        END;

        -- Buscar el lote activo de esta entrada
        SELECT id, toneladas_iniciales, toneladas_disponibles
        INTO   v_id_lote, v_ton_ini, v_ton_disp
        FROM   inventario_lotes
        WHERE  id_entrada = NEW.id
        ORDER BY id DESC
        LIMIT  1;

        IF v_id_lote IS NOT NULL THEN

            -- ── Caso A: Sin salidas todavía → corregir todo ──────
            IF v_ton_disp = v_ton_ini THEN

                SET v_diferencia = v_ton_ini - v_ton_nuevo;  -- cuánto se "pierde" de bruto a seco

                UPDATE inventario_lotes
                SET
                    toneladas_iniciales   = v_ton_nuevo,
                    toneladas_disponibles = v_ton_nuevo,
                    condicion_material    = v_condicion,
                    porcentaje_humedad    = NEW.porcentaje_humedad
                WHERE id = v_id_lote;

                -- Kardex: corrección de peso bruto a seco
                INSERT INTO kardex_movimientos (
                    id_lote, fecha, tipo_movimiento,
                    toneladas_movidas, destino_referencia, comentarios
                ) VALUES (
                    v_id_lote, NOW(), 'AJUSTE_MERMA',
                    ABS(v_diferencia),
                    CONCAT('Corrección bruto→seco tras análisis. MPE #', NEW.id),
                    CONCAT('Anterior (bruto): ', v_ton_ini,
                           ' t  →  Nuevo (seco): ', v_ton_nuevo,
                           ' t  |  Humedad: ', ROUND(NEW.porcentaje_humedad * 100, 2), '%')
                );

            -- ── Caso B: Ya hubo salidas → solo actualizar metadata ─
            ELSE
                -- Las toneladas ya salieron proporcional al bruto;
                -- solo corregimos la condición y humedad, no el saldo
                UPDATE inventario_lotes
                SET
                    condicion_material = v_condicion,
                    porcentaje_humedad = NEW.porcentaje_humedad
                WHERE id = v_id_lote;

                -- Kardex informativo: análisis llegó tardío
                INSERT INTO kardex_movimientos (
                    id_lote, fecha, tipo_movimiento,
                    toneladas_movidas, destino_referencia, comentarios
                ) VALUES (
                    v_id_lote, NOW(), 'AJUSTE_MERMA',
                    0,
                    CONCAT('Análisis tardío MPE #', NEW.id, ' — lote ya tiene salidas'),
                    CONCAT('Análisis registrado con salidas previas. ',
                           'Saldo disponible se mantiene en ', v_ton_disp, ' t. ',
                           'Revisar manualmente si hay discrepancia.')
                );

            END IF;

        END IF;

    END IF;
END$$

-- ────────────────────────────────────────────────────────────────────
-- trg_after_insert_procesamiento_material
-- Cuando un camion entra al batch de proceso:
--   inventario raw -> en_proceso + kardex SALIDA_PROCESO + MPE.estado='en_proceso'
-- ────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_after_insert_procesamiento_material$$
CREATE TRIGGER trg_after_insert_procesamiento_material
AFTER INSERT ON procesamiento_material
FOR EACH ROW
BEGIN
    DECLARE v_id_lote INT DEFAULT NULL;
    SELECT id INTO v_id_lote FROM Inventario_Lotes
    WHERE id_entrada=NEW.id_entrada AND estado IN ('almacenado','en_proceso')
    ORDER BY id DESC LIMIT 1;
    IF v_id_lote IS NOT NULL THEN
        UPDATE Inventario_Lotes SET estado='en_proceso' WHERE id=v_id_lote;
        INSERT INTO Kardex_Movimientos (id_lote,fecha,tipo_movimiento,toneladas_movidas,destino_referencia)
        VALUES (v_id_lote,NOW(),'SALIDA_PROCESO',NEW.toneladas_aportadas,
                CONCAT('Concentrado #',NEW.id_material_concentrado));
    END IF;
    UPDATE material_planta_entrada SET estado='en_proceso'
    WHERE id=NEW.id_entrada AND estado NOT IN ('cancelada','incluida_viaje');
END$$


-- ────────────────────────────────────────────────────────────────────
-- trg_before_update_material_concentrado
-- Al cerrar el batch (en_proceso -> en_canoa):
--   Calcula precio_maquila_por_ton y maquila_total leyendo tarifas_proceso
--   (NO puede hacer UPDATE a su propia tabla, por eso es BEFORE)
-- Logica:
--   molienda + filtroprensa           -> PROCESO_NORMAL  ($400k/ton)
--   molienda + relave + filtroprensa  -> PROCESO_RELAVE  ($560k/ton)
--   solo filtroprensa                 -> SOLO_FILTROPRENSA ($100k/ton)
--   ninguno                           -> $0/ton
-- ────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_before_update_material_concentrado$$
CREATE TRIGGER trg_before_update_material_concentrado
BEFORE UPDATE ON material_concentrado
FOR EACH ROW
BEGIN
    DECLARE v_pn     DECIMAL(14,2) DEFAULT 400000;
    DECLARE v_pr     DECIMAL(14,2) DEFAULT 560000;
    DECLARE v_ps     DECIMAL(14,2) DEFAULT 100000;
    DECLARE v_precio DECIMAL(14,2) DEFAULT 0;
    IF OLD.estado='en_proceso' AND NEW.estado='en_canoa'
       AND NEW.toneladas_seco IS NOT NULL AND NEW.toneladas_seco > 0
    THEN
        SELECT valor INTO v_pn FROM tarifas_proceso
        WHERE codigo='PROCESO_NORMAL'    AND activo=1 ORDER BY fecha_desde DESC LIMIT 1;
        SELECT valor INTO v_pr FROM tarifas_proceso
        WHERE codigo='PROCESO_RELAVE'    AND activo=1 ORDER BY fecha_desde DESC LIMIT 1;
        SELECT valor INTO v_ps FROM tarifas_proceso
        WHERE codigo='SOLO_FILTROPRENSA' AND activo=1 ORDER BY fecha_desde DESC LIMIT 1;
        SET v_precio = CASE
            WHEN NEW.hizo_molienda=1 AND NEW.hizo_filtroprensa=1 AND NEW.hizo_relave=1 THEN v_pr
            WHEN NEW.hizo_molienda=1 AND NEW.hizo_filtroprensa=1                       THEN v_pn
            WHEN NEW.hizo_filtroprensa=1                                               THEN v_ps
            ELSE 0
        END;
        SET NEW.precio_maquila_por_ton = v_precio;
        SET NEW.maquila_total          = v_precio * NEW.toneladas_seco;
    END IF;
END$$


-- ────────────────────────────────────────────────────────────────────
-- trg_after_update_material_concentrado
-- Al cerrar el batch (en_proceso -> en_canoa):
--   1. Crea inventario_lotes para el concentrado
--   2. kardex ENTRADA_CONCENTRADO
--   3. Inventario raw -> agotado
--   4. Distribuye maquila a procesamiento_material y MPE.costo_maquila
-- ────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_after_update_material_concentrado$$
CREATE TRIGGER trg_after_update_material_concentrado
AFTER UPDATE ON material_concentrado
FOR EACH ROW
BEGIN
    DECLARE v_id_lote_conc INT DEFAULT NULL;
    DECLARE v_total_seco   DECIMAL(10,4) DEFAULT 0;
    IF OLD.estado='en_proceso' AND NEW.estado='en_canoa'
       AND NEW.toneladas_seco IS NOT NULL AND NEW.toneladas_seco > 0
    THEN
        INSERT INTO Inventario_Lotes (
            id_entrada, id_material_concentrado, id_mina, id_tipo_material,
            condicion_material, porcentaje_humedad,
            toneladas_iniciales, toneladas_disponibles, estado, ubicacion, fecha_ingreso
        ) VALUES (
            NULL, NEW.id, NULL, 1,
            CASE WHEN COALESCE(NEW.porcentaje_humedad,0)>0 THEN 'Humedo' ELSE 'Seco' END,
            COALESCE(NEW.porcentaje_humedad,0),
            NEW.toneladas_seco, NEW.toneladas_seco,
            'almacenado', COALESCE(NEW.ubicacion_canoa,'Canoa principal'), NOW()
        );
        SET v_id_lote_conc = LAST_INSERT_ID();
        INSERT INTO Kardex_Movimientos (id_lote,fecha,tipo_movimiento,toneladas_movidas,destino_referencia)
        VALUES (v_id_lote_conc,NOW(),'ENTRADA_CONCENTRADO',NEW.toneladas_seco,CONCAT('Lote ',NEW.codigo));
        UPDATE Inventario_Lotes il
        INNER JOIN procesamiento_material pm ON pm.id_entrada=il.id_entrada
        SET il.estado='agotado'
        WHERE pm.id_material_concentrado=NEW.id AND il.id_entrada IS NOT NULL;
        IF COALESCE(NEW.maquila_total,0) > 0 THEN
            SELECT COALESCE(SUM(toneladas_seco_aportadas),0) INTO v_total_seco
            FROM procesamiento_material WHERE id_material_concentrado=NEW.id;
            IF v_total_seco > 0 THEN
                UPDATE procesamiento_material
                SET concentrado_proporcional=ROUND((toneladas_seco_aportadas/v_total_seco)*NEW.toneladas_seco,4),
                    maquila_proporcional=ROUND((toneladas_seco_aportadas/v_total_seco)*NEW.maquila_total,2)
                WHERE id_material_concentrado=NEW.id;
                UPDATE material_planta_entrada mpe
                INNER JOIN procesamiento_material pm ON pm.id_entrada=mpe.id
                SET mpe.costo_maquila=pm.maquila_proporcional
                WHERE pm.id_material_concentrado=NEW.id;
            END IF;
        END IF;
    END IF;
END$$


-- ────────────────────────────────────────────────────────────────────
-- trg_before_insert_viaje_material
-- Calcula costo_maquila de la linea antes de insertar:
--   es_remanente=1        -> costo_maquila=0 (ya se pago en el viaje de origen)
--   id_material_concentrado -> proporcional a concentrado_seco / mc.toneladas_seco
--   sin concentrado       -> costo_maquila=0
-- ────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_before_insert_viaje_material$$
CREATE TRIGGER trg_before_insert_viaje_material
BEFORE INSERT ON viaje_material
FOR EACH ROW
BEGIN
    DECLARE v_maquila_total DECIMAL(14,2) DEFAULT 0;
    DECLARE v_ton_seco      DECIMAL(10,4) DEFAULT 0;

    IF NEW.es_remanente = 1 THEN
        SET NEW.costo_maquila = 0;
    ELSEIF NEW.id_material_concentrado IS NOT NULL THEN
        SELECT maquila_total, toneladas_seco
        INTO   v_maquila_total, v_ton_seco
        FROM   material_concentrado WHERE id=NEW.id_material_concentrado;
        IF v_ton_seco > 0 AND v_maquila_total > 0 THEN
            SET NEW.costo_maquila = ROUND(
                (COALESCE(NEW.concentrado_seco,0) / v_ton_seco) * v_maquila_total, 2
            );
        ELSE
            SET NEW.costo_maquila = 0;
        END IF;
    END IF;
END$$


-- ────────────────────────────────────────────────────────────────────
-- trg_after_insert_viaje_material
-- Despues de insertar la linea del viaje:
--   1. Decrementa material_concentrado.toneladas_disponibles
--   2. Actualiza inventario_lotes del concentrado
--   3. kardex SALIDA_VIAJE
--   4. Si el lote se agoto -> MPEs a 'incluida_viaje'
--   5. Actualiza viaje.maquila = SUM(costo_maquila) de todas las lineas
-- ────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_after_insert_viaje_material$$
CREATE TRIGGER trg_after_insert_viaje_material
AFTER INSERT ON viaje_material
FOR EACH ROW
BEGIN
    DECLARE v_id_lote_conc INT           DEFAULT NULL;
    DECLARE v_disp         DECIMAL(10,4) DEFAULT 0;
    DECLARE v_seco         DECIMAL(10,4) DEFAULT 0;

    SET v_seco=COALESCE(NEW.concentrado_seco,0);

    IF NEW.id_material_concentrado IS NOT NULL AND v_seco>0 AND NEW.es_remanente=0 THEN
        SELECT GREATEST(toneladas_disponibles-v_seco,0) INTO v_disp
        FROM material_concentrado WHERE id=NEW.id_material_concentrado;
        UPDATE material_concentrado SET toneladas_disponibles=v_disp,
            estado=CASE WHEN v_disp<=0 THEN 'enviado_completo' ELSE 'parcialmente_enviado' END
        WHERE id=NEW.id_material_concentrado;
        SELECT id INTO v_id_lote_conc FROM Inventario_Lotes
        WHERE id_material_concentrado=NEW.id_material_concentrado AND estado!='agotado'
        ORDER BY id DESC LIMIT 1;
        IF v_id_lote_conc IS NOT NULL THEN
            UPDATE Inventario_Lotes SET toneladas_disponibles=v_disp,
                estado=CASE WHEN v_disp<=0 THEN 'agotado' ELSE estado END WHERE id=v_id_lote_conc;
            INSERT INTO Kardex_Movimientos (id_lote,fecha,tipo_movimiento,toneladas_movidas,destino_referencia)
            VALUES (v_id_lote_conc,NOW(),'SALIDA_VIAJE',v_seco,CONCAT('Viaje #',NEW.id_viaje));
        END IF;
        IF v_disp<=0 THEN
            UPDATE material_planta_entrada mpe
            INNER JOIN procesamiento_material pm ON pm.id_entrada=mpe.id
            SET mpe.estado='incluida_viaje'
            WHERE pm.id_material_concentrado=NEW.id_material_concentrado AND mpe.estado NOT IN ('cancelada');
        END IF;
    END IF;

    -- Actualizar totales del viaje
    UPDATE Viaje SET
        maquila = (SELECT COALESCE(SUM(vm2.costo_maquila),0) FROM viaje_material vm2 WHERE vm2.id_viaje=NEW.id_viaje),
        total_costo_material = (SELECT COALESCE(SUM(vm2.valor_total_con_gastos),0) FROM viaje_material vm2 WHERE vm2.id_viaje=NEW.id_viaje)
    WHERE id=NEW.id_viaje;
END$$


-- ────────────────────────────────────────────────────────────────────
-- trg_after_delete_viaje_material
-- Reversa: devuelve concentrado al lote y actualiza totales del viaje
-- ────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_after_delete_viaje_material$$
CREATE TRIGGER trg_after_delete_viaje_material
AFTER DELETE ON viaje_material
FOR EACH ROW
BEGIN
    DECLARE v_id_lote_conc INT           DEFAULT NULL;
    DECLARE v_ton_ini      DECIMAL(10,4) DEFAULT 0;
    DECLARE v_seco         DECIMAL(10,4) DEFAULT 0;
    DECLARE v_en_otro      INT           DEFAULT 0;
    SET v_seco=COALESCE(OLD.concentrado_seco,0);
    IF OLD.id_material_concentrado IS NOT NULL AND v_seco>0 THEN
        SELECT id,toneladas_iniciales INTO v_id_lote_conc,v_ton_ini
        FROM Inventario_Lotes WHERE id_material_concentrado=OLD.id_material_concentrado
        ORDER BY id DESC LIMIT 1;
        IF v_id_lote_conc IS NOT NULL THEN
            UPDATE Inventario_Lotes
            SET toneladas_disponibles=LEAST(toneladas_disponibles+v_seco,v_ton_ini), estado='almacenado'
            WHERE id=v_id_lote_conc;
            INSERT INTO Kardex_Movimientos (id_lote,fecha,tipo_movimiento,toneladas_movidas,destino_referencia)
            VALUES (v_id_lote_conc,NOW(),'AJUSTE_MERMA',v_seco,CONCAT('Devolucion Viaje #',OLD.id_viaje));
        END IF;
        UPDATE material_concentrado SET toneladas_disponibles=toneladas_disponibles+v_seco,
            estado='parcialmente_enviado' WHERE id=OLD.id_material_concentrado;
        SELECT COUNT(*) INTO v_en_otro FROM viaje_material WHERE id_material_concentrado=OLD.id_material_concentrado;
        IF v_en_otro=0 THEN UPDATE material_concentrado SET estado='en_canoa' WHERE id=OLD.id_material_concentrado; END IF;
    END IF;
    -- Recalcular totales del viaje
    UPDATE Viaje SET
        maquila = (SELECT COALESCE(SUM(vm2.costo_maquila),0) FROM viaje_material vm2 WHERE vm2.id_viaje=OLD.id_viaje),
        total_costo_material = (SELECT COALESCE(SUM(vm2.valor_total_con_gastos),0) FROM viaje_material vm2 WHERE vm2.id_viaje=OLD.id_viaje)
    WHERE id=OLD.id_viaje;
END$$

DELIMITER ;