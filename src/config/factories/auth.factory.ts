import { Pool } from 'mysql2/promise';
import { RolRepository } from '../../repositories/auth/rol.repository';
import { UsuarioRepository } from '../../repositories/auth/usuario.repository';
import { UsuarioService } from '../../services/auth/usuario.service';
import { AuthController } from '../../controllers/auth/auth.controller';
import { UsuarioController } from '../../controllers/auth/usuario.controller';

export class AuthFactory {
    constructor(private db: Pool) {}

    // ==========================================
    private rolRepository?: RolRepository;
    private usuarioRepository?: UsuarioRepository;
    private usuarioService?: UsuarioService;
    private authController?: AuthController;
    private usuarioController?: UsuarioController;

    public getRolRepository(): RolRepository {
        if (!this.rolRepository) {
            this.rolRepository = new RolRepository(this.db);
        }
        return this.rolRepository;
    }

    public getUsuarioRepository(): UsuarioRepository {
        if (!this.usuarioRepository) {
            this.usuarioRepository = new UsuarioRepository(this.db);
        }
        return this.usuarioRepository;
    }

    public getUsuarioService(): UsuarioService {
        if (!this.usuarioService) {
            this.usuarioService = new UsuarioService(this.getUsuarioRepository(), this.getRolRepository());
        }
        return this.usuarioService;
    }

    public getAuthController(): AuthController {
        if (!this.authController) {
            this.authController = new AuthController(this.getUsuarioService());
        }
        return this.authController;
    }

    public getUsuarioController(): UsuarioController {
        if (!this.usuarioController) {
            this.usuarioController = new UsuarioController(this.getUsuarioService());
        }
        return this.usuarioController;
    }

    // ==========================================
}
