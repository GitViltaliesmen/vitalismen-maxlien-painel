import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
    CustomerContextInputError,
    readCustomerCurrentContext
} from '../services/customerCurrentContextService.js';

const router = express.Router();

export const createCustomerCurrentContextHandler = ({
    readContext = readCustomerCurrentContext
} = {}) => async (req, res) => {
    try {
        const context = await readContext(req.params?.phone || '');
        res.set('Cache-Control', 'no-store');
        return res.json(context);
    } catch (error) {
        if (error instanceof CustomerContextInputError || error?.statusCode === 400) {
            res.set('Cache-Control', 'no-store');
            return res.status(400).json({
                error: error.code || 'INVALID_EC_PHONE',
                message: error.message,
                readOnly: true,
                applicationAllowed: false
            });
        }
        console.error('[CUSTOMER-CURRENT-CONTEXT-V16] Falha na consulta somente leitura:', error?.name || 'Error');
        res.set('Cache-Control', 'no-store');
        return res.status(500).json({
            error: 'CUSTOMER_CONTEXT_UNAVAILABLE',
            message: 'Nao foi possivel carregar o contexto atual do cliente.',
            readOnly: true,
            applicationAllowed: false
        });
    }
};

router.get('/:phone', authMiddleware, createCustomerCurrentContextHandler());

export default router;
