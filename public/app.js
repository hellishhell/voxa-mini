const socket = io();
let currentUser = null;
let currentChatPartner = null;
let isRegMode = false;

// ПЕРЕКЛЮЧЕНИЕ ТАБОВ
document.getElementById('tab-login-btn').onclick = () => {
    isRegMode = false;
    document.getElementById('auth-username').classList.add('hidden');
    document.getElementById('tab-login-btn').classList.add('active');
    document.getElementById('tab-reg-btn').classList.remove('active');
    document.getElementById('main-auth-btn').innerText = 'Войти';
};

document.getElementById('tab-reg-btn').onclick = () => {
    isRegMode = true;
    document.getElementById('auth-username').classList.remove('hidden');
    document.getElementById('tab-reg-btn').classList.add('active');
    document.getElementById('tab-login-btn').classList.remove('active');
    document.getElementById('main-auth-btn').innerText = 'Создать аккаунт';
};

// АВТОРИЗАЦИЯ
document.getElementById('main-auth-btn').onclick = () => {
    const login = document.getElementById('auth-login').value;
    const pass = document.getElementById('auth-pass').value;
    const username = document.getElementById('auth-username').value;

    if (isRegMode) {
        socket.emit('register', { login, password: pass, username });
    } else {
        socket.emit('login', { login, password: pass });
    }
};

socket.on('auth_success', (user) => {
    currentUser = user;
    localStorage.setItem('voxa_session', JSON.stringify({login: user.login, pass: user.password}));
    renderProfile();
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
});

function renderProfile() {
    document.getElementById('my-display-name').innerText = `@${currentUser.username}`;
    document.getElementById('prof-username').innerText = `@${currentUser.username}`;
    if (currentUser.avatar) {
        document.getElementById('my-avatar-img').src = currentUser.avatar;
        document.getElementById('my-avatar-img').classList.remove('hidden');
        document.getElementById('profile-preview').src = currentUser.avatar;
    }
}

// ВЫХОД
document.getElementById('logout-btn').onclick = () => {
    localStorage.removeItem('voxa_session');
    location.reload();
};

// ПОИСК
document.getElementById('search-input').oninput = (e) => {
    if (e.target.value.length > 0) socket.emit('search_users', e.target.value);
};

socket.on('search_results', (users) => {
    const list = document.getElementById('users-list');
    list.innerHTML = '';
    users.forEach(u => {
        if (u.username === currentUser.username) return;
        const div = document.createElement('div');
        div.className = 'user-item';
        div.style = "padding:15px; background:rgba(255,255,255,0.1); border-radius:15px; margin-bottom:10px; display:flex; align-items:center; gap:10px;";
        div.innerHTML = `<img src="${u.avatar || 'https://via.placeholder.com/40'}" class="avatar-sm"> <span>@${u.username}</span>`;
        div.onclick = () => openChat(u);
        list.appendChild(div);
    });
});

// ЧАТ
function openChat(user) {
    currentChatPartner = user.username;
    document.getElementById('chat-with-name').innerText = `@${user.username}`;
    document.getElementById('chat-avatar').src = user.avatar || 'https://via.placeholder.com/40';
    document.getElementById('chat-avatar').classList.remove('hidden');
    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('main-screen').classList.remove('active');
    document.getElementById('chat-screen').classList.add('active');
    // Запрос истории будет автоматическим, так как сервер хранит все сообщения
}

document.getElementById('back-btn').onclick = () => {
    document.getElementById('chat-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
};

// ОТПРАВКА
document.getElementById('send-btn').onclick = () => {
    const text = document.getElementById('message-input').value;
    if (text) {
        socket.emit('send_message', { to: currentChatPartner, content: text, type: 'text' });
        document.getElementById('message-input').value = '';
    }
};

socket.on('receive_message', (msg) => {
    if ((msg.from === currentUser.username && msg.to === currentChatPartner) || 
        (msg.to === currentUser.username && msg.from === currentChatPartner)) {
        appendMessage(msg);
    }
});

socket.on('history', (msgs) => {
    msgs.forEach(appendMessage);
});

function appendMessage(msg) {
    const area = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `msg ${msg.from === currentUser.username ? 'my' : 'their'}`;
    div.innerText = msg.content;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
}

// СМЕНА АВАТАРА
document.getElementById('avatar-upload').onchange = function(e) {
    const reader = new FileReader();
    reader.onload = () => socket.emit('update_profile', { avatar: reader.result });
    reader.readAsDataURL(e.target.files[0]);
};

// СМЕНА ЮЗЕРНЕЙМА
document.getElementById('edit-un-btn').onclick = () => {
    const newName = prompt("Введите новый @username:");
    if (newName) socket.emit('update_profile', { username: newName });
};

// ОТКРЫТЬ ПРОФИЛЬ
document.getElementById('open-profile').onclick = () => document.getElementById('profile-modal').classList.remove('hidden');
document.getElementById('close-profile-btn').onclick = () => document.getElementById('profile-modal').classList.add('hidden');
