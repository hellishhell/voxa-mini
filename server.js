const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    maxHttpBufferSize: 1e8 // Лимит 100мб для передачи фото
});

app.use(express.static('public'));

// --- БАЗА ДАННЫХ В ФАЙЛЕ ---
const DB_PATH = './database.json';
let db = { users: {}, messages: [] };

// Загрузка данных при старте
if (fs.existsSync(DB_PATH)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_PATH));
    } catch (e) {
        console.log("Ошибка чтения БД, создаем новую");
    }
}

const saveDB = () => fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

io.on('connection', (socket) => {
    let sessionUser = null;

    // --- АВТОРИЗАЦИЯ (Вход и Регистрация) ---
    socket.on('auth', (data) => {
        const { login, password, username, isReg } = data;
        
        if (isReg) {
            // Проверка на существующий логин
            if (db.users[login]) return socket.emit('auth_error', 'Этот логин уже занят');
            // Проверка на уникальность @username
            const userExists = Object.values(db.users).find(u => u.username === username.toLowerCase());
            if (userExists) return socket.emit('auth_error', 'Юзернейм @' + username + ' уже занят');

            db.users[login] = { 
                login, 
                password, 
                username: username.toLowerCase(), 
                avatar: null 
            };
        } else {
            const user = db.users[login];
            if (!user || user.password !== password) {
                return socket.emit('auth_error', 'Неверный логин или пароль');
            }
        }

        sessionUser = db.users[login];
        saveDB();
        socket.emit('auth_success', sessionUser);
        
        // Отправляем пользователю ВСЮ его историю переписки для построения списка чатов
        const userHistory = db.messages.filter(m => 
            m.from === sessionUser.username || m.to === sessionUser.username
        );
        socket.emit('chat_history', userHistory);
    });

    // --- ПОИСК ПОЛЬЗОВАТЕЛЕЙ ---
    socket.on('search', (query) => {
        if (!query || !sessionUser) return;
        const results = Object.values(db.users)
            .filter(u => 
                u.username.includes(query.toLowerCase()) && 
                u.username !== sessionUser.username
            )
            .map(u => ({ username: u.username, avatar: u.avatar }));
        socket.emit('search_results', results);
    });

    // --- ОБНОВЛЕНИЕ ПРОФИЛЯ ---
    socket.on('update_profile', (data) => {
        if (!sessionUser) return;
        if (data.username) {
            const cleanName = data.username.toLowerCase();
            // Проверка уникальности при смене имени
            const nameTaken = Object.values(db.users).find(u => u.username === cleanName && u.login !== sessionUser.login);
            if (!nameTaken) db.users[sessionUser.login].username = cleanName;
        }
        if (data.avatar) {
            db.users[sessionUser.login].avatar = data.avatar;
        }
        sessionUser = db.users[sessionUser.login];
        saveDB();
        socket.emit('auth_success', sessionUser);
    });

    // --- ОБРАБОТКА СООБЩЕНИЙ ---
    socket.on('msg', (data) => {
        if (!sessionUser) return;
        
        const newMsg = {
            from: sessionUser.username,
            to: data.to,
            text: data.text,
            type: data.type, // 'text' или 'img'
            time: Date.now()
        };
        
        db.messages.push(newMsg);
        saveDB();
        
        // Трансляция сообщения всем (фильтрация происходит на клиенте)
        io.emit('msg_receive', newMsg);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Voxa-mini работает на порту ${PORT}`);
});
