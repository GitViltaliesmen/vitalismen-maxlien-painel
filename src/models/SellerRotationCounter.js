import mongoose from 'mongoose';

const sellerRotationCounterSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    value: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

const SellerRotationCounter = mongoose.model('SellerRotationCounter', sellerRotationCounterSchema);

export default SellerRotationCounter;
