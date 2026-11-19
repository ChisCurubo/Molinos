-- ====================================================================
--  SISTEMA ERP -- MOLINOS DE COLOMBIA -- ESQUEMA v5 (SIN TRIGGERS)
--  MySQL 8.0.16+  |  utf8mb4  |  nombres de tabla en minuscula (igual
--  a la BD real y a las queries del backend: FROM mina, INTO mina, etc.)
-- --------------------------------------------------------------------
--  Generado a partir del estado real de la base de datos en produccion
--  (MolinosExport.sql), reducido a solo lo necesario para CREAR la BD:
--   - CREATE TABLE con columnas, PK, FK, CHECK e indices reales.
--   - Semilla de catalogos/tipados imprescindibles para operar
--     (plantas, zonas, categorias, tipos_*, roles/permisos, retencion).
--   - SIN datos transaccionales reales (empleados, mineros, viajes,
--     entradas, cuentas, etc. quedan vacios -- son datos de negocio,
--     no estructura).
--  No tiene triggers: toda la logica (inventario/kardex, maquila,
--  excedente, retefuente/reteIVA, 4x1000, estado de pago) vive en el
--  backend (Node/TS), no en la base de datos.
--  Historial narrativo de cambios -> molinos_coments_v4.sql
-- ====================================================================

CREATE DATABASE IF NOT EXISTS molinos_erp_v4
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE molinos_erp_v4;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES   = 0;

-- ====================================================================
--  ESTRUCTURA (71 tablas)
-- ====================================================================

DROP TABLE IF EXISTS `abonos_cxc`;
CREATE TABLE `abonos_cxc` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_cxc` int NOT NULL COMMENT 'Cuenta por cobrar que recibe el abono — ver `cuentas_por_cobrar`',
  `fecha_cobro` date NOT NULL COMMENT 'Fecha en que se recibió el cobro',
  `valor` decimal(14,2) NOT NULL COMMENT 'Monto cobrado',
  `metodo` enum('efectivo','transferencia','descuento_flete','descuento_nomina','otro') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'efectivo' COMMENT 'Forma en que se recibió el cobro',
  `comprobante_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL o ruta del comprobante adjunto',
  `observaciones` text COLLATE utf8mb4_unicode_ci COMMENT 'Observaciones libres',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `idx_abonos_cxc_cuenta` (`id_cxc`),
  KEY `idx_abonos_cxc_fecha` (`fecha_cobro`),
  CONSTRAINT `abonos_cxc_ibfk_1` FOREIGN KEY (`id_cxc`) REFERENCES `cuentas_por_cobrar` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cobros sobre CxC. Reduce el saldo (trigger).';

DROP TABLE IF EXISTS `abonos_cxp`;
CREATE TABLE `abonos_cxp` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_cuenta_pagar` int NOT NULL COMMENT 'Cuenta por pagar que recibe el abono — ver `cuentas_por_pagar`',
  `fecha_abono` date NOT NULL COMMENT 'Fecha en que se realizó el abono',
  `valor` decimal(14,2) NOT NULL COMMENT 'Monto abonado',
  `metodo_pago` enum('efectivo','consignacion','transferencia','nequi','descuento_nomina','saldo_a_favor','otro') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'efectivo' COMMENT 'Forma en que se realizó el pago',
  `id_saldo_favor` int DEFAULT NULL COMMENT 'Solo cuando metodo_pago=saldo_a_favor',
  `comprobante_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL o ruta del comprobante adjunto',
  `observaciones` text COLLATE utf8mb4_unicode_ci COMMENT 'Observaciones libres',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  `id_cuenta_bancaria` int DEFAULT NULL COMMENT 'Cuenta bancaria de la que salió el dinero. NULL en todo lo histórico (solo aplica hacia adelante) y en pagos que no mueven cuenta real (efectivo, descuento_nomina, saldo_a_favor)',
  PRIMARY KEY (`id`),
  KEY `idx_abonos_cxp_cuenta` (`id_cuenta_pagar`),
  KEY `idx_abonos_cxp_fecha` (`fecha_abono`),
  KEY `fk_abonos_saldo_favor` (`id_saldo_favor`),
  KEY `id_cuenta_bancaria` (`id_cuenta_bancaria`),
  CONSTRAINT `abonos_cxp_ibfk_1` FOREIGN KEY (`id_cuenta_pagar`) REFERENCES `cuentas_por_pagar` (`id`) ON DELETE CASCADE,
  CONSTRAINT `abonos_cxp_ibfk_2` FOREIGN KEY (`id_cuenta_bancaria`) REFERENCES `cuentas_bancarias` (`id`),
  CONSTRAINT `fk_abonos_saldo_favor` FOREIGN KEY (`id_saldo_favor`) REFERENCES `saldo_a_favor` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_saldo_favor_metodo` CHECK (((`metodo_pago` = _utf8mb4'saldo_a_favor') = (`id_saldo_favor` is not null)))
) ENGINE=InnoDB AUTO_INCREMENT=91 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Abonos a CxP. id_saldo_favor cuando se usa crédito por sobrepago.';

DROP TABLE IF EXISTS `agua_planta`;
CREATE TABLE `agua_planta` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_dueno_volqueta` int NOT NULL COMMENT 'Dueño que prestó el suministro de agua — ver `dueno_volqueta`',
  `fecha` date NOT NULL COMMENT 'Fecha del registro',
  `valor_viaje` decimal(14,2) NOT NULL COMMENT 'Valor de un viaje individual de agua',
  `cantidad_viajes` int NOT NULL DEFAULT '1' COMMENT 'Número de viajes de agua cobrados en este registro',
  `acpm` decimal(14,2) DEFAULT '0.00' COMMENT 'ACPM histórico restado manualmente (previo a modelarlo vía `combustible`)',
  `valor_total` decimal(14,2) GENERATED ALWAYS AS ((`valor_viaje` * `cantidad_viajes`)) STORED COMMENT 'Valor BRUTO del suministro (valor_viaje × cantidad_viajes). El ACPM se descuenta desde Combustible (no aquí).',
  `estado_pago` enum('pendiente','parcial','pagado','no_aplica') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendiente' COMMENT 'Estado de pago al dueño del suministro',
  `comprobante_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL o ruta del comprobante adjunto',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `idx_agua_volqueta` (`id_dueno_volqueta`),
  KEY `idx_agua_fecha` (`fecha`),
  KEY `idx_agua_estado` (`estado_pago`),
  CONSTRAINT `agua_planta_ibfk_1` FOREIGN KEY (`id_dueno_volqueta`) REFERENCES `dueno_volqueta` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=63 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Estado de pago → v_estado_agua';

DROP TABLE IF EXISTS `alquileres`;
CREATE TABLE `alquileres` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_tipo` int DEFAULT NULL COMMENT 'Categoría del alquiler — ver `tipos_alquiler`',
  `id_proveedor` int DEFAULT NULL COMMENT 'Arrendador que cobra el alquiler — ver `proveedores`',
  `id_contrato` int DEFAULT NULL COMMENT 'Contrato de arriendo que generó este cobro mensual (NULL = alquiler puntual, sin contrato) — ver Contratos_Alquiler',
  `fecha_inicio` date NOT NULL COMMENT 'Fecha del mes/cobro de alquiler',
  `concepto` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Descripción del concepto u operación',
  `valor` decimal(15,2) NOT NULL COMMENT 'Valor del alquiler de ese mes',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  `deleted_at` timestamp NULL DEFAULT NULL COMMENT 'Borrado lógico: con fecha = registro cancelado/eliminado',
  `valor_iva` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'IVA incluido en el valor del alquiler, si se conoce (entrada manual). Base para la reteIVA, hoy inactiva — ver Conceptos_Retencion.',
  `retencion_fuente_manual` decimal(14,2) DEFAULT NULL COMMENT 'Override manual de la retefuente al crear/editar el alquiler. NULL = automático (catálogo); 0 = fuerza que no aplique; >0 = fuerza ese valor exacto.',
  `reteiva_manual` decimal(14,2) DEFAULT NULL COMMENT 'Override manual de la reteIVA al crear/editar el alquiler. NULL = automático (catálogo); 0 = fuerza que no aplique; >0 = fuerza ese valor exacto.',
  PRIMARY KEY (`id`),
  KEY `id_tipo` (`id_tipo`),
  KEY `id_proveedor` (`id_proveedor`),
  KEY `idx_alquileres_fecha` (`fecha_inicio`),
  KEY `fk_alquileres_contrato` (`id_contrato`),
  CONSTRAINT `alquileres_ibfk_1` FOREIGN KEY (`id_tipo`) REFERENCES `tipos_alquiler` (`id`),
  CONSTRAINT `alquileres_ibfk_2` FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id`),
  CONSTRAINT `fk_alquileres_contrato` FOREIGN KEY (`id_contrato`) REFERENCES `contratos_alquiler` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Estado de pago → v_estado_alquileres';

DROP TABLE IF EXISTS `analisis`;
CREATE TABLE `analisis` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_entrada` int DEFAULT NULL COMMENT 'Entrada de material analizada, cuando aplica — ver `material_planta_entrada`',
  `id_material_concentrado` int DEFAULT NULL COMMENT 'Lote de concentrado analizado, cuando aplica — ver `material_concentrado`',
  `id_tipo_analisis` int NOT NULL COMMENT 'Tipo de análisis realizado — ver `tipos_analisis`',
  `id_mina` int DEFAULT NULL COMMENT 'Solo si id_entrada IS NULL',
  `id_minero` int DEFAULT NULL COMMENT 'Solo si id_entrada IS NULL',
  `id_tipo_material` int DEFAULT NULL COMMENT 'Solo si id_entrada IS NULL',
  `id_laboratorio` int DEFAULT NULL COMMENT 'Laboratorio que realizó el análisis — ver `proveedores`',
  `numero_analisis` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Número de reporte asignado por el laboratorio',
  `au_concentrado` decimal(10,4) DEFAULT NULL COMMENT 'Ley de oro (Au) reportada en el concentrado analizado',
  `ag_concentrado` decimal(10,4) DEFAULT NULL COMMENT 'Ley de plata (Ag) reportada en el concentrado analizado',
  `ton` decimal(10,4) DEFAULT NULL COMMENT 'Toneladas de la muestra analizada',
  `porcentaje_humedad` decimal(6,4) DEFAULT NULL COMMENT 'Porcentaje de humedad reportado por el laboratorio',
  `toneladas_humedas` decimal(10,4) DEFAULT NULL COMMENT 'Toneladas húmedas reportadas',
  `toneladas_secas` decimal(10,4) DEFAULT NULL COMMENT 'Toneladas secas reportadas (toneladas_humedas sin la humedad)',
  `au_gr_x_ton` decimal(10,4) DEFAULT NULL COMMENT 'Gramos de Au por tonelada seca',
  `au_falso` decimal(10,4) DEFAULT NULL COMMENT 'Tenor de Au ajustado para mostrar al minero (generalmente menor al real). Aplica cuando hay acuerdo de no revelar el tenor completo.',
  `ag_gr_x_ton` decimal(10,4) DEFAULT NULL COMMENT 'Gramos de Ag por tonelada seca',
  `valor_analisis` decimal(14,2) DEFAULT NULL COMMENT 'Costo del análisis cobrado por el laboratorio',
  `estado_pago` enum('pendiente','parcial','pagado','no_aplica') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'no_aplica' COMMENT 'Estado de pago al laboratorio por este análisis',
  `fecha_salida` date DEFAULT NULL COMMENT 'Fecha en que el laboratorio entregó el resultado',
  `comentarios` text COLLATE utf8mb4_unicode_ci COMMENT 'Comentarios u observaciones libres',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `id_tipo_analisis` (`id_tipo_analisis`),
  KEY `id_mina` (`id_mina`),
  KEY `id_minero` (`id_minero`),
  KEY `id_tipo_material` (`id_tipo_material`),
  KEY `id_laboratorio` (`id_laboratorio`),
  KEY `idx_analisis_entrada` (`id_entrada`),
  KEY `fk_an_mc_idx` (`id_material_concentrado`),
  CONSTRAINT `analisis_ibfk_1` FOREIGN KEY (`id_entrada`) REFERENCES `material_planta_entrada` (`id`),
  CONSTRAINT `analisis_ibfk_2` FOREIGN KEY (`id_tipo_analisis`) REFERENCES `tipos_analisis` (`id`),
  CONSTRAINT `analisis_ibfk_3` FOREIGN KEY (`id_mina`) REFERENCES `mina` (`id`),
  CONSTRAINT `analisis_ibfk_4` FOREIGN KEY (`id_minero`) REFERENCES `minero` (`id`),
  CONSTRAINT `analisis_ibfk_5` FOREIGN KEY (`id_tipo_material`) REFERENCES `tipos_material` (`id`),
  CONSTRAINT `analisis_ibfk_6` FOREIGN KEY (`id_laboratorio`) REFERENCES `proveedores` (`id`),
  CONSTRAINT `fk_an_mc` FOREIGN KEY (`id_material_concentrado`) REFERENCES `material_concentrado` (`id`),
  CONSTRAINT `chk_analisis_refs` CHECK (((`id_entrada` is not null) or (`id_material_concentrado` is not null) or ((`id_mina` is not null) and (`id_tipo_material` is not null))))
) ENGINE=InnoDB AUTO_INCREMENT=270 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Análisis de laboratorio. Ver v_analisis_completo.';

DROP TABLE IF EXISTS `anticipos_terceros`;
CREATE TABLE `anticipos_terceros` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_minero` int DEFAULT NULL COMMENT 'Minero que recibe el anticipo, cuando aplica — ver `minero`',
  `id_dueno_volqueta` int DEFAULT NULL COMMENT 'Dueño de volqueta que recibe el anticipo, cuando aplica — ver `dueno_volqueta`',
  `id_proveedor` int DEFAULT NULL COMMENT 'Proveedor que recibe el anticipo, cuando aplica — ver `proveedores`',
  `fecha` date NOT NULL COMMENT 'Fecha del registro',
  `monto_inicial` decimal(14,2) NOT NULL COMMENT 'Monto original entregado como anticipo',
  `monto_usado` decimal(14,2) DEFAULT '0.00' COMMENT 'Cuánto del anticipo ya se descontó en compras posteriores',
  `saldo_disponible` decimal(14,2) GENERATED ALWAYS AS ((`monto_inicial` - `monto_usado`)) STORED COMMENT 'monto_inicial - monto_usado',
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción libre',
  `estado` enum('disponible','agotado','anulado') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'disponible' COMMENT 'disponible=hay saldo pendiente de descontar | agotado=consumido en su totalidad | anulado=el anticipo se canceló sin usarse',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `id_minero` (`id_minero`),
  KEY `id_dueno_volqueta` (`id_dueno_volqueta`),
  KEY `id_proveedor` (`id_proveedor`),
  CONSTRAINT `anticipos_terceros_ibfk_1` FOREIGN KEY (`id_minero`) REFERENCES `minero` (`id`),
  CONSTRAINT `anticipos_terceros_ibfk_2` FOREIGN KEY (`id_dueno_volqueta`) REFERENCES `dueno_volqueta` (`id`),
  CONSTRAINT `anticipos_terceros_ibfk_3` FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id`),
  CONSTRAINT `chk_anticipo_tercero` CHECK (((((`id_minero` is not null) + (`id_dueno_volqueta` is not null)) + (`id_proveedor` is not null)) = 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Anticipo entregado a un minero, dueño de volqueta o proveedor, descontable luego en compras futuras — ver `historial_descuentos_anticipos`.';

DROP TABLE IF EXISTS `bonos_empleado`;
CREATE TABLE `bonos_empleado` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único del bono',
  `id_empleado` int NOT NULL COMMENT 'Empleado que recibe el bono — ver Empleados',
  `fecha` date NOT NULL DEFAULT (curdate()) COMMENT 'Fecha en que se otorgó el bono',
  `concepto` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Motivo del bono (Ej: Bono de producción, Bono navideño)',
  `valor` decimal(14,2) NOT NULL COMMENT 'Monto del bono en pesos colombianos',
  `id_cuenta_pagar` int DEFAULT NULL COMMENT 'CxP generada al crear el bono (categoría Bono empleado) — ver Cuentas_Por_Pagar',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `id_cuenta_pagar` (`id_cuenta_pagar`),
  KEY `idx_bonos_empleado_fecha` (`id_empleado`,`fecha`),
  CONSTRAINT `bonos_empleado_ibfk_1` FOREIGN KEY (`id_empleado`) REFERENCES `empleados` (`id`),
  CONSTRAINT `bonos_empleado_ibfk_2` FOREIGN KEY (`id_cuenta_pagar`) REFERENCES `cuentas_por_pagar` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bonos ocasionales a empleados, sin periodicidad fija. Cada bono genera su propia Cuenta_Por_Pagar (categoría Bono empleado), igual que cualquier otro egreso de la empresa.';

DROP TABLE IF EXISTS `categorias_cxc`;
CREATE TABLE `categorias_cxc` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre de la categoría de cuenta por cobrar',
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción libre',
  `color` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Color hex usado por el frontend para distinguir la categoría',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tipos de Cuenta por Cobrar';

DROP TABLE IF EXISTS `categorias_cxp`;
CREATE TABLE `categorias_cxp` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre de la categoría de cuenta por pagar',
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción libre',
  `color` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Color hex usado por el frontend para distinguir la categoría',
  `id_concepto_retencion` int DEFAULT NULL COMMENT 'Concepto de retención en la fuente que aplica a esta categoría de CxP — ver Conceptos_Retencion. NULL = esta categoría nunca calcula retención.',
  `id_concepto_reteiva` int DEFAULT NULL COMMENT 'Concepto de reteIVA que aplica a esta categoría — ver Conceptos_Retencion. Paralelo a id_concepto_retencion (retefuente); puede haber uno, otro, los dos o ninguno.',
  PRIMARY KEY (`id`),
  KEY `id_concepto_retencion` (`id_concepto_retencion`),
  KEY `id_concepto_reteiva` (`id_concepto_reteiva`),
  CONSTRAINT `categorias_cxp_ibfk_1` FOREIGN KEY (`id_concepto_retencion`) REFERENCES `conceptos_retencion` (`id`),
  CONSTRAINT `categorias_cxp_ibfk_2` FOREIGN KEY (`id_concepto_reteiva`) REFERENCES `conceptos_retencion` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tipos de Cuenta por Pagar. Excedente removido (es ingreso de la empresa).';

DROP TABLE IF EXISTS `categorias_ingreso`;
CREATE TABLE `categorias_ingreso` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único de la categoría de ingreso',
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre de la categoría (Préstamo recibido, Cobro a tercero, Aporte de socio, Venta, Otro)',
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción del tipo de ingreso que representa esta categoría',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categoria_ingreso_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tipos de ingreso de tesorería de la empresa. Clasifica cada entrada real de dinero (distinto de Deposito, que es solo caja menor de planta).';

DROP TABLE IF EXISTS `categorias_proveedor`;
CREATE TABLE `categorias_proveedor` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre de la categoría de proveedor',
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción libre',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Clasificación de proveedores';

DROP TABLE IF EXISTS `combustible`;
CREATE TABLE `combustible` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_gasolinera` int DEFAULT NULL COMMENT 'Proveedor (gasolinera). Puede ir NULL al registrar el ACPM y completarse luego — ver Proveedores',
  `tipo_consumo` enum('vehiculo','planta','maquinaria','otro') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'vehiculo' COMMENT 'vehiculo=tanqueo a vehículo; planta/maquinaria=tambores o uso interno',
  `forma_pago` enum('efectivo','credito') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'credito' COMMENT 'efectivo=ya se pagó en el momento y no genera CxP; credito=se cargó a la línea de crédito de la gasolinera y debe agruparse en una Cuenta_Por_Pagar',
  `id_dueno_volqueta` int DEFAULT NULL COMMENT 'Dueño al que se carga el costo (crédito)',
  `id_vehiculo` int DEFAULT NULL COMMENT 'Vehículo físico que tanqueó',
  `id_planta` int DEFAULT NULL COMMENT 'Planta que consumió (tambores, maquinaria)',
  `id_material_planta_entrada` int DEFAULT NULL COMMENT 'Entrada puntual a la que se atribuye',
  `id_agua` int DEFAULT NULL COMMENT 'Viaje de agua al que se atribuye este ACPM (excluyente con id_material_planta_entrada) — ver agua_planta',
  `fecha` date NOT NULL COMMENT 'Fecha del tanqueo o consumo',
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Galones, placa, descripción',
  `valor` decimal(15,2) NOT NULL COMMENT 'Valor del tanqueo o consumo',
  `comprobante_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL o ruta del comprobante adjunto',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `id_vehiculo` (`id_vehiculo`),
  KEY `id_planta` (`id_planta`),
  KEY `idx_combustible_gasolinera` (`id_gasolinera`),
  KEY `idx_combustible_volqueta` (`id_dueno_volqueta`),
  KEY `idx_combustible_fecha` (`fecha`),
  KEY `fk_combustible_entrada` (`id_material_planta_entrada`),
  KEY `idx_combustible_agua` (`id_agua`),
  CONSTRAINT `combustible_ibfk_1` FOREIGN KEY (`id_gasolinera`) REFERENCES `proveedores` (`id`),
  CONSTRAINT `combustible_ibfk_2` FOREIGN KEY (`id_dueno_volqueta`) REFERENCES `dueno_volqueta` (`id`),
  CONSTRAINT `combustible_ibfk_3` FOREIGN KEY (`id_vehiculo`) REFERENCES `volqueta_vehiculo` (`id`),
  CONSTRAINT `combustible_ibfk_4` FOREIGN KEY (`id_planta`) REFERENCES `planta` (`id`),
  CONSTRAINT `fk_combustible_agua` FOREIGN KEY (`id_agua`) REFERENCES `agua_planta` (`id`),
  CONSTRAINT `fk_combustible_entrada` FOREIGN KEY (`id_material_planta_entrada`) REFERENCES `material_planta_entrada` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_combustible_tipo` CHECK ((((`tipo_consumo` = _utf8mb4'vehiculo') and ((`id_vehiculo` is not null) or (`id_dueno_volqueta` is not null))) or (`tipo_consumo` in (_utf8mb4'planta',_utf8mb4'maquinaria',_utf8mb4'otro'))))
) ENGINE=InnoDB AUTO_INCREMENT=90 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tanqueos y combustible interno. tipo_consumo diferencia vehículo vs planta.';

DROP TABLE IF EXISTS `conceptos_retencion`;
CREATE TABLE `conceptos_retencion` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único del concepto de retención',
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre del concepto (Ej: Transporte de carga, Arrendamiento muebles)',
  `tarifa_declarante` decimal(5,2) NOT NULL COMMENT 'Tarifa (%) para terceros declarantes de renta',
  `tarifa_no_declarante` decimal(5,2) NOT NULL COMMENT 'Tarifa (%) para terceros no declarantes de renta',
  `base_minima_uvt` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'Base mínima en UVT por debajo de la cual no aplica retención (0 = aplica desde el primer peso)',
  `activo` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'FALSE si el concepto ya no se usa (se conserva el histórico de lo ya aplicado)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_concepto_retencion_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Catálogo de conceptos de retención en la fuente (renta). Tarifas editables aquí sin tocar código. Fase 1: solo transporte de carga y arrendamiento de muebles.';

DROP TABLE IF EXISTS `contratos_alquiler`;
CREATE TABLE `contratos_alquiler` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único del contrato de arriendo',
  `id_tipo` int DEFAULT NULL COMMENT 'Categoría del alquiler — ver Tipos_Alquiler',
  `id_proveedor` int NOT NULL COMMENT 'Arrendador (empresa o persona) — ver Proveedores',
  `concepto` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Descripción base del contrato (Ej: Alquiler camioneta placa ABC123)',
  `valor_mensual` decimal(15,2) NOT NULL COMMENT 'Valor de cada cuota mensual generada en Alquileres',
  `fecha_inicio` date NOT NULL COMMENT 'Fecha de inicio del contrato',
  `fecha_fin` date NOT NULL COMMENT 'Fecha de terminación del contrato (define cuántos meses se generan)',
  `contrato_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Link al documento firmado del contrato (subido aparte, igual que los demás comprobantes del sistema)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de registro del contrato',
  `deleted_at` timestamp NULL DEFAULT NULL COMMENT 'Borrado lógico: con fecha = contrato cancelado. Los meses ya generados en Alquileres NO se tocan automáticamente.',
  PRIMARY KEY (`id`),
  KEY `id_tipo` (`id_tipo`),
  KEY `id_proveedor` (`id_proveedor`),
  CONSTRAINT `contratos_alquiler_ibfk_1` FOREIGN KEY (`id_tipo`) REFERENCES `tipos_alquiler` (`id`),
  CONSTRAINT `contratos_alquiler_ibfk_2` FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id`),
  CONSTRAINT `chk_contrato_fechas` CHECK ((`fecha_fin` >= `fecha_inicio`))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Contrato de arriendo de larga duración (ej. 1 año). Al crearse, genera automáticamente un Alquileres por cada mes del período.';

DROP TABLE IF EXISTS `cotizaciones_materiales`;
CREATE TABLE `cotizaciones_materiales` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_material` int NOT NULL COMMENT 'Mineral cotizado — ver `materiales`',
  `id_proveedor` int DEFAULT NULL COMMENT 'Cliente o proveedor al que se cotiza — ver `proveedores`',
  `fecha_cotizacion` date NOT NULL COMMENT 'Fecha en que se hizo la cotización',
  `fecha_necesidad` date DEFAULT NULL COMMENT 'Fecha en que el cliente necesita el material',
  `valor_bolsa` decimal(15,2) NOT NULL COMMENT 'Valor cotizado por bolsa/unidad',
  `valor_cliente` decimal(15,2) NOT NULL COMMENT 'Valor cotizado al cliente final',
  `lugar_uso` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Lugar donde se usará el material cotizado',
  `observaciones` text COLLATE utf8mb4_unicode_ci COMMENT 'Observaciones libres',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `id_material` (`id_material`),
  KEY `id_proveedor` (`id_proveedor`),
  KEY `idx_cotizaciones_fecha` (`fecha_cotizacion`),
  CONSTRAINT `cotizaciones_materiales_ibfk_1` FOREIGN KEY (`id_material`) REFERENCES `materiales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cotizaciones_materiales_ibfk_2` FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cotizaciones de venta de minerales del catálogo `materiales`. Registro comercial, no genera movimientos contables.';

DROP TABLE IF EXISTS `cuentas_bancarias`;
CREATE TABLE `cuentas_bancarias` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único de la cuenta bancaria',
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre identificador de la cuenta (Ej: Bancolombia Ahorros 123)',
  `banco` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Entidad bancaria',
  `numero_cuenta` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Número de cuenta',
  `tipo_cuenta` enum('ahorros','corriente') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Tipo de cuenta bancaria',
  `propietario` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre del titular/dueño de la cuenta',
  `id_empleado` int DEFAULT NULL COMMENT 'Si el titular es un empleado/socio ya registrado — ver Empleados. NULL si el dueño no está en nómina',
  `exento_4x1000` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'TRUE si esta cuenta está exenta del impuesto 4x1000',
  `activa` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'FALSE si la cuenta ya no se usa (no se borra para no perder el histórico de movimientos)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `id_empleado` (`id_empleado`),
  CONSTRAINT `cuentas_bancarias_ibfk_1` FOREIGN KEY (`id_empleado`) REFERENCES `empleados` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cuentas bancarias de la empresa. De/hacia dónde sale o entra realmente el dinero — ver Abonos_CxP.id_cuenta_bancaria e Ingresos_Tesoreria.id_cuenta_bancaria.';

DROP TABLE IF EXISTS `cuentas_por_cobrar`;
CREATE TABLE `cuentas_por_cobrar` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_categoria` int NOT NULL COMMENT 'Tipo de cuenta por cobrar — ver `categorias_cxc`',
  `concepto` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Descripción del concepto u operación',
  `id_empleado` int DEFAULT NULL COMMENT 'Deudor empleado',
  `id_minero` int DEFAULT NULL COMMENT 'Deudor minero',
  `id_dueno_volqueta` int DEFAULT NULL COMMENT 'Deudor dueño de volqueta',
  `id_proveedor` int DEFAULT NULL COMMENT 'Deudor proveedor',
  `valor_total` decimal(14,2) NOT NULL COMMENT 'Monto total de la deuda',
  `valor_cobrado` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'Monto ya cobrado',
  `saldo` decimal(14,2) GENERATED ALWAYS AS ((`valor_total` - `valor_cobrado`)) STORED COMMENT 'valor_total - valor_cobrado',
  `estado` enum('pendiente','parcial','cobrado','anulado') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendiente' COMMENT 'Estado actual de la cuenta por cobrar',
  `fecha_creacion` date NOT NULL DEFAULT (curdate()) COMMENT 'Fecha de creación del registro',
  `fecha_limite` date DEFAULT NULL COMMENT 'Fecha límite de cobro, si se definió',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la última actualización',
  PRIMARY KEY (`id`),
  KEY `id_categoria` (`id_categoria`),
  KEY `id_empleado` (`id_empleado`),
  KEY `id_minero` (`id_minero`),
  KEY `id_dueno_volqueta` (`id_dueno_volqueta`),
  KEY `id_proveedor` (`id_proveedor`),
  KEY `idx_cxc_estado` (`estado`),
  KEY `idx_cxc_fecha` (`fecha_creacion`),
  CONSTRAINT `cuentas_por_cobrar_ibfk_1` FOREIGN KEY (`id_categoria`) REFERENCES `categorias_cxc` (`id`),
  CONSTRAINT `cuentas_por_cobrar_ibfk_2` FOREIGN KEY (`id_empleado`) REFERENCES `empleados` (`id`),
  CONSTRAINT `cuentas_por_cobrar_ibfk_3` FOREIGN KEY (`id_minero`) REFERENCES `minero` (`id`),
  CONSTRAINT `cuentas_por_cobrar_ibfk_4` FOREIGN KEY (`id_dueno_volqueta`) REFERENCES `dueno_volqueta` (`id`),
  CONSTRAINT `cuentas_por_cobrar_ibfk_5` FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id`),
  CONSTRAINT `chk_cxc_un_deudor` CHECK ((((((`id_empleado` is not null) + (`id_minero` is not null)) + (`id_dueno_volqueta` is not null)) + (`id_proveedor` is not null)) <= 1))
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cuentas por cobrar. Lo que terceros deben a la empresa.';

DROP TABLE IF EXISTS `cuentas_por_cobrar_relacion`;
CREATE TABLE `cuentas_por_cobrar_relacion` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_cxc` int NOT NULL COMMENT 'Cuenta por cobrar relacionada — ver `cuentas_por_cobrar`',
  `id_prestamo_emp` int DEFAULT NULL COMMENT 'Prestamos_Empleados',
  `id_combustible` int DEFAULT NULL COMMENT 'Combustible cargado al dueño de volqueta',
  `id_anticipo` int DEFAULT NULL COMMENT 'Anticipo recuperable',
  `id_excedente` int DEFAULT NULL COMMENT 'Excedente reconocido como CxC',
  `monto_aplicado` decimal(14,2) DEFAULT NULL COMMENT 'Monto de la CxC que corresponde a este origen',
  `concepto` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción del concepto u operación',
  `fecha` date NOT NULL DEFAULT (curdate()) COMMENT 'Fecha del registro',
  `nota` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nota u observación libre',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `id_prestamo_emp` (`id_prestamo_emp`),
  KEY `id_combustible` (`id_combustible`),
  KEY `id_anticipo` (`id_anticipo`),
  KEY `id_excedente` (`id_excedente`),
  KEY `idx_cxcr_cxc` (`id_cxc`),
  CONSTRAINT `cuentas_por_cobrar_relacion_ibfk_1` FOREIGN KEY (`id_cxc`) REFERENCES `cuentas_por_cobrar` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cuentas_por_cobrar_relacion_ibfk_2` FOREIGN KEY (`id_prestamo_emp`) REFERENCES `prestamos_empleados` (`id`),
  CONSTRAINT `cuentas_por_cobrar_relacion_ibfk_3` FOREIGN KEY (`id_combustible`) REFERENCES `combustible` (`id`),
  CONSTRAINT `cuentas_por_cobrar_relacion_ibfk_4` FOREIGN KEY (`id_anticipo`) REFERENCES `anticipos_terceros` (`id`),
  CONSTRAINT `cuentas_por_cobrar_relacion_ibfk_5` FOREIGN KEY (`id_excedente`) REFERENCES `excedente` (`id`),
  CONSTRAINT `chk_cxcr_exactamente_uno` CHECK ((((((`id_prestamo_emp` is not null) + (`id_combustible` is not null)) + (`id_anticipo` is not null)) + (`id_excedente` is not null)) = 1))
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Enlace CxC ↔ dominio. FK explícita. Exactamente 1 FK activa por fila.';

DROP TABLE IF EXISTS `cuentas_por_pagar`;
CREATE TABLE `cuentas_por_pagar` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_categoria` int NOT NULL COMMENT 'Tipo de cuenta por pagar — ver `categorias_cxp`',
  `concepto` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Descripción del concepto u operación',
  `id_proveedor` int DEFAULT NULL COMMENT 'Beneficiario proveedor, cuando aplica — ver `proveedores`',
  `id_empleado` int DEFAULT NULL COMMENT 'Beneficiario empleado, cuando aplica — ver `empleados`',
  `id_minero` int DEFAULT NULL COMMENT 'Beneficiario minero, cuando aplica — ver `minero`',
  `id_dueno_volqueta` int DEFAULT NULL COMMENT 'Beneficiario dueño de volqueta, cuando aplica — ver `dueno_volqueta`',
  `valor_total` decimal(14,2) NOT NULL COMMENT 'Monto total de la obligación',
  `valor_pagado` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'Monto ya pagado',
  `saldo` decimal(14,2) GENERATED ALWAYS AS ((`valor_total` - `valor_pagado`)) STORED COMMENT 'valor_total - valor_pagado',
  `estado` enum('pendiente','parcial','pagado','anulado') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendiente' COMMENT 'Estado actual de la cuenta por pagar',
  `fecha_creacion` date NOT NULL DEFAULT (curdate()) COMMENT 'Fecha de creación del registro',
  `fecha_limite` date DEFAULT NULL COMMENT 'Fecha límite de pago, si se definió',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la última actualización',
  `deleted_at` timestamp NULL DEFAULT NULL COMMENT 'Borrado lógico: con fecha = registro cancelado/eliminado',
  `valor_retenido` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'Monto retenido al tercero por retefuente, calculado al crear la cuenta. valor_pagado lo cuenta como ya pagado (fiscalmente lo está, al Estado) desde la creación — ver Retenciones_Aplicadas.',
  `valor_iva` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'IVA de la obligación (copiado de la entidad al crear la cuenta) — base sobre la que se calcula la reteIVA, no afecta valor_total.',
  PRIMARY KEY (`id`),
  KEY `id_categoria` (`id_categoria`),
  KEY `id_proveedor` (`id_proveedor`),
  KEY `id_empleado` (`id_empleado`),
  KEY `id_minero` (`id_minero`),
  KEY `id_dueno_volqueta` (`id_dueno_volqueta`),
  KEY `idx_cxp_estado` (`estado`),
  KEY `idx_cxp_fecha` (`fecha_creacion`),
  CONSTRAINT `cuentas_por_pagar_ibfk_1` FOREIGN KEY (`id_categoria`) REFERENCES `categorias_cxp` (`id`),
  CONSTRAINT `cuentas_por_pagar_ibfk_2` FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id`),
  CONSTRAINT `cuentas_por_pagar_ibfk_3` FOREIGN KEY (`id_empleado`) REFERENCES `empleados` (`id`),
  CONSTRAINT `cuentas_por_pagar_ibfk_4` FOREIGN KEY (`id_minero`) REFERENCES `minero` (`id`),
  CONSTRAINT `cuentas_por_pagar_ibfk_5` FOREIGN KEY (`id_dueno_volqueta`) REFERENCES `dueno_volqueta` (`id`),
  CONSTRAINT `chk_cxp_un_beneficiario` CHECK ((((((`id_proveedor` is not null) + (`id_empleado` is not null)) + (`id_minero` is not null)) + (`id_dueno_volqueta` is not null)) <= 1))
) ENGINE=InnoDB AUTO_INCREMENT=119 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cuentas por pagar. Estado pagado = cuenta paga.';

DROP TABLE IF EXISTS `cuentas_por_pagar_relacion`;
CREATE TABLE `cuentas_por_pagar_relacion` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_cuenta_pagar` int NOT NULL COMMENT 'Cuenta por pagar relacionada — ver `cuentas_por_pagar`',
  `id_entrada` int DEFAULT NULL COMMENT 'material_planta_entrada',
  `id_viaje` int DEFAULT NULL COMMENT 'Viaje',
  `id_alquiler` int DEFAULT NULL COMMENT 'Alquileres',
  `id_combustible` int DEFAULT NULL COMMENT 'Combustible',
  `id_prestamo_emp` int DEFAULT NULL COMMENT 'Prestamos_Empleados',
  `id_prestamo_fin` int DEFAULT NULL COMMENT 'Prestamos_Financieros',
  `id_deposito` int DEFAULT NULL COMMENT 'Deposito (fondeo caja menor)',
  `id_anticipo` int DEFAULT NULL COMMENT 'Anticipos_Terceros',
  `id_agua` int DEFAULT NULL COMMENT 'Agua_Planta',
  `id_mula` int DEFAULT NULL COMMENT 'Mulas',
  `id_analisis` int DEFAULT NULL COMMENT 'Analisis',
  `id_excedente` int DEFAULT NULL COMMENT 'Excedente (distribución desde empresa)',
  `subtipo` enum('material','flete') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Solo cuando id_entrada IS NOT NULL',
  `monto_aplicado` decimal(14,2) DEFAULT NULL COMMENT 'Monto de la CxP que corresponde a este origen',
  `concepto` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción del concepto u operación',
  `fecha` date NOT NULL DEFAULT (curdate()) COMMENT 'Fecha del registro',
  `nota` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nota u observación libre',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `id_viaje` (`id_viaje`),
  KEY `id_alquiler` (`id_alquiler`),
  KEY `id_combustible` (`id_combustible`),
  KEY `id_prestamo_emp` (`id_prestamo_emp`),
  KEY `id_prestamo_fin` (`id_prestamo_fin`),
  KEY `id_deposito` (`id_deposito`),
  KEY `id_anticipo` (`id_anticipo`),
  KEY `id_agua` (`id_agua`),
  KEY `id_mula` (`id_mula`),
  KEY `id_analisis` (`id_analisis`),
  KEY `idx_cxpr_cuenta` (`id_cuenta_pagar`),
  KEY `idx_cxpr_entrada` (`id_entrada`),
  KEY `idx_cxpr_excedente` (`id_excedente`),
  CONSTRAINT `cuentas_por_pagar_relacion_ibfk_1` FOREIGN KEY (`id_cuenta_pagar`) REFERENCES `cuentas_por_pagar` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cuentas_por_pagar_relacion_ibfk_10` FOREIGN KEY (`id_anticipo`) REFERENCES `anticipos_terceros` (`id`),
  CONSTRAINT `cuentas_por_pagar_relacion_ibfk_11` FOREIGN KEY (`id_agua`) REFERENCES `agua_planta` (`id`),
  CONSTRAINT `cuentas_por_pagar_relacion_ibfk_12` FOREIGN KEY (`id_mula`) REFERENCES `mulas` (`id`),
  CONSTRAINT `cuentas_por_pagar_relacion_ibfk_13` FOREIGN KEY (`id_analisis`) REFERENCES `analisis` (`id`),
  CONSTRAINT `cuentas_por_pagar_relacion_ibfk_14` FOREIGN KEY (`id_excedente`) REFERENCES `excedente` (`id`),
  CONSTRAINT `cuentas_por_pagar_relacion_ibfk_2` FOREIGN KEY (`id_entrada`) REFERENCES `material_planta_entrada` (`id`),
  CONSTRAINT `cuentas_por_pagar_relacion_ibfk_3` FOREIGN KEY (`id_viaje`) REFERENCES `viaje` (`id`),
  CONSTRAINT `cuentas_por_pagar_relacion_ibfk_4` FOREIGN KEY (`id_alquiler`) REFERENCES `alquileres` (`id`),
  CONSTRAINT `cuentas_por_pagar_relacion_ibfk_5` FOREIGN KEY (`id_combustible`) REFERENCES `combustible` (`id`),
  CONSTRAINT `cuentas_por_pagar_relacion_ibfk_6` FOREIGN KEY (`id_prestamo_emp`) REFERENCES `prestamos_empleados` (`id`),
  CONSTRAINT `cuentas_por_pagar_relacion_ibfk_7` FOREIGN KEY (`id_prestamo_fin`) REFERENCES `prestamos_financieros` (`id`),
  CONSTRAINT `cuentas_por_pagar_relacion_ibfk_9` FOREIGN KEY (`id_deposito`) REFERENCES `deposito` (`id`),
  CONSTRAINT `chk_cxpr_subtipo` CHECK (((`subtipo` is null) or (`id_entrada` is not null)))
) ENGINE=InnoDB AUTO_INCREMENT=196 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Enlace CxP ↔ dominio. FK explícita por cada tabla. Exactamente 1 FK activa por fila.';

DROP TABLE IF EXISTS `deposito`;
CREATE TABLE `deposito` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `fecha` date NOT NULL COMMENT 'Fecha del fondeo de caja menor',
  `monto` decimal(14,2) NOT NULL COMMENT 'Monto entregado como fondeo',
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción libre',
  `saldo_anterior` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'Saldo de caja menor antes de este fondeo',
  `saldo_resultante` decimal(14,2) NOT NULL COMMENT 'Saldo de caja menor después de este fondeo',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Fondeo de caja menor de planta (dinero físico entregado para gastos operativos). Base para `gasto_operativo`.';

DROP TABLE IF EXISTS `dueno_volqueta`;
CREATE TABLE `dueno_volqueta` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre o razón social del dueño de volqueta',
  `titular` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nombre del titular real, si es distinto al nombre comercial',
  `cc` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Cédula o identificación',
  `banco` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Entidad bancaria',
  `numero_cuenta` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Número de cuenta bancaria',
  `alias` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Apodo o nombre corto usado en selectores',
  `telefono` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Teléfono de contacto',
  `ciudad` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Ciudad',
  `nequi` tinyint(1) DEFAULT '0' COMMENT 'TRUE si paga/recibe por Nequi',
  `estado` enum('activo','inactivo') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'activo' COMMENT 'Estado actual del dueño de volqueta',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la última actualización',
  PRIMARY KEY (`id`),
  UNIQUE KEY `cc` (`cc`),
  KEY `idx_dueno_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Dueños de volqueta. Vehículos → Volqueta_Vehiculo';

DROP TABLE IF EXISTS `empleados`;
CREATE TABLE `empleados` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre del empleado',
  `apellido` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Apellido del empleado',
  `cc` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Cédula o identificación',
  `cuenta` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Número de cuenta bancaria para pago',
  `nequi` tinyint(1) DEFAULT '0' COMMENT 'TRUE si paga/recibe por Nequi',
  `labor` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Cargo o labor que desempeña',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  UNIQUE KEY `cc` (`cc`),
  KEY `idx_empleados_cc` (`cc`)
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Catálogo de empleados de la empresa.';

DROP TABLE IF EXISTS `empleados_salario`;
CREATE TABLE `empleados_salario` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `empleado_id` int NOT NULL COMMENT 'Empleado al que aplica esta configuración salarial — ver `empleados`',
  `tipo_pago` enum('FIJO_MENSUAL','POR_DIAS','POR_HORAS') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Unidad sobre la que se calcula el pago',
  `tarifa_monto` decimal(12,2) NOT NULL COMMENT 'Monto de la tarifa según tipo_pago (mensual, diario u horario)',
  `aplica_aux_transp` tinyint(1) DEFAULT '0' COMMENT 'TRUE si al empleado se le liquida auxilio de transporte',
  `fecha_inicio` date NOT NULL COMMENT 'Fecha desde la que esta configuración salarial está vigente',
  `activo` tinyint(1) DEFAULT '1' COMMENT 'FALSE si el registro ya no se usa (se conserva por histórico)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `idx_salario_empleado` (`empleado_id`),
  KEY `idx_salario_activo` (`activo`),
  CONSTRAINT `empleados_salario_ibfk_1` FOREIGN KEY (`empleado_id`) REFERENCES `empleados` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Configuración salarial vigente por empleado (tipo de pago y tarifa). Base para liquidar `nomina_liquidaciones`.';

DROP TABLE IF EXISTS `excedente`;
CREATE TABLE `excedente` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_entrada` int NOT NULL COMMENT 'Entrada de material que generó el excedente — ver `material_planta_entrada`',
  `valor_excedente` decimal(14,2) NOT NULL COMMENT 'Beneficio de la empresa en esta entrada',
  `monto_distribuido` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'Cuánto ya se distribuyó/pagó desde este excedente',
  `saldo_por_distribuir` decimal(14,2) GENERATED ALWAYS AS ((`valor_excedente` - `monto_distribuido`)) STORED COMMENT 'valor_excedente - monto_distribuido',
  `fecha_calculo` date NOT NULL COMMENT 'Fecha en que se calculó el excedente',
  `concepto` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción del concepto u operación',
  `estado_distribucion` enum('pendiente','parcial','distribuido') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendiente' COMMENT 'pendiente=no distribuido; distribuido=ya salió como CxP',
  `notas` text COLLATE utf8mb4_unicode_ci COMMENT 'Notas u observaciones libres',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la última actualización',
  PRIMARY KEY (`id`),
  KEY `idx_excedente_entrada` (`id_entrada`),
  KEY `idx_excedente_estado` (`estado_distribucion`),
  CONSTRAINT `excedente_ibfk_1` FOREIGN KEY (`id_entrada`) REFERENCES `material_planta_entrada` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Excedentes = INGRESOS de la empresa. Distribución → Cuentas_Por_Pagar (id_excedente en relación).';

DROP TABLE IF EXISTS `gasto_operativo`;
CREATE TABLE `gasto_operativo` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_deposito` int NOT NULL COMMENT 'Caja menor desde la que se pagó — ver `deposito`',
  `id_tipo_gasto` int NOT NULL COMMENT 'Tipo de gasto operativo — ver `tipos_gasto_operativo`',
  `id_material_planta_entrada` int DEFAULT NULL COMMENT 'Entrada a la que se atribuye el gasto, si aplica — ver `material_planta_entrada`',
  `id_viaje` int DEFAULT NULL COMMENT 'Viaje al que se atribuye el gasto, si aplica — ver `viaje`',
  `fecha` date NOT NULL COMMENT 'Fecha del registro',
  `concepto` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Descripción del concepto u operación',
  `monto` decimal(14,2) NOT NULL COMMENT 'Monto del gasto',
  `saldo_resultante` decimal(14,2) NOT NULL COMMENT 'Saldo de caja menor después de este gasto',
  `mensaje_mauricio` text COLLATE utf8mb4_unicode_ci COMMENT 'Nota libre histórica dirigida a Mauricio (sin uso funcional)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `id_tipo_gasto` (`id_tipo_gasto`),
  KEY `idx_gasto_deposito` (`id_deposito`),
  KEY `idx_gasto_entrada` (`id_material_planta_entrada`),
  KEY `fk_gasto_viaje` (`id_viaje`),
  CONSTRAINT `fk_gasto_entrada` FOREIGN KEY (`id_material_planta_entrada`) REFERENCES `material_planta_entrada` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_gasto_viaje` FOREIGN KEY (`id_viaje`) REFERENCES `viaje` (`id`) ON DELETE SET NULL,
  CONSTRAINT `gasto_operativo_ibfk_1` FOREIGN KEY (`id_deposito`) REFERENCES `deposito` (`id`),
  CONSTRAINT `gasto_operativo_ibfk_2` FOREIGN KEY (`id_tipo_gasto`) REFERENCES `tipos_gasto_operativo` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Gastos pagados con caja menor (`deposito`), opcionalmente atribuibles a una entrada o viaje.';

DROP TABLE IF EXISTS `historial_descuentos_anticipos`;
CREATE TABLE `historial_descuentos_anticipos` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_anticipo` int NOT NULL COMMENT 'Anticipo del que se descontó — ver `anticipos_terceros`',
  `id_entrada` int DEFAULT NULL COMMENT 'Entrada de material en la que se aplicó el descuento, cuando aplica (material). NULL para flete/agua/proveedor — ver material_planta_entrada',
  `id_abono_cxp` int DEFAULT NULL COMMENT 'Abono_CxP (metodo_pago=saldo_a_favor) que efectivamente aplicó este descuento — ver Abonos_CxP',
  `fecha` date NOT NULL COMMENT 'Fecha del registro',
  `monto_descontado` decimal(14,2) NOT NULL COMMENT 'Monto descontado del anticipo en este movimiento',
  `nota` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nota u observación libre',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `id_anticipo` (`id_anticipo`),
  KEY `id_entrada` (`id_entrada`),
  KEY `fk_hda_abono_cxp` (`id_abono_cxp`),
  CONSTRAINT `fk_hda_abono_cxp` FOREIGN KEY (`id_abono_cxp`) REFERENCES `abonos_cxp` (`id`),
  CONSTRAINT `historial_descuentos_anticipos_ibfk_1` FOREIGN KEY (`id_anticipo`) REFERENCES `anticipos_terceros` (`id`),
  CONSTRAINT `historial_descuentos_anticipos_ibfk_2` FOREIGN KEY (`id_entrada`) REFERENCES `material_planta_entrada` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Histórico de cada descuento aplicado contra un anticipo — reduce su saldo_disponible.';

DROP TABLE IF EXISTS `impuestos`;
CREATE TABLE `impuestos` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único del impuesto',
  `nombre` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre del impuesto (Ej: 4x1000)',
  `tasa` decimal(6,5) NOT NULL COMMENT 'Tasa del impuesto como fracción (0.00400 = 4x1000)',
  `aplica_a` enum('egreso','ingreso') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'egreso' COMMENT 'Si el impuesto se cobra al salir dinero (egreso) o al entrar (ingreso) — hoy solo se usa egreso',
  `activo` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'FALSE si el impuesto ya no se cobra (se conserva el histórico de lo ya aplicado)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_impuesto_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Catálogo genérico de impuestos sobre movimientos de dinero. Hoy solo 4x1000; preparado para más impuestos sin cambiar el esquema.';

DROP TABLE IF EXISTS `impuestos_aplicados`;
CREATE TABLE `impuestos_aplicados` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único del impuesto aplicado',
  `id_impuesto` int NOT NULL COMMENT 'Impuesto cobrado — ver Impuestos',
  `id_abono_cxp` int NOT NULL COMMENT 'Abono que generó el cobro de este impuesto — ver Abonos_CxP',
  `id_cuenta_bancaria` int NOT NULL COMMENT 'Cuenta bancaria de la que salió el dinero — ver Cuentas_Bancarias',
  `valor_base` decimal(14,2) NOT NULL COMMENT 'Valor del abono sobre el que se calculó el impuesto',
  `valor_impuesto` decimal(14,2) NOT NULL COMMENT 'Monto cobrado de impuesto (valor_base * tasa)',
  `fecha` date NOT NULL COMMENT 'Fecha del movimiento que generó el impuesto',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `id_impuesto` (`id_impuesto`),
  KEY `id_abono_cxp` (`id_abono_cxp`),
  KEY `idx_impuestos_aplicados_cuenta` (`id_cuenta_bancaria`,`fecha`),
  CONSTRAINT `impuestos_aplicados_ibfk_1` FOREIGN KEY (`id_impuesto`) REFERENCES `impuestos` (`id`),
  CONSTRAINT `impuestos_aplicados_ibfk_2` FOREIGN KEY (`id_abono_cxp`) REFERENCES `abonos_cxp` (`id`),
  CONSTRAINT `impuestos_aplicados_ibfk_3` FOREIGN KEY (`id_cuenta_bancaria`) REFERENCES `cuentas_bancarias` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Histórico inmutable de cada impuesto realmente cobrado sobre un abono. Calculado y guardado por la app al registrar el abono (sin triggers de BD), igual que la maquila.';

DROP TABLE IF EXISTS `ingresos_tesoreria`;
CREATE TABLE `ingresos_tesoreria` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único del ingreso de tesorería',
  `id_categoria` int NOT NULL COMMENT 'Tipo de ingreso — ver Categorias_Ingreso',
  `concepto` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Descripción del ingreso (Ej: Desembolso préstamo Davivienda, Aporte socio Camilo)',
  `valor` decimal(15,2) NOT NULL COMMENT 'Monto del ingreso en pesos colombianos',
  `fecha` date NOT NULL DEFAULT (curdate()) COMMENT 'Fecha en que entró el dinero a la empresa',
  `id_prestamo_fin` int DEFAULT NULL COMMENT 'Cuando el ingreso ES un desembolso de préstamo financiero — ver Prestamos_Financieros',
  `comprobante_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL o ruta del comprobante del ingreso (consignación, transferencia, etc.)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  `id_cuenta_bancaria` int DEFAULT NULL COMMENT 'Cuenta bancaria a la que entró el dinero. NULL en todo lo histórico (solo aplica hacia adelante)',
  PRIMARY KEY (`id`),
  KEY `id_categoria` (`id_categoria`),
  KEY `id_prestamo_fin` (`id_prestamo_fin`),
  KEY `idx_ingresos_fecha` (`fecha`),
  KEY `id_cuenta_bancaria` (`id_cuenta_bancaria`),
  CONSTRAINT `ingresos_tesoreria_ibfk_1` FOREIGN KEY (`id_categoria`) REFERENCES `categorias_ingreso` (`id`),
  CONSTRAINT `ingresos_tesoreria_ibfk_2` FOREIGN KEY (`id_prestamo_fin`) REFERENCES `prestamos_financieros` (`id`),
  CONSTRAINT `ingresos_tesoreria_ibfk_3` FOREIGN KEY (`id_cuenta_bancaria`) REFERENCES `cuentas_bancarias` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Todo el dinero que entra realmente a la empresa (distinto de Deposito, que es solo caja menor de planta). Base para el flujo de caja mensual (ingresos vs. gastos de Abonos_CxP).';

DROP TABLE IF EXISTS `inventario_lotes`;
CREATE TABLE `inventario_lotes` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_entrada` int DEFAULT NULL COMMENT 'Entrada de material que originó el lote húmedo, cuando aplica — ver `material_planta_entrada`',
  `id_material_concentrado` int DEFAULT NULL COMMENT 'Lote de concentrado que originó este lote, cuando aplica — ver `material_concentrado`',
  `id_mina` int DEFAULT NULL COMMENT 'Mina de origen del lote — ver `mina`',
  `id_tipo_material` int DEFAULT NULL COMMENT 'Tipo de material del lote — ver `tipos_material`',
  `condicion_material` enum('Humedo','Seco') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Húmedo o Seco',
  `porcentaje_humedad` decimal(5,4) DEFAULT '0.0000' COMMENT 'Porcentaje de humedad del lote',
  `toneladas_iniciales` decimal(10,4) NOT NULL COMMENT 'Toneladas con las que ingresó el lote',
  `toneladas_disponibles` decimal(10,4) NOT NULL COMMENT 'Toneladas que quedan disponibles del lote',
  `estado` enum('almacenado','en_proceso','agotado','faltante') COLLATE utf8mb4_unicode_ci DEFAULT 'almacenado' COMMENT 'Estado actual del lote',
  `ubicacion` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Ubicación física del lote dentro de la planta',
  `fecha_ingreso` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora en que el lote entró a inventario',
  PRIMARY KEY (`id`),
  KEY `id_mina` (`id_mina`),
  KEY `id_tipo_material` (`id_tipo_material`),
  KEY `idx_inv_entrada` (`id_entrada`),
  KEY `idx_inv_disponible` (`toneladas_disponibles`,`estado`),
  KEY `fk_il_mc_idx` (`id_material_concentrado`),
  CONSTRAINT `fk_il_mc` FOREIGN KEY (`id_material_concentrado`) REFERENCES `material_concentrado` (`id`),
  CONSTRAINT `inventario_lotes_ibfk_1` FOREIGN KEY (`id_entrada`) REFERENCES `material_planta_entrada` (`id`),
  CONSTRAINT `inventario_lotes_ibfk_2` FOREIGN KEY (`id_mina`) REFERENCES `mina` (`id`),
  CONSTRAINT `inventario_lotes_ibfk_3` FOREIGN KEY (`id_tipo_material`) REFERENCES `tipos_material` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=300 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lotes de material almacenado en planta (húmedo o seco) con sus toneladas disponibles. `kardex_movimientos` registra cada movimiento sobre un lote.';

DROP TABLE IF EXISTS `inventario_movimientos`;
CREATE TABLE `inventario_movimientos` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único del movimiento',
  `id_producto` int NOT NULL COMMENT 'Producto afectado — ver Inventario_Productos',
  `fecha` date NOT NULL COMMENT 'Fecha del movimiento',
  `tipo` enum('entrada','salida') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'entrada=compra, salida=consumo',
  `cantidad` decimal(14,4) NOT NULL COMMENT 'Siempre positiva',
  `costo_unitario` decimal(14,4) DEFAULT NULL COMMENT 'En entrada: costo de compra (obligatorio, lo da el cliente). En salida: promedio ponderado usado, lo calcula el backend.',
  `nota` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nota u observación libre',
  `costo_total` decimal(16,2) NOT NULL COMMENT 'entrada: cantidad × costo_unitario. salida: cantidad × promedio ponderado ANTES de este movimiento.',
  `saldo_cantidad` decimal(14,4) NOT NULL COMMENT 'Saldo de cantidad del producto DESPUÉS de este movimiento',
  `saldo_valor` decimal(16,2) NOT NULL COMMENT 'Saldo de valor del producto DESPUÉS de este movimiento',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `idx_inv_mov_producto` (`id_producto`,`id`),
  CONSTRAINT `inventario_movimientos_ibfk_1` FOREIGN KEY (`id_producto`) REFERENCES `inventario_productos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_inv_mov_cantidad` CHECK ((`cantidad` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cardex de movimientos de insumos, costeado por promedio ponderado. saldo_cantidad/saldo_valor/costo_total quedan resueltos en orden de captura (id ASC) — al borrar un movimiento (DELETE) se recalculan solo los posteriores de ese producto.';

DROP TABLE IF EXISTS `inventario_productos`;
CREATE TABLE `inventario_productos` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único del producto/insumo',
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre del producto (Ej: Bola de molino 3", Cianuro de sodio)',
  `categoria` enum('quimico','bola_molino','filtro_prensa','repuesto','consumible','otro') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'otro' COMMENT 'Clasificación del insumo',
  `unidad` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Unidad de medida libre (kg, L, unidad, saco...)',
  `stock_minimo` decimal(14,4) NOT NULL DEFAULT '0.0000' COMMENT 'Umbral para la alerta de stock bajo',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la última actualización',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Catálogo de insumos almacenados (no mineral) — químicos, bolas de molino, filtroprensa, repuestos, consumibles.';

DROP TABLE IF EXISTS `jornada_nocturna_legal`;
CREATE TABLE `jornada_nocturna_legal` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `hora_inicio_nocturno` time NOT NULL COMMENT 'Hora a partir de la cual la jornada se considera legalmente nocturna (recargo 35%); la jornada nocturna siempre termina a las 06:00',
  `vigente_desde` date NOT NULL COMMENT 'Fecha desde la cual aplica este corte. Para una fecha dada, el valor vigente es la fila con mayor vigente_desde <= esa fecha',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  UNIQUE KEY `vigente_desde` (`vigente_desde`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Histórico del corte legal de jornada nocturna (Ley 2101 de 2021). Usado por nomina_liquidacion.service.ts para partir las horas de un Turno entre recargo propio del turno y recargo nocturno legal.';

DROP TABLE IF EXISTS `kardex_movimientos`;
CREATE TABLE `kardex_movimientos` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_lote` int NOT NULL COMMENT 'Lote afectado — ver `inventario_lotes`',
  `fecha` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha del registro',
  `tipo_movimiento` enum('ENTRADA_PLANTA','SALIDA_PROCESO','ENTRADA_CONCENTRADO','SALIDA_VIAJE','AJUSTE_MERMA') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tipo de movimiento sobre el lote',
  `toneladas_movidas` decimal(10,4) NOT NULL COMMENT 'Toneladas movidas en este movimiento',
  `destino_referencia` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Referencia libre del destino del movimiento (proceso, viaje, etc.)',
  `id_usuario` int DEFAULT NULL COMMENT 'Usuario que registró el movimiento — ver `usuarios`',
  `comentarios` text COLLATE utf8mb4_unicode_ci COMMENT 'Comentarios u observaciones libres',
  PRIMARY KEY (`id`),
  KEY `id_usuario` (`id_usuario`),
  KEY `idx_kardex_lote` (`id_lote`),
  KEY `idx_kardex_fecha` (`fecha`),
  CONSTRAINT `kardex_movimientos_ibfk_1` FOREIGN KEY (`id_lote`) REFERENCES `inventario_lotes` (`id`),
  CONSTRAINT `kardex_movimientos_ibfk_2` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=408 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Trazabilidad de movimientos de un lote de `inventario_lotes` (entradas, salidas a proceso, ajustes de merma).';

DROP TABLE IF EXISTS `material_concentrado`;
CREATE TABLE `material_concentrado` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `codigo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Código único del lote de concentrado',
  `fecha_inicio` date DEFAULT NULL COMMENT 'Fecha en que se abrió el lote',
  `fecha_fin` date DEFAULT NULL COMMENT 'Fecha en que se cerró el lote',
  `hizo_molienda` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'TRUE si el lote pasó por molienda',
  `hizo_flotacion` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'TRUE si el lote pasó por flotación',
  `hizo_relave` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'TRUE si el lote pasó por relave',
  `hizo_filtroprensa` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'TRUE si el lote pasó por filtroprensa',
  `toneladas_humedo` decimal(10,4) DEFAULT NULL COMMENT 'Toneladas húmedas totales del lote al cerrarse',
  `porcentaje_humedad` decimal(6,4) DEFAULT NULL COMMENT 'Porcentaje de humedad del lote al cerrarse',
  `toneladas_seco` decimal(10,4) DEFAULT NULL COMMENT 'Toneladas secas totales del lote al cerrarse',
  `toneladas_disponibles` decimal(10,4) NOT NULL DEFAULT '0.0000' COMMENT 'Toneladas secas que aún no se han enviado en un viaje',
  `ubicacion_canoa` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Ubicación física del lote (canoa) dentro de la planta',
  `precio_maquila_por_ton` decimal(14,2) DEFAULT NULL COMMENT 'Precio de maquila aplicado por tonelada seca, calculado al cerrar el lote',
  `maquila_total` decimal(14,2) DEFAULT NULL COMMENT 'Costo total de maquila del lote (precio_maquila_por_ton × toneladas_seco)',
  `estado` enum('en_proceso','en_canoa','parcialmente_enviado','enviado_completo') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'en_proceso' COMMENT 'Estado del lote en su ciclo de vida',
  `comentarios` text COLLATE utf8mb4_unicode_ci COMMENT 'Comentarios u observaciones libres',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la última actualización',
  `material_seco_procesado` decimal(10,4) DEFAULT NULL COMMENT 'Total de toneladas secas de materia prima que entraron al proceso. Se llena automáticamente al cerrar el lote. Útil para calcular la merma: material_seco_procesado - toneladas_seco.',
  `merma_au` decimal(12,4) NOT NULL DEFAULT '0.0000' COMMENT 'Gramos de Au que se pierden del lote (merma); se restan a total_grs_au_venta',
  `merma_ag` decimal(12,4) NOT NULL DEFAULT '0.0000' COMMENT 'Gramos de Ag que se pierden del lote (merma); se restan a total_grs_ag_venta',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lote de concentrado en proceso/canoa, resultado de uno o más procesos (molienda, flotación, relave, filtroprensa) sobre varias entradas — ver `procesamiento_material`.';

DROP TABLE IF EXISTS `material_planta_entrada`;
CREATE TABLE `material_planta_entrada` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `numero_volqueta` int NOT NULL COMMENT 'Número de volqueta anotado en báscula (no es FK, es dato de campo)',
  `id_mina` int NOT NULL COMMENT 'Mina de origen del material — ver `mina`',
  `id_vehiculo` int DEFAULT NULL COMMENT 'Vehículo que llegó (dueño implícito)',
  `id_tipo_material` int NOT NULL COMMENT 'Tipo de material entregado — ver `tipos_material`',
  `fecha_llegada` date NOT NULL COMMENT 'Fecha en que el material llegó a planta',
  `peso_llegada_planta` decimal(10,4) NOT NULL COMMENT 'Peso húmedo registrado en báscula al llegar',
  `porcentaje_humedad` decimal(6,4) NOT NULL COMMENT 'Porcentaje de humedad del material',
  `gramos_humedad` decimal(10,4) DEFAULT NULL COMMENT 'Gramos de agua estimados por la humedad',
  `tenor` decimal(8,4) DEFAULT NULL COMMENT 'Ley de oro (gr Au/ton seca) usada para tasar esta entrada',
  `total_material_seco` decimal(10,4) DEFAULT NULL COMMENT 'Toneladas secas (peso_llegada_planta sin la humedad)',
  `total_gramos` decimal(12,4) DEFAULT NULL COMMENT 'Gramos de Au totales pagados en esta entrada',
  `precio_por_gramo` decimal(14,2) DEFAULT NULL COMMENT 'Precio pagado por gramo de Au, si el minero cobra por_gramo',
  `precio_por_tonelada` decimal(14,2) DEFAULT NULL COMMENT 'Precio pagado por tonelada seca, si el minero cobra por_tonelada',
  `precio_total` decimal(14,2) DEFAULT NULL COMMENT 'Valor total pagado al minero por el material',
  `excedente_calculado` decimal(14,2) DEFAULT NULL COMMENT 'Excedente estimado (ingreso empresa). Ver tabla Excedente.',
  `costo_cargue` decimal(14,2) DEFAULT '0.00' COMMENT 'Costo de cargue en mina',
  `costo_bascula` decimal(14,2) DEFAULT '0.00' COMMENT 'Costo de báscula/pesaje',
  `costo_maquila` decimal(14,2) DEFAULT '0.00' COMMENT 'Costo de procesamiento asignado a esta entrada',
  `costo_adicional` decimal(14,2) DEFAULT '0.00' COMMENT 'Costos adicionales varios no cubiertos por cargue/báscula/maquila/flete',
  `costo_volqueta` decimal(14,2) DEFAULT '0.00' COMMENT 'Flete = total_material_seco × tarifa zona',
  `total_costos_operativos` decimal(14,2) DEFAULT NULL COMMENT 'Suma de costos operativos de la entrada (cargue, báscula, adicional, maquila, flete)',
  `total_material` decimal(14,2) DEFAULT NULL COMMENT 'Valor final de la entrada (precio_total + costos operativos)',
  `estado` enum('pendiente','en_proceso','pagada','incluida_viaje','cancelada') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendiente' COMMENT 'Estado de la entrada en su ciclo de vida',
  `estado_pago_flete` enum('pendiente','parcial','pagado','no_aplica') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendiente' COMMENT 'Estado de pago del flete al dueño del vehículo',
  `comentarios` text COLLATE utf8mb4_unicode_ci COMMENT 'Comentarios u observaciones libres',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la última actualización',
  PRIMARY KEY (`id`),
  KEY `id_tipo_material` (`id_tipo_material`),
  KEY `idx_mpe_mina` (`id_mina`),
  KEY `idx_mpe_vehiculo` (`id_vehiculo`),
  KEY `idx_mpe_fecha` (`fecha_llegada`),
  KEY `idx_mpe_estado` (`estado`),
  KEY `idx_mpe_flete` (`estado_pago_flete`),
  CONSTRAINT `material_planta_entrada_ibfk_1` FOREIGN KEY (`id_mina`) REFERENCES `mina` (`id`),
  CONSTRAINT `material_planta_entrada_ibfk_2` FOREIGN KEY (`id_vehiculo`) REFERENCES `volqueta_vehiculo` (`id`),
  CONSTRAINT `material_planta_entrada_ibfk_3` FOREIGN KEY (`id_tipo_material`) REFERENCES `tipos_material` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=381 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Entrada de material. Minero → id_mina→Mina.id_minero. Dueño flete → id_vehiculo→Volqueta_Vehiculo.';

DROP TABLE IF EXISTS `materiales`;
CREATE TABLE `materiales` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre del mineral',
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción libre',
  `unidad_medida` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Unidad en la que se cotiza este mineral',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Catálogo de minerales (uso en cotizaciones)';

DROP TABLE IF EXISTS `mina`;
CREATE TABLE `mina` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre de la mina',
  `id_minero` int DEFAULT NULL COMMENT 'Dueño habitual — ver Minero',
  `id_zona` int DEFAULT NULL COMMENT 'Zona de lejanía — define flete',
  `ubicacion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Ubicación física de la mina',
  `estado` enum('activa','inactiva') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'activa' COMMENT 'Estado actual de la mina',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la última actualización',
  PRIMARY KEY (`id`),
  KEY `id_zona` (`id_zona`),
  KEY `idx_mina_minero` (`id_minero`),
  CONSTRAINT `mina_ibfk_1` FOREIGN KEY (`id_minero`) REFERENCES `minero` (`id`) ON DELETE SET NULL,
  CONSTRAINT `mina_ibfk_2` FOREIGN KEY (`id_zona`) REFERENCES `zona` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Frentes de extracción. id_tipo_material eliminado: zona ≠ tipo de material.';

DROP TABLE IF EXISTS `minero`;
CREATE TABLE `minero` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre del minero',
  `titular` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nombre del titular real, si es distinto al nombre comercial',
  `cc` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Cédula o identificación',
  `alias` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Apodo o nombre corto usado en selectores',
  `telefono` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Teléfono de contacto',
  `ciudad` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Ciudad',
  `banco` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Entidad bancaria',
  `numero_cuenta` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Número de cuenta bancaria',
  `nequi` tinyint(1) DEFAULT '0' COMMENT 'TRUE si paga/recibe por Nequi',
  `metodo_calculo` enum('por_gramo','por_tonelada') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'por_tonelada' COMMENT 'Forma en que se le paga por defecto a este minero',
  `estado` enum('activo','inactivo') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'activo' COMMENT 'Estado actual del minero',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la última actualización',
  PRIMARY KEY (`id`),
  UNIQUE KEY `cc` (`cc`),
  KEY `idx_minero_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Catálogo de mineros (dueños habituales de minas).';

DROP TABLE IF EXISTS `movimientos_prestamo_financiero`;
CREATE TABLE `movimientos_prestamo_financiero` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único del movimiento',
  `id_prestamo_fin` int NOT NULL COMMENT 'Préstamo financiero afectado — ver Prestamos_Financieros',
  `tipo` enum('interes','abono') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'interes = interés acumulado del período (no es salida de caja, capitaliza el saldo); abono = pago real registrado vía Abonos_CxP',
  `fecha` date NOT NULL COMMENT 'Fecha del movimiento',
  `valor` decimal(15,2) NOT NULL COMMENT 'Monto del movimiento en pesos colombianos (siempre positivo; tipo indica si suma o resta al saldo)',
  `saldo_resultante` decimal(15,2) NOT NULL COMMENT 'Saldo_pendiente del préstamo inmediatamente después de aplicar este movimiento',
  `id_abono_cxp` int DEFAULT NULL COMMENT 'Solo cuando tipo=abono: el Abono_CxP real que generó este movimiento — ver Abonos_CxP',
  `observaciones` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Notas adicionales (Ej: Interés de 3 meses acumulado, Abono parcial Davivienda)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `id_abono_cxp` (`id_abono_cxp`),
  KEY `idx_mov_prestamo_fin` (`id_prestamo_fin`,`fecha`),
  CONSTRAINT `movimientos_prestamo_financiero_ibfk_1` FOREIGN KEY (`id_prestamo_fin`) REFERENCES `prestamos_financieros` (`id`),
  CONSTRAINT `movimientos_prestamo_financiero_ibfk_2` FOREIGN KEY (`id_abono_cxp`) REFERENCES `abonos_cxp` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Historial de movimientos del saldo de un préstamo financiero: acumulación de interés (capitaliza, no es caja) y abonos (sí son caja, reflejados también en Cuentas_Por_Pagar/Abonos_CxP vía Cuentas_Por_Pagar_Relacion.id_prestamo_fin).';

DROP TABLE IF EXISTS `mulas`;
CREATE TABLE `mulas` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_proveedor` int NOT NULL COMMENT 'Transportadora que hace el despacho — ver `proveedores`',
  `id_viaje` int DEFAULT NULL COMMENT 'Viaje despachado en esta mula, si aplica — ver `viaje`',
  `fecha` date NOT NULL COMMENT 'Fecha del despacho',
  `concepto` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción del concepto u operación',
  `factura_num` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Número de factura de la transportadora',
  `foto_factura_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL o ruta de la foto de la factura',
  `valor` decimal(14,2) NOT NULL COMMENT 'Lo que se debe pagar por este despacho (antes de retención) — la deuda, no un pago. El pago real se registra en los abonos de su Cuenta_Por_Pagar; comprobante_url de esta tabla queda sin uso desde la app (el comprobante vive en cada Abono_CxP).',
  `comprobante_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL o ruta del comprobante adjunto',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  `retencion_fuente_manual` decimal(14,2) DEFAULT NULL COMMENT 'Override manual de la retefuente al crear/editar el despacho. NULL = automático (catálogo); 0 = fuerza que no aplique; >0 = fuerza ese valor exacto.',
  PRIMARY KEY (`id`),
  KEY `idx_mulas_proveedor` (`id_proveedor`),
  KEY `idx_mulas_fecha` (`fecha`),
  KEY `fk_mulas_viaje` (`id_viaje`),
  CONSTRAINT `fk_mulas_viaje` FOREIGN KEY (`id_viaje`) REFERENCES `viaje` (`id`) ON DELETE SET NULL,
  CONSTRAINT `mulas_ibfk_1` FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Retención → v_mulas. Estado → v_estado_mulas.';

DROP TABLE IF EXISTS `nomina_liquidaciones`;
CREATE TABLE `nomina_liquidaciones` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único de la liquidación quincenal',
  `id_empleado` int NOT NULL COMMENT 'Empleado liquidado — ver Empleados',
  `anio` int NOT NULL COMMENT 'Año de la quincena liquidada',
  `mes` int NOT NULL COMMENT 'Mes de la quincena liquidada (1-12)',
  `quincena` tinyint NOT NULL COMMENT '1 = primera quincena (paga el día 15), 2 = segunda quincena (paga a fin de mes)',
  `tipo_pago` enum('FIJO_MENSUAL','POR_DIAS','POR_HORAS') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Copiado de Empleados_Salario vigente al momento de liquidar',
  `unidades` decimal(10,2) DEFAULT NULL COMMENT 'Días u horas trabajadas en la quincena (NULL cuando tipo_pago=FIJO_MENSUAL)',
  `tarifa_aplicada` decimal(14,2) NOT NULL COMMENT 'Tarifa vigente usada en el cálculo (mensual, diaria u horaria según tipo_pago)',
  `monto_bruto` decimal(14,2) NOT NULL COMMENT 'Devengado antes de bonos y descuentos',
  `total_recargo_dominical_festivo` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'Parte de monto_bruto atribuible al recargo dominical/festivo (+75%) — informativo, YA está incluido en monto_bruto, no se resta ni suma aparte en monto_neto',
  `total_bonos` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'Suma de Bonos_Empleado del empleado dentro del rango de fechas de esta quincena',
  `total_descuento_prestamo` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'Cuota de Prestamos_Empleados descontada automáticamente en esta liquidación',
  `aporte_salud` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'Aporte a salud a cargo del empleado: 4% del IBC (monto_bruto + total_bonos)',
  `aporte_pension` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'Aporte a pensión a cargo del empleado: 4% del IBC (monto_bruto + total_bonos)',
  `total_aportes_seguridad_social` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'aporte_salud + aporte_pension; se descuenta del monto_neto junto con total_descuento_prestamo y otros_descuentos',
  `otros_descuentos` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'Descuentos adicionales manuales (ausencias, etc.)',
  `monto_neto` decimal(14,2) NOT NULL COMMENT 'monto_bruto + total_bonos - total_descuento_prestamo - total_aportes_seguridad_social - otros_descuentos',
  `id_cuenta_pagar` int DEFAULT NULL COMMENT 'CxP generada al confirmar (categoría Nómina) — ver Cuentas_Por_Pagar. NULL mientras estado=borrador',
  `estado` enum('borrador','confirmado') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'borrador' COMMENT 'borrador = aún editable, no genera CxP. confirmado = ya generó la CxP y el descuento de préstamo',
  `fecha_liquidacion` date NOT NULL DEFAULT (curdate()) COMMENT 'Fecha en que se confirmó/registró la liquidación',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_nomina_liquidacion_periodo` (`id_empleado`,`anio`,`mes`,`quincena`),
  KEY `id_cuenta_pagar` (`id_cuenta_pagar`),
  KEY `idx_nomina_liq_periodo` (`anio`,`mes`,`quincena`),
  CONSTRAINT `nomina_liquidaciones_ibfk_1` FOREIGN KEY (`id_empleado`) REFERENCES `empleados` (`id`),
  CONSTRAINT `nomina_liquidaciones_ibfk_2` FOREIGN KEY (`id_cuenta_pagar`) REFERENCES `cuentas_por_pagar` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Liquidación quincenal de nómina por empleado. Una fila por empleado por quincena (1=día 15, 2=fin de mes). El bruto se calcula de Empleados_Salario (fijo) o Turno (variable, por días/horas de esa quincena).';

DROP TABLE IF EXISTS `permisos`;
CREATE TABLE `permisos` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `codigo` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Código único del permiso, usado por el backend para autorizar',
  `descripcion` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción libre',
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Catálogo de permisos del sistema, asignables a roles vía `rol_permiso`.';

DROP TABLE IF EXISTS `peso_final_transfigura`;
CREATE TABLE `peso_final_transfigura` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_viaje` int NOT NULL COMMENT 'Viaje al que corresponde este resultado — ver `viaje`',
  `fecha` date NOT NULL COMMENT 'Fecha del resultado',
  `peso_neto` decimal(15,4) DEFAULT NULL COMMENT 'Peso neto reportado por Transfigura',
  `peso_seco` decimal(15,4) DEFAULT NULL COMMENT 'Peso seco reportado por Transfigura',
  `infopath_au` decimal(10,4) DEFAULT NULL COMMENT 'Ley de Au reportada en el Infopath (muestreo inicial)',
  `infopath_ag` decimal(10,4) DEFAULT NULL COMMENT 'Ley de Ag reportada en el Infopath (muestreo inicial)',
  `tenor_inicial_sgs_au` decimal(10,4) DEFAULT NULL COMMENT 'Ley de Au reportada por SGS en el muestreo inicial',
  `tenor_inicial_sgs_ag` decimal(10,4) DEFAULT NULL COMMENT 'Ley de Ag reportada por SGS en el muestreo inicial',
  `tenor_inicial_sgs_cu` decimal(10,4) DEFAULT NULL COMMENT 'Ley de Cu reportada por SGS en el muestreo inicial',
  `tenor_final_peru_au` decimal(10,4) DEFAULT NULL COMMENT 'Ley de Au final reportada por la refinería en Perú',
  `tenor_final_peru_ag` decimal(10,4) DEFAULT NULL COMMENT 'Ley de Ag final reportada por la refinería en Perú',
  `arsenico_final_peru` decimal(10,4) DEFAULT NULL COMMENT 'Porcentaje de arsénico final reportado por la refinería en Perú',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `idx_peso_viaje` (`id_viaje`),
  CONSTRAINT `peso_final_transfigura_ibfk_1` FOREIGN KEY (`id_viaje`) REFERENCES `viaje` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Trazabilidad metalúrgica. numero_viaje → JOIN con Viaje.numero_viaje';

DROP TABLE IF EXISTS `planta`;
CREATE TABLE `planta` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre de la instalación',
  `ubicacion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Dirección o ubicación física de la planta',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Instalaciones de procesamiento';

DROP TABLE IF EXISTS `planta_procesos`;
CREATE TABLE `planta_procesos` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `planta_id` int NOT NULL COMMENT 'Planta a la que pertenece este proceso — ver `planta`',
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre del proceso o área',
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción libre',
  `activo` tinyint(1) DEFAULT '1' COMMENT 'FALSE si el registro ya no se usa (se conserva por histórico)',
  PRIMARY KEY (`id`),
  KEY `idx_procesos_planta` (`planta_id`),
  CONSTRAINT `planta_procesos_ibfk_1` FOREIGN KEY (`planta_id`) REFERENCES `planta` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Áreas de trabajo o procesos específicos dentro de cada planta';

DROP TABLE IF EXISTS `precio_material`;
CREATE TABLE `precio_material` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único del precio',
  `id_minero` int DEFAULT NULL COMMENT 'Minero al que aplica este precio. NULL = precio global para todos los mineros.',
  `id_zona` int DEFAULT NULL COMMENT 'Zona a la que aplica este precio. NULL = aplica independientemente de la zona.',
  `metodo` enum('por_gramo','por_tonelada') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'por_tonelada' COMMENT 'Método de cálculo: por_gramo=paga por gramos de Au totales, por_tonelada=paga por toneladas secas de material',
  `precio_por_gramo` decimal(14,2) DEFAULT NULL COMMENT 'Precio en pesos por gramo de Au. Activo cuando metodo=por_gramo (Ej: 72000 = $72.000/gr Au)',
  `precio_por_tonelada` decimal(14,2) DEFAULT NULL COMMENT 'Precio en pesos por tonelada seca. Activo cuando metodo=por_tonelada (Ej: 650000 = $650.000/ton)',
  `intervalo_tenor_min` decimal(8,4) NOT NULL DEFAULT '0.0000' COMMENT 'Tenor mínimo del rango en gr Au/ton seca al que aplica este precio (inclusive)',
  `intervalo_tenor_max` decimal(8,4) NOT NULL DEFAULT '9999.0000' COMMENT 'Tenor máximo del rango en gr Au/ton seca al que aplica este precio (inclusive)',
  `fecha_inicio` date NOT NULL COMMENT 'Fecha desde la que está vigente este precio',
  `fecha_fin` date DEFAULT NULL COMMENT 'Fecha hasta la que aplica. NULL = precio vigente actualmente sin fecha de vencimiento.',
  `activo` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Indica si este precio está activo para nuevos cálculos (1=vigente, 0=histórico reemplazado)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `idx_precio_minero` (`id_minero`,`activo`),
  KEY `idx_precio_zona` (`id_zona`,`activo`),
  CONSTRAINT `precio_material_ibfk_1` FOREIGN KEY (`id_minero`) REFERENCES `minero` (`id`) ON DELETE CASCADE,
  CONSTRAINT `precio_material_ibfk_2` FOREIGN KEY (`id_zona`) REFERENCES `zona` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Escala de precios de compra de material por rango de tenor (gr Au/ton). Puede ser global (id_minero/id_zona NULL), específico por minero o por zona. El trigger busca el precio activo según el tenor de la entrada.';

DROP TABLE IF EXISTS `prestamos_empleados`;
CREATE TABLE `prestamos_empleados` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_empleado` int NOT NULL COMMENT 'Empleado que recibe el préstamo — ver `empleados`',
  `fecha` date NOT NULL COMMENT 'Fecha del registro',
  `concepto` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción del concepto u operación',
  `valor` decimal(15,2) NOT NULL COMMENT 'Valor total prestado',
  `cuotas` int DEFAULT '1' COMMENT 'Número de cuotas en que se descuenta de nómina',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `idx_prestamos_empleado` (`id_empleado`),
  CONSTRAINT `prestamos_empleados_ibfk_1` FOREIGN KEY (`id_empleado`) REFERENCES `empleados` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Saldo real → v_saldo_prestamos_empleado. Genera CxC al desembolsar.';

DROP TABLE IF EXISTS `prestamos_financieros`;
CREATE TABLE `prestamos_financieros` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `nombre_prestamo` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre o referencia del préstamo (Ej: Bancolombia crédito 123)',
  `fecha_adquisicion` date NOT NULL COMMENT 'Fecha en que se adquirió el préstamo',
  `monto_principal` decimal(15,2) NOT NULL COMMENT 'Monto original desembolsado',
  `tasa_interes` decimal(5,2) NOT NULL COMMENT 'Tasa de interés periódica aplicada (%)',
  `saldo_pendiente` decimal(15,2) NOT NULL COMMENT 'Saldo actual del préstamo, incluyendo interés capitalizado — ver `movimientos_prestamo_financiero`',
  `activo` tinyint(1) DEFAULT '1' COMMENT 'FALSE si el registro ya no se usa (se conserva por histórico)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Préstamos recibidos por la empresa de terceros financieros. `movimientos_prestamo_financiero` lleva el histórico de interés y abonos.';

DROP TABLE IF EXISTS `procesamiento_material`;
CREATE TABLE `procesamiento_material` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_material_concentrado` int NOT NULL COMMENT 'Lote de concentrado al que aporta esta entrada — ver `material_concentrado`',
  `id_entrada` int NOT NULL COMMENT 'Entrada que aporta material al lote — ver `material_planta_entrada`',
  `toneladas_aportadas` decimal(10,4) NOT NULL COMMENT 'Toneladas húmedas que esta entrada aportó al lote',
  `toneladas_seco_aportadas` decimal(10,4) DEFAULT NULL COMMENT 'Toneladas secas que esta entrada aportó al lote',
  `concentrado_proporcional` decimal(10,4) DEFAULT NULL COMMENT 'Toneladas de concentrado atribuidas proporcionalmente a esta entrada',
  `maquila_proporcional` decimal(14,2) DEFAULT NULL COMMENT 'Costo de maquila atribuido proporcionalmente a esta entrada',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_conc_ent` (`id_material_concentrado`,`id_entrada`),
  KEY `fk_pm_mc_idx` (`id_material_concentrado`),
  KEY `fk_pm_ent_idx` (`id_entrada`),
  CONSTRAINT `fk_pm_entrada` FOREIGN KEY (`id_entrada`) REFERENCES `material_planta_entrada` (`id`),
  CONSTRAINT `fk_pm_mc` FOREIGN KEY (`id_material_concentrado`) REFERENCES `material_concentrado` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=181 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Relación N:N entre `material_concentrado` y `material_planta_entrada`: cuánto aportó cada entrada a cada lote de concentrado.';

DROP TABLE IF EXISTS `proveedores`;
CREATE TABLE `proveedores` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre o razón social del proveedor',
  `id_categoria` int DEFAULT NULL COMMENT 'Categoría del proveedor — ver `categorias_proveedor`',
  `tipo` enum('general','combustible','transportadora','laboratorio') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'general' COMMENT 'Tipo de negocio del proveedor — combustible = válido como Combustible.id_gasolinera',
  `contacto` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nombre de la persona de contacto',
  `telefono` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Teléfono de contacto',
  `ciudad` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Ciudad',
  `alias` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Apodo o nombre corto usado en selectores',
  `nequi` tinyint(1) DEFAULT '0' COMMENT 'TRUE si paga/recibe por Nequi',
  `compra_realizada` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nota libre histórica de compras realizadas a este proveedor',
  `estado` enum('activo','inactivo') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'activo' COMMENT 'Estado actual del proveedor',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la última actualización',
  `declarante_renta` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'TRUE si el proveedor es declarante de renta (cambia la tarifa de retención aplicable). Por defecto FALSE (no declarante, la tarifa más conservadora) hasta que se cargue el dato real.',
  `exento_retencion` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'TRUE si al proveedor nunca se le calcula retención en la fuente (Ej: autorretenedores, grandes contribuyentes)',
  PRIMARY KEY (`id`),
  KEY `id_categoria` (`id_categoria`),
  KEY `idx_proveedores_nombre` (`nombre`),
  CONSTRAINT `proveedores_ibfk_1` FOREIGN KEY (`id_categoria`) REFERENCES `categorias_proveedor` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Catálogo de proveedores/terceros (gasolineras, transportadoras, laboratorios, arrendadores, etc.).';

DROP TABLE IF EXISTS `retenciones_aplicadas`;
CREATE TABLE `retenciones_aplicadas` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único de la retención aplicada',
  `id_concepto_retencion` int NOT NULL COMMENT 'Concepto de retención aplicado — ver Conceptos_Retencion',
  `id_cuenta_pagar` int NOT NULL COMMENT 'Cuenta por pagar sobre la que se calculó — ver Cuentas_Por_Pagar',
  `valor_base` decimal(14,2) NOT NULL COMMENT 'Valor bruto sobre el que se calculó la retención',
  `tarifa_aplicada` decimal(5,2) NOT NULL COMMENT 'Tarifa (%) efectivamente usada (según declarante_renta del tercero en ese momento)',
  `valor_retenido` decimal(14,2) NOT NULL COMMENT 'Monto retenido (valor_base × tarifa_aplicada / 100)',
  `tipo` enum('fuente','iva') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'fuente' COMMENT 'Tipo de retención. Solo "fuente" en esta fase; "iva" queda listo para la Fase 2',
  `fecha` date NOT NULL COMMENT 'Fecha de causación (fecha de creación de la CxP)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  `ajustado_manualmente` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'TRUE si valor_retenido fue corregido a mano en vez de quedarse con el cálculo automático del catálogo',
  `valor_calculado_original` decimal(14,2) DEFAULT NULL COMMENT 'Valor que el catálogo calculó automáticamente antes del primer ajuste manual. NULL mientras nunca se haya ajustado.',
  PRIMARY KEY (`id`),
  KEY `id_concepto_retencion` (`id_concepto_retencion`),
  KEY `idx_retenciones_aplicadas_cuenta` (`id_cuenta_pagar`),
  KEY `idx_retenciones_aplicadas_fecha` (`fecha`),
  CONSTRAINT `retenciones_aplicadas_ibfk_1` FOREIGN KEY (`id_concepto_retencion`) REFERENCES `conceptos_retencion` (`id`),
  CONSTRAINT `retenciones_aplicadas_ibfk_2` FOREIGN KEY (`id_cuenta_pagar`) REFERENCES `cuentas_por_pagar` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Histórico inmutable de cada retención realmente aplicada sobre una CxP. Calculado y guardado por la app al crear la cuenta (sin triggers de BD), igual que el 4x1000 y la maquila.';

DROP TABLE IF EXISTS `rol_permiso`;
CREATE TABLE `rol_permiso` (
  `id_rol` int NOT NULL COMMENT 'Rol — ver `roles`',
  `id_permiso` int NOT NULL COMMENT 'Permiso concedido al rol — ver `permisos`',
  PRIMARY KEY (`id_rol`,`id_permiso`),
  KEY `id_permiso` (`id_permiso`),
  CONSTRAINT `rol_permiso_ibfk_1` FOREIGN KEY (`id_rol`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rol_permiso_ibfk_2` FOREIGN KEY (`id_permiso`) REFERENCES `permisos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Relación N:N entre `roles` y `permisos`.';

DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `nombre` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre del rol',
  `descripcion` text COLLATE utf8mb4_unicode_ci COMMENT 'Descripción libre',
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Catálogo de roles de usuario del sistema.';

DROP TABLE IF EXISTS `saldo_a_favor`;
CREATE TABLE `saldo_a_favor` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `origen` enum('pago_excedido','ajuste_manual','anticipo') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Origen: pago_excedido=sobrepago en un Abono_CxP, ajuste_manual=corrección contable, anticipo=espejo de un Anticipos_Terceros creado a propósito',
  `id_abono_cxp_orig` int DEFAULT NULL COMMENT 'Abono que generó el sobrepago (si origen=pago_excedido)',
  `id_anticipo` int DEFAULT NULL COMMENT 'Solo cuando origen=anticipo: anticipo del que este crédito es espejo — ver Anticipos_Terceros',
  `id_minero` int DEFAULT NULL COMMENT 'Minero beneficiario del crédito, cuando aplica — ver `minero`',
  `id_dueno_volqueta` int DEFAULT NULL COMMENT 'Dueño de volqueta beneficiario del crédito, cuando aplica — ver `dueno_volqueta`',
  `id_proveedor` int DEFAULT NULL COMMENT 'Proveedor beneficiario del crédito, cuando aplica — ver `proveedores`',
  `id_empleado` int DEFAULT NULL COMMENT 'Empleado beneficiario del crédito, cuando aplica — ver `empleados`',
  `id_cuenta_pagar` int DEFAULT NULL COMMENT 'CxP sobre la que se generó el sobrepago, si origen=pago_excedido — ver `cuentas_por_pagar`',
  `monto_original` decimal(14,2) NOT NULL COMMENT 'Valor pagado en exceso',
  `monto_aplicado` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'Cuánto de este crédito ya se usó o devolvió',
  `saldo_disponible` decimal(14,2) GENERATED ALWAYS AS ((`monto_original` - `monto_aplicado`)) STORED COMMENT 'monto_original - monto_aplicado',
  `tipo_resolucion` enum('pendiente','descontar_futuro','devolucion') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendiente' COMMENT 'pendiente=sin decidir; descontar_futuro=abono futuro; devolucion=tercero regresa el dinero',
  `estado` enum('disponible','parcial','agotado','devuelto') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'disponible' COMMENT 'Estado actual del crédito',
  `fecha` date NOT NULL DEFAULT (curdate()) COMMENT 'Fecha del registro',
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción del error o motivo del ajuste',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la última actualización',
  PRIMARY KEY (`id`),
  KEY `id_empleado` (`id_empleado`),
  KEY `id_cuenta_pagar` (`id_cuenta_pagar`),
  KEY `idx_saf_minero` (`id_minero`),
  KEY `idx_saf_volqueta` (`id_dueno_volqueta`),
  KEY `idx_saf_proveedor` (`id_proveedor`),
  KEY `idx_saf_estado` (`estado`),
  KEY `fk_saf_anticipo` (`id_anticipo`),
  CONSTRAINT `fk_saf_anticipo` FOREIGN KEY (`id_anticipo`) REFERENCES `anticipos_terceros` (`id`),
  CONSTRAINT `saldo_a_favor_ibfk_1` FOREIGN KEY (`id_minero`) REFERENCES `minero` (`id`),
  CONSTRAINT `saldo_a_favor_ibfk_2` FOREIGN KEY (`id_dueno_volqueta`) REFERENCES `dueno_volqueta` (`id`),
  CONSTRAINT `saldo_a_favor_ibfk_3` FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id`),
  CONSTRAINT `saldo_a_favor_ibfk_4` FOREIGN KEY (`id_empleado`) REFERENCES `empleados` (`id`),
  CONSTRAINT `saldo_a_favor_ibfk_5` FOREIGN KEY (`id_cuenta_pagar`) REFERENCES `cuentas_por_pagar` (`id`),
  CONSTRAINT `chk_saf_origen_anticipo` CHECK (((`origen` = _utf8mb4'anticipo') = (`id_anticipo` is not null))),
  CONSTRAINT `chk_saf_un_beneficiario` CHECK ((((((`id_minero` is not null) + (`id_dueno_volqueta` is not null)) + (`id_proveedor` is not null)) + (`id_empleado` is not null)) = 1))
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Crédito por sobrepago. Resuelve con descuento futuro o devolución del tercero.';

DROP TABLE IF EXISTS `tarifa_zona`;
CREATE TABLE `tarifa_zona` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_zona` int NOT NULL COMMENT 'Zona a la que aplica esta tarifa — ver `zona`',
  `valor_tonelada` decimal(14,2) NOT NULL COMMENT 'Valor de flete por tonelada seca para esta zona',
  `vigente_desde` date NOT NULL DEFAULT (curdate()) COMMENT 'Fecha desde la que esta tarifa aplica',
  `vigente_hasta` date DEFAULT NULL COMMENT 'Fecha hasta la que aplicó. NULL = sigue vigente',
  `activo` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'FALSE si el registro ya no se usa (se conserva por histórico)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `idx_tarifa_zona` (`id_zona`,`activo`),
  CONSTRAINT `tarifa_zona_ibfk_1` FOREIGN KEY (`id_zona`) REFERENCES `zona` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Histórico de tarifas de flete por tonelada por zona, vigentes por rango de fechas.';

DROP TABLE IF EXISTS `tarifas_calculo`;
CREATE TABLE `tarifas_calculo` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `codigo` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Código único de la tarifa (usado por el backend)',
  `valor` decimal(14,2) NOT NULL COMMENT 'Valor numérico de la tarifa',
  `descripcion` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción libre',
  `vigente_desde` date NOT NULL DEFAULT (curdate()) COMMENT 'Fecha desde la que aplica este valor',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la última actualización',
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tarifas globales de cálculo';

DROP TABLE IF EXISTS `tarifas_proceso`;
CREATE TABLE `tarifas_proceso` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `codigo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Código único del proceso (molienda, flotacion, relave, filtroprensa)',
  `descripcion` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción libre',
  `valor` decimal(14,4) NOT NULL COMMENT 'Valor de la tarifa de maquila para este proceso',
  `unidad` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'COP/ton' COMMENT 'Unidad en la que se expresa el valor',
  `fecha_desde` date NOT NULL COMMENT 'Fecha desde la que esta tarifa aplica',
  `fecha_hasta` date DEFAULT NULL COMMENT 'Fecha hasta la que aplicó. NULL = sigue vigente',
  `activo` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'FALSE si el registro ya no se usa (se conserva por histórico)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la última actualización',
  PRIMARY KEY (`id`),
  KEY `idx_tarifa_codigo_activo` (`codigo`,`activo`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Histórico de tarifas de maquila por proceso (molienda, flotación, relave, filtroprensa), vigentes por rango de fechas — ver `material_concentrado`.';

DROP TABLE IF EXISTS `tipos_alquiler`;
CREATE TABLE `tipos_alquiler` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre de la categoría de alquiler',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Clasificación de alquileres';

DROP TABLE IF EXISTS `tipos_analisis`;
CREATE TABLE `tipos_analisis` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `nombre` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre del tipo de análisis',
  `descripcion` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción libre',
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tipos de análisis de laboratorio';

DROP TABLE IF EXISTS `tipos_gasto_operativo`;
CREATE TABLE `tipos_gasto_operativo` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `nombre` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre del tipo de gasto operativo',
  `descripcion` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción libre',
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tipos de gasto operativo (caja menor)';

DROP TABLE IF EXISTS `tipos_material`;
CREATE TABLE `tipos_material` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `nombre` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre del tipo de material',
  `descripcion` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción libre',
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tipos de material para inventario y entradas';

DROP TABLE IF EXISTS `tipos_turno`;
CREATE TABLE `tipos_turno` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `nombre` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre del turno (Ej: TURNO 1, TURNO 2, TURNO 3)',
  `hora_inicio` time NOT NULL COMMENT 'Hora de inicio del turno',
  `hora_fin` time NOT NULL COMMENT 'Hora de fin del turno',
  `recargo_porcentaje` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT 'Recargo PROPIO de este turno (política interna, ej. bono de la tarde) — aparte del recargo nocturno legal de 35%, que ahora se calcula por hora según Jornada_Nocturna_Legal y se suma por separado. No usar este campo para modelar la noche.',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Horarios de operación';

DROP TABLE IF EXISTS `turnos`;
CREATE TABLE `turnos` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `fecha` date NOT NULL COMMENT 'Fecha del turno trabajado',
  `id_empleado` int NOT NULL COMMENT 'Empleado que trabajó el turno — ver `empleados`',
  `id_tipo_turno` int NOT NULL COMMENT 'Tipo de turno trabajado — ver `tipos_turno`',
  `id_planta_proceso` int DEFAULT NULL COMMENT 'Proceso/área de la planta asignado, si aplica — ver `planta_procesos`',
  `horas_trabajadas` decimal(5,2) DEFAULT '0.00' COMMENT 'Horas efectivamente trabajadas ese día',
  `presente` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'FALSE = el empleado no asistió ese día (ausencia); horas_trabajadas queda en 0. TRUE = turno normal.',
  `es_festivo` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Festivo de calendario (no domingo, que se detecta solo) — se marca al registrar el turno de ese día, sin catálogo de fechas aparte. Suma +75% de recargo dominical/festivo.',
  `comentarios` text COLLATE utf8mb4_unicode_ci COMMENT 'Comentarios u observaciones libres',
  `quincena` int GENERATED ALWAYS AS ((case when (dayofmonth(`fecha`) <= 15) then 1 else 2 end)) STORED COMMENT '1 si el día cae en la primera quincena (1-15), 2 si cae en la segunda',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_turno_empleado_fecha` (`id_empleado`,`fecha`),
  KEY `id_tipo_turno` (`id_tipo_turno`),
  KEY `id_planta_proceso` (`id_planta_proceso`),
  KEY `idx_turnos_fecha` (`fecha`),
  CONSTRAINT `turnos_ibfk_1` FOREIGN KEY (`id_empleado`) REFERENCES `empleados` (`id`),
  CONSTRAINT `turnos_ibfk_2` FOREIGN KEY (`id_tipo_turno`) REFERENCES `tipos_turno` (`id`),
  CONSTRAINT `turnos_ibfk_3` FOREIGN KEY (`id_planta_proceso`) REFERENCES `planta_procesos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=150 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Asistencia diaria de un empleado: turno trabajado, planta/proceso asignado y horas — base de la nómina variable.';

DROP TABLE IF EXISTS `usuarios`;
CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre de usuario para iniciar sesión',
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Contraseña cifrada (hash), nunca en texto plano',
  `id_rol` int NOT NULL COMMENT 'Rol asignado al usuario — ver `roles`',
  `id_empleado` int DEFAULT NULL COMMENT 'Empleado asociado a este usuario, si aplica — ver `empleados`',
  `activo` tinyint(1) DEFAULT '1' COMMENT 'FALSE si el registro ya no se usa (se conserva por histórico)',
  `ultimo_acceso` datetime DEFAULT NULL COMMENT 'Fecha y hora del último inicio de sesión',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `id_rol` (`id_rol`),
  KEY `id_empleado` (`id_empleado`),
  CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`id_rol`) REFERENCES `roles` (`id`),
  CONSTRAINT `usuarios_ibfk_2` FOREIGN KEY (`id_empleado`) REFERENCES `empleados` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Usuarios con acceso al sistema, cada uno ligado a un rol y opcionalmente a un empleado.';

DROP TABLE IF EXISTS `uvt_vigente`;
CREATE TABLE `uvt_vigente` (
  `anio` int NOT NULL COMMENT 'Año fiscal',
  `valor` decimal(10,2) NOT NULL COMMENT 'Valor de la UVT vigente ese año en pesos',
  PRIMARY KEY (`anio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Valor de la UVT por año. Se actualiza una fila al año (o cuando cambie a mitad de año) sin tocar código.';

DROP TABLE IF EXISTS `viaje`;
CREATE TABLE `viaje` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `numero_viaje` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Número de viaje asignado manualmente (no autoincremental)',
  `fecha` date NOT NULL COMMENT 'Fecha del registro',
  `estado` enum('almacenado','despachado') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'almacenado' COMMENT 'almacenado=el viaje está armado (con o sin líneas) pero el material sigue en planta. despachado=ya salió en una Mula hacia Barranquilla. Lo mantiene PagoMulaService al crear/eliminar/desvincular una Mula — no hay trigger.',
  `total_costo_material` decimal(14,2) DEFAULT NULL COMMENT 'Suma del costo de material de las líneas del viaje',
  `maquila` decimal(14,2) DEFAULT NULL COMMENT 'Costo total de maquila atribuido al viaje',
  `total_viaje` decimal(14,2) DEFAULT NULL COMMENT 'Valor total del viaje (material + maquila + gastos)',
  `au_promedio_compra` decimal(10,4) DEFAULT NULL COMMENT 'Ley de Au promedio de compra de las líneas del viaje',
  `tenor_au_venta` decimal(10,4) DEFAULT NULL COMMENT 'Ley de Au reportada en la venta (Transfigura)',
  `total_grs_au_venta` decimal(10,4) DEFAULT NULL COMMENT 'Gramos de Au totales reportados en la venta',
  `tenor_ag` decimal(10,4) DEFAULT NULL COMMENT 'Ley de Ag reportada en la venta',
  `total_grs_ag_venta` decimal(10,4) DEFAULT NULL COMMENT 'Gramos de Ag totales reportados en la venta',
  `comentarios` text COLLATE utf8mb4_unicode_ci COMMENT 'Comentarios u observaciones libres',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la última actualización',
  PRIMARY KEY (`id`),
  KEY `idx_viaje_estado` (`estado`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Despacho de material/concentrado hacia Transfigura (Barranquilla). Agrupa una o más líneas en `viaje_material`.';

DROP TABLE IF EXISTS `viaje_material`;
CREATE TABLE `viaje_material` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_viaje` int NOT NULL COMMENT 'Viaje al que pertenece esta línea — ver `viaje`',
  `es_remanente` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'TRUE si esta línea es el remanente no despachado de un viaje anterior',
  `id_viaje_origen` int DEFAULT NULL COMMENT 'Viaje del que proviene el remanente, si es_remanente=TRUE — ver `viaje`',
  `id_material_concentrado` int DEFAULT NULL COMMENT 'Lote de concentrado incluido en esta línea — ver `material_concentrado`',
  `concepto` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción del concepto u operación',
  `total_material` decimal(10,4) DEFAULT NULL COMMENT 'Toneladas de material incluidas en esta línea',
  `total_concentrado_humedo` decimal(10,4) DEFAULT NULL COMMENT 'Toneladas húmedas de concentrado incluidas',
  `porcentaje_humedad` decimal(6,4) DEFAULT NULL COMMENT 'Porcentaje de humedad del concentrado de esta línea',
  `peso_humedad` decimal(10,4) DEFAULT NULL COMMENT 'Peso de agua estimado por la humedad',
  `concentrado_seco` decimal(10,4) DEFAULT NULL COMMENT 'Toneladas secas de concentrado de esta línea',
  `costo_maquila` decimal(14,2) DEFAULT NULL COMMENT 'Costo de procesamiento proporcional a esta entrada',
  `valor_total_con_gastos` decimal(14,2) DEFAULT NULL COMMENT 'Valor de la línea incluyendo gastos atribuidos',
  `au_promedio_compra` decimal(10,4) DEFAULT NULL COMMENT 'Ley de Au promedio de compra de esta línea',
  `tenor_au_venta` decimal(10,4) DEFAULT NULL COMMENT 'Ley de Au reportada en la venta para esta línea',
  `total_grs_au_venta` decimal(10,4) DEFAULT NULL COMMENT 'Gramos de Au totales reportados en la venta para esta línea',
  `tenor_ag` decimal(10,4) DEFAULT NULL COMMENT 'Ley de Ag reportada en la venta para esta línea',
  `total_grs_ag_venta` decimal(10,4) DEFAULT NULL COMMENT 'Gramos de Ag totales reportados en la venta para esta línea',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  KEY `id_viaje_origen` (`id_viaje_origen`),
  KEY `idx_vm_viaje` (`id_viaje`),
  KEY `fk_vm_mc_idx` (`id_material_concentrado`),
  CONSTRAINT `fk_vm_mc` FOREIGN KEY (`id_material_concentrado`) REFERENCES `material_concentrado` (`id`),
  CONSTRAINT `viaje_material_ibfk_1` FOREIGN KEY (`id_viaje`) REFERENCES `viaje` (`id`),
  CONSTRAINT `viaje_material_ibfk_3` FOREIGN KEY (`id_viaje_origen`) REFERENCES `viaje` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=74 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Entradas que componen un viaje. costo_maquila se actualiza al cerrar la Maquila.';

DROP TABLE IF EXISTS `volqueta_vehiculo`;
CREATE TABLE `volqueta_vehiculo` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `id_dueno_volqueta` int NOT NULL COMMENT 'Dueño del vehículo — ver `dueno_volqueta`',
  `placa` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Placa del vehículo',
  `tipo_vehiculo` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Tipo de vehículo (volqueta, camión, etc.)',
  `conductor` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nombre del conductor habitual',
  `conductor_cc` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Cédula del conductor habitual',
  `capacidad_ton` decimal(8,2) DEFAULT NULL COMMENT 'Capacidad de carga del vehículo en toneladas',
  `fecha` date DEFAULT NULL COMMENT 'Fecha de registro o último viaje registrado',
  `estado_pago` enum('pendiente','parcial','pagado','no_aplica') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'no_aplica' COMMENT 'Estado cuenta corriente de flete. Actualizado por trigger.',
  `activo` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'FALSE si el registro ya no se usa (se conserva por histórico)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  UNIQUE KEY `placa` (`placa`),
  KEY `idx_vehiculo_dueno` (`id_dueno_volqueta`),
  KEY `idx_vehiculo_placa` (`placa`),
  KEY `idx_vehiculo_estado` (`estado_pago`),
  CONSTRAINT `volqueta_vehiculo_ibfk_1` FOREIGN KEY (`id_dueno_volqueta`) REFERENCES `dueno_volqueta` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Vehículo físico. Enlace directo con material_planta_entrada.';

DROP TABLE IF EXISTS `zona`;
CREATE TABLE `zona` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Identificador único',
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre de la zona geográfica',
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Descripción libre',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación del registro',
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Zonas geográficas de origen';

-- ====================================================================
--  VISTAS (17)
-- ====================================================================

DROP VIEW IF EXISTS `v_analisis_completo`;
CREATE VIEW `v_analisis_completo` AS select `a`.`id` AS `id`,`a`.`id_entrada` AS `id_entrada`,`a`.`id_tipo_analisis` AS `id_tipo_analisis`,`a`.`id_mina` AS `id_mina`,`a`.`id_minero` AS `id_minero`,`a`.`id_tipo_material` AS `id_tipo_material`,`a`.`id_laboratorio` AS `id_laboratorio`,`a`.`numero_analisis` AS `numero_analisis`,`a`.`au_concentrado` AS `au_concentrado`,`a`.`ag_concentrado` AS `ag_concentrado`,`a`.`ton` AS `ton`,`a`.`porcentaje_humedad` AS `porcentaje_humedad`,`a`.`toneladas_humedas` AS `toneladas_humedas`,`a`.`toneladas_secas` AS `toneladas_secas`,`a`.`au_gr_x_ton` AS `au_gr_x_ton`,`a`.`au_falso` AS `au_falso`,`a`.`ag_gr_x_ton` AS `ag_gr_x_ton`,`a`.`valor_analisis` AS `valor_analisis`,`a`.`estado_pago` AS `estado_pago`,`a`.`fecha_salida` AS `fecha_salida`,`a`.`comentarios` AS `comentarios`,`a`.`created_at` AS `created_at`,coalesce(`a`.`id_mina`,`mpe`.`id_mina`) AS `id_mina_resuelto`,coalesce(`a`.`id_minero`,`mi`.`id_minero`) AS `id_minero_resuelto`,coalesce(`a`.`id_tipo_material`,`mpe`.`id_tipo_material`) AS `tipo_mat_resuelto` from ((`analisis` `a` left join `material_planta_entrada` `mpe` on((`mpe`.`id` = `a`.`id_entrada`))) left join `mina` `mi` on((`mi`.`id` = `mpe`.`id_mina`)));

DROP VIEW IF EXISTS `v_estado_agua`;
CREATE VIEW `v_estado_agua` AS select `ap`.`id` AS `id_agua`,`dv`.`nombre` AS `dueno_volqueta`,`ap`.`valor_total` AS `bruto`,coalesce(`cb`.`acpm`,0) AS `acpm`,coalesce(`cpr`.`monto_aplicado`,greatest((`ap`.`valor_total` - coalesce(`cb`.`acpm`,0)),0)) AS `valor_total`,round((coalesce(`cpr`.`monto_aplicado`,0) * (coalesce(`cp`.`valor_pagado`,0) / nullif(`cp`.`valor_total`,0))),2) AS `total_pagado`,round((coalesce(`cpr`.`monto_aplicado`,greatest((`ap`.`valor_total` - coalesce(`cb`.`acpm`,0)),0)) - (coalesce(`cpr`.`monto_aplicado`,0) * (coalesce(`cp`.`valor_pagado`,0) / nullif(`cp`.`valor_total`,0)))),2) AS `saldo_pendiente`,(case when (coalesce(`cp`.`valor_pagado`,0) <= 0) then 'pendiente' when (`cp`.`valor_pagado` >= `cp`.`valor_total`) then 'pagado' else 'parcial' end) AS `estado_pago` from ((((`agua_planta` `ap` left join `dueno_volqueta` `dv` on((`dv`.`id` = `ap`.`id_dueno_volqueta`))) left join (select `combustible`.`id_agua` AS `id_agua`,sum(`combustible`.`valor`) AS `acpm` from `combustible` where (`combustible`.`id_agua` is not null) group by `combustible`.`id_agua`) `cb` on((`cb`.`id_agua` = `ap`.`id`))) left join `cuentas_por_pagar_relacion` `cpr` on((`cpr`.`id_agua` = `ap`.`id`))) left join `cuentas_por_pagar` `cp` on(((`cp`.`id` = `cpr`.`id_cuenta_pagar`) and (`cp`.`estado` <> 'anulado'))));

DROP VIEW IF EXISTS `v_estado_alquileres`;
CREATE VIEW `v_estado_alquileres` AS select `al`.`id` AS `id`,`al`.`valor` AS `valor_total`,coalesce(sum(`ab`.`valor`),0) AS `total_pagado`,greatest((`al`.`valor` - coalesce(sum(`ab`.`valor`),0)),0) AS `saldo_pendiente`,(case when (coalesce(sum(`ab`.`valor`),0) <= 0) then 'pendiente' when (coalesce(sum(`ab`.`valor`),0) >= `al`.`valor`) then 'pagado' else 'parcial' end) AS `estado_pago` from (((`alquileres` `al` left join `cuentas_por_pagar_relacion` `cpr` on((`cpr`.`id_alquiler` = `al`.`id`))) left join `cuentas_por_pagar` `cp` on(((`cp`.`id` = `cpr`.`id_cuenta_pagar`) and (`cp`.`estado` <> 'anulado')))) left join `abonos_cxp` `ab` on((`ab`.`id_cuenta_pagar` = `cp`.`id`))) group by `al`.`id`,`al`.`valor`;

DROP VIEW IF EXISTS `v_estado_combustible`;
CREATE VIEW `v_estado_combustible` AS select `c`.`id` AS `id`,`c`.`forma_pago` AS `forma_pago`,`c`.`valor` AS `valor_total`,(case when (`c`.`forma_pago` = 'efectivo') then `c`.`valor` else coalesce(sum(`ab`.`valor`),0) end) AS `total_pagado`,(case when (`c`.`forma_pago` = 'efectivo') then 0 else greatest((`c`.`valor` - coalesce(sum(`ab`.`valor`),0)),0) end) AS `saldo_pendiente`,(case when (`c`.`forma_pago` = 'efectivo') then 'pagado' when (coalesce(sum(`ab`.`valor`),0) <= 0) then 'pendiente' when (coalesce(sum(`ab`.`valor`),0) >= `c`.`valor`) then 'pagado' else 'parcial' end) AS `estado_pago` from (((`combustible` `c` left join `cuentas_por_pagar_relacion` `cpr` on((`cpr`.`id_combustible` = `c`.`id`))) left join `cuentas_por_pagar` `cp` on(((`cp`.`id` = `cpr`.`id_cuenta_pagar`) and (`cp`.`estado` <> 'anulado')))) left join `abonos_cxp` `ab` on((`ab`.`id_cuenta_pagar` = `cp`.`id`))) group by `c`.`id`,`c`.`forma_pago`,`c`.`valor`;

DROP VIEW IF EXISTS `v_estado_mulas`;
CREATE VIEW `v_estado_mulas` AS select `m`.`id` AS `id`,coalesce(`cp`.`valor_total`,`m`.`valor`) AS `valor_total`,coalesce(`cp`.`valor_pagado`,0) AS `total_pagado`,coalesce(`cp`.`saldo`,`m`.`valor`) AS `saldo_pendiente`,coalesce(`cp`.`estado`,'pendiente') AS `estado_pago` from ((`mulas` `m` left join `cuentas_por_pagar_relacion` `cpr` on((`cpr`.`id_mula` = `m`.`id`))) left join `cuentas_por_pagar` `cp` on(((`cp`.`id` = `cpr`.`id_cuenta_pagar`) and (`cp`.`estado` <> 'anulado'))));

DROP VIEW IF EXISTS `v_estado_pago_flete`;
CREATE VIEW `v_estado_pago_flete` AS select `mpe`.`id` AS `id_entrada`,`vv`.`placa` AS `placa`,`dv`.`nombre` AS `dueno_volqueta`,`mpe`.`costo_volqueta` AS `flete_bruto`,coalesce(`cb`.`acpm`,0) AS `acpm`,coalesce(`cpr`.`monto_aplicado`,greatest((`mpe`.`costo_volqueta` - coalesce(`cb`.`acpm`,0)),0)) AS `valor_total`,round((coalesce(`cpr`.`monto_aplicado`,0) * (coalesce(`cp`.`valor_pagado`,0) / nullif(`cp`.`valor_total`,0))),2) AS `total_pagado`,round((coalesce(`cpr`.`monto_aplicado`,greatest((`mpe`.`costo_volqueta` - coalesce(`cb`.`acpm`,0)),0)) - (coalesce(`cpr`.`monto_aplicado`,0) * (coalesce(`cp`.`valor_pagado`,0) / nullif(`cp`.`valor_total`,0)))),2) AS `saldo_pendiente`,(case when (coalesce(`cp`.`valor_pagado`,0) <= 0) then 'pendiente' when (`cp`.`valor_pagado` >= `cp`.`valor_total`) then 'pagado' else 'parcial' end) AS `estado_pago` from (((((`material_planta_entrada` `mpe` left join `volqueta_vehiculo` `vv` on((`vv`.`id` = `mpe`.`id_vehiculo`))) left join `dueno_volqueta` `dv` on((`dv`.`id` = `vv`.`id_dueno_volqueta`))) left join (select `combustible`.`id_material_planta_entrada` AS `id_entrada`,sum(`combustible`.`valor`) AS `acpm` from `combustible` where (`combustible`.`id_material_planta_entrada` is not null) group by `combustible`.`id_material_planta_entrada`) `cb` on((`cb`.`id_entrada` = `mpe`.`id`))) left join `cuentas_por_pagar_relacion` `cpr` on(((`cpr`.`id_entrada` = `mpe`.`id`) and (`cpr`.`subtipo` = 'flete')))) left join `cuentas_por_pagar` `cp` on(((`cp`.`id` = `cpr`.`id_cuenta_pagar`) and (`cp`.`estado` <> 'anulado')))) where ((`mpe`.`costo_volqueta` > 0) and (`mpe`.`estado` <> 'cancelada'));

DROP VIEW IF EXISTS `v_estado_pago_material`;
CREATE VIEW `v_estado_pago_material` AS select `mpe`.`id` AS `id_entrada`,`mpe`.`numero_volqueta` AS `numero_volqueta`,`mpe`.`fecha_llegada` AS `fecha_llegada`,`mn`.`nombre` AS `minero`,coalesce(`cpr`.`monto_aplicado`,`mpe`.`precio_total`) AS `valor_total`,round((coalesce(`cpr`.`monto_aplicado`,0) * (coalesce(`cp`.`valor_pagado`,0) / nullif(`cp`.`valor_total`,0))),2) AS `total_pagado`,round((coalesce(`cpr`.`monto_aplicado`,`mpe`.`precio_total`) - (coalesce(`cpr`.`monto_aplicado`,0) * (coalesce(`cp`.`valor_pagado`,0) / nullif(`cp`.`valor_total`,0)))),2) AS `saldo_pendiente`,(case when ((`cp`.`id` is null) or (coalesce(`cp`.`valor_pagado`,0) <= 0)) then 'pendiente' when (`cp`.`valor_pagado` >= `cp`.`valor_total`) then 'pagado' else 'parcial' end) AS `estado_pago` from ((((`material_planta_entrada` `mpe` join `mina` `mi` on((`mi`.`id` = `mpe`.`id_mina`))) left join `minero` `mn` on((`mn`.`id` = `mi`.`id_minero`))) left join `cuentas_por_pagar_relacion` `cpr` on(((`cpr`.`id_entrada` = `mpe`.`id`) and (`cpr`.`subtipo` = ('material' collate utf8mb4_unicode_ci))))) left join `cuentas_por_pagar` `cp` on(((`cp`.`id` = `cpr`.`id_cuenta_pagar`) and (`cp`.`estado` <> ('anulado' collate utf8mb4_unicode_ci)))));

DROP VIEW IF EXISTS `v_excedente_empresa`;
CREATE VIEW `v_excedente_empresa` AS select `e`.`id` AS `id`,`e`.`id_entrada` AS `id_entrada`,`mpe`.`fecha_llegada` AS `fecha_llegada`,`mpe`.`numero_volqueta` AS `numero_volqueta`,`mi`.`nombre` AS `mina`,`mn`.`nombre` AS `minero`,`vv`.`placa` AS `vehiculo`,`dv`.`nombre` AS `dueno_volqueta`,`mpe`.`excedente_calculado` AS `excedente_estimado`,`e`.`valor_excedente` AS `excedente_registrado`,`e`.`monto_distribuido` AS `monto_distribuido`,`e`.`saldo_por_distribuir` AS `saldo_por_distribuir`,`e`.`concepto` AS `concepto`,`e`.`estado_distribucion` AS `estado_distribucion`,`e`.`fecha_calculo` AS `fecha_calculo` from (((((`excedente` `e` join `material_planta_entrada` `mpe` on((`mpe`.`id` = `e`.`id_entrada`))) join `mina` `mi` on((`mi`.`id` = `mpe`.`id_mina`))) left join `minero` `mn` on((`mn`.`id` = `mi`.`id_minero`))) left join `volqueta_vehiculo` `vv` on((`vv`.`id` = `mpe`.`id_vehiculo`))) left join `dueno_volqueta` `dv` on((`dv`.`id` = `vv`.`id_dueno_volqueta`)));

DROP VIEW IF EXISTS `v_excedente_por_vehiculo`;
CREATE VIEW `v_excedente_por_vehiculo` AS select `vv`.`id` AS `id_vehiculo`,`vv`.`placa` AS `placa`,`dv`.`nombre` AS `dueno`,count(`e`.`id`) AS `num_excedentes`,sum(`e`.`valor_excedente`) AS `total_excedentes`,sum(`e`.`monto_distribuido`) AS `total_distribuido`,sum(`e`.`saldo_por_distribuir`) AS `pendiente_distribuir`,sum((case when (`e`.`estado_distribucion` = 'pendiente') then 1 else 0 end)) AS `pendientes`,sum((case when (`e`.`estado_distribucion` = 'parcial') then 1 else 0 end)) AS `parciales`,sum((case when (`e`.`estado_distribucion` = 'distribuido') then 1 else 0 end)) AS `distribuidos` from (((`volqueta_vehiculo` `vv` join `dueno_volqueta` `dv` on((`dv`.`id` = `vv`.`id_dueno_volqueta`))) join `material_planta_entrada` `mpe` on((`mpe`.`id_vehiculo` = `vv`.`id`))) join `excedente` `e` on((`e`.`id_entrada` = `mpe`.`id`))) group by `vv`.`id`,`vv`.`placa`,`dv`.`nombre`;

DROP VIEW IF EXISTS `v_inventario_concentrado`;
CREATE VIEW `v_inventario_concentrado` AS select `mc`.`id` AS `id`,`mc`.`codigo` AS `codigo`,`mc`.`estado` AS `estado`,`mc`.`ubicacion_canoa` AS `ubicacion_canoa`,`mc`.`fecha_inicio` AS `fecha_inicio`,`mc`.`fecha_fin` AS `fecha_fin`,`mc`.`porcentaje_humedad` AS `porcentaje_humedad`,`mc`.`toneladas_humedo` AS `toneladas_humedo`,`mc`.`toneladas_seco` AS `toneladas_seco`,`mc`.`toneladas_disponibles` AS `toneladas_disponibles`,`mc`.`material_seco_procesado` AS `material_seco_procesado`,`mc`.`maquila_total` AS `maquila_total`,`mc`.`precio_maquila_por_ton` AS `precio_maquila_por_ton`,(select `a`.`au_gr_x_ton` from `analisis` `a` where ((`a`.`id_material_concentrado` = `mc`.`id`) and (`a`.`id_tipo_analisis` = 2)) order by `a`.`fecha_salida` desc,`a`.`id` desc limit 1) AS `tenor_au`,(select `a`.`ag_gr_x_ton` from `analisis` `a` where ((`a`.`id_material_concentrado` = `mc`.`id`) and (`a`.`id_tipo_analisis` = 2)) order by `a`.`fecha_salida` desc,`a`.`id` desc limit 1) AS `tenor_ag` from `material_concentrado` `mc` where ((`mc`.`toneladas_disponibles` > 0) and (`mc`.`estado` in ('en_canoa','parcialmente_enviado')));

DROP VIEW IF EXISTS `v_inventario_material_crudo`;
CREATE VIEW `v_inventario_material_crudo` AS select `mpe`.`id` AS `id`,`mpe`.`numero_volqueta` AS `numero_volqueta`,`mpe`.`id_mina` AS `id_mina`,`m`.`nombre` AS `mina`,`mpe`.`id_tipo_material` AS `id_tipo_material`,`tm`.`nombre` AS `tipo_material`,`mpe`.`fecha_llegada` AS `fecha_llegada`,`mpe`.`peso_llegada_planta` AS `toneladas_humedo`,`mpe`.`total_material_seco` AS `total_material_seco`,`mpe`.`porcentaje_humedad` AS `porcentaje_humedad`,`mpe`.`tenor` AS `tenor`,`mpe`.`estado` AS `estado`,coalesce((select sum(`pm`.`toneladas_seco_aportadas`) from `procesamiento_material` `pm` where (`pm`.`id_entrada` = `mpe`.`id`)),0) AS `ya_procesado_seco`,(coalesce(`mpe`.`total_material_seco`,0) - coalesce((select sum(`pm`.`toneladas_seco_aportadas`) from `procesamiento_material` `pm` where (`pm`.`id_entrada` = `mpe`.`id`)),0)) AS `disponible_seco` from ((`material_planta_entrada` `mpe` join `mina` `m` on((`m`.`id` = `mpe`.`id_mina`))) left join `tipos_material` `tm` on((`tm`.`id` = `mpe`.`id_tipo_material`))) where ((`mpe`.`estado` in ('pendiente','pagada')) and ((coalesce(`mpe`.`total_material_seco`,0) <= 0) or (coalesce((select sum(`pm`.`toneladas_seco_aportadas`) from `procesamiento_material` `pm` where (`pm`.`id_entrada` = `mpe`.`id`)),0) < `mpe`.`total_material_seco`)));

DROP VIEW IF EXISTS `v_mulas`;
CREATE VIEW `v_mulas` AS select `m`.`id` AS `id`,`m`.`id_proveedor` AS `id_proveedor`,`m`.`id_viaje` AS `id_viaje`,`m`.`fecha` AS `fecha`,`m`.`concepto` AS `concepto`,`m`.`factura_num` AS `factura_num`,`m`.`foto_factura_url` AS `foto_factura_url`,`m`.`valor` AS `valor`,`m`.`comprobante_url` AS `comprobante_url`,`m`.`created_at` AS `created_at`,`ra`.`tarifa_aplicada` AS `pct_retencion`,coalesce(`ra`.`valor_retenido`,0) AS `retencion`,(`m`.`valor` - coalesce(`ra`.`valor_retenido`,0)) AS `abono_neto` from (((`mulas` `m` left join `cuentas_por_pagar_relacion` `cpr` on((`cpr`.`id_mula` = `m`.`id`))) left join `cuentas_por_pagar` `cp` on((`cp`.`id` = `cpr`.`id_cuenta_pagar`))) left join `retenciones_aplicadas` `ra` on(((`ra`.`id_cuenta_pagar` = `cp`.`id`) and (`ra`.`tipo` = 'fuente'))));

DROP VIEW IF EXISTS `v_resumen_liquidacion_material`;
CREATE VIEW `v_resumen_liquidacion_material` AS select `mpe`.`id` AS `id_entrada`,`mpe`.`fecha_llegada` AS `fecha_llegada`,`mpe`.`numero_volqueta` AS `numero_volqueta`,`mpe`.`estado` AS `estado`,`mpe`.`id_vehiculo` AS `id_vehiculo`,`vv`.`placa` AS `placa`,`dv`.`nombre` AS `dueno_volqueta`,`mi`.`nombre` AS `mina`,`mn`.`nombre` AS `minero`,`mpe`.`peso_llegada_planta` AS `peso_llegada_planta`,`mpe`.`porcentaje_humedad` AS `porcentaje_humedad`,`mpe`.`total_material_seco` AS `total_material_seco`,`mpe`.`tenor` AS `tenor`,`mpe`.`total_gramos` AS `total_gramos`,`mpe`.`precio_por_gramo` AS `precio_por_gramo`,`mpe`.`precio_total` AS `precio_total`,`mpe`.`excedente_calculado` AS `excedente_calculado`,`mpe`.`costo_volqueta` AS `costo_volqueta`,`mpe`.`total_costos_operativos` AS `total_costos_operativos`,`mpe`.`total_material` AS `total_material` from ((((`material_planta_entrada` `mpe` left join `volqueta_vehiculo` `vv` on((`vv`.`id` = `mpe`.`id_vehiculo`))) left join `dueno_volqueta` `dv` on((`dv`.`id` = `vv`.`id_dueno_volqueta`))) left join `mina` `mi` on((`mi`.`id` = `mpe`.`id_mina`))) left join `minero` `mn` on((`mn`.`id` = `mi`.`id_minero`)));

DROP VIEW IF EXISTS `v_resumen_lote`;
CREATE VIEW `v_resumen_lote` AS select `mc`.`id` AS `id`,`mc`.`codigo` AS `codigo`,`mc`.`estado` AS `estado`,`mc`.`fecha_inicio` AS `fecha_inicio`,`mc`.`fecha_fin` AS `fecha_fin`,`mc`.`ubicacion_canoa` AS `ubicacion_canoa`,`mc`.`porcentaje_humedad` AS `porcentaje_humedad`,`mc`.`toneladas_humedo` AS `toneladas_humedo`,`mc`.`toneladas_seco` AS `toneladas_seco`,`mc`.`toneladas_disponibles` AS `toneladas_disponibles`,`mc`.`material_seco_procesado` AS `material_seco_procesado`,0.0000 AS `merma_seco`,`mc`.`maquila_total` AS `maquila_total`,`mc`.`precio_maquila_por_ton` AS `precio_maquila_por_ton`,`mc`.`hizo_molienda` AS `hizo_molienda`,`mc`.`hizo_flotacion` AS `hizo_flotacion`,`mc`.`hizo_relave` AS `hizo_relave`,`mc`.`hizo_filtroprensa` AS `hizo_filtroprensa`,(select count(0) from `procesamiento_material` `pm` where (`pm`.`id_material_concentrado` = `mc`.`id`)) AS `num_materiales`,(select coalesce(sum(`pm`.`toneladas_seco_aportadas`),0) from `procesamiento_material` `pm` where (`pm`.`id_material_concentrado` = `mc`.`id`)) AS `total_seco_procesado`,(select coalesce(sum(`vm`.`total_concentrado_humedo`),0) from `viaje_material` `vm` where (`vm`.`id_material_concentrado` = `mc`.`id`)) AS `total_despachado_humedo`,(select `a`.`au_gr_x_ton` from `analisis` `a` where ((`a`.`id_material_concentrado` = `mc`.`id`) and (`a`.`id_tipo_analisis` = 2)) order by `a`.`fecha_salida` desc,`a`.`id` desc limit 1) AS `tenor_au`,(select `a`.`ag_gr_x_ton` from `analisis` `a` where ((`a`.`id_material_concentrado` = `mc`.`id`) and (`a`.`id_tipo_analisis` = 2)) order by `a`.`fecha_salida` desc,`a`.`id` desc limit 1) AS `tenor_ag` from `material_concentrado` `mc`;

DROP VIEW IF EXISTS `v_saldo_cuentas`;
CREATE VIEW `v_saldo_cuentas` AS select `cb`.`id` AS `id_cuenta_bancaria`,`cb`.`nombre` AS `nombre`,`cb`.`banco` AS `banco`,`cb`.`propietario` AS `propietario`,`cb`.`exento_4x1000` AS `exento_4x1000`,`cb`.`activa` AS `activa`,coalesce((select sum(`it`.`valor`) from `ingresos_tesoreria` `it` where (`it`.`id_cuenta_bancaria` = `cb`.`id`)),0) AS `total_ingresos`,coalesce((select sum(`ab`.`valor`) from `abonos_cxp` `ab` where (`ab`.`id_cuenta_bancaria` = `cb`.`id`)),0) AS `total_egresos`,coalesce((select sum(`ia`.`valor_impuesto`) from `impuestos_aplicados` `ia` where (`ia`.`id_cuenta_bancaria` = `cb`.`id`)),0) AS `total_impuestos`,((coalesce((select sum(`it`.`valor`) from `ingresos_tesoreria` `it` where (`it`.`id_cuenta_bancaria` = `cb`.`id`)),0) - coalesce((select sum(`ab`.`valor`) from `abonos_cxp` `ab` where (`ab`.`id_cuenta_bancaria` = `cb`.`id`)),0)) - coalesce((select sum(`ia`.`valor_impuesto`) from `impuestos_aplicados` `ia` where (`ia`.`id_cuenta_bancaria` = `cb`.`id`)),0)) AS `saldo` from `cuentas_bancarias` `cb`;

DROP VIEW IF EXISTS `v_saldo_prestamos_empleado`;
CREATE VIEW `v_saldo_prestamos_empleado` AS select `pe`.`id` AS `id`,`pe`.`id_empleado` AS `id_empleado`,`pe`.`valor` AS `monto_prestamo`,coalesce(sum(`ab`.`valor`),0) AS `total_abonado`,greatest((`pe`.`valor` - coalesce(sum(`ab`.`valor`),0)),0) AS `saldo_pendiente`,(case when (coalesce(sum(`ab`.`valor`),0) <= 0) then 'pendiente' when (coalesce(sum(`ab`.`valor`),0) >= `pe`.`valor`) then 'pagado' else 'parcial' end) AS `estado` from (((`prestamos_empleados` `pe` left join `cuentas_por_pagar_relacion` `cpr` on((`cpr`.`id_prestamo_emp` = `pe`.`id`))) left join `cuentas_por_pagar` `cp` on(((`cp`.`id` = `cpr`.`id_cuenta_pagar`) and (`cp`.`estado` <> 'anulado')))) left join `abonos_cxp` `ab` on((`ab`.`id_cuenta_pagar` = `cp`.`id`))) group by `pe`.`id`,`pe`.`id_empleado`,`pe`.`valor`;

DROP VIEW IF EXISTS `v_saldos_a_favor_disponibles`;
CREATE VIEW `v_saldos_a_favor_disponibles` AS select `saf`.`id` AS `id`,`saf`.`tipo_resolucion` AS `tipo_resolucion`,`saf`.`estado` AS `estado`,`saf`.`monto_original` AS `monto_original`,`saf`.`monto_aplicado` AS `monto_aplicado`,`saf`.`saldo_disponible` AS `saldo_disponible`,`saf`.`fecha` AS `fecha`,`saf`.`descripcion` AS `descripcion`,coalesce(`mn`.`nombre`,`dv`.`nombre`,`pr`.`nombre`,`em`.`nombre`) AS `beneficiario`,(case when (`saf`.`id_minero` is not null) then 'minero' when (`saf`.`id_dueno_volqueta` is not null) then 'volquetero' when (`saf`.`id_proveedor` is not null) then 'proveedor' when (`saf`.`id_empleado` is not null) then 'empleado' end) AS `tipo_beneficiario` from ((((`saldo_a_favor` `saf` left join `minero` `mn` on((`mn`.`id` = `saf`.`id_minero`))) left join `dueno_volqueta` `dv` on((`dv`.`id` = `saf`.`id_dueno_volqueta`))) left join `proveedores` `pr` on((`pr`.`id` = `saf`.`id_proveedor`))) left join `empleados` `em` on((`em`.`id` = `saf`.`id_empleado`))) where (`saf`.`estado` in ('disponible','parcial'));

SET FOREIGN_KEY_CHECKS = 1;

-- ====================================================================
--  SEMILLA MINIMA DE CATALOGOS / TIPADOS
--  (plantas, zonas, categorias, tipos_*, roles, permisos, retencion.
--   Nada de datos transaccionales: empleados, minero, proveedores,
--   viajes, entradas, cuentas_por_*, etc. se crean vacios.)
-- ====================================================================

-- planta
INSERT INTO `planta` VALUES (1,'PLANTA GRANDE','MOLINOS DE COLOMBIA - PLANTA PRINCIPAL'),(2,'PLANTA CASA','MOLINOS DE COLOMBIA - PLANTA PEQUEÑA'),(3,'PLANTA BARRANQUILLA','BARRANQUILLA - PROCESAMIENTO EXTERNO'),(4,'OFICINA BUCARAMANGA','BUCARAMANGA - SEDE ADMINISTRATIVA');
-- planta_procesos
INSERT INTO `planta_procesos` VALUES (1,1,'FILTRO PRENSA','Operación de la maquinaria de filtro prensa',1),(2,1,'MOLIENDA','Área principal de molienda y trituración',1),(3,1,'FLOTACIÓN','Piscinas o tanques del proceso de flotación',1),(4,1,'ANÁLISIS','Laboratorio o zona de análisis de calidad del material',1),(5,1,'PLANTA ELÉCTRICA','Operación de generadores y control de energía',1),(6,4,'ADMINISTRACIÓN','Área de gerencia y labores administrativas generales',1),(7,4,'FINANZAS','Pagos, egresos y control de nómina',1);
-- zona
INSERT INTO `zona` VALUES (1,'General','Mina General','2026-06-29 22:05:56'),(2,'Mina 30','Zona de extracción Mina 30','2026-06-29 22:05:56'),(3,'Mina 80','Zona de extracción Mina 80','2026-06-29 22:05:56'),(4,'Santa Rosa','Zona de extracción Santa Rosa','2026-06-29 22:05:56'),(5,'Culo Alzado','Zona de extracción Culo Alzado','2026-06-29 22:05:56'),(6,'Mina cachete','Zona de extracción Mina cachete','2026-06-29 22:05:56'),(10,'Zona Nueva','Nueva Zona Prueba','2026-08-08 19:38:49');
-- categorias_cxp
INSERT INTO `categorias_cxp` VALUES (1,'Material','Pago al minero por el material entregado','#1D9E75',NULL,NULL),(2,'Flete volqueta','Pago al dueño de volqueta por el acarreo','#0F6E56',NULL,NULL),(3,'Deuda proveedor','Abono a deuda histórica de un tercero','#E24B4A',NULL,NULL),(4,'Maquila','Pago a planta externa por procesamiento','#378ADD',NULL,NULL),(5,'Cargue','Pago por servicio de cargue','#7F77DD',NULL,NULL),(6,'Báscula','Pago por pesaje en báscula','#7F77DD',NULL,NULL),(7,'Combustible','Pago a la gasolinera (ACPM/gasolina)','#D85A30',NULL,NULL),(8,'Agua','Pago de agua a la planta','#85B7EB',NULL,NULL),(9,'Mula','Pago a la transportadora de salida (Barranquilla)','#534AB7',1,NULL),(10,'Análisis','Pago al laboratorio por análisis','#97C459',NULL,NULL),(11,'Alquiler','Pago por alquiler de maquinaria/vehículos','#888780',2,3),(12,'Nómina','Pago de salarios y jornales','#639922',NULL,NULL),(13,'Préstamo empleado','Desembolso de un préstamo a empleado','#D4537E',NULL,NULL),(14,'Préstamo financiero','Abono de obligación financiera (banco)','#A32D2D',NULL,NULL),(15,'Gasto de viaje','Gastos de viaje distintos de la maquila','#5C6BC0',NULL,NULL),(16,'Anticipo','Desembolso de anticipo a tercero','#EF9F27',NULL,NULL),(17,'Compra proveedor','Compra o servicio directo a un proveedor','#6D8B3C',NULL,NULL),(18,'Distribución excedente','Distribución de excedente de la empresa','#BA7517',NULL,NULL),(19,'Devolución sobrepago','Reintegro al tercero por pago en exceso','#E24B4A',NULL,NULL),(20,'Otro','Gasto no clasificado','#888780',NULL,NULL),(21,'Bono empleado','Bono ocasional a un empleado, sin periodicidad fija','#F2B84B',NULL,NULL),(22,'Gasto Directo','Gasto operativo pagado de inmediato (parqueadero, peajes, etc.), reportado con su comprobante en el momento','#4F6D7A',NULL,NULL),(23,'Inversión Planta',NULL,NULL,NULL,NULL);
-- categorias_cxc
INSERT INTO `categorias_cxc` VALUES (1,'Préstamo empleado','Dinero prestado al personal a descontar de nómina','#D4537E'),(2,'Combustible cargado','Combustible adelantado a dueño de volqueta','#D85A30'),(3,'Anticipo recuperable','Anticipo entregado a tercero que debe recuperarse','#EF9F27'),(4,'Excedente empresa','Excedente generado por una entrada (ingreso)','#1D9E75'),(5,'Otro cobro','Cobro no categorizado','#888780');
-- categorias_proveedor
INSERT INTO `categorias_proveedor` VALUES (1,'Dotación','Ropa, calzado y EPP'),(2,'Laboratorio','Servicios de análisis de minerales'),(3,'Combustible','Estaciones de servicio / gasolineras'),(4,'Maquinaria','Alquiler o mantenimiento de equipos pesados'),(5,'Procesamiento','Plantas externas de maquila'),(6,'Transporte_Mula','Empresa transportadora de salida a Barranquilla'),(7,'Quimicos','Insumos químicos y reactivos'),(8,'Otro','Proveedor no clasificado');
-- categorias_ingreso
INSERT INTO `categorias_ingreso` VALUES (1,'Préstamo recibido','Desembolso de un préstamo financiero (banco o fondo de inversión) — ver Prestamos_Financieros'),(2,'Cobro a tercero','Recuperación de una Cuenta_Por_Cobrar u otro cobro a un tercero'),(3,'Aporte de socio','Dinero aportado por un socio de la empresa'),(4,'Venta','Ingreso por venta de material o servicio'),(5,'Otro','Ingreso no clasificado en las categorías anteriores');
-- tipos_material
INSERT INTO `tipos_material` VALUES (1,'Concentrado','Material procesado con alto contenido de mineral'),(2,'Roca','Material bruto extraído directamente de la mina'),(3,'Lamas','Material fino y húmedo producto del lavado'),(4,'Relave','Desecho sólido del proceso de beneficio'),(5,'Lodos','Material con alta concentración de agua'),(6,'Otro','Material que no encaja en las categorías existentes');
-- tipos_turno
INSERT INTO `tipos_turno` VALUES (1,'TURNO 1','06:00:00','14:00:00',0.00),(2,'TURNO 2','14:00:00','22:00:00',25.00),(3,'TURNO 3','22:00:00','06:00:00',0.00);
-- tipos_alquiler
INSERT INTO `tipos_alquiler` VALUES (1,'Vehículos y Transporte'),(2,'Maquinaria Pesada'),(3,'Herramientas y Equipos'),(5,'Oficinas y bodegas');
-- tipos_analisis
INSERT INTO `tipos_analisis` VALUES (1,'Cabeza','Análisis de entrada. Define tenor y humedad oficiales'),(2,'Concentrado','Análisis del concentrado obtenido'),(3,'Colas','Análisis de las colas o relaves'),(4,'Concentrado_Colas','Concentrado obtenido al reprocesar colas'),(5,'Colas_Colas','Colas resultantes de reprocesar colas');
-- tipos_gasto_operativo
INSERT INTO `tipos_gasto_operativo` VALUES (1,'cargue','Pago por carga de material en la mina'),(2,'bascula','Pago por servicio de pesaje en báscula'),(3,'viatico','Gastos de viáticos y alimentación'),(4,'acpm','Compra de ACPM para vehículos o maquinaria'),(5,'adelanto_volqueta','Adelanto al transportador antes del pago formal'),(6,'muestreo','Toma de muestra para análisis de laboratorio'),(7,'acompanamiento','Pago por acompañamiento o custodia del material'),(8,'buscar_agua','Servicio de abastecimiento de agua'),(9,'insumos_quimicos','Cianuro, zinc, reactivos y similares'),(10,'mantenimiento','Repuestos y arreglos de equipos'),(11,'otro','Gasto operativo no clasificado');
-- roles
INSERT INTO `roles` VALUES (1,'David_admin','Acceso total a reportes, utilidad y finanzas'),(2,'Juliana_Tesoreria','Módulo Juliana: Pagos, depósitos, nómina'),(3,'Vicky_material','Módulo Victoria: Entradas de material, inventario, laboratorio'),(4,'Valeria_volqueta','Módulo Valeria: Volquetas entrada o salida de la planta'),(5,'Ginna_planta','Módulo Ginna: Enlace y trazabilidad material en planta que se procesa que se analisa'),(6,'Angela_exportaciones','Módulo Angela: Importacion del material'),(7,'Cindy_planta','Módulo Cindy: Contaduria hacia la dian');
-- conceptos_retencion
INSERT INTO `conceptos_retencion` VALUES (1,'Transporte de carga',1.00,1.00,0.00,1),(2,'Arrendamiento muebles',4.00,4.00,0.00,1),(3,'ReteIVA general',15.00,15.00,0.00,1);
-- uvt_vigente
INSERT INTO `uvt_vigente` VALUES (2026,52374.00);
