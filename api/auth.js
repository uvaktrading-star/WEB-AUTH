const mongoose = require('mongoose');

// MongoDB සම්බන්ධතාවය
const MONGO_URI = "mongodb+srv://zanta-mini:Akashkavindu12345@zanta-mini.x1s0cjc.mongodb.net/?appName=zanta-mini";

const connectToDatabase = async () => {
    if (mongoose.connection.readyState >= 1) return;
    return mongoose.connect(MONGO_URI);
};

// Settings Schema එක (ඔයාගේ Schema එකේ තිබුණු හැම settings එකක්ම මෙහි ඇත)
const SettingsSchema = new mongoose.Schema({
    id: String,
    password: { type: String, default: 'not_set' },
    botName: String,
    ownerName: String,
    prefix: String,
    workType: String,
    botImage: { type: String, default: "null" },
    alwaysOnline: String,
    autoRead: String,
    autoTyping: String,
    autoStatusSeen: String,
    autoStatusReact: String,
    readCmd: String,
    autoVoice: String,
    autoReply: { type: String, default: 'false' },
    connectionMsg: String,
    buttons: String,
    autoVoiceReply: String,
    antidelete: String,
    autoReact: String,
    badWords: String,
    antiLink: String,
    antiCmd: String,
    paymentStatus: String,
    autoReplies: { type: Array, default: [] },
    googleEmail: { type: String, default: null },
    googleRefreshToken: { type: String, default: null },
    autoSaveStatus: { type: String, default: 'false' }
}, { collection: 'settings', strict: false });

const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

// Vercel Serverless Function Handler
export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: "Method not allowed" });

    try {
        await connectToDatabase();
        const { id, password, action, settings, botUrl, googleData } = req.body; 

        // පරිශීලකයා පරීක්ෂා කිරීම
        const user = await Settings.findOne({ id: id });
        if (!user) return res.status(404).json({ success: false, error: "User not found!" });
        
        // Password එක පරීක්ෂා කිරීම
        if (user.password !== password) {
            return res.status(401).json({ success: false, error: "Invalid Password." });
        }

        // --- 1. LOGIN ACTION ---
        if (action === "login") {
            return res.status(200).json({ success: true, settings: user });
        }

        // --- 2. UPDATE SETTINGS ACTION ---
        if (action === "updateSettings") {
            // Database එක Update කිරීම
            await Settings.updateOne({ id: id }, { $set: settings });

            // බොට්ගේ RAM එක Refresh කිරීමට Signal එක යැවීම
            if (botUrl) {
                const signalUrl = `${botUrl.replace(/\/$/, "")}/update-cache?id=${id}`;
                try {
                    // Node 18+ වල fetch සෘජුවම වැඩ කරයි.
                    await fetch(signalUrl).catch(e => console.log("Bot cache update request failed."));
                } catch (err) {
                    console.error("Signal Sync Failed");
                }
            }

            return res.status(200).json({ success: true, message: "Settings Updated & Cache Synced!" });
        }

        if (action === "saveGoogleAuth") {
            if (!googleData || !googleData.email) {
                return res.status(400).json({ success: false, error: "Missing Google Data" });
            }

            await Settings.updateOne({ id: id }, { 
                $set: { 
                    googleEmail: googleData.email,
                    googleRefreshToken: googleData.refreshToken,
                    autoSaveStatus: 'true'
                } 
            });
            return res.status(200).json({ success: true, message: "Google Account Linked!" });
        }

    } catch (e) {
        console.error("API Error:", e.message);
        return res.status(500).json({ success: false, error: e.message });
    }
}
