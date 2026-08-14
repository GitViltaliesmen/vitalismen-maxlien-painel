import express from "express";
import { routeAndRespond } from "../services/aiRouter.js";

const router = express.Router();

router.post("/ai-reply", async (req, res) => {
    try {
        const { phoneE164, country, text } = req.body || {};
        if (!phoneE164 || !country || !text) {
            return res.status(400).json({ error: "phoneE164, country, text são obrigatórios" });
        }
        const out = await routeAndRespond({ phoneE164, country, userText: text });
        return res.json({ ok: true, reply: out.text });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ ok: false, error: "ai-reply failed" });
    }
});

export default router;
