import express from 'express';
import Product from '../models/Product.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Default products to seed if none exist
const DEFAULT_PRODUCTS = [
    { country: 'EC', productId: 1, label: '1 Frasco', price: 39, currency: 'USD', displayPrice: '$39 USD', sortOrder: 1 },
    { country: 'EC', productId: 3, label: '3 Frascos', price: 95.99, currency: 'USD', displayPrice: '$95.99 USD', isPopular: true, sortOrder: 2 },
    { country: 'EC', productId: 6, label: '6 Frascos', price: 167.99, currency: 'USD', displayPrice: '$167.99 USD', sortOrder: 3 },
];

// GET /api/products - Get products by country (public)
router.get('/', async (req, res) => {
    try {
        const { country } = req.query;

        // Seed products if none exist
        const count = await Product.countDocuments();
        if (count === 0) {
            await Product.insertMany(DEFAULT_PRODUCTS);
            console.log('✅ Default products seeded');
        } else {
            // Safe migration: update only if the DB still has the old Ecuador prices
            const migrations = [
                { country: 'EC', productId: 1, oldPrice: 50, newPrice: 39, displayPrice: '$39 USD', sortOrder: 1, label: '1 Frasco', isPopular: false },
                { country: 'EC', productId: 1, oldPrice: 40, newPrice: 39, displayPrice: '$39 USD', sortOrder: 1, label: '1 Frasco', isPopular: false },
                { country: 'EC', productId: 3, oldPrice: 80, newPrice: 95.99, displayPrice: '$95.99 USD', sortOrder: 2, label: '3 Frascos', isPopular: true },
                { country: 'EC', productId: 3, oldPrice: 96, newPrice: 95.99, displayPrice: '$95.99 USD', sortOrder: 2, label: '3 Frascos', isPopular: true },
                { country: 'EC', productId: 6, oldPrice: 130, newPrice: 167.99, displayPrice: '$167.99 USD', sortOrder: 3, label: '6 Frascos', isPopular: false },
                { country: 'EC', productId: 6, oldPrice: 168, newPrice: 167.99, displayPrice: '$167.99 USD', sortOrder: 3, label: '6 Frascos', isPopular: false },
            ];
            for (const m of migrations) {
                await Product.updateOne(
                    { country: m.country, productId: m.productId, price: m.oldPrice },
                    {
                        $set: {
                            price: m.newPrice,
                            currency: 'USD',
                            displayPrice: m.displayPrice,
                            label: m.label,
                            sortOrder: m.sortOrder,
                            isPopular: m.isPopular
                        }
                    }
                );
            }
        }

        const query = { isActive: true };
        if (country) query.country = country;

        const products = await Product.find(query).sort({ country: 1, sortOrder: 1 });

        // Group by country if no specific country requested
        if (!country) {
            const grouped = {
                EC: products.filter(p => p.country === 'EC')
            };
            return res.json({ products: grouped });
        }

        res.json({ products });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/products - Create product (admin only)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { country, productId, label, price, currency, displayPrice, isPopular, sortOrder } = req.body;

        const product = new Product({
            country,
            productId,
            label,
            price,
            currency,
            displayPrice,
            isPopular: isPopular || false,
            sortOrder: sortOrder || 0
        });

        await product.save();

        res.status(201).json({ success: true, product });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// PATCH /api/products/:id - Update product (admin only)
router.patch('/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ success: true, product });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

export default router;
