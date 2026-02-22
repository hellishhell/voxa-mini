const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 });

app.use(express.static('public'));

// Файловая база данных (создается автоматически)
const USERS_FILE = './users.json';
const MSGS_FILE = './messages.json';

const loadData = (file) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : (file === USERS_FILE ? {} : []);
const saveData = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

let users = loadData(USERS_FILE); // { login: { username, password, avatar } }
let messages = loadData(MSGS_FILE);
let onlineUsers = {}; // { socketId: login }

io.on('connection', (socket) => {
    // РЕГИСТРАЦИЯ
    socket.on('register', (data) => {
        const { login, password, username } = data;
        if (users[login]) return socket.emit('error_msg', 'Логин уже занят');
        
        users[login] = { login, password, username: username.toLowerCase(), avatar: null };
        saveData(USERS_FILE, users);
        socket.emit('auth_success', users[login]);
    });

    // ВХОД
    socket.on('login', (data) => {
        const { login, password } = data;
        const user = users[login];
        if (user && user.password === password) {
            onlineUsers[socket.id] = login;
            socket.emit('auth_success', user);
            // Отправляем историю сообщений при входе
            socket.emit('history', messages.filter(m => m.from === user.username || m.to === user.username));
        } else {
            socket.emit('error_msg', 'Неверный логин или пароль');
        }
    });

    // ПОИСК (Исправлено)
    socket.on('search_users', (query) => {
        const results = Object.values(users)
            .filter(u => u.username.includes(query.toLowerCase()))
            .map(u => ({ username: u.username, avatar: u.avatar }));
        socket.emit('search_results', results);
    });

    // СМЕНА ЮЗЕРНЕЙМА И АВАТАРА
    socket.on('update_profile', (data) => {
        const login = onlineUsers[socket.id];
        if (login && users[login]) {
            if (data.username) users[login].username = data.username.toLowerCase();
            if (data.avatar) users[login].avatar = data.avatar;
            saveData(USERS_FILE, users);
            socket.emit('auth_success', users[login]);
        }
    });

    // СООБЩЕНИЯ (С сохранением)
    socket.on('send_message', (data) => {
        const login = onlineUsers[socket.id];
        if (!login) return;

        const msg = {
            from: users[login].username,
            to: data.to,
            content: data.content,
            type: data.type,
            timestamp: new Date().toISOString()
        };
        messages.push(msg);
        saveData(MSGS_FILE, messages);

        // Рассылка (себе и получателю)
        io.emit('receive_message', msg); 
    });

    socket.on('disconnect', () => delete onlineUsers[socket.id]);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Voxa-mini Live on ${PORT}`));
