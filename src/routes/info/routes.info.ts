import { Router } from 'express';
import apiRoutes from './api.routes';

const router = Router();
router.use('/', apiRoutes);

export default router;
