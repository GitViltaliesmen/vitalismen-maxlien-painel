import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    country: {
        type: String,
        enum: ['EC'],
        required: true
    },
    productId: {
        type: Number,
        required: true
    },
    label: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        enum: ['USD'],
        required: true
    },
    displayPrice: {
        type: String,
        required: true
    },
    isPopular: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    sortOrder: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Compound index for country + productId
productSchema.index({ country: 1, productId: 1 }, { unique: true });

const Product = mongoose.model('Product', productSchema);

export default Product;
