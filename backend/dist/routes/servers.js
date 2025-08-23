"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../database"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Global değişkeni başlat
if (!global.inviteCodes) {
    global.inviteCodes = new Map();
}
// PUBLIC ENDPOINT: Davet önizleme - AUTH GEREKMİYOR (Discord gibi)
router.get('/invite/:inviteCode/preview', (req, res) => {
    try {
        const { inviteCode } = req.params;
        console.log('Preview request for invite code:', inviteCode);
        console.log('Available invite codes:', Array.from(global.inviteCodes.keys()));
        // Davet kodu kontrol et
        if (!global.inviteCodes || !global.inviteCodes.has(inviteCode)) {
            console.log('Invite code not found in memory');
            return res.status(404).json({ error: 'Invalid invite code' });
        }
        const inviteInfo = global.inviteCodes.get(inviteCode);
        // Süresi dolmuş mu?
        if (Date.now() > inviteInfo.expiresAt) {
            global.inviteCodes.delete(inviteCode);
            console.log('Invite code expired');
            return res.status(404).json({ error: 'Invite expired' });
        }
        const serverId = inviteInfo.serverId;
        const server = database_1.default.servers.findById(serverId);
        if (!server) {
            console.log('Server not found for invite');
            return res.status(404).json({ error: 'Server not found' });
        }
        // Sunucu üye sayısını hesapla (doğru şekilde)
        const members = database_1.default.serverMembers.findByServerId(serverId);
        const memberCount = members.length;
        const onlineCount = Math.floor(memberCount * 0.6) + Math.floor(Math.random() * 3) + 1; // %60'ı + rastgele 1-3 kişi
        // Sunucu önizleme bilgisi
        const serverPreview = {
            id: server.id,
            name: server.name,
            description: server.description,
            icon_url: server.icon_url,
            member_count: memberCount,
            online_count: Math.min(onlineCount, memberCount), // Online sayısı üye sayısından fazla olamaz
            invite_code: inviteCode
        };
        console.log('Returning server preview:', serverPreview);
        res.json({ server: serverPreview });
    }
    catch (error) {
        console.error('Invite preview error:', error);
        res.status(500).json({ error: 'Failed to get invite preview' });
    }
});
// AUTH GEREKTİREN ENDPOINT'LER İÇİN MIDDLEWARE
router.use(auth_1.authMiddleware);
// Kullanıcının üye olduğu sunucuları getir
router.get('/', (req, res) => {
    try {
        const userId = req.user.id;
        // JSON database'den kullanıcının sunucularını getir
        const servers = database_1.default.servers.findByUserId(userId);
        res.json({ servers });
    }
    catch (error) {
        console.error('Get servers error:', error);
        res.status(500).json({ error: 'Failed to get servers' });
    }
});
// Yeni sunucu oluştur
router.post('/', (req, res) => {
    try {
        const { name, icon_url } = req.body;
        const userId = req.user.id;
        if (!name || name.trim().length < 1) {
            return res.status(400).json({ error: 'Server name is required' });
        }
        if (name.length > 100) {
            return res.status(400).json({ error: 'Server name too long' });
        }
        // JSON database ile sunucu oluştur
        const server = database_1.default.servers.create({
            name: name.trim(),
            owner_id: userId,
            icon_url: icon_url || undefined
        });
        res.status(201).json({ server });
    }
    catch (error) {
        console.error('Create server error:', error);
        res.status(500).json({ error: 'Failed to create server' });
    }
});
// Sunucuya katıl (invite link ile)
router.post('/join/:serverId', (req, res) => {
    try {
        const serverId = req.params.serverId;
        const userId = req.user.id;
        // Sunucu var mı kontrol et
        const server = database_1.default.servers.findById(serverId);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }
        // Zaten üye mi kontrol et
        const existingMember = database_1.default.serverMembers.findByServerAndUser(serverId, userId);
        if (existingMember) {
            return res.status(400).json({ error: 'Already a member' });
        }
        // Üye olarak ekle
        database_1.default.serverMembers.create(serverId, userId);
        // Sunucu bilgisini is_owner bilgisi ile geri döndür
        const serverWithOwnership = {
            ...server,
            is_owner: server.owner_id === userId
        };
        res.json({ server: serverWithOwnership });
    }
    catch (error) {
        console.error('Join server error:', error);
        res.status(500).json({ error: 'Failed to join server' });
    }
});
// Sunucu detaylarını getir (kanalları ile birlikte)
router.get('/:serverId', (req, res) => {
    try {
        const serverId = req.params.serverId;
        const userId = req.user.id;
        // Kullanıcı bu sunucunun üyesi mi?
        const membership = database_1.default.serverMembers.findByServerAndUser(serverId, userId);
        if (!membership) {
            return res.status(403).json({ error: 'Not a member of this server' });
        }
        // Sunucu bilgisi
        const server = database_1.default.servers.findById(serverId);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }
        // Sunucu kanalları
        const channels = database_1.default.channels.findByServerId(serverId);
        // is_owner bilgisini ekle
        const serverWithOwnership = {
            ...server,
            is_owner: server.owner_id === userId
        };
        res.json({ server: serverWithOwnership, channels });
    }
    catch (error) {
        console.error('Get server details error:', error);
        res.status(500).json({ error: 'Failed to get server details' });
    }
});
// Sunucu davet linki oluştur
router.post('/:serverId/invite', (req, res) => {
    try {
        const serverId = req.params.serverId;
        const userId = req.user.id;
        // Kullanıcı bu sunucunun üyesi mi?
        const membership = database_1.default.serverMembers.findByServerAndUser(serverId, userId);
        if (!membership) {
            return res.status(403).json({ error: 'Not a member of this server' });
        }
        // Sunucu var mı?
        const server = database_1.default.servers.findById(serverId);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }
        // Davet kodu oluştur (6 karakter random)
        const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        // Davet bilgisi
        const invite = {
            code: inviteCode,
            server_id: serverId,
            server_name: server.name,
            invited_by: req.user.username,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 saat
            url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/${inviteCode}`
        };
        // Davet kodunu geçici olarak bellekte sakla
        global.inviteCodes.set(inviteCode, {
            serverId,
            createdBy: userId,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000
        });
        console.log('Created invite code:', inviteCode, 'for server:', serverId);
        res.json({ invite });
    }
    catch (error) {
        console.error('Create invite error:', error);
        res.status(500).json({ error: 'Failed to create invite' });
    }
});
// Davet kodu ile katılma
router.post('/join-by-invite/:inviteCode', (req, res) => {
    try {
        const { inviteCode } = req.params;
        const userId = req.user.id;
        // Davet kodu kontrol et
        if (!global.inviteCodes || !global.inviteCodes.has(inviteCode)) {
            return res.status(404).json({ error: 'Invalid or expired invite code' });
        }
        const inviteInfo = global.inviteCodes.get(inviteCode);
        // Süresi dolmuş mu?
        if (Date.now() > inviteInfo.expiresAt) {
            global.inviteCodes.delete(inviteCode);
            return res.status(404).json({ error: 'Invite code expired' });
        }
        const serverId = inviteInfo.serverId;
        // Sunucu var mı?
        const server = database_1.default.servers.findById(serverId);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }
        // Zaten üye mi?
        const existingMember = database_1.default.serverMembers.findByServerAndUser(serverId, userId);
        if (existingMember) {
            return res.status(400).json({ error: 'Already a member of this server' });
        }
        // Sunucuya ekle
        database_1.default.serverMembers.create(serverId, userId);
        res.json({
            server: {
                ...server,
                is_owner: server.owner_id === userId
            },
            message: `Successfully joined ${server.name}!`
        });
    }
    catch (error) {
        console.error('Join by invite error:', error);
        res.status(500).json({ error: 'Failed to join server' });
    }
});
exports.default = router;
