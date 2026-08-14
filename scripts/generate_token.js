import 'dotenv/config';
import jwt from 'jsonwebtoken';

const token = jwt.sign(
    { id: 'admin', role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
);
console.log(token);
