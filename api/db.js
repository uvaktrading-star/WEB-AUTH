const mongoose = require('mongoose');

const MONGO_URI = "mongodb+srv://zanta-mini:Akashkavindu12345@zanta-mini.x1s0cjc.mongodb.net/?appName=zanta-mini";

// Connection එක cache කරගැනීමට (Serverless වලට වැදගත්)
let cachedConnection = null;

export const connectToDatabase = async () => {
    if (cachedConnection) return cachedConnection;

    if (mongoose.connection.readyState >= 1) {
        cachedConnection = mongoose.connection;
        return cachedConnection;
    }

    cachedConnection = await mongoose.connect(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    return cachedConnection;
};

// Settings Schema
// ඔයාගේ Database එකේ දැනටමත් තියෙන fields වලට අමතරව 'knowledgeText' මෙතනට දැම්මා.
const SettingsSchema = new mongoose.Schema({
    id: String, // Bot Number එක
    knowledgeText: { type: String, default: "" }, // AI Knowledge එක
    password: { type: String, default: 'not_set' },
    botName: String,
    ownerName: String,
    // අනෙක් සියලුම fields 'strict: false' නිසා auto handle වෙනවා
}, { collection: 'settings', strict: false });

export const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);
