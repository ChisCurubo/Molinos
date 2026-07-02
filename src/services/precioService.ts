import { PrecioRepository } from '../repositories/material/precio.repository';
import { PrecioMaterialLookup } from '../models/material/sql/precio_material.sql';

export class PrecioService {
  private precioRepo = new PrecioRepository();

  // 2.1 Buscar precio aplicable
  async buscarPrecio(
    idMinero: number | null,
    idZona: number | null,
    metodo: string,
    tenorFalso: number,
    fechaEntrada: string | Date,
    conn?: any
  ): Promise<PrecioMaterialLookup | null> {
    
    // Convertir Date a string 'YYYY-MM-DD' si es necesario para la query
    let fechaStr = typeof fechaEntrada === 'string' ? fechaEntrada : fechaEntrada.toISOString().split('T')[0];

    return await this.precioRepo.buscarPrecio(
      idMinero,
      idZona,
      metodo,
      tenorFalso,
      fechaStr,
      conn
    );
  }

  // 2.2 Buscar tarifa de zona con fallback a 2.3
  async buscarTarifaZona(idZona: number | null, conn?: any): Promise<number> {
    if (idZona) {
      // 2.2 Verificar tarifa de zona
      const tarifaZona = await this.precioRepo.buscarTarifaZona(idZona, conn);
      if (tarifaZona !== null && tarifaZona !== undefined) {
        return Number(tarifaZona);
      }
    }

    // 2.3 Fallback: tarifa global
    const tarifaGlobal = await this.precioRepo.buscarTarifaGlobal(conn);
    if (tarifaGlobal !== null && tarifaGlobal !== undefined) {
      return Number(tarifaGlobal);
    }

    // Si ni siquiera hay fallback, retornar '0' o lanzar error. 
    // Asumimos un default en caso extremo.
    return 0;
  }
}
