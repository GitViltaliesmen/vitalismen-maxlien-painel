import express from 'express';
import { createVitPowerWebChatHandlerV220 } from '../services/vitPowerWebChatV220Application.js';
const router = express.Router();
router.post('/', createVitPowerWebChatHandlerV220());
export default router;
