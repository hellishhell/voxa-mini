const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 });

app.use(express.static('public'));

// Простейшая БД в файлах
const DB_PATH = './database.json';
let db = { users: {}, messages: [] };

if (fs.existsSync(DB_PATH)) {
    db = JSON.parse(fs.readFileSync(DB_PATH));
}

const saveDB = () => fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

io.on('connection', (socket) => {
    let sessionUser = null;

    // Регистрация и Вход
    socket.on('auth', (data) => {
        const { login, password, username, isReg } = data;
        
        if (isReg) {
            if (db.users[login]) return socket.emit('auth_error', 'Логин занят');
            db.users[login] = { login, password, username: username.toLowerCase(), avatar: null };
        } else {
            const user = db.users[login];
            if (!user || user.password !== password) return socket.emit('auth_error', 'Ошибка входа');
        }

        sessionUser = db.users[login];
        saveDB();
        socket.emit('auth_success', sessionUser);
        
        // Отправляем историю сообщений, касающуюся пользователя
        const history = db.messages.filter(m => m.from === sessionUser.username || m.to === sessionUser.username);
        socket.emit('chat_history', history);
    });

    // Поиск пользователей
    socket.on('search', (query) => {
        const results = Object.values(db.users)
            .filter(u => u.username.includes(query.toLowerCase()) && u.username !== sessionUser?.username)
            .map(u => ({ username: u.username, avatar: u.avatar }));
        socket.emit('search_results', results);
    });

    // Обновление профиля
    socket.on('update_profile', (data) => {
        if (!sessionUser) return;
        if (data.username) db.users[sessionUser.login].username = data.username.toLowerCase();
        if (data.avatar) db.users[sessionUser.login].avatar = data.avatar;
        sessionUser = db.users[sessionUser.login];
        saveDB();
        socket.emit('auth_success', sessionUser);
    });

    // Сообщения
    socket.on('msg', (data) => {
        if (!sessionUser) return;
        const newMsg = {
            from: sessionUser.username,
            to: data.to,
            text: data.text,
            type: data.type,
            time: Date.now()
        };
        db.messages.push(newMsg);
        saveDB();
        io.emit('msg_receive', newMsg);
    });
});

server.listen(process.env.PORT || 3000);
