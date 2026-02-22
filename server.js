const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 }); // Для фото

app.use(express.static('public'));

// База данных в памяти (при перезапуске Render она очистится, для реального продакшена потом подключим базу)
let users = {}; // { socketId: { id, username } }
let messages = []; // { from, to, text, type, timestamp }

io.on('connection', (socket) => {
    console.log('Пользователь подключился:', socket.id);

    // Регистрация/Вход
    socket.on('login', (username) => {
        users[socket.id] = { id: socket.id, username: username.toLowerCase() };
        socket.emit('login_success', users[socket.id]);
        io.emit('users_update', Object.values(users)); // Обновляем список для всех
    });

    // Изменение юзернейма
    socket.on('change_username', (newUsername) => {
        if (users[socket.id]) {
            users[socket.id].username = newUsername.toLowerCase();
            socket.emit('login_success', users[socket.id]);
            io.emit('users_update', Object.values(users));
        }
    });

    // Поиск
    socket.on('search_users', (query) => {
        const results = Object.values(users).filter(u => 
            u.username.includes(query.toLowerCase()) && u.id !== socket.id
        );
        socket.emit('search_results', results);
    });

    // Отправка сообщений (текст или фото)
    socket.on('send_message', (data) => {
        const msg = {
            from: users[socket.id].username,
            to: data.to,
            content: data.content,
            type: data.type, // 'text' или 'image'
            timestamp: new Date().toISOString()
        };
        messages.push(msg);

        // Ищем socket.id получателя
        const receiver = Object.values(users).find(u => u.username === data.to);
        if (receiver) {
            const receiverSocketId = Object.keys(users).find(key => users[key].id === receiver.id);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('receive_message', msg);
            }
        }
        // Отправляем обратно себе для отображения
        socket.emit('receive_message', msg);
    });

    // Бонус: Индикатор печати
    socket.on('typing', (to) => {
        const receiver = Object.values(users).find(u => u.username === to);
        if (receiver) {
            const receiverSocketId = Object.keys(users).find(key => users[key].id === receiver.id);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('user_typing', users[socket.id].username);
            }
        }
    });

    // Отключение
    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('users_update', Object.values(users));
        console.log('Пользователь отключился');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Voxa-mini работает на порту ${PORT}`);
});
