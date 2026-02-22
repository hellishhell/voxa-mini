const socket = io();
let me = null;
let currentChat = null;
let isRegMode = false;
let allMessages = []; // Локальное хранилище всех сообщений

// ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ
function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// 1. АВТОРИЗАЦИЯ
function toggleAuth(reg) {
    isRegMode = reg;
    document.getElementById('t-login').className = reg ? '' : 'active';
    document.getElementById('t-reg').className = reg ? 'active' : '';
    document.getElementById('usr-in').className = reg ? 'ios-input' : 'ios-input hidden';
}

function doAuth() {
    const data = {
        login: document.getElementById('log-in').value,
        password: document.getElementById('pas-in').value,
        username: document.getElementById('usr-in').value,
        isReg: isRegMode
    };
    if (!data.login || !data.password) return alert('Заполни поля');
    socket.emit('auth', data);
}

socket.on('auth_error', err => alert(err));
socket.on('auth_success', user => {
    me = user;
    localStorage.setItem('voxa_auth', JSON.stringify({l:user.login, p:user.password}));
    renderProfile();
    showView('main-screen');
});

// 2. ЛОГИКА СПИСКА ЧАТОВ И ПОИСКА
function doSearch() {
    const q = document.getElementById('search-in').value.trim();
    if (q.length > 0) {
        socket.emit('search', q);
    } else {
        renderChatList(); // Если поле пустое, возвращаем список активных чатов
    }
}

socket.on('search_results', users => {
    const list = document.getElementById('contacts-list');
    list.innerHTML = '<p style="padding:10px; opacity:0.6">Результаты поиска:</p>';
    users.forEach(u => renderUserItem(u, list));
});

// Отрисовка элемента пользователя в списке
function renderUserItem(user, container) {
    const item = document.createElement('div');
    item.className = 'contact-item glass';
    item.innerHTML = `
        <div class="avatar-circle sm" style="background-image:url(${user.avatar || ''})"></div>
        <div class="contact-info">
            <b>@${user.username}</b>
            <span class="last-msg">${user.lastMsg || 'Нажми, чтобы написать'}</span>
        </div>
    `;
    item.onclick = () => openChat(user);
    container.appendChild(item);
}

// Рендер списка активных чатов (с кем уже есть переписка)
function renderChatList() {
    const list = document.getElementById('contacts-list');
    list.innerHTML = '';
    
    // Получаем уникальных собеседников
    const partners = new Set();
    allMessages.forEach(m => {
        if (m.from !== me.username) partners.add(m.from);
        if (m.to !== me.username) partners.add(m.to);
    });

    if (partners.size === 0) {
        list.innerHTML = '<div style="text-align:center; margin-top:50px; opacity:0.5">У вас пока нет чатов.<br>Используйте поиск выше.</div>';
        return;
    }

    partners.forEach(p => {
        const lastMsg = allMessages.filter(m => m.from === p || m.to === p).pop();
        renderUserItem({
            username: p,
            avatar: '', // В идеале сервер должен отдавать аватарки активных чатов тоже
            lastMsg: lastMsg ? (lastMsg.type === 'text' ? lastMsg.text : '📷 Фотография') : ''
        }, list);
    });
}

// 3. ЧАТ
function openChat(user) {
    currentChat = user.username;
    document.getElementById('chat-title').innerText = '@' + user.username;
    document.getElementById('chat-avatar').style.backgroundImage = `url(${user.avatar || ''})`;
    showView('chat-screen');
    renderMessages(); // Загружаем сообщения из локального allMessages
}

function renderMessages() {
    const flow = document.getElementById('chat-flow');
    flow.innerHTML = '';
    const myHistory = allMessages.filter(m => 
        (m.from === me.username && m.to === currentChat) || 
        (m.to === me.username && m.from === currentChat)
    );
    myHistory.forEach(appendMessageUI);
}

function appendMessageUI(m) {
    const flow = document.getElementById('chat-flow');
    const div = document.createElement('div');
    div.className = `msg ${m.from === me.username ? 'my' : 'their'}`;
    div.innerHTML = m.type === 'text' ? m.text : `<img src="${m.text}">`;
    flow.appendChild(div);
    flow.scrollTop = flow.scrollHeight;
}

function closeChat() { 
    showView('main-screen'); 
    currentChat = null; 
    renderChatList(); // Обновляем список чатов на главной
}

// СООБЩЕНИЯ (ПОЛУЧЕНИЕ И ОТПРАВКА)
socket.on('chat_history', history => {
    allMessages = history;
    renderChatList();
});

socket.on('msg_receive', m => {
    allMessages.push(m);
    if (currentChat === m.from || currentChat === m.to) {
        appendMessageUI(m);
    } else {
        renderChatList(); // Обновляем превью на главной, если мы не в этом чате
    }
});

function sendTxt() {
    const text = document.getElementById('msg-in').value.trim();
    if (!text || !currentChat) return;
    socket.emit('msg', { to: currentChat, text, type: 'text' });
    document.getElementById('msg-in').value = '';
}

function sendImg() {
    const file = document.getElementById('img-in').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => socket.emit('msg', { to: currentChat, text: reader.result, type: 'img' });
    reader.readAsDataURL(file);
}

// ПРОФИЛЬ (БЕЗ ИЗМЕНЕНИЙ)
function showProfile(show) { document.getElementById('profile-modal').classList.toggle('hidden', !show); }
function renderProfile() {
    document.getElementById('my-name').innerText = '@' + me.username;
    document.getElementById('prof-user-label').innerText = '@' + me.username;
    const av = me.avatar ? `url(${me.avatar})` : '';
    document.getElementById('my-avatar').style.backgroundImage = av;
    document.getElementById('prof-preview').style.backgroundImage = av;
}
function changeUser() {
    const n = prompt('Новый @username:');
    if (n) socket.emit('update_profile', { username: n });
}
function updateAv(input) {
    const reader = new FileReader();
    reader.onload = () => socket.emit('update_profile', { avatar: reader.result });
    reader.readAsDataURL(input.files[0]);
}
function logout() { localStorage.clear(); location.reload(); }

// АВТО-ВХОД
const saved = localStorage.getItem('voxa_auth');
if (saved) {
    const p = JSON.parse(saved);
    socket.emit('auth', { login: p.l, password: p.p, isReg: false });
}
