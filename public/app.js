const socket = io();

// Состояние приложения
let currentUser = null;
let currentChatUser = null;
let typingTimeout = null;

// Элементы DOM
const screens = {
    login: document.getElementById('login-screen'),
    main: document.getElementById('main-screen'),
    chat: document.getElementById('chat-screen')
};

// Функция переключения экранов
function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// 1. ИНИЦИАЛИЗАЦИЯ (Локальная память)
window.onload = () => {
    const savedUser = localStorage.getItem('voxa_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        socket.emit('login', currentUser.username);
    }
};

socket.on('login_success', (user) => {
    currentUser = user;
    localStorage.setItem('voxa_user', JSON.stringify(user));
    document.getElementById('current-username').innerText = `@${user.username}`;
    showScreen('main');
});

// 2. ЛОГИН
document.getElementById('login-btn').addEventListener('click', () => {
    const username = document.getElementById('username-input').value.trim();
    if (username) socket.emit('login', username);
});

// 3. ПОИСК И СПИСОК ЧАТОВ
const searchInput = document.getElementById('search-input');
const usersList = document.getElementById('users-list');

searchInput.addEventListener('input', (e) => {
    socket.emit('search_users', e.target.value);
});

socket.on('search_results', (users) => {
    usersList.innerHTML = '';
    users.forEach(u => {
        const div = document.createElement('div');
        div.className = 'user-item';
        div.innerHTML = `<span>@${u.username}</span> <span class="online">В сети</span>`;
        div.onclick = () => openChat(u.username);
        usersList.appendChild(div);
    });
});

// 4. ПРОФИЛЬ (Смена юзернейма)
document.getElementById('open-profile').onclick = () => document.getElementById('profile-modal').classList.remove('hidden');
document.getElementById('close-profile-btn').onclick = () => document.getElementById('profile-modal').classList.add('hidden');

document.getElementById('save-username-btn').onclick = () => {
    const newName = document.getElementById('new-username').value.trim();
    if (newName) socket.emit('change_username', newName);
    document.getElementById('profile-modal').classList.add('hidden');
};

// 5. ЧАТ И СООБЩЕНИЯ
function openChat(username) {
    currentChatUser = username;
    document.getElementById('chat-with-name').innerText = `@${username}`;
    document.getElementById('chat-messages').innerHTML = ''; // Для мини-версии очищаем при входе
    showScreen('chat');
}

document.getElementById('back-btn').onclick = () => {
    currentChatUser = null;
    showScreen('main');
};

// Отправка текста
const msgInput = document.getElementById('message-input');
document.getElementById('send-btn').onclick = sendMessage;

function sendMessage() {
    const text = msgInput.value.trim();
    if (text && currentChatUser) {
        socket.emit('send_message', { to: currentChatUser, content: text, type: 'text' });
        msgInput.value = '';
    }
}

// Отправка фото
document.getElementById('file-input').addEventListener('change', function() {
    const file = this.files[0];
    if (file && currentChatUser) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Image = e.target.result;
            socket.emit('send_message', { to: currentChatUser, content: base64Image, type: 'image' });
        };
        reader.readAsDataURL(file);
    }
});

// Получение сообщений
socket.on('receive_message', (msg) => {
    if (currentChatUser === msg.from || currentChatUser === msg.to) {
        const chatArea = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.className = `msg ${msg.from === currentUser.username ? 'my' : 'their'}`;
        
        if (msg.type === 'text') {
            div.innerText = msg.content;
        } else {
            const img = document.createElement('img');
            img.src = msg.content;
            div.appendChild(img);
        }
        
        chatArea.appendChild(div);
        chatArea.scrollTop = chatArea.scrollHeight;
    } else {
        // Если сообщение пришло от того, с кем мы не в чате — можно добавить кружочек-уведомление (оставим на будущее)
    }
});

// Бонус: Индикатор печати
msgInput.addEventListener('input', () => {
    if (currentChatUser) socket.emit('typing', currentChatUser);
});

socket.on('user_typing', (username) => {
    if (currentChatUser === username) {
        const indicator = document.getElementById('typing-indicator');
        indicator.innerText = 'печатает...';
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => { indicator.innerText = ''; }, 1500);
    }
});
