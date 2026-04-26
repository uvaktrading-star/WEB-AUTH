const mongoose = require('mongoose');

// MongoDB සම්බන්ධතාවය
const MONGO_URI = "mongodb+srv://zanta-mini:Akashkavindu12345@zanta-mini.x1s0cjc.mongodb.net/?appName=zanta-mini";

const connectToDatabase = async () => {
    if (mongoose.connection.readyState >= 1) return;
    return mongoose.connect(MONGO_URI);
};

// Settings Schema
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
    antiEdit: String,
    autoReact: String,
    badWords: String,
    antiLink: String,
    antiCmd: String,
    antiCall: String,
    paymentStatus: String,
    autoReplies: { type: Array, default: [] },
    googleEmail: { type: String, default: null },
    googleRefreshToken: { type: String, default: null },
    autoSaveStatus: { type: String, default: 'false' },
    footerText: { type: String, default: '> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴢᴀɴᴛᴀ ᴍɪɴɪ </>' },
    savedContacts: { type: Array, default: [] }
}, { collection: 'settings', strict: false });

const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

// Vercel Serverless Function Handler
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: "Method not allowed" });

    try {
        await connectToDatabase();
        const { id, password, action, settings, botUrl, newNumber } = req.body; 

        const user = await Settings.findOne({ id: id });
        if (!user) return res.status(404).json({ success: false, error: "User not found!" });
        
        if (user.password !== password) {
            return res.status(401).json({ success: false, error: "Invalid Password." });
        }

        // --- 1. LOGIN ACTION ---
        if (action === "login") {
            return res.status(200).json({ success: true, settings: user });
        }

        // --- 2. UPDATE SETTINGS ACTION ---
        if (action === "updateSettings") {
            // Auto Save False කළහොත් ලැයිස්තුව Clear කිරීම
            if (settings && settings.autoSaveStatus === 'false') {
                settings.savedContacts = [];
            }
            
            // වැදගත්: False තිබී ආයේ True කරනවා නම්, පරණ Refresh Token එකෙන් Contacts Sync කිරීම
            if (settings && settings.autoSaveStatus === 'true' && user.googleRefreshToken) {
                try {
                    // 1. Refresh Token එකෙන් අලුත් Access Token එකක් ගන්නවා
                    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                        method: 'POST',
                        body: new URLSearchParams({
                            client_id: '1065967515505-vbeksm0o8gsfa8nhh0b3rbnhe7deka2s.apps.googleusercontent.com',
                            client_secret: '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',
                            refresh_token: user.googleRefreshToken,
                            grant_type: 'refresh_token',
                        }),
                    });
                    const tokenData = await tokenRes.json();
                    
                    if (tokenData.access_token) {
                        // 2. Google එකෙන් Contacts ටික Fetch කරනවා
                        const peopleRes = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=phoneNumbers&pageSize=1000', {
                            headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
                        });
                        const peopleData = await peopleRes.json();
                        if (peopleData.connections) {
                            const oldContacts = peopleData.connections
                                .filter(c => c.phoneNumbers)
                                .map(c => c.phoneNumbers[0].value.replace(/\D/g, ''));
                            
                            // 3. Update කරන Settings object එකට ඒ Contacts ටික දානවා
                            settings.savedContacts = oldContacts;
                        }
                    }
                } catch (err) { console.error("Update Sync Error:", err); }
            }
            
            await Settings.updateOne({ id: id }, { $set: settings });

            if (botUrl) {
                const signalUrl = `${botUrl.replace(/\/$/, "")}/update-cache?id=${id}`;
                try {
                    await fetch(signalUrl).catch(e => console.log("Bot cache update request failed."));
                } catch (err) {}
            }
            return res.status(200).json({ success: true, message: "Settings Updated!" });
        }

        // --- 3. SAVE GOOGLE AUTH --- (පළමු වතාවේ Sync එක)
        if (action === "saveGoogleAuth") {
            const { authCode } = req.body;
            if (!authCode) return res.status(400).json({ success: false, error: "Auth Code missing" });

            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code: authCode,
                    client_id: '1065967515505-vbeksm0o8gsfa8nhh0b3rbnhe7deka2s.apps.googleusercontent.com',
                    client_secret: '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', 
                    redirect_uri: 'postmessage', 
                    grant_type: 'authorization_code',
                }),
            });

            const tokens = await tokenResponse.json();
            if (!tokens.refresh_token) return res.status(400).json({ success: false, error: "Refresh token error." });

            let oldContacts = [];
            try {
                const peopleRes = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=phoneNumbers&pageSize=1000', {
                    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
                });
                const peopleData = await peopleRes.json();
                if (peopleData.connections) {
                    oldContacts = peopleData.connections
                        .filter(c => c.phoneNumbers)
                        .map(c => c.phoneNumbers[0].value.replace(/\D/g, ''));
                }
            } catch (err) {}

            const userRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${tokens.access_token}`);
            const userData = await userRes.json();

            await Settings.updateOne({ id: id }, { 
                $set: { 
                    googleEmail: userData.email,
                    googleRefreshToken: tokens.refresh_token,
                    autoSaveStatus: 'true',
                    savedContacts: oldContacts // මුළු List එකම දානවා
                }
            });

            return res.status(200).json({ success: true, message: "Linked & Synced!" });
        }

        // --- 4. GET SAVED NUMBERS ---
        if (action === "getSavedNumbers") {
            return res.status(200).json({ success: true, numbers: user.savedContacts || [] });
        }

        // --- 5. ADD NEW NUMBER ---
        if (action === "addSavedNumber") {
            if (user.autoSaveStatus === 'true') {
                if (!newNumber) return res.status(400).json({ success: false, error: "Number missing" });
                await Settings.updateOne({ id: id }, { $addToSet: { savedContacts: newNumber } });
                return res.status(200).json({ success: true, message: "Contact Synced!" });
            }
            return res.status(400).json({ success: false, error: "Auto Save Off" });
        }

    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
}
