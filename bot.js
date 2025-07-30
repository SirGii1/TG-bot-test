const TelegramBot = require('node-telegram-bot-api');

// Bot configuration
const BOT_TOKEN = '8429756008:AAHMzGEsBJwoEt5XC_gX3fJYBFZAe9O9k6c';
const ADMIN_ID = 2051249497;

// Create bot instance
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Bot state and configuration
let botConfig = {
    welcomeMessage: "👋 Welcome! How can I help you today?",
    buttons: [
        { text: "ℹ️ Info", callback: "info" },
        { text: "📞 Contact", callback: "contact" },
        { text: "❓ Help", callback: "help" }
    ],
    responses: {
        info: "This is the info section. You can customize this message.",
        contact: "Contact us at: your-email@example.com",
        help: "Here's how you can use this bot:\n• Click buttons to navigate\n• Send messages to interact"
    }
};

// Admin commands
const adminCommands = `
🔧 *Admin Commands:*

/setmessage <text> - Set welcome message
/addbutton <text>|<response> - Add new button
/removebutton <text> - Remove button by text
/listbuttons - Show all buttons
/setresponse <callback>|<text> - Set button response
/broadcast <message> - Send message to all users
/stats - Show bot statistics
/config - Show current configuration
`;

// User database
let users = new Set();
let userStats = {
    totalUsers: 0,
    messagesReceived: 0,
    buttonsClicked: 0
};

// Helper functions
function isAdmin(userId) {
    return userId === ADMIN_ID;
}

function createKeyboard() {
    const keyboard = [];
    for (let i = 0; i < botConfig.buttons.length; i += 2) {
        const row = [];
        row.push({ text: botConfig.buttons[i].text, callback_data: botConfig.buttons[i].callback });
        if (botConfig.buttons[i + 1]) {
            row.push({ text: botConfig.buttons[i + 1].text, callback_data: botConfig.buttons[i + 1].callback });
        }
        keyboard.push(row);
    }
    return { inline_keyboard: keyboard };
}

// Bot event handlers
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Add user to database
    if (!users.has(userId)) {
        users.add(userId);
        userStats.totalUsers++;
    }
    
    userStats.messagesReceived++;
    
    // Send welcome message with buttons
    bot.sendMessage(chatId, botConfig.welcomeMessage, {
        reply_markup: createKeyboard()
    });
    
    // Notify admin of new user
    if (!isAdmin(userId)) {
        bot.sendMessage(ADMIN_ID, `🆕 New user: ${msg.from.first_name} (@${msg.from.username || 'no username'})\nID: ${userId}`);
    }
});

// Handle button clicks
bot.on('callback_query', (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    
    userStats.buttonsClicked++;
    
    // Find response for the callback
    const response = botConfig.responses[data] || "Sorry, this feature is not configured yet.";
    
    bot.answerCallbackQuery(callbackQuery.id);
    bot.sendMessage(message.chat.id, response, {
        reply_markup: createKeyboard()
    });
    
    // Notify admin of button click
    if (!isAdmin(userId)) {
        bot.sendMessage(ADMIN_ID, `🔘 Button clicked: "${data}" by ${callbackQuery.from.first_name}`);
    }
});

// Handle regular messages
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;
    
    // Skip if it's a command
    if (text && text.startsWith('/')) return;
    
    userStats.messagesReceived++;
    
    // Forward user messages to admin (except admin's own messages)
    if (!isAdmin(userId)) {
        bot.sendMessage(ADMIN_ID, `💬 Message from ${msg.from.first_name} (@${msg.from.username || 'no username'}):\n"${text}"`);
        
        // Auto-reply to user
        bot.sendMessage(chatId, "Thanks for your message! I'll get back to you soon.", {
            reply_markup: createKeyboard()
        });
    }
});

// Admin Commands
bot.onText(/\/admin/, (msg) => {
    if (isAdmin(msg.from.id)) {
        bot.sendMessage(msg.chat.id, adminCommands, { parse_mode: 'Markdown' });
    }
});

bot.onText(/\/setmessage (.+)/, (msg, match) => {
    if (isAdmin(msg.from.id)) {
        botConfig.welcomeMessage = match[1];
        bot.sendMessage(msg.chat.id, `✅ Welcome message updated to:\n"${match[1]}"`);
    }
});

bot.onText(/\/addbutton (.+)/, (msg, match) => {
    if (isAdmin(msg.from.id)) {
        const parts = match[1].split('|');
        if (parts.length === 2) {
            const buttonText = parts[0].trim();
            const response = parts[1].trim();
            const callback = buttonText.toLowerCase().replace(/\s+/g, '_');
            
            botConfig.buttons.push({ text: buttonText, callback: callback });
            botConfig.responses[callback] = response;
            
            bot.sendMessage(msg.chat.id, `✅ Button added: "${buttonText}"`);
        } else {
            bot.sendMessage(msg.chat.id, "❌ Format: /addbutton Button Text|Response Text");
        }
    }
});

bot.onText(/\/removebutton (.+)/, (msg, match) => {
    if (isAdmin(msg.from.id)) {
        const buttonText = match[1];
        const index = botConfig.buttons.findIndex(btn => btn.text === buttonText);
        
        if (index !== -1) {
            const removed = botConfig.buttons.splice(index, 1)[0];
            delete botConfig.responses[removed.callback];
            bot.sendMessage(msg.chat.id, `✅ Button removed: "${buttonText}"`);
        } else {
            bot.sendMessage(msg.chat.id, `❌ Button not found: "${buttonText}"`);
        }
    }
});

bot.onText(/\/listbuttons/, (msg) => {
    if (isAdmin(msg.from.id)) {
        if (botConfig.buttons.length === 0) {
            bot.sendMessage(msg.chat.id, "No buttons configured.");
            return;
        }
        
        let buttonList = "🔘 Current buttons:\n\n";
        botConfig.buttons.forEach((btn, index) => {
            buttonList += `${index + 1}. ${btn.text}\n`;
        });
        
        bot.sendMessage(msg.chat.id, buttonList);
    }
});

bot.onText(/\/setresponse (.+)/, (msg, match) => {
    if (isAdmin(msg.from.id)) {
        const parts = match[1].split('|');
        if (parts.length === 2) {
            const callback = parts[0].trim();
            const response = parts[1].trim();
            
            botConfig.responses[callback] = response;
            bot.sendMessage(msg.chat.id, `✅ Response updated for: "${callback}"`);
        } else {
            bot.sendMessage(msg.chat.id, "❌ Format: /setresponse callback_name|Response Text");
        }
    }
});

bot.onText(/\/broadcast (.+)/, (msg, match) => {
    if (isAdmin(msg.from.id)) {
        const message = match[1];
        let sent = 0;
        
        users.forEach(userId => {
            if (userId !== ADMIN_ID) {
                bot.sendMessage(userId, `📢 ${message}`).then(() => {
                    sent++;
                }).catch(() => {
                    // User blocked the bot or chat doesn't exist
                });
            }
        });
        
        setTimeout(() => {
            bot.sendMessage(msg.chat.id, `✅ Broadcast sent to ${sent} users`);
        }, 2000);
    }
});

bot.onText(/\/stats/, (msg) => {
    if (isAdmin(msg.from.id)) {
        const stats = `📊 *Bot Statistics:*

👥 Total Users: ${userStats.totalUsers}
💬 Messages Received: ${userStats.messagesReceived}
🔘 Buttons Clicked: ${userStats.buttonsClicked}
⚙️ Active Buttons: ${botConfig.buttons.length}`;

        bot.sendMessage(msg.chat.id, stats, { parse_mode: 'Markdown' });
    }
});

bot.onText(/\/config/, (msg) => {
    if (isAdmin(msg.from.id)) {
        const config = `⚙️ *Current Configuration:*

📝 Welcome Message:
"${botConfig.welcomeMessage}"

🔘 Buttons: ${botConfig.buttons.length}
${botConfig.buttons.map(btn => `• ${btn.text}`).join('\n')}`;

        bot.sendMessage(msg.chat.id, config, { parse_mode: 'Markdown' });
    }
});

// Error handling
bot.on('error', (error) => {
    console.log('Bot error:', error);
});

bot.on('polling_error', (error) => {
    console.log('Polling error:', error);
});

console.log('🤖 Bot started successfully!');
console.log(`👤 Admin ID: ${ADMIN_ID}`);
console.log('📱 Send /admin to see all available commands');

// Export for use in other modules
module.exports = { bot, botConfig, userStats };
