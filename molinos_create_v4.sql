-- ====================================================================
--  SISTEMA ERP — MOLINOS DE COLOMBIA  ·  ESQUEMA v4
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
--   · Categorias_CxC              — tipos de cuentas por cobrar
--   · Cuentas_Por_Cobrar          — lo que terceros deben a la empresa
--   · Abonos_CxC                  — cobros recibidos
--   · Cuentas_Por_Cobrar_Relacion — FK explícitas al dominio de CxC
--   · Saldo_A_Favor               — crédito por sobrepago a un tercero
--     (Error de pago: se pagó de más a minero/volquetero/proveedor)
--
--  CAMBIO DE ARQUITECTURA — Cuentas_Por_Pagar_Relacion:
--   · Antes: polimórfico (tipo_entidad ENUM + id_entidad genérico)
--   · Ahora: FK explícita por cada tabla de dominio (13 columnas
--     nullable) + CHECK garantiza exactamente 1 no nulo por fila.
--
--  EXCEDENTE (integrado en la misma tabla, sin Caja_Excedente aparte):
--   · +monto_distribuido, +estado_distribucion
--   · La distribución se registra en Cuentas_Por_Pagar con id_excedente
--     en Cuentas_Por_Pagar_Relacion.
--
--  OTRAS MODIFICACIONES:
--   · Mina: eliminado id_tipo_material (zona ≠ tipo; muchos materiales posibles)
--   · material_planta_entrada: eliminado id_minero (deriva de id_mina→Mina),
--     añadido estado_pago_flete
--   · Combustible: añadidos tipo_consumo (vehiculo/planta/maquinaria/otro)
--     e id_planta para diferenciar tambores de planta vs tanqueo de vehículo
--   · Maquila: añadido campo descripcion; costo_maquila entra en viaje_material
--   · viaje_material: +costo_maquila (asignación proporcional por entrada)
--   · Abonos_CxP: +id_saldo_favor para pagos por crédito de sobrepago
--
--  SOBREPAGO:
--   · Cuando se paga de más → Saldo_A_Favor
--   · Se aplica en futuros Abonos_CxP (metodo='saldo_a_favor')
--   · Ver Módulo 13
--
--  Tablas totales: 52  |  Vistas: 12
-- ====================================================================

CREATE DATABASE IF NOT EXISTS molinos_erp_v4
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE molinos_erp_v4;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES   = 0;


-- ====================================================================
--  MÓDULO 1 · CATÁLOGOS
-- ====================================================================

CREATE TABLE Planta (
    id        INT          AUTO_INCREMENT PRIMARY KEY,
    nombre    VARCHAR(150) NOT NULL,
    ubicacion VARCHAR(255)
) COMMENT='Instalaciones de procesamiento';

CREATE TABLE Planta_Procesos (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    planta_id   INT NOT NULL,
    nombre      VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    activo      BOOLEAN DEFAULT TRUE,
    
    -- Llave foránea para vincular el proceso a una sede física
    FOREIGN KEY (planta_id) REFERENCES Planta(id) ON DELETE CASCADE,
    INDEX idx_procesos_planta (planta_id)
) COMMENT='Áreas de trabajo o procesos específicos dentro de cada planta';


CREATE TABLE Materiales (
    id            INT          AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(150) NOT NULL,
    descripcion   VARCHAR(255),
    unidad_medida VARCHAR(50)
) COMMENT='Catálogo de minerales (uso en cotizaciones)';

CREATE TABLE Tipos_Material (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(50)  NOT NULL UNIQUE,
    descripcion VARCHAR(150)
) COMMENT='Tipos de material para inventario y entradas';

INSERT INTO Tipos_Material (nombre, descripcion) VALUES
('Concentrado','Material procesado con alto contenido de mineral'),
('Roca',       'Material bruto extraído directamente de la mina'),
('Lamas',      'Material fino y húmedo producto del lavado'),
('Relave',     'Desecho sólido del proceso de beneficio'),
('Lodos',      'Material con alta concentración de agua'),
('Otro',       'Material que no encaja en las categorías existentes');

CREATE TABLE Tipos_Gasto_Operativo (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(50)  NOT NULL UNIQUE,
    descripcion VARCHAR(150)
) COMMENT='Tipos de gasto operativo (caja menor)';

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
    id          INT         AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(50) NOT NULL,
    hora_inicio TIME        NOT NULL,
    hora_fin    TIME        NOT NULL
) COMMENT='Horarios de operación';

INSERT INTO Tipos_Turno (nombre, hora_inicio, hora_fin) VALUES
('TURNO 1','06:00:00','14:00:00'),
('TURNO 2','14:00:00','22:00:00'),
('TURNO 3','22:00:00','06:00:00');

CREATE TABLE Tipos_Alquiler (
    id     INT          AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
) COMMENT='Clasificación de alquileres';

INSERT INTO Tipos_Alquiler (nombre) VALUES
('Vehículos y Transporte'),('Maquinaria Pesada'),('Herramientas y Equipos');

CREATE TABLE Tipos_Analisis (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(50)  NOT NULL UNIQUE,
    descripcion VARCHAR(150)
) COMMENT='Tipos de análisis de laboratorio';

INSERT INTO Tipos_Analisis (nombre, descripcion) VALUES
('Cabeza',            'Análisis de entrada. Define tenor y humedad oficiales'),
('Concentrado',       'Análisis del concentrado obtenido'),
('Colas',             'Análisis de las colas o relaves'),
('Concentrado_Colas', 'Concentrado obtenido al reprocesar colas'),
('Colas_Colas',       'Colas resultantes de reprocesar colas');

CREATE TABLE Categorias_Proveedor (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255)
) COMMENT='Clasificación de proveedores';

INSERT INTO Categorias_Proveedor (nombre, descripcion) VALUES
('Dotación','Ropa, calzado y EPP'),
('Laboratorio','Servicios de análisis de minerales'),
('Combustible','Estaciones de servicio / gasolineras'),
('Maquinaria','Alquiler o mantenimiento de equipos pesados'),
('Procesamiento','Plantas externas de maquila'),
('Transporte_Mula','Empresa transportadora de salida a Barranquilla'),
('Quimicos','Insumos químicos y reactivos'),
('Otro','Proveedor no clasificado');

-- v4: renombrada de Categorias_Pago. Excedente ELIMINADO (es ingreso, no pago).
CREATE TABLE Categorias_CxP (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    color       VARCHAR(10)
) COMMENT='Tipos de Cuenta por Pagar. Excedente removido (es ingreso de la empresa).';

INSERT INTO Categorias_CxP (nombre, descripcion, color) VALUES
('Material',           'Pago al minero por el material entregado',          '#1D9E75'),
('Flete volqueta',     'Pago al dueño de volqueta por el acarreo',          '#0F6E56'),
('Deuda proveedor',    'Abono a deuda histórica de un tercero',             '#E24B4A'),
('Maquila',            'Pago a planta externa por procesamiento',           '#378ADD'),
('Cargue',             'Pago por servicio de cargue',                       '#7F77DD'),
('Báscula',            'Pago por pesaje en báscula',                        '#7F77DD'),
('Combustible',        'Pago a la gasolinera (ACPM/gasolina)',              '#D85A30'),
('Agua',               'Pago de agua a la planta',                          '#85B7EB'),
('Mula',               'Pago a la transportadora de salida (Barranquilla)', '#534AB7'),
('Análisis',           'Pago al laboratorio por análisis',                  '#97C459'),
('Alquiler',           'Pago por alquiler de maquinaria/vehículos',         '#888780'),
('Nómina',             'Pago de salarios y jornales',                       '#639922'),
('Préstamo empleado',  'Desembolso de un préstamo a empleado',              '#D4537E'),
('Préstamo financiero','Abono de obligación financiera (banco)',             '#A32D2D'),
('Gasto de viaje',     'Gastos de viaje distintos de la maquila',           '#5C6BC0'),
('Anticipo',           'Desembolso de anticipo a tercero',                  '#EF9F27'),
('Compra proveedor',   'Compra o servicio directo a un proveedor',          '#6D8B3C'),
('Distribución excedente','Distribución de excedente de la empresa',        '#BA7517'),
('Devolución sobrepago','Reintegro al tercero por pago en exceso',          '#E24B4A'),
('Otro',               'Gasto no clasificado',                              '#888780');

-- v4: nuevo catálogo para Cuentas por Cobrar
CREATE TABLE Categorias_CxC (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    color       VARCHAR(10)
) COMMENT='Tipos de Cuenta por Cobrar';

INSERT INTO Categorias_CxC (nombre, descripcion, color) VALUES
('Préstamo empleado',    'Dinero prestado al personal a descontar de nómina',     '#D4537E'),
('Combustible cargado',  'Combustible adelantado a dueño de volqueta',            '#D85A30'),
('Anticipo recuperable', 'Anticipo entregado a tercero que debe recuperarse',      '#EF9F27'),
('Excedente empresa',    'Excedente generado por una entrada (ingreso)',           '#1D9E75'),
('Otro cobro',           'Cobro no categorizado',                                 '#888780');

CREATE TABLE Tarifas_Calculo (
    id            INT           AUTO_INCREMENT PRIMARY KEY,
    codigo        VARCHAR(50)   NOT NULL UNIQUE,
    valor         DECIMAL(14,2) NOT NULL,
    descripcion   VARCHAR(150),
    vigente_desde DATE          NOT NULL DEFAULT (CURRENT_DATE),
    updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT='Tarifas globales de cálculo';

INSERT INTO Tarifas_Calculo (codigo, valor, descripcion) VALUES
('flete_ton_seca',     100000, 'Flete por tonelada seca (fallback si mina sin zona)'),
('retencion_mula_pct', 1.00,   'Porcentaje de retención sobre valor mulas');


-- ====================================================================
--  MÓDULO 2 · ZONAS Y TARIFAS
-- ====================================================================

CREATE TABLE Zona (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL UNIQUE,
    descripcion VARCHAR(255),
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) COMMENT='Zonas geográficas de origen';

INSERT INTO Zona (nombre, descripcion) VALUES
('Sin zona','Pendiente de asignar');

CREATE TABLE Tarifa_Zona (
    id             INT           AUTO_INCREMENT PRIMARY KEY,
    id_zona        INT           NOT NULL,
    valor_tonelada DECIMAL(14,2) NOT NULL,
    vigente_desde  DATE          NOT NULL DEFAULT (CURRENT_DATE),
    vigente_hasta  DATE          NULL,
    activo         BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_zona) REFERENCES Zona(id),
    INDEX idx_tarifa_zona (id_zona, activo)
);


-- ====================================================================
--  MÓDULO 3 · TERCEROS DEL NEGOCIO
-- ====================================================================

CREATE TABLE Minero (
    id             INT          AUTO_INCREMENT PRIMARY KEY,
    nombre         VARCHAR(150) NOT NULL,
    titular        VARCHAR(150) NULL,
    cc             VARCHAR(20)  NULL UNIQUE,
    alias          VARCHAR(60),
    telefono       VARCHAR(20),
    ciudad         VARCHAR(100),
    banco          VARCHAR(80)  NULL,
    numero_cuenta  VARCHAR(40)  NULL,
    nequi          BOOLEAN      DEFAULT FALSE,
    metodo_calculo ENUM('por_gramo','por_tonelada') NOT NULL DEFAULT 'por_tonelada',
    estado         ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_minero_nombre (nombre)
);

CREATE TABLE Dueno_Volqueta (
    id            INT          AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(150) NOT NULL,
    titular       VARCHAR(150) NULL,
    cc            VARCHAR(20)  NULL UNIQUE,
    banco         VARCHAR(80)  NULL,
    numero_cuenta VARCHAR(40)  NULL,
    alias         VARCHAR(60),
    telefono      VARCHAR(20),
    ciudad        VARCHAR(100),
    nequi         BOOLEAN      DEFAULT FALSE,
    estado        ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_dueno_nombre (nombre)
) COMMENT='Dueños de volqueta. Vehículos → Volqueta_Vehiculo';

CREATE TABLE Volqueta_Vehiculo (
    id                INT          AUTO_INCREMENT PRIMARY KEY,
    id_dueno_volqueta INT          NOT NULL,
    placa             VARCHAR(15)  NOT NULL UNIQUE,
    tipo_vehiculo     VARCHAR(60),
    conductor         VARCHAR(150),
    conductor_cc      VARCHAR(20),
    capacidad_ton     DECIMAL(8,2) NULL,
    fecha             DATE         NULL     COMMENT 'Fecha de registro o último viaje registrado',
    estado_pago       ENUM('pendiente','parcial','pagado','no_aplica')
                      NOT NULL DEFAULT 'no_aplica'
                      COMMENT 'Estado cuenta corriente de flete. Actualizado por trigger.',
    activo            BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_dueno_volqueta) REFERENCES Dueno_Volqueta(id),
    INDEX idx_vehiculo_dueno (id_dueno_volqueta),
    INDEX idx_vehiculo_placa (placa),
    INDEX idx_vehiculo_estado (estado_pago)
) COMMENT='Vehículo físico. Enlace directo con material_planta_entrada.';

-- v4: eliminado id_tipo_material. Las minas son zonas geográficas;
-- pueden traer muchos materiales distintos en cada entrada.
-- El tipo de material se registra en material_planta_entrada.
CREATE TABLE Mina (
    id         INT          AUTO_INCREMENT PRIMARY KEY,
    nombre     VARCHAR(150) NOT NULL,
    id_minero  INT          NULL  COMMENT 'Dueño habitual — ver Minero',
    id_zona    INT          NULL  COMMENT 'Zona de lejanía — define flete',
    ubicacion  VARCHAR(255),
    estado     ENUM('activa','inactiva') NOT NULL DEFAULT 'activa',
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_minero) REFERENCES Minero(id) ON DELETE SET NULL,
    FOREIGN KEY (id_zona)   REFERENCES Zona(id)   ON DELETE SET NULL,
    INDEX idx_mina_minero (id_minero)
) COMMENT='Frentes de extracción. id_tipo_material eliminado: zona ≠ tipo de material.';

CREATE TABLE Empleados (
    id         INT          AUTO_INCREMENT PRIMARY KEY,
    nombre     VARCHAR(100) NOT NULL,
    apellido   VARCHAR(100),
    cc         VARCHAR(20)  NOT NULL UNIQUE,
    cuenta     VARCHAR(50),
    nequi      BOOLEAN      DEFAULT FALSE,
    labor      VARCHAR(100),
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_empleados_cc (cc)
);

CREATE TABLE Empleados_Salario (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    empleado_id        INT NOT NULL,
    tipo_pago          ENUM('FIJO_MENSUAL', 'POR_DIAS', 'POR_HORAS') NOT NULL,
    tarifa_monto       DECIMAL(12, 2) NOT NULL,
    aplica_aux_transp  BOOLEAN DEFAULT FALSE,
    fecha_inicio       DATE NOT NULL,
    activo             BOOLEAN DEFAULT TRUE,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Llave foránea para conectar con la tabla Empleados
    FOREIGN KEY (empleado_id) REFERENCES Empleados(id) ON DELETE CASCADE,
    
    -- Índices para búsquedas rápidas cuando Juliana liquide la nómina
    INDEX idx_salario_empleado (empleado_id),
    INDEX idx_salario_activo (activo)
);

CREATE TABLE Proveedores (
    id               INT          AUTO_INCREMENT PRIMARY KEY,
    nombre           VARCHAR(150) NOT NULL,
    id_categoria     INT,
    contacto         VARCHAR(150),
    telefono         VARCHAR(20),
    ciudad           VARCHAR(100),
    alias            VARCHAR(60),
    nequi            BOOLEAN      DEFAULT FALSE,
    compra_realizada VARCHAR(255),
    estado           ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
    created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_categoria) REFERENCES Categorias_Proveedor(id),
    INDEX idx_proveedores_nombre (nombre)
);


-- ====================================================================
--  MÓDULO 4 · SEGURIDAD
-- ====================================================================

CREATE TABLE Roles (
    id          INT         AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT
);

CREATE TABLE Permisos (
    id          INT         AUTO_INCREMENT PRIMARY KEY,
    codigo      VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(150)
);

CREATE TABLE Rol_Permiso (
    id_rol     INT NOT NULL,
    id_permiso INT NOT NULL,
    PRIMARY KEY (id_rol, id_permiso),
    FOREIGN KEY (id_rol)     REFERENCES Roles(id)    ON DELETE CASCADE,
    FOREIGN KEY (id_permiso) REFERENCES Permisos(id) ON DELETE CASCADE
);

CREATE TABLE Usuarios (
    id            INT          AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    id_rol        INT          NOT NULL,
    id_empleado   INT          NULL,
    activo        BOOLEAN      DEFAULT TRUE,
    ultimo_acceso DATETIME     NULL,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_rol)      REFERENCES Roles(id),
    FOREIGN KEY (id_empleado) REFERENCES Empleados(id)
);


-- ====================================================================
--  MÓDULO 5 · OPERACIÓN GENERAL
-- ====================================================================

CREATE TABLE Cotizaciones_Materiales (
    id               INT           AUTO_INCREMENT PRIMARY KEY,
    id_material      INT           NOT NULL,
    id_proveedor     INT           NULL,
    fecha_cotizacion DATE          NOT NULL,
    fecha_necesidad  DATE,
    valor_bolsa      DECIMAL(15,2) NOT NULL,
    valor_cliente    DECIMAL(15,2) NOT NULL,
    lugar_uso        VARCHAR(255),
    observaciones    TEXT,
    created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_material)  REFERENCES Materiales(id)  ON DELETE CASCADE,
    FOREIGN KEY (id_proveedor) REFERENCES Proveedores(id) ON DELETE SET NULL,
    INDEX idx_cotizaciones_fecha (fecha_cotizacion)
);

CREATE TABLE Precio_Material (
    id                  INT           AUTO_INCREMENT PRIMARY KEY,
    id_minero           INT           NULL,
    id_zona             INT           NULL,
    metodo              ENUM('por_gramo','por_tonelada') NOT NULL DEFAULT 'por_tonelada',
    precio_por_gramo    DECIMAL(14,2),
    precio_por_tonelada DECIMAL(14,2),
    intervalo_tenor_min DECIMAL(8,4)  NOT NULL DEFAULT 0,
    intervalo_tenor_max DECIMAL(8,4)  NOT NULL DEFAULT 9999,
    fecha_inicio        DATE          NOT NULL,
    fecha_fin           DATE,
    activo              BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_minero) REFERENCES Minero(id) ON DELETE CASCADE,
    FOREIGN KEY (id_zona)   REFERENCES Zona(id)   ON DELETE CASCADE,
    INDEX idx_precio_minero (id_minero, activo),
    INDEX idx_precio_zona   (id_zona, activo)
);

CREATE TABLE Alquileres (
    id           INT           AUTO_INCREMENT PRIMARY KEY,
    id_tipo      INT,
    id_proveedor INT,
    fecha_inicio DATE          NOT NULL,
    concepto     VARCHAR(255)  NOT NULL,
    valor        DECIMAL(15,2) NOT NULL,
    created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMP     NULL DEFAULT NULL,
    FOREIGN KEY (id_tipo)      REFERENCES Tipos_Alquiler(id),
    FOREIGN KEY (id_proveedor) REFERENCES Proveedores(id),
    INDEX idx_alquileres_fecha (fecha_inicio)
) COMMENT='Estado de pago → v_estado_alquileres';

CREATE TABLE Turnos (
    id               INT           AUTO_INCREMENT PRIMARY KEY,
    fecha            DATE          NOT NULL,
    id_empleado      INT           NOT NULL,
    id_tipo_turno    INT           NOT NULL,
    id_planta_proceso  INT         NULL,
    horas_trabajadas DECIMAL(5,2)  DEFAULT 0,
    comentarios      TEXT,
    quincena         INT GENERATED ALWAYS AS (CASE WHEN DAY(fecha) <= 15 THEN 1 ELSE 2 END) STORED,
    created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_empleado)   REFERENCES Empleados(id),
    FOREIGN KEY (id_tipo_turno) REFERENCES Tipos_Turno(id),
    FOREIGN KEY (id_planta_proceso) REFERENCES Planta_Procesos(id),
    INDEX idx_turnos_fecha (fecha)
);


-- v4: añadido tipo_consumo para distinguir vehículo vs planta vs maquinaria.
-- Cuando tipo_consumo='vehiculo': id_vehiculo + id_dueno_volqueta aplican.
-- Cuando tipo_consumo IN ('planta','maquinaria'): id_planta aplica.
-- id_dueno_volqueta SE MANTIENE: es quien debe el combustible si fue a crédito.
CREATE TABLE Combustible (
    id                         INT           AUTO_INCREMENT PRIMARY KEY,
    id_gasolinera              INT           NOT NULL  COMMENT 'Proveedor categoría Combustible',
    tipo_consumo               ENUM('vehiculo','planta','maquinaria','otro')
                               NOT NULL DEFAULT 'vehiculo'
                               COMMENT 'vehiculo=tanqueo a vehículo; planta/maquinaria=tambores o uso interno',
    id_dueno_volqueta          INT           NULL  COMMENT 'Dueño al que se carga el costo (crédito)',
    id_vehiculo                INT           NULL  COMMENT 'Vehículo físico que tanqueó',
    id_planta                  INT           NULL  COMMENT 'Planta que consumió (tambores, maquinaria)',
    id_material_planta_entrada INT           NULL  COMMENT 'Entrada puntual a la que se atribuye',
    fecha                      DATE          NOT NULL,
    descripcion                VARCHAR(255)  COMMENT 'Galones, placa, descripción',
    valor                      DECIMAL(15,2) NOT NULL,
    comprobante_url            VARCHAR(512),
    created_at                 TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_gasolinera)     REFERENCES Proveedores(id),
    FOREIGN KEY (id_dueno_volqueta) REFERENCES Dueno_Volqueta(id),
    FOREIGN KEY (id_vehiculo)       REFERENCES Volqueta_Vehiculo(id),
    FOREIGN KEY (id_planta)         REFERENCES Planta(id),
    CONSTRAINT chk_combustible_tipo CHECK (
        (tipo_consumo = 'vehiculo'  AND (id_vehiculo IS NOT NULL OR id_dueno_volqueta IS NOT NULL))
        OR tipo_consumo IN ('planta','maquinaria','otro')
    ),
    INDEX idx_combustible_gasolinera (id_gasolinera),
    INDEX idx_combustible_volqueta   (id_dueno_volqueta),
    INDEX idx_combustible_fecha      (fecha)
) COMMENT='Tanqueos y combustible interno. tipo_consumo diferencia vehículo vs planta.';

CREATE TABLE Prestamos_Financieros (
    id                INT            AUTO_INCREMENT PRIMARY KEY,
    nombre_prestamo   VARCHAR(150)   NOT NULL,
    fecha_adquisicion DATE           NOT NULL,
    monto_principal   DECIMAL(15,2)  NOT NULL,
    tasa_interes      DECIMAL(5,2)   NOT NULL,
    saldo_pendiente   DECIMAL(15,2)  NOT NULL,
    activo            BOOLEAN        DEFAULT TRUE,
    created_at        TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Prestamos_Empleados (
    id          INT            AUTO_INCREMENT PRIMARY KEY,
    id_empleado INT            NOT NULL,
    fecha       DATE           NOT NULL,
    concepto    VARCHAR(255),
    valor       DECIMAL(15,2)  NOT NULL,
    cuotas      INT            DEFAULT 1,
    created_at  TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_empleado) REFERENCES Empleados(id),
    INDEX idx_prestamos_empleado (id_empleado)
) COMMENT='Saldo real → v_saldo_prestamos_empleado. Genera CxC al desembolsar.';


-- ====================================================================
--  MÓDULO 6 · CAJA MENOR
-- ====================================================================

CREATE TABLE Deposito (
    id               INT            AUTO_INCREMENT PRIMARY KEY,
    fecha            DATE           NOT NULL,
    monto            DECIMAL(14,2)  NOT NULL,
    descripcion      VARCHAR(255),
    saldo_anterior   DECIMAL(14,2)  NOT NULL DEFAULT 0,
    saldo_resultante DECIMAL(14,2)  NOT NULL,
    created_at       TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Gasto_Operativo (
    id                         INT            AUTO_INCREMENT PRIMARY KEY,
    id_deposito                INT            NOT NULL,
    id_tipo_gasto              INT            NOT NULL,
    id_material_planta_entrada INT            NULL,
    id_viaje                   INT            NULL,
    fecha                      DATE           NOT NULL,
    concepto                   VARCHAR(150)   NOT NULL,
    monto                      DECIMAL(14,2)  NOT NULL,
    saldo_resultante           DECIMAL(14,2)  NOT NULL,
    mensaje_mauricio           TEXT,
    created_at                 TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_deposito)   REFERENCES Deposito(id),
    FOREIGN KEY (id_tipo_gasto) REFERENCES Tipos_Gasto_Operativo(id),
    INDEX idx_gasto_deposito (id_deposito),
    INDEX idx_gasto_entrada  (id_material_planta_entrada)
);


-- ====================================================================
--  MÓDULO 7 · RECEPCIÓN DE MATERIAL
-- ====================================================================

-- v4: eliminado id_minero (se deriva: id_mina → Mina.id_minero).
--     Añadido estado_pago_flete: saber si se pagó el acarreo al dueño del vehículo.
--     El dueño del vehículo se sigue derivando: id_vehiculo → Volqueta_Vehiculo → id_dueno_volqueta.
CREATE TABLE material_planta_entrada (
    id                      INT           AUTO_INCREMENT PRIMARY KEY,
    numero_volqueta         INT           NOT NULL,
    id_mina                 INT           NOT NULL,
    id_vehiculo             INT           NULL  COMMENT 'Vehículo que llegó (dueño implícito)',
    id_tipo_material        INT           NOT NULL,
    id_precio               INT           NULL,

    fecha_llegada           DATE          NOT NULL,
    peso_llegada_planta     DECIMAL(10,4) NOT NULL,
    porcentaje_humedad      DECIMAL(6,4)  NOT NULL,
    gramos_humedad          DECIMAL(10,4),
    tenor                   DECIMAL(8,4),
    total_material_seco     DECIMAL(10,4),
    total_gramos            DECIMAL(12,4),

    precio_por_gramo        DECIMAL(14,2),
    precio_por_tonelada     DECIMAL(14,2),
    precio_total            DECIMAL(14,2),
    excedente_calculado     DECIMAL(14,2) COMMENT 'Excedente estimado (ingreso empresa). Ver tabla Excedente.',

    costo_cargue            DECIMAL(14,2) DEFAULT 0,
    costo_bascula           DECIMAL(14,2) DEFAULT 0,
    costo_maquila           DECIMAL(14,2) DEFAULT 0  COMMENT 'Costo de procesamiento asignado a esta entrada',
    costo_adicional         DECIMAL(14,2) DEFAULT 0,
    costo_volqueta          DECIMAL(14,2) DEFAULT 0  COMMENT 'Flete = total_material_seco × tarifa zona',
    total_costos_operativos DECIMAL(14,2),
    total_material          DECIMAL(14,2),

    estado                  ENUM('pendiente','en_proceso','pagada','incluida_viaje','cancelada')
                            NOT NULL DEFAULT 'pendiente',
    estado_pago_flete       ENUM('pendiente','parcial','pagado','no_aplica')
                            NOT NULL DEFAULT 'pendiente'
                            COMMENT 'Estado de pago del flete al dueño del vehículo',
    comentarios             TEXT,
    created_at              TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (id_mina)          REFERENCES Mina(id),
    FOREIGN KEY (id_vehiculo)      REFERENCES Volqueta_Vehiculo(id),
    FOREIGN KEY (id_tipo_material) REFERENCES Tipos_Material(id),
    FOREIGN KEY (id_precio)        REFERENCES Precio_Material(id),
    INDEX idx_mpe_mina     (id_mina),
    INDEX idx_mpe_vehiculo (id_vehiculo),
    INDEX idx_mpe_fecha    (fecha_llegada),
    INDEX idx_mpe_estado   (estado),
    INDEX idx_mpe_flete    (estado_pago_flete)
) COMMENT='Entrada de material. Minero → id_mina→Mina.id_minero. Dueño flete → id_vehiculo→Volqueta_Vehiculo.';

ALTER TABLE Gasto_Operativo
    ADD CONSTRAINT fk_gasto_entrada
    FOREIGN KEY (id_material_planta_entrada) REFERENCES material_planta_entrada(id) ON DELETE SET NULL;

ALTER TABLE Combustible
    ADD CONSTRAINT fk_combustible_entrada
    FOREIGN KEY (id_material_planta_entrada) REFERENCES material_planta_entrada(id) ON DELETE SET NULL;

-- v4: el excedente queda DENTRO de su propia tabla (sin Caja_Excedente aparte).
--     monto_distribuido: cuánto de este excedente ya se distribuyó (salió como CxP).
--     estado_distribucion: estado de la distribución desde la empresa.
--     Cuando se distribuye → se crea una Cuentas_Por_Pagar (categoría 'Distribución excedente')
--     enlazada via Cuentas_Por_Pagar_Relacion.id_excedente.
--     Vista v_excedente_por_vehiculo muestra cuántos excedentes hay por placa.
CREATE TABLE Excedente (
    id                  INT           AUTO_INCREMENT PRIMARY KEY,
    id_entrada          INT           NOT NULL,
    valor_excedente     DECIMAL(14,2) NOT NULL  COMMENT 'Beneficio de la empresa en esta entrada',
    monto_distribuido   DECIMAL(14,2) NOT NULL DEFAULT 0
                        COMMENT 'Cuánto ya se distribuyó/pagó desde este excedente',
    saldo_por_distribuir DECIMAL(14,2) AS (valor_excedente - monto_distribuido) STORED,
    fecha_calculo       DATE          NOT NULL,
    concepto            VARCHAR(255)  NULL,
    estado_distribucion ENUM('pendiente','parcial','distribuido') NOT NULL DEFAULT 'pendiente'
                        COMMENT 'pendiente=no distribuido; distribuido=ya salió como CxP',
    notas               TEXT,
    created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_entrada) REFERENCES material_planta_entrada(id),
    INDEX idx_excedente_entrada (id_entrada),
    INDEX idx_excedente_estado  (estado_distribucion)
) COMMENT='Excedentes = INGRESOS de la empresa. Distribución → Cuentas_Por_Pagar (id_excedente en relación).';

CREATE TABLE Anticipos_Terceros (
    id                INT            AUTO_INCREMENT PRIMARY KEY,
    id_minero         INT            NULL,
    id_dueno_volqueta INT            NULL,
    id_proveedor      INT            NULL,
    fecha             DATE           NOT NULL,
    monto_inicial     DECIMAL(14,2)  NOT NULL,
    monto_usado       DECIMAL(14,2)  DEFAULT 0,
    saldo_disponible  DECIMAL(14,2)  AS (monto_inicial - monto_usado) STORED,
    descripcion       VARCHAR(255),
    estado            ENUM('disponible','agotado') DEFAULT 'disponible',
    created_at        TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_minero)         REFERENCES Minero(id),
    FOREIGN KEY (id_dueno_volqueta) REFERENCES Dueno_Volqueta(id),
    FOREIGN KEY (id_proveedor)      REFERENCES Proveedores(id),
    CONSTRAINT chk_anticipo_tercero CHECK (
        (id_minero IS NOT NULL) + (id_dueno_volqueta IS NOT NULL) + (id_proveedor IS NOT NULL) = 1
    )
);

CREATE TABLE Historial_Descuentos_Anticipos (
    id               INT            AUTO_INCREMENT PRIMARY KEY,
    id_anticipo      INT            NOT NULL,
    id_entrada       INT            NOT NULL,
    fecha            DATE           NOT NULL,
    monto_descontado DECIMAL(14,2)  NOT NULL,
    nota             VARCHAR(255),
    created_at       TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_anticipo) REFERENCES Anticipos_Terceros(id),
    FOREIGN KEY (id_entrada)  REFERENCES material_planta_entrada(id)
);

CREATE TABLE Analisis (
    id                 INT           AUTO_INCREMENT PRIMARY KEY,
    id_entrada         INT           NULL,
    id_tipo_analisis   INT           NOT NULL,
    id_mina            INT           NULL  COMMENT 'Solo si id_entrada IS NULL',
    id_minero          INT           NULL  COMMENT 'Solo si id_entrada IS NULL',
    id_tipo_material   INT           NULL  COMMENT 'Solo si id_entrada IS NULL',
    id_laboratorio     INT           NULL,
    numero_analisis    VARCHAR(50),
    au_concentrado     DECIMAL(10,4),
    ag_concentrado     DECIMAL(10,4),
    ton                DECIMAL(10,4),
    porcentaje_humedad DECIMAL(6,4),
    toneladas_humedas  DECIMAL(10,4),
    toneladas_secas    DECIMAL(10,4),
    au_gr_x_ton        DECIMAL(10,4),
    au_gr_x_ton_falso  DECIMAL(10,4) NULL,
    ag_gr_x_ton        DECIMAL(10,4),
    valor_analisis     DECIMAL(14,2) NULL,
    estado_pago        ENUM('pendiente','parcial','pagado','no_aplica') NOT NULL DEFAULT 'no_aplica',
    fecha_salida       DATE,
    comentarios        TEXT,
    created_at         TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
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
    INDEX idx_analisis_entrada (id_entrada)
) COMMENT='Análisis de laboratorio. Ver v_analisis_completo.';


-- ====================================================================
--  MÓDULO 8 · AGUA Y MULAS
-- ====================================================================

CREATE TABLE Agua_Planta (
    id                INT           AUTO_INCREMENT PRIMARY KEY,
    id_dueno_volqueta INT           NOT NULL,
    fecha             DATE          NOT NULL,
    valor_viaje       DECIMAL(14,2) NOT NULL,
    cantidad_viajes   INT           NOT NULL DEFAULT 1,
    acpm              DECIMAL(14,2) DEFAULT 0,
    valor_total       DECIMAL(14,2) AS (valor_viaje * cantidad_viajes - IFNULL(acpm,0)) STORED,
    comprobante_url   VARCHAR(512),
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_dueno_volqueta) REFERENCES Dueno_Volqueta(id),
    INDEX idx_agua_volqueta (id_dueno_volqueta),
    INDEX idx_agua_fecha    (fecha)
) COMMENT='Estado de pago → v_estado_agua';

CREATE TABLE Mulas (
    id               INT           AUTO_INCREMENT PRIMARY KEY,
    id_proveedor     INT           NOT NULL,
    id_viaje         INT           NULL,
    fecha            DATE          NOT NULL,
    concepto         VARCHAR(255),
    factura_num      VARCHAR(50),
    foto_factura_url VARCHAR(512),
    valor            DECIMAL(14,2) NOT NULL,
    comprobante_url  VARCHAR(512),
    created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_proveedor) REFERENCES Proveedores(id),
    INDEX idx_mulas_proveedor (id_proveedor),
    INDEX idx_mulas_fecha     (fecha)
) COMMENT='Retención → v_mulas. Estado → v_estado_mulas.';


-- ====================================================================
--  MÓDULO 9 · VIAJES Y MAQUILA
-- ====================================================================

CREATE TABLE Viaje (
    id                   INT           AUTO_INCREMENT PRIMARY KEY,
    numero_viaje         VARCHAR(20)   NOT NULL,
    fecha                DATE          NOT NULL,
    total_costo_material DECIMAL(14,2),
    maquila              DECIMAL(14,2),
    total_viaje          DECIMAL(14,2),
    au_promedio_compra   DECIMAL(10,4),
    tenor_au_venta       DECIMAL(10,4),
    total_grs_au_venta   DECIMAL(10,4),
    tenor_ag             DECIMAL(10,4),
    total_grs_ag_venta   DECIMAL(10,4),
    comentarios          TEXT,
    created_at           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE Mulas
    ADD CONSTRAINT fk_mulas_viaje
    FOREIGN KEY (id_viaje) REFERENCES Viaje(id) ON DELETE SET NULL;

ALTER TABLE Gasto_Operativo
    ADD CONSTRAINT fk_gasto_viaje
    FOREIGN KEY (id_viaje) REFERENCES Viaje(id) ON DELETE SET NULL;

-- v4: añadido costo_maquila = costo de procesamiento asignado a esta entrada.
-- Cálculo: (concentrado_seco_entrada / total_concentrado_viaje) × Maquila.valor_total_maquila
-- Se calcula y actualiza al cerrar la Maquila del viaje (trigger o SP).
CREATE TABLE viaje_material (
    id                       INT           AUTO_INCREMENT PRIMARY KEY,
    id_viaje                 INT           NOT NULL,
    id_entrada               INT           NOT NULL,
    es_remanente             BOOLEAN       NOT NULL DEFAULT FALSE,
    id_viaje_origen          INT           NULL,
    concepto                 VARCHAR(150),
    total_material           DECIMAL(10,4),
    total_concentrado_humedo DECIMAL(10,4),
    porcentaje_humedad       DECIMAL(6,4),
    peso_humedad             DECIMAL(10,4),
    concentrado_seco         DECIMAL(10,4),
    costo_maquila            DECIMAL(14,2) NULL COMMENT 'Costo de procesamiento proporcional a esta entrada',
    valor_total_con_gastos   DECIMAL(14,2),
    created_at               TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_viaje_material (id_viaje, id_entrada),
    FOREIGN KEY (id_viaje)        REFERENCES Viaje(id),
    FOREIGN KEY (id_entrada)      REFERENCES material_planta_entrada(id),
    FOREIGN KEY (id_viaje_origen) REFERENCES Viaje(id),
    INDEX idx_vm_entrada (id_entrada),
    INDEX idx_vm_viaje   (id_viaje)
) COMMENT='Entradas que componen un viaje. costo_maquila se actualiza al cerrar la Maquila.';

-- v4: Maquila es el COSTO OPERATIVO de procesar las toneladas del viaje.
-- valor_total_maquila = total_material × precio_por_tonelada.
-- Este costo se distribuye proporcionalmente en viaje_material.costo_maquila.
-- estado SE MANTIENE (incluye 'anulado' que no es derivable de pagos).
CREATE TABLE Maquila (
    id                  INT           AUTO_INCREMENT PRIMARY KEY,
    id_viaje            INT           NOT NULL,
    descripcion         VARCHAR(255)  NULL  COMMENT 'Tipo de procesamiento o planta externa',
    total_material      DECIMAL(10,4) NOT NULL,
    precio_por_tonelada DECIMAL(14,2) NOT NULL DEFAULT 300000
                        COMMENT 'Costo operativo de procesamiento por tonelada',
    peso_humedad        DECIMAL(10,4),
    valor_total_maquila DECIMAL(14,2)
                        COMMENT 'total_material × precio_por_tonelada — costo total de procesamiento',
    estado              ENUM('pendiente','pagado','anulado') NOT NULL DEFAULT 'pendiente',
    created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_viaje) REFERENCES Viaje(id),
    INDEX idx_maquila_estado (estado)
) COMMENT='Costo operativo de procesamiento por viaje. Se distribuye en viaje_material.costo_maquila.';

CREATE TABLE Peso_Final_Transfigura (
    id                   INT           AUTO_INCREMENT PRIMARY KEY,
    id_viaje             INT           NOT NULL,
    fecha                DATE          NOT NULL,
    peso_neto            DECIMAL(15,4),
    peso_seco            DECIMAL(15,4),
    infopath_au          DECIMAL(10,4),
    infopath_ag          DECIMAL(10,4),
    tenor_inicial_sgs_au DECIMAL(10,4),
    tenor_inicial_sgs_ag DECIMAL(10,4),
    tenor_inicial_sgs_cu DECIMAL(10,4),
    tenor_final_peru_au  DECIMAL(10,4),
    tenor_final_peru_ag  DECIMAL(10,4),
    arsenico_final_peru  DECIMAL(10,4),
    created_at           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_viaje) REFERENCES Viaje(id),
    INDEX idx_peso_viaje (id_viaje)
) COMMENT='Trazabilidad metalúrgica. numero_viaje → JOIN con Viaje.numero_viaje';


-- ====================================================================
--  MÓDULO 10 · INVENTARIO Y KARDEX
-- ====================================================================

CREATE TABLE Inventario_Lotes (
    id                    INT           AUTO_INCREMENT PRIMARY KEY,
    id_entrada            INT           NOT NULL,
    id_mina               INT           NOT NULL,
    id_tipo_material      INT           NOT NULL,
    condicion_material    ENUM('Humedo','Seco') NOT NULL,
    porcentaje_humedad    DECIMAL(5,4)  DEFAULT 0.0000,
    toneladas_iniciales   DECIMAL(10,4) NOT NULL,
    toneladas_disponibles DECIMAL(10,4) NOT NULL,
    estado                ENUM('almacenado','en_proceso','agotado','faltante') DEFAULT 'almacenado',
    ubicacion             VARCHAR(100)  NULL,
    fecha_ingreso         DATETIME      DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_entrada)       REFERENCES material_planta_entrada(id),
    FOREIGN KEY (id_mina)          REFERENCES Mina(id),
    FOREIGN KEY (id_tipo_material) REFERENCES Tipos_Material(id),
    INDEX idx_inv_entrada    (id_entrada),
    INDEX idx_inv_disponible (toneladas_disponibles, estado)
);

CREATE TABLE Kardex_Movimientos (
    id                 INT           AUTO_INCREMENT PRIMARY KEY,
    id_lote            INT           NOT NULL,
    fecha              DATETIME      DEFAULT CURRENT_TIMESTAMP,
    tipo_movimiento    ENUM('ENTRADA_PLANTA','SALIDA_PROCESO','SALIDA_VIAJE','AJUSTE_MERMA') NOT NULL,
    toneladas_movidas  DECIMAL(10,4) NOT NULL,
    destino_referencia VARCHAR(100),
    id_usuario         INT,
    comentarios        TEXT,
    FOREIGN KEY (id_lote)    REFERENCES Inventario_Lotes(id),
    FOREIGN KEY (id_usuario) REFERENCES Usuarios(id),
    INDEX idx_kardex_lote  (id_lote),
    INDEX idx_kardex_fecha (fecha)
);


-- ====================================================================
--  MÓDULO 11 · CUENTAS POR PAGAR  (renombrado de Motor de Pagos)
-- ====================================================================

-- v4: renombrada de Pagos → Cuentas_Por_Pagar.
--     Estado 'pagado' = "cuenta paga" (ya se cumplió la obligación).
--     CHECK garantiza máximo 1 beneficiario por registro.
CREATE TABLE Cuentas_Por_Pagar (
    id                INT           AUTO_INCREMENT PRIMARY KEY,
    id_categoria      INT           NOT NULL,
    concepto          VARCHAR(255)  NOT NULL,
    id_proveedor      INT           NULL,
    id_empleado       INT           NULL,
    id_minero         INT           NULL,
    id_dueno_volqueta INT           NULL,
    valor_total       DECIMAL(14,2) NOT NULL,
    valor_pagado      DECIMAL(14,2) NOT NULL DEFAULT 0,
    saldo             DECIMAL(14,2) AS (valor_total - valor_pagado) STORED,
    estado            ENUM('pendiente','parcial','pagado','anulado') NOT NULL DEFAULT 'pendiente',
    fecha_creacion    DATE          NOT NULL DEFAULT (CURRENT_DATE),
    fecha_limite      DATE,
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at        TIMESTAMP     NULL DEFAULT NULL,
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
) COMMENT='Cuentas por pagar. Estado pagado = cuenta paga.';

-- v4: renombrado de Abonos_Pagos → Abonos_CxP.
--     id_saldo_favor: cuando el pago se hace usando un crédito por sobrepago.
--     metodo 'saldo_a_favor' activado solo cuando id_saldo_favor IS NOT NULL.
CREATE TABLE Abonos_CxP (
    id              INT           AUTO_INCREMENT PRIMARY KEY,
    id_cuenta_pagar INT           NOT NULL,
    fecha_abono     DATE          NOT NULL,
    valor           DECIMAL(14,2) NOT NULL,
    metodo_pago     ENUM('efectivo','consignacion','transferencia','nequi',
                         'descuento_nomina','saldo_a_favor','otro')
                    NOT NULL DEFAULT 'efectivo',
    id_saldo_favor  INT           NULL COMMENT 'Solo cuando metodo_pago=saldo_a_favor',
    comprobante_url VARCHAR(512),
    observaciones   TEXT,
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_cuenta_pagar) REFERENCES Cuentas_Por_Pagar(id) ON DELETE CASCADE,
    CONSTRAINT chk_saldo_favor_metodo CHECK (
        (metodo_pago = 'saldo_a_favor') = (id_saldo_favor IS NOT NULL)
    ),
    INDEX idx_abonos_cxp_cuenta (id_cuenta_pagar),
    INDEX idx_abonos_cxp_fecha  (fecha_abono)
) COMMENT='Abonos a CxP. id_saldo_favor cuando se usa crédito por sobrepago.';

-- ====================================================================
--  TABLA DE ENLACE — FK EXPLÍCITAS (reemplaza la polimórfica de v3)
-- ====================================================================
-- v4: cada dominio tiene su propia FK declarada. El motor garantiza
-- integridad referencial en TODAS las relaciones, no solo en id_cuenta_pagar.
-- CHECK: exactamente 1 FK debe estar NOT NULL por fila.
-- subtipo: solo cuando id_entrada IS NOT NULL (material vs flete).
CREATE TABLE Cuentas_Por_Pagar_Relacion (
    id                  INT           AUTO_INCREMENT PRIMARY KEY,
    id_cuenta_pagar     INT           NOT NULL,

    -- Exactamente UNA de estas FKs debe ser NOT NULL:
    id_entrada          INT           NULL  COMMENT 'material_planta_entrada',
    id_viaje            INT           NULL  COMMENT 'Viaje',
    id_alquiler         INT           NULL  COMMENT 'Alquileres',
    id_combustible      INT           NULL  COMMENT 'Combustible',
    id_prestamo_emp     INT           NULL  COMMENT 'Prestamos_Empleados',
    id_prestamo_fin     INT           NULL  COMMENT 'Prestamos_Financieros',
    id_maquila          INT           NULL  COMMENT 'Maquila',
    id_deposito         INT           NULL  COMMENT 'Deposito (fondeo caja menor)',
    id_anticipo         INT           NULL  COMMENT 'Anticipos_Terceros',
    id_agua             INT           NULL  COMMENT 'Agua_Planta',
    id_mula             INT           NULL  COMMENT 'Mulas',
    id_analisis         INT           NULL  COMMENT 'Analisis',
    id_excedente        INT           NULL  COMMENT 'Excedente (distribución desde empresa)',

    subtipo             ENUM('material','flete') NULL
                        COMMENT 'Solo cuando id_entrada IS NOT NULL',
    monto_aplicado      DECIMAL(14,2),
    concepto            VARCHAR(255),
    fecha               DATE          NOT NULL DEFAULT (CURRENT_DATE),
    nota                VARCHAR(255),
    created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_cuenta_pagar) REFERENCES Cuentas_Por_Pagar(id) ON DELETE CASCADE,
    FOREIGN KEY (id_entrada)      REFERENCES material_planta_entrada(id),
    FOREIGN KEY (id_viaje)        REFERENCES Viaje(id),
    FOREIGN KEY (id_alquiler)     REFERENCES Alquileres(id),
    FOREIGN KEY (id_combustible)  REFERENCES Combustible(id),
    FOREIGN KEY (id_prestamo_emp) REFERENCES Prestamos_Empleados(id),
    FOREIGN KEY (id_prestamo_fin) REFERENCES Prestamos_Financieros(id),
    FOREIGN KEY (id_maquila)      REFERENCES Maquila(id),
    FOREIGN KEY (id_deposito)     REFERENCES Deposito(id),
    FOREIGN KEY (id_anticipo)     REFERENCES Anticipos_Terceros(id),
    FOREIGN KEY (id_agua)         REFERENCES Agua_Planta(id),
    FOREIGN KEY (id_mula)         REFERENCES Mulas(id),
    FOREIGN KEY (id_analisis)     REFERENCES Analisis(id),
    FOREIGN KEY (id_excedente)    REFERENCES Excedente(id),

    CONSTRAINT chk_cxpr_exactamente_uno CHECK (
        (id_entrada      IS NOT NULL) + (id_viaje        IS NOT NULL) +
        (id_alquiler     IS NOT NULL) + (id_combustible   IS NOT NULL) +
        (id_prestamo_emp IS NOT NULL) + (id_prestamo_fin  IS NOT NULL) +
        (id_maquila      IS NOT NULL) + (id_deposito      IS NOT NULL) +
        (id_anticipo     IS NOT NULL) + (id_agua          IS NOT NULL) +
        (id_mula         IS NOT NULL) + (id_analisis      IS NOT NULL) +
        (id_excedente    IS NOT NULL) = 1
    ),
    CONSTRAINT chk_cxpr_subtipo CHECK (
        subtipo IS NULL OR id_entrada IS NOT NULL
    ),
    INDEX idx_cxpr_cuenta     (id_cuenta_pagar),
    INDEX idx_cxpr_entrada    (id_entrada),
    INDEX idx_cxpr_excedente  (id_excedente),
    INDEX idx_cxpr_maquila    (id_maquila)
) COMMENT='Enlace CxP ↔ dominio. FK explícita por cada tabla. Exactamente 1 FK activa por fila.';

-- FK diferida a Abonos_CxP desde Saldo_A_Favor (se crea en Módulo 13)
ALTER TABLE Abonos_CxP
    ADD CONSTRAINT fk_abonos_saldo_favor
    FOREIGN KEY (id_saldo_favor) REFERENCES Saldo_A_Favor(id) ON DELETE RESTRICT;
-- (Saldo_A_Favor se crea en Módulo 13; el FK se aplica después gracias a SET FOREIGN_KEY_CHECKS=0)


-- ====================================================================
--  MÓDULO 12 · CUENTAS POR COBRAR
-- ====================================================================
-- Lo que TERCEROS deben A LA EMPRESA.
-- Ejemplos: préstamos a empleados, combustible adelantado, anticipos recuperables.
-- Cuando se cobra → Abonos_CxC reduce el saldo.

CREATE TABLE Cuentas_Por_Cobrar (
    id                INT           AUTO_INCREMENT PRIMARY KEY,
    id_categoria      INT           NOT NULL,
    concepto          VARCHAR(255)  NOT NULL,
    id_empleado       INT           NULL  COMMENT 'Deudor empleado',
    id_minero         INT           NULL  COMMENT 'Deudor minero',
    id_dueno_volqueta INT           NULL  COMMENT 'Deudor dueño de volqueta',
    id_proveedor      INT           NULL  COMMENT 'Deudor proveedor',
    valor_total       DECIMAL(14,2) NOT NULL,
    valor_cobrado     DECIMAL(14,2) NOT NULL DEFAULT 0,
    saldo             DECIMAL(14,2) AS (valor_total - valor_cobrado) STORED,
    estado            ENUM('pendiente','parcial','cobrado','anulado') NOT NULL DEFAULT 'pendiente',
    fecha_creacion    DATE          NOT NULL DEFAULT (CURRENT_DATE),
    fecha_limite      DATE          NULL,
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
) COMMENT='Cuentas por cobrar. Lo que terceros deben a la empresa.';

CREATE TABLE Abonos_CxC (
    id              INT           AUTO_INCREMENT PRIMARY KEY,
    id_cxc          INT           NOT NULL,
    fecha_cobro     DATE          NOT NULL,
    valor           DECIMAL(14,2) NOT NULL,
    metodo          ENUM('efectivo','transferencia','descuento_flete',
                         'descuento_nomina','otro')
                    NOT NULL DEFAULT 'efectivo',
    comprobante_url VARCHAR(512),
    observaciones   TEXT,
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_cxc) REFERENCES Cuentas_Por_Cobrar(id) ON DELETE CASCADE,
    INDEX idx_abonos_cxc_cuenta (id_cxc),
    INDEX idx_abonos_cxc_fecha  (fecha_cobro)
) COMMENT='Cobros sobre CxC. Reduce el saldo (trigger).';

-- FK explícitas: qué generó esta CxC.
-- Exactamente 1 FK activa (CHECK garantiza).
CREATE TABLE Cuentas_Por_Cobrar_Relacion (
    id              INT           AUTO_INCREMENT PRIMARY KEY,
    id_cxc          INT           NOT NULL,

    -- Exactamente UNA de estas FKs debe ser NOT NULL:
    id_prestamo_emp INT           NULL  COMMENT 'Prestamos_Empleados',
    id_combustible  INT           NULL  COMMENT 'Combustible cargado al dueño de volqueta',
    id_anticipo     INT           NULL  COMMENT 'Anticipo recuperable',
    id_excedente    INT           NULL  COMMENT 'Excedente reconocido como CxC',

    monto_aplicado  DECIMAL(14,2),
    concepto        VARCHAR(255),
    fecha           DATE          NOT NULL DEFAULT (CURRENT_DATE),
    nota            VARCHAR(255),
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

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
) COMMENT='Enlace CxC ↔ dominio. FK explícita. Exactamente 1 FK activa por fila.';


-- ====================================================================
--  MÓDULO 13 · AJUSTES — SALDO A FAVOR (SOBREPAGO)
-- ====================================================================
-- Escenario: se pagó de más a un minero, proveedor o volquetero.
-- ¿Qué pasa?
--   OPCIÓN A: El tercero devuelve el dinero → tipo_resolucion='devolucion'
--   OPCIÓN B: Se descuenta del próximo pago → tipo_resolucion='descontar_futuro'
--
-- Flujo:
--   1. Contador detecta sobrepago (manual o por trigger cuando valor_pagado > valor_total).
--   2. Se crea Saldo_A_Favor con el monto en exceso y el beneficiario.
--   3a. Si devuelve: se marca estado='devuelto', se registra un ingreso en caja.
--   3b. Si se descuenta: en el próximo Abono_CxP se usa metodo='saldo_a_favor'
--       y se referencia este Saldo_A_Favor. El trigger actualiza monto_aplicado.

CREATE TABLE Saldo_A_Favor (
    id                INT           AUTO_INCREMENT PRIMARY KEY,
    origen            ENUM('pago_excedido','ajuste_manual') NOT NULL
                      COMMENT 'pago_excedido=valor_pagado superó valor_total; ajuste_manual=corrección',
    id_abono_cxp_orig INT           NULL COMMENT 'Abono que generó el sobrepago (si origen=pago_excedido)',

    -- Beneficiario que recibió de más (exactamente 1):
    id_minero         INT           NULL,
    id_dueno_volqueta INT           NULL,
    id_proveedor      INT           NULL,
    id_empleado       INT           NULL,

    -- Referencia a la CxP que fue sobrepagada:
    id_cuenta_pagar   INT           NULL,

    monto_original    DECIMAL(14,2) NOT NULL  COMMENT 'Valor pagado en exceso',
    monto_aplicado    DECIMAL(14,2) NOT NULL DEFAULT 0
                      COMMENT 'Cuánto de este crédito ya se usó o devolvió',
    saldo_disponible  DECIMAL(14,2) AS (monto_original - monto_aplicado) STORED,

    tipo_resolucion   ENUM('pendiente','descontar_futuro','devolucion') NOT NULL DEFAULT 'pendiente'
                      COMMENT 'pendiente=sin decidir; descontar_futuro=abono futuro; devolucion=tercero regresa el dinero',
    estado            ENUM('disponible','parcial','agotado','devuelto') NOT NULL DEFAULT 'disponible',

    fecha             DATE          NOT NULL DEFAULT (CURRENT_DATE),
    descripcion       VARCHAR(255)  COMMENT 'Descripción del error o motivo del ajuste',
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

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
) COMMENT='Crédito por sobrepago. Resuelve con descuento futuro o devolución del tercero.';


-- ====================================================================
--  MÓDULO 14 · VISTAS CALCULADAS
-- ====================================================================

-- Estado de pago del MATERIAL al minero, por entrada
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

-- Estado de pago del FLETE, por entrada
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

-- Excedentes por VEHÍCULO (cuántos excedentes tiene cada placa, estado de distribución)
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
FROM      Volqueta_Vehiculo            vv
JOIN      Dueno_Volqueta               dv  ON dv.id  = vv.id_dueno_volqueta
JOIN      material_planta_entrada      mpe ON mpe.id_vehiculo = vv.id
JOIN      Excedente                    e   ON e.id_entrada    = mpe.id
GROUP BY  vv.id, vv.placa, dv.nombre;

-- Excedentes detalle con datos de la entrada
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

-- Saldos a favor disponibles por beneficiario
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

-- MULAS con retención dinámica
CREATE VIEW v_mulas AS
SELECT
    m.*,
    tc.valor                                       AS pct_retencion,
    ROUND(m.valor * tc.valor / 100, 2)             AS retencion,
    m.valor - ROUND(m.valor * tc.valor / 100, 2)  AS abono_neto
FROM       Mulas           m
CROSS JOIN Tarifas_Calculo tc
WHERE      tc.codigo = 'retencion_mula_pct';

-- Estado de pago ALQUILERES
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

-- Estado de pago COMBUSTIBLE (a la gasolinera)
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

-- Estado de pago AGUA
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

-- Estado de pago MULAS
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

-- Saldo real PRÉSTAMOS EMPLEADOS
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

-- Análisis con refs siempre resueltas
CREATE VIEW v_analisis_completo AS
SELECT
    a.*,
    COALESCE(a.id_mina,         mpe.id_mina)          AS id_mina_resuelto,
    COALESCE(a.id_minero,       mi.id_minero)          AS id_minero_resuelto,
    COALESCE(a.id_tipo_material,mpe.id_tipo_material)  AS tipo_mat_resuelto
FROM      Analisis a
LEFT JOIN material_planta_entrada mpe ON mpe.id = a.id_entrada
LEFT JOIN Mina                    mi  ON mi.id  = mpe.id_mina;


SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES   = 1;

-- ====================================================================
--  FIN DEL ESQUEMA v4
--  52 tablas · 12 vistas
-- --------------------------------------------------------------------
--  Triggers pendientes (archivo separado):
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
--   1. Contador detecta: valor_pagado > valor_total en una CxP
--   2. INSERT Saldo_A_Favor (monto_original = exceso, beneficiario = id_minero/etc.)
--   3a. Devolucion: UPDATE Saldo_A_Favor SET tipo_resolucion='devolucion', estado='devuelto'
--       + registrar ingreso en Deposito
--   3b. Descontar: en próximo Abono_CxP SET metodo='saldo_a_favor', id_saldo_favor = SAF_ID
--       → trigger actualiza SAF.monto_aplicado automáticamente
-- ====================================================================