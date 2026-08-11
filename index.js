const { 
    Client, 
    GatewayIntentBits, 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder,
    REST,
    Routes,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require('discord.js');
const fs = require('fs');
require('dotenv').config();

// ==================== CONFIGURATION ====================
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;
const SECATAM_SETAM_ROLE_ID = process.env.SECATAM_SETAM_ROLE_ID;
const SETAM_PING_ROLE = process.env.SETAM_PING_ROLE;
const SETAM_STAGE = process.env.SETAM_STAGE;
const SECATAM_PING_ROLE = process.env.SECATAM_PING_ROLE;
const SECATAM_STAGE = process.env.SECATAM_STAGE;
const ROBLOX_LINK = process.env.ROBLOX_LINK;
const LAPORAN_CHANNEL_ID = process.env.LAPORAN_CHANNEL_ID;

const TICKETS_FILE = './tickets.json';
const BLACKLIST_FILE = './blacklist.json';

// ==================== HELPER: TICKETS DATABASE ====================

function loadTickets() {
    try {
        if (fs.existsSync(TICKETS_FILE)) {
            const data = fs.readFileSync(TICKETS_FILE, 'utf-8');
            return JSON.parse(data);
        }
        return {};
    } catch (error) {
        console.error('Error loading tickets:', error);
        return {};
    }
}

function saveTickets(data) {
    try {
        fs.writeFileSync(TICKETS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving tickets:', error);
    }
}

function createTicket(guildId, userId, judul, deskripsi, mention) {
    const tickets = loadTickets();
    if (!tickets[guildId]) {
        tickets[guildId] = [];
    }

    const ticketId = Date.now().toString();
    const ticket = {
        id: ticketId,
        userId: userId,
        judul: judul,
        deskripsi: deskripsi,
        mention: mention || null,
        status: 'open',
        claimedBy: null,
        createdAt: new Date().toISOString(),
        closedAt: null
    };

    tickets[guildId].push(ticket);
    saveTickets(tickets);
    return ticket;
}

function getTickets(guildId) {
    const tickets = loadTickets();
    return tickets[guildId] || [];
}

function closeTicket(guildId, ticketId) {
    const tickets = loadTickets();
    const guildTickets = tickets[guildId] || [];
    const ticket = guildTickets.find(t => t.id === ticketId);
    
    if (ticket) {
        ticket.status = 'closed';
        ticket.closedAt = new Date().toISOString();
        tickets[guildId] = guildTickets;
        saveTickets(tickets);
        return ticket;
    }
    return null;
}

function claimTicket(guildId, ticketId, adminId) {
    const tickets = loadTickets();
    const guildTickets = tickets[guildId] || [];
    const ticket = guildTickets.find(t => t.id === ticketId);
    
    if (ticket) {
        ticket.claimedBy = adminId;
        tickets[guildId] = guildTickets;
        saveTickets(tickets);
        return ticket;
    }
    return null;
}

// ==================== HELPER: BLACKLIST DATABASE ====================

function loadBlacklist() {
    try {
        if (fs.existsSync(BLACKLIST_FILE)) {
            const data = fs.readFileSync(BLACKLIST_FILE, 'utf-8');
            return JSON.parse(data);
        }
        return {};
    } catch (error) {
        console.error('Error loading blacklist:', error);
        return {};
    }
}

function saveBlacklist(data) {
    try {
        fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving blacklist:', error);
    }
}

function addBlacklist(guildId, username, userId, reason) {
    const blacklist = loadBlacklist();
    if (!blacklist[guildId]) {
        blacklist[guildId] = [];
    }

    const entry = {
        username: username,
        userId: userId,
        reason: reason,
        bannedAt: new Date().toISOString()
    };

    blacklist[guildId].push(entry);
    saveBlacklist(blacklist);
    return entry;
}

function removeBlacklist(guildId, username) {
    const blacklist = loadBlacklist();
    const guildBlacklist = blacklist[guildId] || [];
    const index = guildBlacklist.findIndex(b => b.username.toLowerCase() === username.toLowerCase());
    
    if (index > -1) {
        const removed = guildBlacklist[index];
        guildBlacklist.splice(index, 1);
        blacklist[guildId] = guildBlacklist;
        saveBlacklist(blacklist);
        return removed;
    }
    return null;
}

function getBlacklist(guildId) {
    const blacklist = loadBlacklist();
    return blacklist[guildId] || [];
}

// ==================== HELPER FUNCTION ====================

async function checkAdminRole(interaction) {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const hasRole = member.roles.cache.has(ADMIN_ROLE_ID);
    
    if (!hasRole) {
        await interaction.reply({
            content: `❌ Maaf, Anda tidak memiliki role admin yang diperlukan!\n**Role yang diperlukan:** <@&${ADMIN_ROLE_ID}>`,
            ephemeral: true
        });
        return false;
    }
    return true;
}

async function checkSecatamSetamRole(interaction) {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const hasRole = member.roles.cache.has(SECATAM_SETAM_ROLE_ID);
    
    if (!hasRole) {
        await interaction.reply({
            content: `❌ Maaf, Anda tidak memiliki role yang diperlukan untuk command ini!\n**Role yang diperlukan:** <@&${SECATAM_SETAM_ROLE_ID}>`,
            ephemeral: true
        });
        return false;
    }
    return true;
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
    ]
});

// ==================== COMMAND DEFINITIONS ====================

const commands = [
    // ==================== PENGUMUMAN COMMAND ====================
    {
        data: new SlashCommandBuilder()
            .setName('pengumuman')
            .setDescription('📢 Buat pengumuman')
            .addStringOption(option =>
                option
                    .setName('isi')
                    .setDescription('Isi pengumuman')
                    .setRequired(true)
                    .setMaxLength(2000)
            )
            .addUserOption(option =>
                option
                    .setName('mention')
                    .setDescription('Mention member (opsional)')
                    .setRequired(false)
            )
            .addAttachmentOption(option =>
                option
                    .setName('attachment')
                    .setDescription('Lampiran foto (opsional)')
                    .setRequired(false)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
        
        async execute(interaction) {
            if (!await checkAdminRole(interaction)) return;

            const isi = interaction.options.getString('isi');
            const mention = interaction.options.getUser('mention');
            const attachment = interaction.options.getAttachment('attachment');

            try {
                await interaction.deferReply({ ephemeral: false });

                let message = isi;
                if (mention) {
                    message += `\n\n<@${mention.id}>`;
                }

                const messageOptions = { content: message };

                if (attachment) {
                    messageOptions.files = [attachment.url];
                }

                await interaction.channel.send(messageOptions);

                await interaction.followUp({
                    content: '✅ Pengumuman berhasil dikirim!',
                    ephemeral: true
                });

                console.log(`✅ Pengumuman dikirim oleh ${interaction.user.username}`);

            } catch (error) {
                console.error('❌ Error di command pengumuman:', error);
                
                if (interaction.deferred) {
                    await interaction.followUp({
                        content: '❌ Terjadi error saat mengirim pengumuman!',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '❌ Terjadi error saat mengirim pengumuman!',
                        ephemeral: true
                    });
                }
            }
        }
    },

    // ==================== TEXT COMMAND ====================
    {
        data: new SlashCommandBuilder()
            .setName('text')
            .setDescription('📝 Kirim pesan text')
            .addStringOption(option =>
                option
                    .setName('isi')
                    .setDescription('Isi pesan')
                    .setRequired(true)
                    .setMaxLength(2000)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

        async execute(interaction) {
            if (!await checkAdminRole(interaction)) return;

            const isi = interaction.options.getString('isi');

            try {
                await interaction.deferReply({ ephemeral: false });

                await interaction.channel.send(isi);

                await interaction.followUp({
                    content: '✅ Pesan berhasil dikirim!',
                    ephemeral: true
                });

                console.log(`✅ Text message dikirim oleh ${interaction.user.username}`);

            } catch (error) {
                console.error('❌ Error di command text:', error);
                
                if (interaction.deferred) {
                    await interaction.followUp({
                        content: '❌ Terjadi error saat mengirim pesan!',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '❌ Terjadi error saat mengirim pesan!',
                        ephemeral: true
                    });
                }
            }
        }
    },

    // ==================== SECATAM COMMAND ====================
    {
        data: new SlashCommandBuilder()
            .setName('secatam')
            .setDescription('🎖️ SEKOLAH CALON TAMTAMA')
            .addStringOption(option =>
                option
                    .setName('host')
                    .setDescription('Host')
                    .setRequired(true)
                    .setMaxLength(100)
            )
            .addStringOption(option =>
                option
                    .setName('co-host')
                    .setDescription('Co Host')
                    .setRequired(true)
                    .setMaxLength(100)
            )
            .addStringOption(option =>
                option
                    .setName('supervisor')
                    .setDescription('Supervisor')
                    .setRequired(true)
                    .setMaxLength(100)
            )
            .addStringOption(option =>
                option
                    .setName('time')
                    .setDescription('Waktu')
                    .setRequired(true)
                    .setMaxLength(100)
            )
            .addStringOption(option =>
                option
                    .setName('note')
                    .setDescription('Note/Catatan')
                    .setRequired(true)
                    .setMaxLength(500)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

        async execute(interaction) {
            if (!await checkSecatamSetamRole(interaction)) return;

            const host = interaction.options.getString('host');
            const coHost = interaction.options.getString('co-host');
            const supervisor = interaction.options.getString('supervisor');
            const time = interaction.options.getString('time');
            const note = interaction.options.getString('note');

            try {
                await interaction.deferReply({ ephemeral: false });

                const message = `# SEKOLAH CALON TAMTAMA

Host: ${host}
Co host: ${coHost}
Supervisor: ${supervisor}
Time: ${time}
Note: ${note}
Ping: <@&${SECATAM_PING_ROLE}>
Dresscode: Menyesuaikan Dengan Disuruh Pelatih.
Stage: ${SECATAM_STAGE}
Link: ${ROBLOX_LINK}`;

                await interaction.channel.send(message);

                await interaction.followUp({
                    content: '✅ SECATAM berhasil dikirim!',
                    ephemeral: true
                });

                console.log(`✅ SECATAM dikirim oleh ${interaction.user.username}`);

            } catch (error) {
                console.error('❌ Error di command secatam:', error);
                
                if (interaction.deferred) {
                    await interaction.followUp({
                        content: '❌ Terjadi error!',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '❌ Terjadi error!',
                        ephemeral: true
                    });
                }
            }
        }
    },

    // ==================== SETAM COMMAND ====================
    {
        data: new SlashCommandBuilder()
            .setName('setam')
            .setDescription('⚓ SEKOLAH TAMTAMA')
            .addStringOption(option =>
                option
                    .setName('host')
                    .setDescription('Host')
                    .setRequired(true)
                    .setMaxLength(100)
            )
            .addStringOption(option =>
                option
                    .setName('co-host')
                    .setDescription('Co Host')
                    .setRequired(true)
                    .setMaxLength(100)
            )
            .addStringOption(option =>
                option
                    .setName('supervisor')
                    .setDescription('Supervisor')
                    .setRequired(true)
                    .setMaxLength(100)
            )
            .addStringOption(option =>
                option
                    .setName('time')
                    .setDescription('Waktu')
                    .setRequired(true)
                    .setMaxLength(100)
            )
            .addStringOption(option =>
                option
                    .setName('note')
                    .setDescription('Note/Catatan')
                    .setRequired(true)
                    .setMaxLength(500)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

        async execute(interaction) {
            if (!await checkSecatamSetamRole(interaction)) return;

            const host = interaction.options.getString('host');
            const coHost = interaction.options.getString('co-host');
            const supervisor = interaction.options.getString('supervisor');
            const time = interaction.options.getString('time');
            const note = interaction.options.getString('note');

            try {
                await interaction.deferReply({ ephemeral: false });

                const message = `# SEKOLAH TAMTAMA

Host: ${host}
Co host: ${coHost}
Supervisor: ${supervisor}
Time: ${time}
Note: ${note}
Ping: <@&${SETAM_PING_ROLE}>
Dresscode: Menyesuaikan Dengan Disuruh Pelatih.
Stage: ${SETAM_STAGE}
Link: ${ROBLOX_LINK}`;

                await interaction.channel.send(message);

                await interaction.followUp({
                    content: '✅ SETAM berhasil dikirim!',
                    ephemeral: true
                });

                console.log(`✅ SETAM dikirim oleh ${interaction.user.username}`);

            } catch (error) {
                console.error('❌ Error di command setam:', error);
                
                if (interaction.deferred) {
                    await interaction.followUp({
                        content: '❌ Terjadi error!',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '❌ Terjadi error!',
                        ephemeral: true
                    });
                }
            }
        }
    },

    // ==================== PANEL-TICKET COMMAND ====================
    {
        data: new SlashCommandBuilder()
            .setName('panel-ticket')
            .setDescription('🎫 Buat ticket/laporan')
            .addStringOption(option =>
                option
                    .setName('judul')
                    .setDescription('Judul ticket')
                    .setRequired(true)
                    .setMaxLength(100)
            )
            .addStringOption(option =>
                option
                    .setName('deskripsi')
                    .setDescription('Deskripsi ticket')
                    .setRequired(true)
                    .setMaxLength(1000)
            )
            .addUserOption(option =>
                option
                    .setName('mention')
                    .setDescription('Mention member (opsional)')
                    .setRequired(false)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

        async execute(interaction) {
            if (!await checkAdminRole(interaction)) return;

            const judul = interaction.options.getString('judul');
            const deskripsi = interaction.options.getString('deskripsi');
            const mention = interaction.options.getUser('mention');

            try {
                await interaction.deferReply({ ephemeral: false });

                const ticket = createTicket(interaction.guild.id, interaction.user.id, judul, deskripsi, mention?.id);

                // Post ticket di main channel dengan button
                const ticketEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🎫 PUSAT BANDING & LAPORAN')
                    .addFields(
                        { name: '📝 Judul', value: judul, inline: false },
                        { name: '📄 Deskripsi', value: deskripsi, inline: false },
                        mention ? { name: '👤 Mention', value: `<@${mention.id}>`, inline: false } : { name: '⠀', value: '⠀', inline: false },
                        { name: '🔧 Status', value: '🟢 Open', inline: true },
                        { name: '🆔 Ticket ID', value: `\`${ticket.id}\``, inline: true },
                        { name: '👨‍💼 Dibuat oleh', value: interaction.user.tag, inline: false },
                        { name: '⏰ Waktu', value: new Date().toLocaleString('id-ID'), inline: false }
                    )
                    .setFooter({ text: 'TNI AL Bot Ticketing System' })
                    .setTimestamp();

                const button = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`ticket_ajukan_${ticket.id}`)
                            .setLabel('Ajukan Banding')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🎖️')
                    );

                await interaction.channel.send({
                    embeds: [ticketEmbed],
                    components: [button]
                });

                await interaction.followUp({
                    content: '✅ Ticket berhasil dibuat!',
                    ephemeral: true
                });

                console.log(`✅ Ticket dibuat oleh ${interaction.user.username} - ID: ${ticket.id}`);

            } catch (error) {
                console.error('❌ Error di command panel-ticket:', error);
                
                if (interaction.deferred) {
                    await interaction.followUp({
                        content: '❌ Terjadi error!',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '❌ Terjadi error!',
                        ephemeral: true
                    });
                }
            }
        }
    },

    // ==================== BLACKLIST-ADD COMMAND ====================
    {
        data: new SlashCommandBuilder()
            .setName('blacklist-add')
            .setDescription('🚫 Ban member')
            .addUserOption(option =>
                option
                    .setName('username')
                    .setDescription('Member yang akan di-ban')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('reason')
                    .setDescription('Alasan ban')
                    .setRequired(true)
                    .setMaxLength(256)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

        async execute(interaction) {
            if (!await checkAdminRole(interaction)) return;

            const targetUser = interaction.options.getUser('username');
            const reason = interaction.options.getString('reason');
            const guild = interaction.guild;

            try {
                await interaction.deferReply({ ephemeral: false });

                if (targetUser.id === interaction.user.id) {
                    return await interaction.followUp({
                        content: '❌ Anda tidak bisa mem-ban diri sendiri!',
                        ephemeral: true
                    });
                }

                if (targetUser.bot) {
                    return await interaction.followUp({
                        content: '❌ Bot tidak bisa di-ban!',
                        ephemeral: true
                    });
                }

                try {
                    await guild.members.ban(targetUser, { reason: reason });
                } catch (error) {
                    return await interaction.followUp({
                        content: '❌ Tidak bisa mem-ban member!',
                        ephemeral: true
                    });
                }

                addBlacklist(guild.id, targetUser.username, targetUser.id, reason);

                const banEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🚫 MEMBER DI-BAN')
                    .setThumbnail(targetUser.displayAvatarURL())
                    .addFields(
                        { name: '👤 Username', value: `${targetUser.tag}`, inline: false },
                        { name: '📝 Alasan', value: reason, inline: false },
                        { name: '🔨 Di-ban oleh', value: interaction.user.tag, inline: true },
                        { name: '⏰ Waktu', value: new Date().toLocaleString('id-ID'), inline: true }
                    )
                    .setFooter({ text: 'Member telah dihapus dari server' })
                    .setTimestamp();

                await interaction.channel.send({ embeds: [banEmbed] });

                await interaction.followUp({
                    content: `✅ ${targetUser.tag} berhasil di-ban!`,
                    ephemeral: true
                });

                console.log(`🚫 ${targetUser.tag} di-ban oleh ${interaction.user.username}`);

            } catch (error) {
                console.error('❌ Error di command blacklist-add:', error);
                
                if (interaction.deferred) {
                    await interaction.followUp({
                        content: '❌ Terjadi error!',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '❌ Terjadi error!',
                        ephemeral: true
                    });
                }
            }
        }
    },

    // ==================== UNBLACKLIST COMMAND ====================
    {
        data: new SlashCommandBuilder()
            .setName('unblacklist')
            .setDescription('✅ Unban member')
            .addStringOption(option =>
                option
                    .setName('username')
                    .setDescription('Username member yang akan di-unban')
                    .setRequired(true)
                    .setMaxLength(100)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

        async execute(interaction) {
            if (!await checkAdminRole(interaction)) return;

            const username = interaction.options.getString('username');
            const guild = interaction.guild;

            try {
                await interaction.deferReply({ ephemeral: false });

                const removed = removeBlacklist(guild.id, username);

                if (!removed) {
                    return await interaction.followUp({
                        content: `❌ Member \`${username}\` tidak ditemukan di blacklist!`,
                        ephemeral: true
                    });
                }

                const unbanEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ MEMBER DI-UNBAN')
                    .addFields(
                        { name: '👤 Username', value: removed.username, inline: false },
                        { name: '📝 Alasan Ban Sebelumnya', value: removed.reason, inline: false },
                        { name: '🔓 Di-unban oleh', value: interaction.user.tag, inline: true },
                        { name: '⏰ Waktu', value: new Date().toLocaleString('id-ID'), inline: true }
                    )
                    .setFooter({ text: 'Member dapat bergabung kembali' })
                    .setTimestamp();

                await interaction.channel.send({ embeds: [unbanEmbed] });

                await interaction.followUp({
                    content: `✅ ${username} berhasil di-unban!`,
                    ephemeral: true
                });

                console.log(`✅ ${username} di-unban oleh ${interaction.user.username}`);

            } catch (error) {
                console.error('❌ Error di command unblacklist:', error);
                
                if (interaction.deferred) {
                    await interaction.followUp({
                        content: '❌ Terjadi error!',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '❌ Terjadi error!',
                        ephemeral: true
                    });
                }
            }
        }
    }
];

// ==================== BOT EVENTS ====================

client.once('ready', () => {
    console.log('\n' + '='.repeat(60));
    console.log(`✅ TNI AL Bot Ready! Logged in as ${client.user.tag}`);
    console.log(`Bot ID: ${client.user.id}`);
    console.log(`Admin Role: ${ADMIN_ROLE_ID}`);
    console.log('='.repeat(60) + '\n');
    
    client.user.setActivity('🪖 TNI AL Bot', { type: 'WATCHING' });
});

client.on('interactionCreate', async interaction => {
    // Handle buttons untuk panel-ticket
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('ticket_ajukan_')) {
            const ticketId = interaction.customId.replace('ticket_ajukan_', '');
            const guildId = interaction.guild.id;
            const tickets = getTickets(guildId);
            const ticket = tickets.find(t => t.id === ticketId);

            if (!ticket) {
                return await interaction.reply({
                    content: '❌ Ticket tidak ditemukan!',
                    ephemeral: true
                });
            }

            try {
                // Create channel untuk laporan
                const laporanChannel = await interaction.guild.channels.fetch(LAPORAN_CHANNEL_ID);
                
                if (!laporanChannel) {
                    return await interaction.reply({
                        content: '❌ Channel laporan tidak ditemukan!',
                        ephemeral: true
                    });
                }

                // Post ticket di laporan channel
                const ticketEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🎫 TICKET LAPORAN')
                    .addFields(
                        { name: '🆔 Ticket ID', value: `\`${ticket.id}\``, inline: true },
                        { name: '📝 Judul', value: ticket.judul, inline: false },
                        { name: '📄 Deskripsi', value: ticket.deskripsi, inline: false },
                        ticket.mention ? { name: '👤 Mention', value: `<@${ticket.mention}>`, inline: false } : { name: '⠀', value: '⠀', inline: false },
                        { name: '👨‍💼 Reporter', value: `<@${ticket.userId}>`, inline: true },
                        { name: '⏰ Dibuat', value: new Date(ticket.createdAt).toLocaleString('id-ID'), inline: true },
                        { name: '🔧 Status', value: '🟡 Pending', inline: false }
                    )
                    .setFooter({ text: 'TNI AL Bot Ticketing System' })
                    .setTimestamp();

                const buttons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`ticket_claim_${ticket.id}`)
                            .setLabel('Claim')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('👨‍💼'),
                        new ButtonBuilder()
                            .setCustomId(`ticket_close_${ticket.id}`)
                            .setLabel('Tutup Ticket')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('❌')
                    );

                await laporanChannel.send({
                    embeds: [ticketEmbed],
                    components: [buttons]
                });

                await interaction.reply({
                    content: '✅ Ticket berhasil dikirim ke channel laporan!',
                    ephemeral: true
                });

            } catch (error) {
                console.error('Error:', error);
                await interaction.reply({
                    content: '❌ Terjadi error!',
                    ephemeral: true
                });
            }
        }

        // Claim ticket
        if (interaction.customId.startsWith('ticket_claim_')) {
            if (!await checkAdminRole(interaction)) return;

            const ticketId = interaction.customId.replace('ticket_claim_', '');
            const guildId = interaction.guild.id;

            claimTicket(guildId, ticketId, interaction.user.id);

            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setFields(
                    ...interaction.message.embeds[0].fields.map(f => ({
                        name: f.name,
                        value: f.name === '🔧 Status' ? `🟡 Claimed by <@${interaction.user.id}>` : f.value,
                        inline: f.inline
                    }))
                );

            await interaction.message.edit({ embeds: [updatedEmbed] });

            await interaction.reply({
                content: `✅ Ticket ini sudah di-claim oleh <@${interaction.user.id}>`,
                ephemeral: false
            });
        }

        // Close ticket
        if (interaction.customId.startsWith('ticket_close_')) {
            if (!await checkAdminRole(interaction)) return;

            const ticketId = interaction.customId.replace('ticket_close_', '');
            const guildId = interaction.guild.id;

            closeTicket(guildId, ticketId);

            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setFields(
                    ...interaction.message.embeds[0].fields.map(f => ({
                        name: f.name,
                        value: f.name === '🔧 Status' ? '🔴 Closed' : f.value,
                        inline: f.inline
                    }))
                );

            await interaction.message.edit({ embeds: [updatedEmbed], components: [] });

            await interaction.reply({
                content: `✅ Ticket berhasil ditutup oleh <@${interaction.user.id}>`,
                ephemeral: false
            });
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = commands.find(cmd => cmd.data.name === interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        console.log(`🔧 ${interaction.user.username} used /${interaction.commandName}`);
        await command.execute(interaction);
    } catch (error) {
        console.error(`❌ Error executing ${interaction.commandName}:`, error);
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: '❌ Terjadi error saat menjalankan command!',
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: '❌ Terjadi error saat menjalankan command!',
                ephemeral: true
            });
        }
    }
});

// ==================== DEPLOY COMMANDS ====================

async function deployCommands() {
    const commandsData = commands.map(cmd => cmd.data.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log(`\n🔄 Deploying ${commandsData.length} command(s)...`);
        
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commandsData }
        );

        console.log(`✅ Successfully deployed ${data.length} command(s)!\n`);
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
}

client.once('ready', deployCommands);

// ==================== ERROR HANDLING ====================

process.on('unhandledRejection', error => {
    console.error('❌ Unhandled Rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('❌ Uncaught Exception:', error);
});

// ==================== LOGIN ====================

console.log('🚀 Memulai TNI AL Bot...\n');
client.login(process.env.DISCORD_TOKEN);
