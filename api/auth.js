const mongoose = require('mongoose');

// MongoDB සම්බන්ධතාවය
const MONGO_URI = "mongodb+srv://zanta-mini:Akashkavindu12345@zanta-mini.x1s0cjc.mongodb.net/?appName=zanta-mini";

const connectToDatabase = async () => {
    if (mongoose.connection.readyState >= 1) return;
    return mongoose.connect(MONGO_URI);
};

// Settings Schema එක
const SettingsSchema = new mongoose.Schema({
    id: String,
    password: { type: String, default: 'not_set' },
    botName: String,
    ownerName: String,
    prefix: String,
    autoRead: String,
    autoTyping: String,
    autoStatusSeen: String,
    autoStatusReact: String,
    alwaysOnline: String,
    readCmd: String,
    autoVoice: String,
    autoReply: { type: String, default: 'false' },
    autoReplies: { type: Array, default: [] } 
}, { collection: 'settings', strict: false });

const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

// Vercel Serverless Function Handler
export default async function handler(req, res) {
    // CORS Headers (වෙබ් Dashboard එකේ සිට වැඩ කිරීමට)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: "Method not allowed" });

    try {
        await connectToDatabase();
        const { id, password, action, settings, botUrl } = req.body; 

        // පරිශීලකයා පරීක්ෂා කිරීම
        const user = await Settings.findOne({ id: id });
        if (!user) return res.status(404).json({ success: false, error: "User not found!" });
        if (user.password !== password) return res.status(401).json({ success: false, error: "Invalid Password." });

        // Login Action
        if (action === "login") {
            return res.status(200).json({ success: true, settings: user });
        }

        // Update Settings Action
        if (action === "updateSettings") {
            // 1. Database එක Update කිරීම
            await Settings.updateOne({ id: id }, { $set: settings });

            // 2. බොට්ගේ RAM එක Refresh කිරීමට Signal එක යැවීම (Axios වෙනුවට Native Fetch භාවිතා කර ඇත)
            if (botUrl) {
                const signalUrl = `${botUrl.replace(/\/$/, "")}/update-cache?id=${id}`;
                try {
                    // Node 18+ වල fetch සෘජුවම වැඩ කරයි. Axios අවශ්‍ය නැත.
                    await fetch(signalUrl).catch(e => console.log("Bot unreachable"));
                } catch (err) {
                    console.error("Signal Sync Failed");
                }
            }

            return res.status(200).json({ success: true, message: "Settings Updated & Cache Synced!" });
        }

    } catch (e) {
        console.error("API Error:", e.message);
        return res.status(500).json({ success: false, error: e.message });
    }
}
