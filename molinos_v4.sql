-- ====================================================================
--  SISTEMA ERP — MOLINOS DE COLOMBIA  ·  ESQUEMA v4  (SIN TRIGGERS)
--  MySQL 8.0.16+  |  utf8mb4
-- --------------------------------------------------------------------
--  Toda la lógica que antes vivía en triggers (inventario/kardex,
--  costo_maquila, distribución proporcional, descuento de stock por
--  viaje, excedente, estado de pago) ahora vive en el backend
--  (Node/TS). Esta base de datos NO tiene triggers — todos fueron
--  soltados. El backend es responsable de escribir consistentemente
--  en Inventario_Lotes, Kardex_Movimientos, material_concentrado,
--  procesamiento_material, viaje_material, Excedente, etc.
--
--  Cambios desde v3 (Pagos→Cuentas_Por_Pagar, Abonos_Pagos→Abonos_CxP,
--  Pago_Relacion→Cuentas_Por_Pagar_Relacion, Categorias_Pago→Categorias_CxP,
--  + tablas nuevas de CxC y Saldo_A_Favor) — ver histórico en
--  molinos_coments_v4.sql.
--
--  Cambios desde la primera versión "con comentarios" (integrados aquí
--  directamente en los CREATE, sin dejar rastro de ALTER):
--   · Combustible: id_gasolinera ahora NULL (ACPM adelantado sin proveedor
--     asignado todavía); nueva columna id_agua (excluyente con
--     id_material_planta_entrada) — migración ACPM flete/agua 2026-09-02.
--   · Agua_Planta: valor_total ya NO resta acpm (el neto se calcula contra
--     Combustible.id_agua); nueva columna estado_pago — Fase B 2026-09-05.
--   · Anticipos_Terceros: estado admite 'anulado'.
--   · Historial_Descuentos_Anticipos: id_entrada ahora NULL (aplica a
--     material/flete/agua/proveedor); nueva columna id_abono_cxp.
--   · Viaje: nueva columna estado ('almacenado'/'despachado'), la
--     mantiene PagoMulaService.
--   · Saldo_A_Favor: origen admite 'anticipo'; nueva columna id_anticipo.
--   · Combustible: nueva columna forma_pago ('efectivo'/'credito'); vista
--     v_estado_combustible ahora la usa (efectivo siempre 'pagado', sin CxP)
--     — migración forma_pago 2026-09-16.
--   · Proveedores: nueva columna tipo ('general'/'combustible'/
--     'transportadora'/'laboratorio') — fija en el esquema, ya no depende
--     del nombre de texto libre de la categoría; usada por el selector de
--     Combustible.id_gasolinera (?tipo=combustible) — migración 2026-09-19.
--   · Vistas v_estado_pago_material, v_estado_pago_flete, v_estado_agua,
--     v_estado_mulas: recalculadas para prorratear por monto_aplicado
--     (antes sobrecontaban cuando una CxP cubre varias entradas) y para
--     descontar el ACPM real desde Combustible en flete/agua.
--   · Nomina_Liquidaciones: nuevas columnas total_recargo_dominical_festivo,
--     aporte_salud, aporte_pension, total_aportes_seguridad_social —
--     seguridad social (8% del IBC, migración 2026-10-12) y recargo
--     dominical/festivo informativo (migración 2026-10-13).
--   · Turnos: nueva columna es_festivo (bool) — marca el festivo por turno,
--     sin catálogo de fechas aparte. El domingo se detecta solo.
--   · Tipos_Turno: TURNO 3 pasó su recargo_porcentaje de 35 a 0 — el 35%
--     nocturno ahora se calcula por hora (ver Jornada_Nocturna_Legal) y se
--     suma aparte; dejarlo en 35 aquí lo duplicaría.
--   · Tabla nueva Jornada_Nocturna_Legal: histórico del corte legal de
--     jornada nocturna (Ley 2101/2021) — migración 2026-10-13.
--
--  Tablas totales: 57  |  Vistas: 12  |  Triggers: 0
-- ====================================================================

CREATE DATABASE IF NOT EXISTS molinos_erp_v4
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;
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
    id                 INT           AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único del horario de turno',
    nombre             VARCHAR(50)   NOT NULL                   COMMENT 'Nombre descriptivo del turno (TURNO 1=mañana 6-14h, TURNO 2=tarde 14-22h, TURNO 3=noche 22-6h)',
    hora_inicio        TIME          NOT NULL                   COMMENT 'Hora de inicio del turno en formato HH:MM:SS (Ej: 06:00:00)',
    hora_fin           TIME          NOT NULL                   COMMENT 'Hora de finalización del turno en formato HH:MM:SS (Ej: 14:00:00)',
    recargo_porcentaje DECIMAL(5,2)  NOT NULL DEFAULT 0         COMMENT 'Recargo PROPIO de este turno (política interna, ej. bono de la tarde) — aparte del recargo nocturno legal de 35%, que ahora se calcula por hora según Jornada_Nocturna_Legal y se suma por separado. No usar este campo para modelar la noche. Migración 2026-10-13.'
) COMMENT='Catálogo estático de horarios de operación de la planta. Los tres turnos cubren las 24 horas del día corrido.';

INSERT INTO Tipos_Turno (nombre, hora_inicio, hora_fin, recargo_porcentaje) VALUES
('TURNO 1','06:00:00','14:00:00', 0),
('TURNO 2','14:00:00','22:00:00', 25),
('TURNO 3','22:00:00','06:00:00', 0);

-- Histórico del corte legal de jornada nocturna (Ley 2101 de 2021, se ha movido varias veces).
-- Usado por nomina_liquidacion.service.ts para partir las horas de un Turno entre recargo propio
-- del turno y recargo nocturno legal (+35%, siempre hasta las 06:00). Migración 2026-10-13.
CREATE TABLE Jornada_Nocturna_Legal (
    id                    INT  AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único',
    hora_inicio_nocturno  TIME NOT NULL                   COMMENT 'Hora a partir de la cual la jornada se considera legalmente nocturna (recargo 35%); la jornada nocturna siempre termina a las 06:00',
    vigente_desde         DATE NOT NULL UNIQUE            COMMENT 'Fecha desde la cual aplica este corte. Para una fecha dada, el valor vigente es la fila con mayor vigente_desde <= esa fecha',
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) COMMENT='Histórico del corte legal de jornada nocturna (Ley 2101 de 2021).';

INSERT INTO Jornada_Nocturna_Legal (hora_inicio_nocturno, vigente_desde) VALUES
('22:00:00', '2000-01-01'),
('21:00:00', '2023-07-15'),
('20:00:00', '2024-07-15'),
('19:00:00', '2025-07-15');


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
('Bono empleado',         'Bono ocasional a un empleado, sin periodicidad fija', '#F2B84B'),
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
    codigo        VARCHAR(50)   NOT NULL UNIQUE            COMMENT 'Clave única de la tarifa usada en el backend (Ej: flete_ton_seca, retencion_mula_pct)',
    valor         DECIMAL(14,2) NOT NULL                   COMMENT 'Valor de la tarifa: pesos por tonelada o porcentaje, según el código (Ej: 100000, 1.00)',
    descripcion   VARCHAR(150)                             COMMENT 'Explicación de para qué se usa esta tarifa y cómo se interpreta su valor',
    vigente_desde DATE          NOT NULL DEFAULT (CURRENT_DATE) COMMENT 'Fecha desde la cual aplica este valor. Permite historial de cambios de tarifa.',
    updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la última modificación del registro'
) COMMENT='Tarifas globales configurables usadas en cálculos automáticos del backend. Editar aquí sin tocar el código de la aplicación. flete_ton_seca es el fallback cuando la mina no tiene zona asignada.';

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
) COMMENT='Tarifa de flete por tonelada seca para cada zona geográfica. Permite manejar múltiples tarifas en el tiempo. El backend usa la tarifa activa vigente al calcular costo_volqueta en material_planta_entrada.';


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
                      COMMENT 'Estado de la cuenta corriente de flete de este vehículo. Actualizado por el backend al abonar CxP con subtipo=flete.',
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
    tipo             ENUM('general','combustible','transportadora','laboratorio') NOT NULL DEFAULT 'general'
                     COMMENT 'Tipo de negocio del proveedor, fijo (no texto libre como la categoría) — combustible=válido como Combustible.id_gasolinera. Migración 2026-09-19',
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
) COMMENT='Usuarios con acceso al sistema ERP. Cada usuario tiene exactamente un rol. Las contraseñas siempre se almacenan hasheadas (el backend gestiona la encriptación).';


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
) COMMENT='Escala de precios de compra de material por rango de tenor (gr Au/ton). Puede ser global (id_minero/id_zona NULL), específico por minero o por zona. El backend busca el precio activo según el tenor de la entrada.';


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
    horas_trabajadas  DECIMAL(5,2)  DEFAULT 0                 COMMENT 'Horas efectivas trabajadas durante el turno. Base para cálculo de nómina cuando tipo_pago=POR_HORAS. En 0 cuando presente=FALSE.',
    presente          BOOLEAN       NOT NULL DEFAULT TRUE      COMMENT 'FALSE = el empleado no asistió ese día (ausencia); horas_trabajadas queda en 0. TRUE = turno normal. Migración 2026-09-27.',
    es_festivo        BOOLEAN       NOT NULL DEFAULT FALSE     COMMENT 'Festivo de calendario (no domingo, que se detecta solo) — se marca al registrar el turno de ese día, sin catálogo de fechas aparte. Suma +75% de recargo dominical/festivo. Migración 2026-10-13.',
    comentarios       TEXT                                     COMMENT 'Novedades, ausencias parciales, paros, incidencias u anomalías del turno',
    quincena          INT GENERATED ALWAYS AS (CASE WHEN DAY(fecha) <= 15 THEN 1 ELSE 2 END) STORED
                      COMMENT 'Período de nómina calculado automáticamente: 1=días 1 al 15 del mes, 2=días 16 al 31. No editable.',
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de registro del turno en el sistema',
    FOREIGN KEY (id_empleado)       REFERENCES Empleados(id),
    FOREIGN KEY (id_tipo_turno)     REFERENCES Tipos_Turno(id),
    FOREIGN KEY (id_planta_proceso) REFERENCES Planta_Procesos(id),
    INDEX idx_turnos_fecha (fecha),
    UNIQUE KEY uq_turno_empleado_fecha (id_empleado, fecha)
) COMMENT='Registro diario de asistencia y turnos del personal de planta. A lo sumo un turno por (empleado, fecha) — upsert, no duplicar. La columna quincena se calcula sola para facilitar la liquidación de nómina por período. Permite filtrar por empleado, área o proceso.';


CREATE TABLE Combustible (
    id                         INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del registro de combustible',
    id_gasolinera              INT           NULL                        COMMENT 'Proveedor (gasolinera o estación de servicio) que vendió el combustible, si se conoce — informativo cuando forma_pago=efectivo; obligatorio en la práctica cuando forma_pago=credito (es a quien se le arma la CxP) — ver Proveedores',
    tipo_consumo               ENUM('vehiculo','planta','maquinaria','otro') NOT NULL DEFAULT 'vehiculo'
                               COMMENT 'Destino del combustible: vehiculo=tanqueo de camión, planta=tambores para uso interno de planta, maquinaria=retroexcavadora u otro equipo, otro=sin clasificar',
    forma_pago                 ENUM('efectivo','credito') NOT NULL DEFAULT 'credito'
                               COMMENT 'efectivo=ya se pagó en el momento (adelanto en efectivo al dueño de volqueta, o caja menor de planta) y no genera CxP; credito=se cargó a la línea de crédito de la gasolinera y debe agruparse en una Cuenta_Por_Pagar',
    id_dueno_volqueta          INT           NULL                        COMMENT 'Dueño del vehículo al que se carga el combustible a crédito. El costo se descuenta del flete — ver Dueno_Volqueta',
    id_vehiculo                INT           NULL                        COMMENT 'Vehículo físico que tanqueó (cuando tipo_consumo=vehiculo) — ver Volqueta_Vehiculo',
    id_planta                  INT           NULL                        COMMENT 'Planta que consumió el combustible en tambores o equipos internos — ver Planta',
    id_material_planta_entrada INT           NULL                        COMMENT 'Entrada de material a la que se atribuye este ACPM adelantado del flete (excluyente con id_agua) — ver material_planta_entrada',
    id_agua                    INT           NULL                        COMMENT 'Viaje de agua al que se atribuye este ACPM adelantado (excluyente con id_material_planta_entrada) — ver Agua_Planta',
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
    INDEX idx_combustible_agua       (id_agua),
    INDEX idx_combustible_fecha      (fecha)
) COMMENT='Registro de tanqueos, suministros y ACPM adelantados. tipo_consumo diferencia vehículo (ACPM camión) vs planta (tambores) vs maquinaria. Fuente única del ACPM que se descuenta al flete/agua (id_material_planta_entrada | id_agua). Estado de pago a la gasolinera → v_estado_combustible.';
-- Nota: id_agua tiene su FK diferida más abajo (Agua_Planta se crea en el Módulo 8).


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
    costo_maquila           DECIMAL(14,2) DEFAULT 0                   COMMENT 'Costo de procesamiento (maquila) asignado proporcionalmente a esta entrada en pesos. Se actualiza al cerrar el lote de concentrado.',
    costo_adicional         DECIMAL(14,2) DEFAULT 0                   COMMENT 'Otros costos: muestreo, acompañamiento, transporte especial, etc., en pesos',
    costo_volqueta          DECIMAL(14,2) DEFAULT 0                   COMMENT 'Flete al transportador = total_material_seco × tarifa de zona. Calculado por el backend al registrar la entrada.',
    total_costos_operativos DECIMAL(14,2)                             COMMENT 'Suma de todos los costos operativos: cargue + báscula + maquila + adicional + volqueta',
    total_material          DECIMAL(14,2)                             COMMENT 'Valor total de la entrada = precio_total + total_costos_operativos',

    estado                  ENUM('pendiente','en_proceso','pagada','incluida_viaje','cancelada') NOT NULL DEFAULT 'pendiente'
                            COMMENT 'Estado en planta: pendiente=recién llegado, en_proceso=en molienda, pagada=pago al minero cancelado, incluida_viaje=despachado a Barranquilla, cancelada=anulada',
    estado_pago_flete       ENUM('pendiente','parcial','pagado','no_aplica') NOT NULL DEFAULT 'pendiente'
                            COMMENT 'Estado del pago del flete al dueño del vehículo. Actualizado por el backend al abonar CxP de categoría Flete volqueta.',
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
) COMMENT='Ingresos netos (excedentes) de la empresa por cada entrada de material. El backend calcula y crea este registro cuando el tenor real (au_gr_x_ton) es ≥ 4 gr Au/ton. Al distribuirlos se crean Cuentas_Por_Pagar (categoría Distribución excedente) enlazadas via Cuentas_Por_Pagar_Relacion.id_excedente.';


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
    estado            ENUM('disponible','agotado','anulado') NOT NULL DEFAULT 'disponible'
                      COMMENT 'disponible=hay saldo pendiente de descontar | agotado=el anticipo fue consumido en su totalidad | anulado=se canceló sin usarse',
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro del anticipo',
    FOREIGN KEY (id_minero)         REFERENCES Minero(id),
    FOREIGN KEY (id_dueno_volqueta) REFERENCES Dueno_Volqueta(id),
    FOREIGN KEY (id_proveedor)      REFERENCES Proveedores(id),
    CONSTRAINT chk_anticipo_tercero CHECK (
        (id_minero IS NOT NULL) + (id_dueno_volqueta IS NOT NULL) + (id_proveedor IS NOT NULL) = 1
    )
) COMMENT='Anticipos de dinero entregados a mineros, dueños de volqueta o proveedores. El monto se descuenta de pagos futuros. Exactamente un tipo de tercero por registro (CHECK garantiza). Los descuentos se auditan en Historial_Descuentos_Anticipos. Cada anticipo se espeja en Saldo_A_Favor (origen='anticipo') para poder descontarse igual que un sobrepago.';


CREATE TABLE Historial_Descuentos_Anticipos (
    id               INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del descuento aplicado',
    id_anticipo      INT           NOT NULL                    COMMENT 'Anticipo del que se realizó el descuento — ver Anticipos_Terceros',
    id_entrada       INT           NULL                        COMMENT 'Entrada de material en la que se aplicó el descuento, cuando aplica (material). NULL para flete/agua/proveedor — ver material_planta_entrada',
    id_abono_cxp     INT           NULL                        COMMENT 'Abono_CxP (metodo_pago=saldo_a_favor) que efectivamente aplicó este descuento — ver Abonos_CxP',
    fecha            DATE          NOT NULL                    COMMENT 'Fecha en que se aplicó el descuento',
    monto_descontado DECIMAL(14,2) NOT NULL                    COMMENT 'Monto descontado en esta operación específica en pesos',
    nota             VARCHAR(255)                              COMMENT 'Observación o acuerdo sobre el descuento (Ej: Descuento pactado $300.000, Acuerdo verbal con Omar)',
    created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro del descuento',
    FOREIGN KEY (id_anticipo)  REFERENCES Anticipos_Terceros(id),
    FOREIGN KEY (id_entrada)   REFERENCES material_planta_entrada(id)
    -- FK a Abonos_CxP diferida más abajo (Abonos_CxP se crea en el Módulo 11)
) COMMENT='Historial inmutable de descuentos aplicados sobre anticipos. Generalizado a material/flete/agua/proveedor: audita contra el Abono_CxP real (id_abono_cxp); id_entrada solo aplica al flujo de material.';


CREATE TABLE Analisis (
    id                       INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del análisis de laboratorio',
    id_entrada               INT           NULL                        COMMENT 'Entrada de material analizada. NULL si es un análisis de muestra compuesta sin entrada asociada — ver material_planta_entrada',
    id_material_concentrado  INT           NULL                        COMMENT 'Lote de concentrado analizado (tenores del concentrado). NULL si es análisis de materia prima. Mutuamente exclusivo con id_entrada — ver material_concentrado',
    id_tipo_analisis         INT           NOT NULL                    COMMENT 'Tipo de análisis (Cabeza, Concentrado, Colas, etc.) — ver Tipos_Analisis',
    id_mina                  INT           NULL                        COMMENT 'Mina de origen. Solo requerida si id_entrada IS NULL (análisis sin entrada directa) — ver Mina',
    id_minero                INT           NULL                        COMMENT 'Minero asociado. Solo requerido si id_entrada IS NULL — ver Minero',
    id_tipo_material         INT           NULL                        COMMENT 'Tipo de material. Solo requerido si id_entrada IS NULL — ver Tipos_Material',
    id_laboratorio           INT           NULL                        COMMENT 'Laboratorio que realizó el análisis (proveedor categoría Laboratorio) — ver Proveedores',
    numero_analisis          VARCHAR(50)                               COMMENT 'Código o número de referencia del análisis asignado por el laboratorio (puede ser compuesto: 3211+3212+3216)',
    au_concentrado           DECIMAL(10,4)                             COMMENT 'Total de gramos de Au en la muestra analizada',
    ag_concentrado           DECIMAL(10,4)                             COMMENT 'Total de gramos de Ag en la muestra analizada',
    ton                      DECIMAL(10,4)                             COMMENT 'Toneladas de material analizadas en la muestra',
    porcentaje_humedad       DECIMAL(6,4)                              COMMENT 'Humedad certificada por el laboratorio en decimal (Ej: 0.0800 = 8%). Dato oficial para cálculos de pago.',
    toneladas_humedas        DECIMAL(10,4)                             COMMENT 'Peso total con humedad en toneladas, certificado por el laboratorio',
    toneladas_secas          DECIMAL(10,4)                             COMMENT 'Peso seco certificado por el laboratorio en toneladas. Dato oficial para el cálculo del pago al minero.',
    au_gr_x_ton              DECIMAL(10,4)                             COMMENT 'Tenor de Au certificado: gramos de Au por tonelada seca (gr Au/ton). Define el precio/gramo a aplicar. Umbral de excedente: >= 4.',
    au_falso                 DECIMAL(10,4) NULL                        COMMENT 'Tenor de Au ajustado para mostrar al minero (generalmente menor al real). Aplica cuando hay acuerdo de no revelar el tenor completo.',
    ag_gr_x_ton              DECIMAL(10,4)                             COMMENT 'Tenor de Ag certificado: gramos de Ag por tonelada seca (gr Ag/ton)',
    valor_analisis           DECIMAL(14,2) NULL                        COMMENT 'Costo cobrado por el laboratorio en pesos. Se paga como CxP categoría Análisis.',
    estado_pago              ENUM('pendiente','parcial','pagado','no_aplica') NOT NULL DEFAULT 'no_aplica'
                             COMMENT 'Estado del pago al laboratorio por este análisis. no_aplica cuando el costo está incluido en un contrato marco.',
    fecha_salida             DATE                                      COMMENT 'Fecha en que el material salió de la planta hacia Barranquilla para procesamiento externo',
    comentarios              TEXT                                      COMMENT 'Diferencias con la medición interna de planta, aclaraciones técnicas u observaciones del laboratorio',
    created_at               TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro del análisis',
    FOREIGN KEY (id_entrada)       REFERENCES material_planta_entrada(id),
    FOREIGN KEY (id_tipo_analisis) REFERENCES Tipos_Analisis(id),
    FOREIGN KEY (id_mina)          REFERENCES Mina(id),
    FOREIGN KEY (id_minero)        REFERENCES Minero(id),
    FOREIGN KEY (id_tipo_material) REFERENCES Tipos_Material(id),
    FOREIGN KEY (id_laboratorio)   REFERENCES Proveedores(id),
    FOREIGN KEY (id_material_concentrado) REFERENCES material_concentrado(id),
    CONSTRAINT chk_analisis_refs CHECK (
        id_entrada IS NOT NULL
        OR id_material_concentrado IS NOT NULL
        OR (id_mina IS NOT NULL AND id_tipo_material IS NOT NULL)
    ),
    INDEX idx_analisis_entrada (id_entrada)
) COMMENT='Resultados de laboratorio por entrada de material. El tipo Cabeza es el oficial que define tenor y humedad para el pago al minero. Ver v_analisis_completo para datos siempre resueltos con referencias completas.';


-- ====================================================================
--  MÓDULO 8 · AGUA Y MULAS
-- ====================================================================

CREATE TABLE Agua_Planta (
    id                INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del registro de suministro de agua',
    id_dueno_volqueta INT           NOT NULL                    COMMENT 'Dueño del vehículo cisterna que transportó el agua a la planta — ver Dueno_Volqueta',
    fecha             DATE          NOT NULL                    COMMENT 'Fecha del suministro de agua a la planta',
    valor_viaje       DECIMAL(14,2) NOT NULL                    COMMENT 'Valor pactado en pesos por cada viaje de agua',
    cantidad_viajes   INT           NOT NULL DEFAULT 1          COMMENT 'Número de viajes de agua realizados en este registro',
    acpm              DECIMAL(14,2) DEFAULT 0                   COMMENT 'Dato de entrada LEGADO del ACPM adelantado. Se espeja a Combustible (id_agua); el neto se deriva desde ahí, no desde esta columna.',
    valor_total       DECIMAL(14,2) AS (valor_viaje * cantidad_viajes) STORED
                      COMMENT 'Valor BRUTO del suministro (valor_viaje × cantidad_viajes). El ACPM se descuenta desde Combustible (id_agua), no aquí.',
    estado_pago       ENUM('pendiente','parcial','pagado','no_aplica') NOT NULL DEFAULT 'pendiente'
                      COMMENT 'Estado de pago del registro de agua. Lo mantiene el backend al abonar (= estado de su CxP).',
    comprobante_url   VARCHAR(512)                              COMMENT 'URL o ruta del comprobante fotográfico del pago de agua',
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro',
    FOREIGN KEY (id_dueno_volqueta) REFERENCES Dueno_Volqueta(id),
    INDEX idx_agua_volqueta (id_dueno_volqueta),
    INDEX idx_agua_fecha    (fecha),
    INDEX idx_agua_estado   (estado_pago)
) COMMENT='Registro de suministros de agua a la planta en vehículos cisterna de dueños de volqueta. El valor_total se calcula automáticamente (bruto). Estado de pago (neto de ACPM) → v_estado_agua.';


ALTER TABLE Combustible
    ADD CONSTRAINT fk_combustible_agua
    FOREIGN KEY (id_agua) REFERENCES Agua_Planta(id) ON DELETE SET NULL;


CREATE TABLE Mulas (
    id               INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del despacho de mula a Barranquilla',
    id_proveedor     INT           NOT NULL                    COMMENT 'Empresa transportadora que realizó el despacho (categoría Transporte_Mula) — ver Proveedores',
    id_viaje         INT           NULL                        COMMENT 'Viaje al que está asociado este despacho — ver Viaje. NULL si aún no se ha vinculado al viaje.',
    fecha            DATE          NOT NULL                    COMMENT 'Fecha del despacho del material hacia Barranquilla para procesamiento externo',
    concepto         VARCHAR(255)                              COMMENT 'Descripción del despacho: contenido, toneladas, destino y condiciones del transporte',
    factura_num      VARCHAR(50)                               COMMENT 'Número de factura de la empresa transportadora para este servicio',
    foto_factura_url VARCHAR(512)                              COMMENT 'URL o ruta de la foto de la factura del servicio de transporte',
    valor            DECIMAL(14,2) NOT NULL                    COMMENT 'Lo que se debe pagar por este despacho (antes de retención) — la deuda, no un pago. El pago real se registra en los abonos de su Cuenta_Por_Pagar; comprobante_url de esta tabla queda sin uso desde la app (el comprobante vive en cada Abono_CxP).',
    comprobante_url  VARCHAR(512)                              COMMENT 'Sin uso desde la app (legado) — el comprobante del pago vive en cada Abono_CxP, no aquí',
    created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro del despacho',
    FOREIGN KEY (id_proveedor) REFERENCES Proveedores(id),
    INDEX idx_mulas_proveedor (id_proveedor),
    INDEX idx_mulas_fecha     (fecha)
) COMMENT='Despachos de concentrado a Barranquilla para procesamiento externo. La retención sobre el valor se calcula en v_mulas (tarifa retencion_mula_pct). Estado de pago (neto de retención) → v_estado_mulas.';


-- ====================================================================
--  MÓDULO 9 · VIAJES Y PROCESAMIENTO
-- ====================================================================
--  MÓDULO 9B · TARIFAS Y PROCESAMIENTO DE CONCENTRADO
-- ====================================================================

CREATE TABLE tarifas_proceso (
    id          INT           AUTO_INCREMENT PRIMARY KEY
                COMMENT 'Identificador único de la tarifa',
    codigo      VARCHAR(30)   NOT NULL
                COMMENT 'Código que usa el backend para leer la tarifa. '
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
                COMMENT '1=vigente usada por el backend. 0=histórica. NUNCA borrar filas',
    created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_tarifa_codigo_activo (codigo, activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tarifas de maquila y parámetros del proceso de concentración. Similar a Precio_Material pero para costos de procesamiento.
  Para actualizar anualmente: desactivar vigente e insertar nueva. El backend usa: WHERE codigo=X AND activo=1 ORDER BY fecha_desde DESC LIMIT 1';

INSERT INTO tarifas_proceso (codigo, descripcion, valor, unidad, fecha_desde) VALUES
('PROCESO_NORMAL',     'Molienda + Flotacion + Filtroprensa',                   400000, 'COP/ton',    CURDATE()),
('PROCESO_RELAVE',     'Molienda + Flotacion + Relave + Filtroprensa',           560000, 'COP/ton',    CURDATE()),
('SOLO_FILTROPRENSA',  'Solo Filtroprensa (concentrado comprado o alta humedad)', 100000, 'COP/ton',    CURDATE()),
('UMBRAL_FILTROPRENSA','Humedad minima de referencia para filtroprensa',             0.15, 'porcentaje', CURDATE());


CREATE TABLE material_concentrado (
    id                       int(11)       NOT NULL AUTO_INCREMENT
                             COMMENT 'Identificador único del lote de concentrado',
    codigo                   VARCHAR(30)   NOT NULL
                             COMMENT 'Código interno del lote (Ej: LC-2026-001)',
    fecha_inicio             DATE          NULL
                             COMMENT 'Fecha en que el primer material entró al molino',
    fecha_fin                DATE          NULL
                             COMMENT 'Fecha en que salió el concentrado del filtroprensa. NULL si aún en proceso',
    hizo_molienda            TINYINT(1)    NOT NULL DEFAULT 0,
    hizo_flotacion           TINYINT(1)    NOT NULL DEFAULT 0,
    hizo_relave              TINYINT(1)    NOT NULL DEFAULT 0,
    hizo_filtroprensa        TINYINT(1)    NOT NULL DEFAULT 0,
    toneladas_humedo         DECIMAL(10,4) NULL
                             COMMENT 'Toneladas húmedas del concentrado al salir del proceso',
    porcentaje_humedad       DECIMAL(6,4)  NULL
                             COMMENT 'Humedad del concentrado (Ej: 0.1300 = 13%)',
    toneladas_seco           DECIMAL(10,4) NULL
                             COMMENT 'Toneladas secas = toneladas_humedo × (1 - porcentaje_humedad). '
                                     'Base para calcular maquila y para la escala de análisis',
    material_seco_procesado DECIMAL(10,4) NULL COMMENT 'Total toneladas secas materia prima. Útil para calcular merma.',
    merma_seco               DECIMAL(10,4) DEFAULT 0.0000
                             COMMENT 'Toneladas secas perdidas en el proceso (polvo, derrames, etc.). '
                                     'Se descuenta del disponible real.',
    merma_au                 DECIMAL(12,4) NOT NULL DEFAULT 0
                             COMMENT 'Gramos de Au que se pierden del lote (merma); se restan a total_grs_au_venta',
    merma_ag                 DECIMAL(12,4) NOT NULL DEFAULT 0
                             COMMENT 'Gramos de Ag que se pierden del lote (merma); se restan a total_grs_ag_venta',
    toneladas_disponibles    DECIMAL(10,4) NOT NULL DEFAULT 0
                             COMMENT 'Concentrado seco disponible en planta DESPUÉS de descontar la merma y los viajes. '
                                     'Lo mantiene el backend (sin trigger).',
    ubicacion_canoa          VARCHAR(100)  NULL,
    precio_maquila_por_ton   DECIMAL(14,2) NULL,
    maquila_total            DECIMAL(14,2) NULL,
    estado                   ENUM('en_proceso','en_canoa','parcialmente_enviado','enviado_completo')
                             NOT NULL DEFAULT 'en_proceso',
    comentarios              TEXT          NULL,
    created_at               TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Lote de concentrado. La disponibilidad física se mantiene como:
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
                                     'Calculado por el backend al cerrar el lote: '
                                     '(ton_seco_aportadas / total_seco_lote) × toneladas_seco',
    maquila_proporcional     DECIMAL(14,2) NULL
                             COMMENT 'Costo de maquila de esta entrada en pesos. '
                                     'Calculado por el backend: (ton_seco_aportadas / total_seco_lote) × maquila_total. '
                                     'Propagado a material_planta_entrada.costo_maquila',
    PRIMARY KEY (id),
    UNIQUE KEY uq_conc_ent (id_material_concentrado, id_entrada),
    KEY fk_pm_mc_idx  (id_material_concentrado),
    KEY fk_pm_ent_idx (id_entrada),
    CONSTRAINT fk_pm_mc      FOREIGN KEY (id_material_concentrado) REFERENCES material_concentrado(id),
    CONSTRAINT fk_pm_entrada FOREIGN KEY (id_entrada)              REFERENCES material_planta_entrada(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tabla puente: qué entradas (camiones) alimentaron cada lote de concentrado.
  Al insertar un camión, el backend marca inventario en_proceso y kardex SALIDA_PROCESO. Al cerrar el lote, calcula concentrado_proporcional y maquila_proporcional.';


CREATE TABLE Viaje (
    id                   INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del viaje',
    numero_viaje         VARCHAR(20)   NOT NULL                    COMMENT 'Código del viaje según nomenclatura de Transfigura (Ej: 11-1, 11-2, 12-3). Formato: semana-consecutivo.',
    fecha                DATE          NOT NULL                    COMMENT 'Fecha de salida del material de la planta hacia Barranquilla',
    estado               ENUM('almacenado','despachado') NOT NULL DEFAULT 'almacenado'
                         COMMENT 'almacenado=el viaje está armado pero el material sigue en planta. despachado=ya salió en una Mula hacia Barranquilla. Lo mantiene el backend al crear/eliminar/desvincular una Mula.',
    total_costo_material DECIMAL(14,2)                             COMMENT 'Suma del costo de todo el material incluido en el viaje (sum de precio_total de cada entrada)',
    maquila              DECIMAL(14,2)                             COMMENT 'Costo total de maquila del viaje. Calculado como SUMA de viaje_material.costo_maquila. Actualizado por el backend al asignar concentrado al viaje. El costo de maquila nace en material_concentrado al cerrar el lote (en_proceso->en_canoa)',
    total_viaje          DECIMAL(14,2)                             COMMENT 'Costo total del viaje: material + maquila + otros gastos asociados',
    au_promedio_compra   DECIMAL(10,4)                             COMMENT 'Precio promedio ponderado de compra de Au en pesos por gramo, calculado sobre todas las entradas del viaje',
    tenor_au_venta       DECIMAL(10,4)                             COMMENT 'Tenor de Au al momento de venta en Barranquilla en gr/ton, certificado por el comprador',
    total_grs_au_venta   DECIMAL(10,4)                             COMMENT 'Total de gramos de Au efectivamente vendidos y certificados en el destino',
    tenor_ag             DECIMAL(10,4)                             COMMENT 'Tenor de Ag del material del viaje en gr/ton',
    total_grs_ag_venta   DECIMAL(10,4)                             COMMENT 'Total de gramos de Ag efectivamente vendidos en el destino',
    comentarios          TEXT                                      COMMENT 'Novedades, diferencias en destino, condiciones de venta o incidencias del transporte',
    created_at           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de creación del viaje en el sistema',
    updated_at           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                         COMMENT 'Fecha y hora de la última actualización del viaje',
    INDEX idx_viaje_estado (estado)
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
                                                                               'Al insertar, el backend decrementa toneladas_disponibles del lote y actualiza kardex e inventario',
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
                                                                               'Calculado por el backend al insertar. '
                                                                               'Es 0 si es_remanente=1 (ya se costeó en el viaje de origen). '
                                                                               'Es 0 si es concentrado comprado sin proceso (a menos que hizo_filtroprensa=1)',
    valor_total_con_gastos   DECIMAL(14,2)                             COMMENT 'Valor total de este lote en el viaje incluyendo todos sus costos operativos',
    -- Detalle de Au y Ag por lote (para reportes y liquidación)
    au_promedio_compra       DECIMAL(10,4) NULL                        COMMENT 'Precio promedio ponderado de compra de Au en pesos por gramo para este lote. '
                                                                               'Calculado por el backend desde procesamiento_material → material_planta_entrada',
    tenor_au_venta           DECIMAL(10,4) NULL                        COMMENT 'Tenor de Au del concentrado en gr/ton (del análisis vinculado al material_concentrado). '
                                                                               'El que Transfigura usa para liquidar',
    total_grs_au_venta       DECIMAL(10,4) NULL                        COMMENT 'Total gramos de Au de este lote = concentrado_seco × tenor_au_venta. '
                                                                               'Gramos que Transfigura reconoce de este lote',
    tenor_ag                 DECIMAL(10,4) NULL                        COMMENT 'Tenor de Ag del concentrado en gr/ton (del análisis)',
    total_grs_ag_venta       DECIMAL(10,4) NULL                        COMMENT 'Total gramos de Ag de este lote = concentrado_seco × tenor_ag',
    created_at               TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de creación del registro',
    FOREIGN KEY (id_viaje)               REFERENCES Viaje(id),
    FOREIGN KEY (id_material_concentrado) REFERENCES material_concentrado(id),
    FOREIGN KEY (id_viaje_origen)        REFERENCES Viaje(id),
    INDEX idx_vm_viaje (id_viaje),
    INDEX idx_vm_mc    (id_material_concentrado)
) COMMENT='Lotes de concentrado que componen cada viaje. Cada fila es un lote de material_concentrado asignado al viaje.
Flujo (en la app): al insertar la línea se calcula costo_maquila; luego se actualiza inventario, kardex y viaje.maquila. El detalle Au/Ag (tenor_au_venta, etc.) lo llena el backend desde el análisis vinculado.';


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
    id                       INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del lote de inventario en planta',
    id_entrada               INT           NULL                    COMMENT 'Entrada de material que origina este lote de materia prima. NULL para lotes de concentrado — ver material_planta_entrada',
    id_material_concentrado  INT           NULL                        COMMENT 'Lote de concentrado que origina este registro. NULL para lotes de materia prima. Mutuamente exclusivo con id_entrada — ver material_concentrado',
    id_mina                  INT           NULL                    COMMENT 'Mina de origen del lote. NULL para lotes de concentrado (pueden ser mezcla de minas) — ver Mina',
    id_tipo_material         INT           NULL                    COMMENT 'Tipo de material del lote. NULL para lotes de concentrado — ver Tipos_Material',
    condicion_material       ENUM('Humedo','Seco') NOT NULL            COMMENT 'Condición física del material al momento de su ingreso al inventario de planta',
    porcentaje_humedad       DECIMAL(5,4)  DEFAULT 0.0000              COMMENT 'Porcentaje de humedad del lote al ingresar al inventario (Ej: 0.1500 = 15.00%)',
    toneladas_iniciales      DECIMAL(10,4) NOT NULL                    COMMENT 'Toneladas con las que ingresó el lote. Este campo no cambia; es el registro histórico de la cantidad inicial.',
    toneladas_disponibles    DECIMAL(10,4) NOT NULL                    COMMENT 'Toneladas disponibles en planta hoy. Se actualiza por el backend al mover o consumir material.',
    estado                   ENUM('almacenado','en_proceso','agotado','faltante') DEFAULT 'almacenado'
                             COMMENT 'Estado actual: almacenado=en planta disponible, en_proceso=en molienda, agotado=consumido/despachado, faltante=diferencia física detectada',
    ubicacion                VARCHAR(100)  NULL                        COMMENT 'Ubicación física dentro de la planta donde está almacenado el lote (Ej: Patio norte, Bodega 2, Canoa 3)',
    fecha_ingreso            DATETIME      DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora en que el lote ingresó formalmente al inventario de planta',
    FOREIGN KEY (id_entrada)       REFERENCES material_planta_entrada(id),
    FOREIGN KEY (id_material_concentrado) REFERENCES material_concentrado(id),
    FOREIGN KEY (id_mina)          REFERENCES Mina(id),
    FOREIGN KEY (id_tipo_material) REFERENCES Tipos_Material(id),
    INDEX idx_inv_entrada    (id_entrada),
    INDEX idx_inv_disponible (toneladas_disponibles, estado)
) COMMENT='Stock de material en planta organizado por lote de entrada. El backend lo crea al insertar en material_planta_entrada. Cada cambio de toneladas_disponibles queda auditado en Kardex_Movimientos.';


CREATE TABLE Kardex_Movimientos (
    id                 INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único e inmutable del movimiento de inventario',
    id_lote            INT           NOT NULL                    COMMENT 'Lote de inventario afectado por este movimiento — ver Inventario_Lotes',
    fecha              DATETIME      DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora exacta del movimiento de material',
    tipo_movimiento    ENUM('ENTRADA_PLANTA','SALIDA_PROCESO','ENTRADA_CONCENTRADO','SALIDA_VIAJE','AJUSTE_MERMA') NOT NULL
                       COMMENT 'Tipo: ENTRADA_PLANTA=llegada de material a planta, SALIDA_PROCESO=ingresa a molienda, SALIDA_VIAJE=despacho a Barranquilla, AJUSTE_MERMA=corrección por diferencia física',
    toneladas_movidas  DECIMAL(10,4) NOT NULL                    COMMENT 'Toneladas involucradas en el movimiento (siempre positivo). La dirección la define tipo_movimiento.',
    destino_referencia VARCHAR(100)                              COMMENT 'A dónde fue el material o por qué se movió (Ej: Viaje 11-1, Molienda Turno Mañana, Ajuste secado)',
    id_usuario         INT                                       COMMENT 'Usuario que registró el movimiento — ver Usuarios. NULL si fue generado automáticamente por el backend.',
    comentarios        TEXT                                      COMMENT 'Observaciones, motivo del ajuste o notas adicionales sobre el movimiento de inventario',
    FOREIGN KEY (id_lote)    REFERENCES Inventario_Lotes(id),
    FOREIGN KEY (id_usuario) REFERENCES Usuarios(id),
    INDEX idx_kardex_lote  (id_lote),
    INDEX idx_kardex_fecha (fecha)
) COMMENT='Historial inmutable de todos los movimientos de material en planta. Lo escribe el backend al modificar Inventario_Lotes. Permite auditar cualquier cambio de stock en cualquier momento histórico.';


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
    valor_pagado      DECIMAL(14,2) NOT NULL DEFAULT 0          COMMENT 'Suma acumulada de todos los abonos. Actualizado por el backend al insertar un Abono_CxP.',
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
                    COMMENT 'Método: efectivo, consignacion, transferencia bancaria, nequi, descuento_nomina (empleados), saldo_a_favor (usa crédito por sobrepago o anticipo), otro',
    id_saldo_favor  INT           NULL                        COMMENT 'Solo cuando metodo_pago=saldo_a_favor: referencia al crédito por sobrepago/anticipo que se consume — ver Saldo_A_Favor',
    comprobante_url VARCHAR(512)                              COMMENT 'URL o ruta del comprobante (captura de transferencia, foto del recibo, número de confirmación)',
    observaciones   TEXT                                      COMMENT 'Notas adicionales (Ej: Pagado con fondos rotativo Trafigura, Abono parcial acordado con Camilo)',
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  COMMENT 'Fecha y hora de registro del abono en el sistema',
    FOREIGN KEY (id_cuenta_pagar) REFERENCES Cuentas_Por_Pagar(id) ON DELETE CASCADE,
    CONSTRAINT chk_saldo_favor_metodo CHECK (
        (metodo_pago = 'saldo_a_favor') = (id_saldo_favor IS NOT NULL)
    ),
    INDEX idx_abonos_cxp_cuenta (id_cuenta_pagar),
    INDEX idx_abonos_cxp_fecha  (fecha_abono)
) COMMENT='Abonos realizados sobre Cuentas_Por_Pagar. El backend actualiza valor_pagado y estado en CxP, y Saldo_A_Favor.monto_aplicado cuando metodo=saldo_a_favor.';


-- FK diferida de Historial_Descuentos_Anticipos (definida en el Módulo 7) hacia Abonos_CxP
ALTER TABLE Historial_Descuentos_Anticipos
    ADD CONSTRAINT fk_hda_abono_cxp
    FOREIGN KEY (id_abono_cxp) REFERENCES Abonos_CxP(id);


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
) COMMENT='Enlace CxP ↔ dominio con FK explícita por cada tabla. El CHECK garantiza exactamente 1 FK activa por fila. subtipo diferencia si el pago de una entrada es por material (al minero) o por flete (al volquetero).';


-- ====================================================================
--  MÓDULO 11B · NÓMINA QUINCENAL Y BONOS
-- ====================================================================

CREATE TABLE Nomina_Liquidaciones (
    id                       INT           AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único de la liquidación quincenal',
    id_empleado              INT           NOT NULL                   COMMENT 'Empleado liquidado — ver Empleados',
    anio                     INT           NOT NULL                   COMMENT 'Año de la quincena liquidada',
    mes                      INT           NOT NULL                   COMMENT 'Mes de la quincena liquidada (1-12)',
    quincena                 TINYINT       NOT NULL                   COMMENT '1 = primera quincena (paga el día 15), 2 = segunda quincena (paga a fin de mes)',
    tipo_pago                ENUM('FIJO_MENSUAL','POR_DIAS','POR_HORAS') NOT NULL COMMENT 'Copiado de Empleados_Salario vigente al momento de liquidar',
    unidades                 DECIMAL(10,2) NULL                        COMMENT 'Días u horas trabajadas en la quincena (NULL cuando tipo_pago=FIJO_MENSUAL)',
    tarifa_aplicada          DECIMAL(14,2) NOT NULL                    COMMENT 'Tarifa vigente usada en el cálculo (mensual, diaria u horaria según tipo_pago)',
    monto_bruto              DECIMAL(14,2) NOT NULL                    COMMENT 'Devengado antes de bonos y descuentos',
    total_recargo_dominical_festivo DECIMAL(14,2) NOT NULL DEFAULT 0   COMMENT 'Parte de monto_bruto atribuible al recargo dominical/festivo (+75%) — informativo, YA está incluido en monto_bruto. Migración 2026-10-13.',
    total_bonos              DECIMAL(14,2) NOT NULL DEFAULT 0          COMMENT 'Suma de Bonos_Empleado del empleado dentro del rango de fechas de esta quincena',
    total_descuento_prestamo DECIMAL(14,2) NOT NULL DEFAULT 0          COMMENT 'Cuota de Prestamos_Empleados descontada automáticamente en esta liquidación',
    aporte_salud             DECIMAL(14,2) NOT NULL DEFAULT 0          COMMENT 'Aporte a salud a cargo del empleado: 4% del IBC (monto_bruto + total_bonos). Migración 2026-10-12.',
    aporte_pension           DECIMAL(14,2) NOT NULL DEFAULT 0          COMMENT 'Aporte a pensión a cargo del empleado: 4% del IBC (monto_bruto + total_bonos). Migración 2026-10-12.',
    total_aportes_seguridad_social DECIMAL(14,2) NOT NULL DEFAULT 0    COMMENT 'aporte_salud + aporte_pension; se descuenta del monto_neto. Migración 2026-10-12.',
    otros_descuentos         DECIMAL(14,2) NOT NULL DEFAULT 0          COMMENT 'Descuentos adicionales manuales (ausencias, etc.)',
    monto_neto               DECIMAL(14,2) NOT NULL                    COMMENT 'monto_bruto + total_bonos - total_descuento_prestamo - total_aportes_seguridad_social - otros_descuentos',
    id_cuenta_pagar          INT           NULL                       COMMENT 'CxP generada al confirmar (categoría Nómina) — ver Cuentas_Por_Pagar. NULL mientras estado=borrador',
    estado                   ENUM('borrador','confirmado') NOT NULL DEFAULT 'borrador' COMMENT 'borrador = aún editable, no genera CxP. confirmado = ya generó la CxP y el descuento de préstamo',
    fecha_liquidacion        DATE          NOT NULL DEFAULT (CURRENT_DATE) COMMENT 'Fecha en que se confirmó/registró la liquidación',
    created_at               TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_empleado)     REFERENCES Empleados(id),
    FOREIGN KEY (id_cuenta_pagar) REFERENCES Cuentas_Por_Pagar(id),
    UNIQUE KEY uq_nomina_liquidacion_periodo (id_empleado, anio, mes, quincena),
    INDEX idx_nomina_liq_periodo (anio, mes, quincena)
) COMMENT='Liquidación quincenal de nómina por empleado. Una fila por empleado por quincena (1=día 15, 2=fin de mes). El bruto se calcula de Empleados_Salario (fijo) o Turno (variable, por días/horas de esa quincena).';


CREATE TABLE Bonos_Empleado (
    id              INT           AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único del bono',
    id_empleado     INT           NOT NULL                   COMMENT 'Empleado que recibe el bono — ver Empleados',
    fecha           DATE          NOT NULL DEFAULT (CURRENT_DATE) COMMENT 'Fecha en que se otorgó el bono',
    concepto        VARCHAR(255)  NOT NULL                   COMMENT 'Motivo del bono (Ej: Bono de producción, Bono navideño)',
    valor           DECIMAL(14,2) NOT NULL                   COMMENT 'Monto del bono en pesos colombianos',
    id_cuenta_pagar INT           NULL                       COMMENT 'CxP generada al crear el bono (categoría Bono empleado) — ver Cuentas_Por_Pagar',
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_empleado)     REFERENCES Empleados(id),
    FOREIGN KEY (id_cuenta_pagar) REFERENCES Cuentas_Por_Pagar(id),
    INDEX idx_bonos_empleado_fecha (id_empleado, fecha)
) COMMENT='Bonos ocasionales a empleados, sin periodicidad fija. Cada bono genera su propia Cuenta_Por_Pagar (categoría Bono empleado), igual que cualquier otro egreso de la empresa.';


-- ====================================================================
--  MÓDULO 11C · TESORERÍA (INGRESOS)
-- ====================================================================

CREATE TABLE Categorias_Ingreso (
    id          INT          AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único de la categoría de ingreso',
    nombre      VARCHAR(100) NOT NULL                   COMMENT 'Nombre de la categoría (Préstamo recibido, Cobro a tercero, Aporte de socio, Venta, Otro)',
    descripcion VARCHAR(255)                            COMMENT 'Descripción del tipo de ingreso que representa esta categoría',
    UNIQUE KEY uq_categoria_ingreso_nombre (nombre)
) COMMENT='Tipos de ingreso de tesorería de la empresa. Clasifica cada entrada real de dinero (distinto de Deposito, que es solo caja menor de planta).';

INSERT INTO Categorias_Ingreso (nombre, descripcion) VALUES
('Préstamo recibido', 'Desembolso de un préstamo financiero (banco o fondo de inversión) — ver Prestamos_Financieros'),
('Cobro a tercero',   'Recuperación de una Cuenta_Por_Cobrar u otro cobro a un tercero'),
('Aporte de socio',   'Dinero aportado por un socio de la empresa'),
('Venta',             'Ingreso por venta de material o servicio'),
('Otro',              'Ingreso no clasificado en las categorías anteriores');


CREATE TABLE Ingresos_Tesoreria (
    id               INT           AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único del ingreso de tesorería',
    id_categoria     INT           NOT NULL                   COMMENT 'Tipo de ingreso — ver Categorias_Ingreso',
    concepto         VARCHAR(255)  NOT NULL                   COMMENT 'Descripción del ingreso (Ej: Desembolso préstamo Davivienda, Aporte socio Camilo)',
    valor            DECIMAL(15,2) NOT NULL                   COMMENT 'Monto del ingreso en pesos colombianos',
    fecha            DATE          NOT NULL DEFAULT (CURRENT_DATE) COMMENT 'Fecha en que entró el dinero a la empresa',
    id_prestamo_fin  INT           NULL                       COMMENT 'Cuando el ingreso ES un desembolso de préstamo financiero — ver Prestamos_Financieros',
    comprobante_url  VARCHAR(512)                              COMMENT 'URL o ruta del comprobante del ingreso (consignación, transferencia, etc.)',
    created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_categoria)    REFERENCES Categorias_Ingreso(id),
    FOREIGN KEY (id_prestamo_fin) REFERENCES Prestamos_Financieros(id),
    INDEX idx_ingresos_fecha (fecha)
) COMMENT='Todo el dinero que entra realmente a la empresa (distinto de Deposito, que es solo caja menor de planta). Base para el flujo de caja mensual (ingresos vs. gastos de Abonos_CxP).';


-- Interés y abonos de Prestamos_Financieros — ver migracion_prestamos_financieros_interes_2026-10-01.sql
CREATE TABLE Movimientos_Prestamo_Financiero (
    id               INT           AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único del movimiento',
    id_prestamo_fin  INT           NOT NULL                   COMMENT 'Préstamo financiero afectado — ver Prestamos_Financieros',
    tipo             ENUM('interes','abono') NOT NULL         COMMENT 'interes = interés acumulado del período (no es salida de caja, capitaliza el saldo); abono = pago real registrado vía Abonos_CxP',
    fecha            DATE          NOT NULL                   COMMENT 'Fecha del movimiento',
    valor            DECIMAL(15,2) NOT NULL                   COMMENT 'Monto del movimiento en pesos colombianos (siempre positivo; tipo indica si suma o resta al saldo)',
    saldo_resultante DECIMAL(15,2) NOT NULL                   COMMENT 'Saldo_pendiente del préstamo inmediatamente después de aplicar este movimiento',
    id_abono_cxp     INT           NULL                       COMMENT 'Solo cuando tipo=abono: el Abono_CxP real que generó este movimiento — ver Abonos_CxP',
    observaciones    VARCHAR(255)                              COMMENT 'Notas adicionales (Ej: Interés de 3 meses acumulado, Abono parcial Davivienda)',
    created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_prestamo_fin) REFERENCES Prestamos_Financieros(id),
    FOREIGN KEY (id_abono_cxp)    REFERENCES Abonos_CxP(id),
    INDEX idx_mov_prestamo_fin (id_prestamo_fin, fecha)
) COMMENT='Historial de movimientos del saldo de un préstamo financiero: acumulación de interés (capitaliza, no es caja) y abonos (sí son caja, reflejados también en Cuentas_Por_Pagar/Abonos_CxP vía Cuentas_Por_Pagar_Relacion.id_prestamo_fin).';


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
    valor_cobrado     DECIMAL(14,2) NOT NULL DEFAULT 0          COMMENT 'Total cobrado al tercero hasta la fecha. Actualizado por el backend al insertar un Abono_CxC.',
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
) COMMENT='Cobros recibidos sobre Cuentas_Por_Cobrar. El backend actualiza valor_cobrado y estado. descuento_flete y descuento_nomina permiten el descuento automático en el momento del pago.';


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
--  MÓDULO 13 · SALDO A FAVOR (SOBREPAGO / ANTICIPO)
-- ====================================================================

CREATE TABLE Saldo_A_Favor (
    id                INT           AUTO_INCREMENT PRIMARY KEY  COMMENT 'Identificador único del crédito por sobrepago',
    origen            ENUM('pago_excedido','ajuste_manual','anticipo') NOT NULL
                      COMMENT 'Origen: pago_excedido=valor_pagado superó valor_total en un Abono_CxP, ajuste_manual=corrección contable manual, anticipo=espejo de un Anticipos_Terceros creado a propósito',
    id_abono_cxp_orig INT           NULL                        COMMENT 'Abono que generó el sobrepago cuando origen=pago_excedido — ver Abonos_CxP',
    id_anticipo       INT           NULL                        COMMENT 'Solo cuando origen=anticipo: anticipo del que este crédito es espejo — ver Anticipos_Terceros',

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
    FOREIGN KEY (id_anticipo)       REFERENCES Anticipos_Terceros(id),
    CONSTRAINT chk_saf_un_beneficiario CHECK (
        (id_minero IS NOT NULL) + (id_dueno_volqueta IS NOT NULL) +
        (id_proveedor IS NOT NULL) + (id_empleado IS NOT NULL) = 1
    ),
    CONSTRAINT chk_saf_origen_anticipo CHECK (
        (origen = 'anticipo') = (id_anticipo IS NOT NULL)
    ),
    INDEX idx_saf_minero    (id_minero),
    INDEX idx_saf_volqueta  (id_dueno_volqueta),
    INDEX idx_saf_proveedor (id_proveedor),
    INDEX idx_saf_estado    (estado)
) COMMENT='Créditos por sobrepago o por anticipo entregado a un tercero. Se resuelve descontando del próximo pago (metodo=saldo_a_favor en Abonos_CxP) o con devolución del tercero.';


-- FK diferida de Abonos_CxP (definida en el Módulo 11) hacia Saldo_A_Favor
ALTER TABLE Abonos_CxP
    ADD CONSTRAINT fk_abonos_saldo_favor
    FOREIGN KEY (id_saldo_favor) REFERENCES Saldo_A_Favor(id) ON DELETE RESTRICT;


-- ====================================================================
--  MÓDULO 14 · VISTAS CALCULADAS
-- ====================================================================

-- v_estado_pago_material: prorratea el pago de la CxP entre las entradas
-- que cubre (monto_aplicado × valor_pagado/valor_total de la CxP), en vez
-- de sumar todos los abonos a cada entrada (lo que sobrecontaba cuando una
-- sola CxP agrupa varias volquetas).
CREATE OR REPLACE VIEW v_estado_pago_material AS
SELECT
    mpe.id                                                       AS id_entrada,
    mpe.numero_volqueta                                         AS numero_volqueta,
    mpe.fecha_llegada                                          AS fecha_llegada,
    mn.nombre                                                   AS minero,
    COALESCE(cpr.monto_aplicado, mpe.precio_total)             AS valor_total,
    ROUND(COALESCE(cpr.monto_aplicado, 0)
          * (COALESCE(cp.valor_pagado, 0) / NULLIF(cp.valor_total, 0)), 2)         AS total_pagado,
    ROUND(COALESCE(cpr.monto_aplicado, mpe.precio_total)
          - COALESCE(cpr.monto_aplicado, 0)
            * (COALESCE(cp.valor_pagado, 0) / NULLIF(cp.valor_total, 0)), 2)       AS saldo_pendiente,
    CASE
        WHEN cp.id IS NULL OR COALESCE(cp.valor_pagado, 0) <= 0 THEN 'pendiente'
        WHEN cp.valor_pagado >= cp.valor_total                  THEN 'pagado'
        ELSE 'parcial'
    END AS estado_pago
FROM      material_planta_entrada mpe
JOIN      Mina    mi ON mi.id  = mpe.id_mina
LEFT JOIN Minero  mn ON mn.id  = mi.id_minero
LEFT JOIN Cuentas_Por_Pagar_Relacion cpr
       ON cpr.id_entrada = mpe.id AND cpr.subtipo = 'material' COLLATE utf8mb4_unicode_ci
LEFT JOIN Cuentas_Por_Pagar cp
       ON cp.id = cpr.id_cuenta_pagar AND cp.estado != 'anulado' COLLATE utf8mb4_unicode_ci;


-- v_estado_pago_flete: NETA (resta ACPM de Combustible) y PRORRATEADA (usa
-- monto_aplicado × valor_pagado/valor_total, sin fan-out de abonos). El
-- detalle por dueño lo arma el backend materializando cuentas mensuales;
-- esta vista alimenta el KPI global de deuda. Estado por viaje →
-- material_planta_entrada.estado_pago_flete.
CREATE OR REPLACE VIEW v_estado_pago_flete AS
SELECT
    mpe.id                                                              AS id_entrada,
    vv.placa,
    dv.nombre                                                           AS dueno_volqueta,
    mpe.costo_volqueta                                                  AS flete_bruto,
    COALESCE(cb.acpm, 0)                                                AS acpm,
    COALESCE(cpr.monto_aplicado, GREATEST(mpe.costo_volqueta - COALESCE(cb.acpm, 0), 0)) AS valor_total,
    ROUND(COALESCE(cpr.monto_aplicado, 0)
          * (COALESCE(cp.valor_pagado, 0) / NULLIF(cp.valor_total, 0)), 2)              AS total_pagado,
    ROUND(COALESCE(cpr.monto_aplicado, GREATEST(mpe.costo_volqueta - COALESCE(cb.acpm, 0), 0))
          - COALESCE(cpr.monto_aplicado, 0)
            * (COALESCE(cp.valor_pagado, 0) / NULLIF(cp.valor_total, 0)), 2)            AS saldo_pendiente,
    CASE
        WHEN COALESCE(cp.valor_pagado, 0) <= 0        THEN 'pendiente'
        WHEN cp.valor_pagado >= cp.valor_total        THEN 'pagado'
        ELSE 'parcial'
    END                                                                AS estado_pago
FROM      material_planta_entrada mpe
LEFT JOIN Volqueta_Vehiculo vv ON vv.id = mpe.id_vehiculo
LEFT JOIN Dueno_Volqueta    dv ON dv.id = vv.id_dueno_volqueta
LEFT JOIN (
    SELECT id_material_planta_entrada AS id_entrada, SUM(valor) AS acpm
    FROM   Combustible
    WHERE  id_material_planta_entrada IS NOT NULL
    GROUP BY id_material_planta_entrada
)         cb  ON cb.id_entrada = mpe.id
LEFT JOIN Cuentas_Por_Pagar_Relacion cpr
       ON cpr.id_entrada = mpe.id AND cpr.subtipo = 'flete'
LEFT JOIN Cuentas_Por_Pagar cp
       ON cp.id = cpr.id_cuenta_pagar AND cp.estado != 'anulado'
WHERE     mpe.costo_volqueta > 0 AND mpe.estado != 'cancelada';


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
    dv.nombre                AS dueno_volqueta,
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
    c.id, c.forma_pago, c.valor AS valor_total,
    CASE WHEN c.forma_pago = 'efectivo' THEN c.valor ELSE COALESCE(SUM(ab.valor),0) END AS total_pagado,
    CASE WHEN c.forma_pago = 'efectivo' THEN 0 ELSE GREATEST(c.valor - COALESCE(SUM(ab.valor),0), 0) END AS saldo_pendiente,
    CASE WHEN c.forma_pago = 'efectivo' THEN 'pagado'
         WHEN COALESCE(SUM(ab.valor),0)<=0 THEN 'pendiente'
         WHEN COALESCE(SUM(ab.valor),0)>=c.valor THEN 'pagado' ELSE 'parcial' END AS estado_pago
FROM Combustible c
LEFT JOIN Cuentas_Por_Pagar_Relacion cpr ON cpr.id_combustible = c.id
LEFT JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar AND cp.estado!='anulado'
LEFT JOIN Abonos_CxP ab ON ab.id_cuenta_pagar = cp.id
GROUP BY c.id, c.forma_pago, c.valor;


-- v_estado_agua: NETA (resta ACPM de Combustible por id_agua) y
-- PRORRATEADA (sin fan-out de abonos). El detalle por dueño lo arma el
-- backend.
CREATE VIEW v_estado_agua AS
SELECT
    ap.id                                                             AS id_agua,
    dv.nombre                                                         AS dueno_volqueta,
    ap.valor_total                                                    AS bruto,
    COALESCE(cb.acpm, 0)                                              AS acpm,
    COALESCE(cpr.monto_aplicado, GREATEST(ap.valor_total - COALESCE(cb.acpm, 0), 0)) AS valor_total,
    ROUND(COALESCE(cpr.monto_aplicado, 0)
          * (COALESCE(cp.valor_pagado, 0) / NULLIF(cp.valor_total, 0)), 2)              AS total_pagado,
    ROUND(COALESCE(cpr.monto_aplicado, GREATEST(ap.valor_total - COALESCE(cb.acpm, 0), 0))
          - COALESCE(cpr.monto_aplicado, 0)
            * (COALESCE(cp.valor_pagado, 0) / NULLIF(cp.valor_total, 0)), 2)            AS saldo_pendiente,
    CASE
        WHEN COALESCE(cp.valor_pagado, 0) <= 0 THEN 'pendiente'
        WHEN cp.valor_pagado >= cp.valor_total THEN 'pagado'
        ELSE 'parcial'
    END                                                               AS estado_pago
FROM      Agua_Planta ap
LEFT JOIN Dueno_Volqueta dv ON dv.id = ap.id_dueno_volqueta
LEFT JOIN (
    SELECT id_agua, SUM(valor) AS acpm
    FROM   Combustible
    WHERE  id_agua IS NOT NULL
    GROUP BY id_agua
)         cb  ON cb.id_agua = ap.id
LEFT JOIN Cuentas_Por_Pagar_Relacion cpr ON cpr.id_agua = ap.id
LEFT JOIN Cuentas_Por_Pagar cp ON cp.id = cpr.id_cuenta_pagar AND cp.estado != 'anulado';


-- v_estado_mulas: NETA de retención (lee la CxP real, no Mulas.valor bruto).
CREATE VIEW v_estado_mulas AS
SELECT
    m.id,
    COALESCE(cp.valor_total, m.valor)   AS valor_total,
    COALESCE(cp.valor_pagado, 0)        AS total_pagado,
    COALESCE(cp.saldo, m.valor)         AS saldo_pendiente,
    COALESCE(cp.estado, 'pendiente')    AS estado_pago
FROM       Mulas m
LEFT JOIN  Cuentas_Por_Pagar_Relacion cpr ON cpr.id_mula = m.id
LEFT JOIN  Cuentas_Por_Pagar cp           ON cp.id = cpr.id_cuenta_pagar AND cp.estado != 'anulado';


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


-- v_analisis_completo: resuelve mina/minero/tipo_material aunque el
-- análisis no tenga id_entrada directa (muestra compuesta).
CREATE VIEW v_analisis_completo AS
SELECT
    a.*,
    COALESCE(a.id_mina,          mpe.id_mina)          AS id_mina_resuelto,
    COALESCE(a.id_minero,        mi.id_minero)         AS id_minero_resuelto,
    COALESCE(a.id_tipo_material, mpe.id_tipo_material) AS tipo_mat_resuelto
FROM      Analisis a
LEFT JOIN material_planta_entrada mpe ON mpe.id = a.id_entrada
LEFT JOIN Mina                    mi  ON mi.id = COALESCE(a.id_mina, mpe.id_mina);


SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES   = 1;

-- ====================================================================
--  FIN DEL ESQUEMA v4  ·  56 tablas · 12 vistas · 0 triggers
-- --------------------------------------------------------------------
--  Notas de lógica de negocio que vive en el backend (sin DDL):
--   · Excedente: aplica cuando el tenor real (au_gr_x_ton) >= 4 gr Au/ton.
--   · Tarifas de maquila: se versionan por fecha en tarifas_proceso
--     (POST /material/tarifas-proceso crea nueva vigencia y cierra la
--     anterior).
--   · viaje_material.valor_total_con_gastos se deriva del total_material
--     del lote (material+gastos, sin excedente) prorrateado por el seco
--     despachado.
--   · Al cerrar un lote de concentrado, porcentaje_humedad es OPCIONAL
--     (se toma del análisis correspondiente si existe).
--   · Flujo de sobrepago: se detecta valor_pagado > valor_total en una
--     CxP → INSERT Saldo_A_Favor (origen='pago_excedido') → se resuelve
--     con devolución o con un Abono_CxP futuro (metodo='saldo_a_favor').
--   · Flujo de anticipo: Anticipos_Terceros se espeja en Saldo_A_Favor
--     (origen='anticipo') para poder descontarse igual que un sobrepago.
-- ====================================================================
