import express from 'express';

const router = express.Router();

// POST /api/webhook/order-created - Notify external systems (e.g., WhatsApp bot)
router.post('/order-created', async (req, res) => {
    try {
        const { orderId, customer, country, total, currency } = req.body;

        console.log('📱 Webhook: New order notification');
        console.log(`   Order: ${orderId}`);
        console.log(`   Customer: ${customer?.name} - ${customer?.phone}`);
        console.log(`   Country: ${country}`);
        console.log(`   Total: ${total} ${currency}`);

        // TODO: Integrate with WhatsApp bot
        // This endpoint can be called by the checkout to trigger WPP notifications
        // Or external services can listen to this webhook

        // For now, just log and return success
        // In production, this would send a message to the WPP bot queue

        res.json({
            success: true,
            message: 'Webhook received',
            // Add your WPP bot integration here
            // wppStatus: 'queued'
        });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// POST /api/webhook/status-update - Update order status from external system
router.post('/status-update', async (req, res) => {
    try {
        const { orderId, status, trackingNumber } = req.body;

        console.log(`📦 Webhook: Status update for ${orderId} -> ${status}`);

        // This webhook can be called by external systems (e.g., Dropi, Servientrega)
        // to update order status automatically

        res.json({
            success: true,
            message: 'Status update received'
        });
    } catch (error) {
        console.error('Status webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

export default router;
