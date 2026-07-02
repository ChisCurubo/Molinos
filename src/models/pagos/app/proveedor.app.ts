// Objeto APP para la entidad de dominio de negocio

import { CategoriaProveedorApp } from './categoria_proveedor.app';

export interface ProveedorApp {
    id: number;
    nombre: string;
    categoria?: CategoriaProveedorApp;
    contacto: string;
    telefono: string;
    ciudad: string;
    alias: string;
    nequi: boolean;
    compra_realizada: string;
    estado: string;
    created_at: Date;
    updated_at: Date;
}
