const socket = io();
let me = null;
let currentChat = null;
let isRegMode = false;
let allMessages = [];
let pendingImage = null;
let typingTimeout = null;

// Помощник для цвета аватарок
function getAvStyle(user) {
    if (user.avatar) return `background-image:url(${user.avatar})`;
    let hash = 0;
    for (let i = 0; i < user.username.length; i++) hash = user.username.charCodeAt(i) + ((hash << 5) - hash);
    return `background-color: hsl(${Math.abs(hash) % 360}, 65%, 75%)`;
}

// 1. Авторизация
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
    socket.emit('auth', data);
}

socket.on('auth_error', err => alert(err));
socket.on('auth_success', user => {
    me = user;
    localStorage.setItem('voxa_auth', JSON.stringify({l:user.login, p:user.password}));
    renderProfile();
    showView('main-screen');
});

// 2. Поиск и Списки
function doSearch() {
    const q = document.getElementById('search-in').value.trim();
    if (q.length > 0) socket.emit('search', q);
    else renderChatList();
}

socket.on('search_results', users => {
    const list = document.getElementById('contacts-list');
    list.innerHTML = '<p style="padding:10px; opacity:0.5; font-size:12px;">Глобальный поиск</p>';
    users.forEach(u => renderUserItem(u, list));
});

function renderUserItem(user, container) {
    const item = document.createElement('div');
    item.className = 'contact-item glass';
    const avStyle = getAvStyle(user);
    const letter = user.avatar ? '' : user.username.charAt(0).toUpperCase();
    
    item.innerHTML = `
        <div class="avatar-circle sm" style="${avStyle}">${letter}</div>
        <div class="contact-info">
            <b>@${user.username}</b>
            <span class="last-msg">${user.lastMsg || 'Написать...'}</span>
        </div>
    `;
    item.onclick = () => openChat(user);
    container.appendChild(item);
}

function renderChatList() {
    const list = document.getElementById('contacts-list');
    list.innerHTML = '';
    const partners = [...new Set(allMessages.map(m => m.from === me.username ? m.to : m.from))];

    if (partners.length === 0) {
        list.innerHTML = '<div style="text-align:center;margin-top:40px;opacity:0.5">Нет чатов</div>';
        return;
    }

    partners.reverse().forEach(p => {
        const chatMsgs = allMessages.filter(m => m.from === p || m.to === p);
        const last = chatMsgs[chatMsgs.length - 1];
        const prefix = last.from === me.username ? "Вы: " : "";
        renderUserItem({
            username: p,
            lastMsg: prefix + (last.type === 'text' ? last.text : '📷 Фото')
        }, list);
    });
}

// 3. Чат
function openChat(user) {
    currentChat = user.username;
    document.getElementById('chat-title').innerText = '@' + user.username;
    const avStyle = getAvStyle(user);
    document.getElementById('chat-avatar').style = avStyle;
    document.getElementById('chat-avatar').innerText = user.avatar ? '' : user.username.charAt(0).toUpperCase();
    showView('chat-screen');
    renderMessages();
}

function renderMessages() {
    const flow = document.getElementById('chat-flow');
    flow.innerHTML = '';
    allMessages.filter(m => (m.from === me.username && m.to === currentChat) || (m.to === me.username && m.from === currentChat))
               .forEach(appendMsgUI);
}

function appendMsgUI(m) {
    const flow = document.getElementById('chat-flow');
    const div = document.createElement('div');
    div.className = `msg ${m.from === me.username ? 'my' : 'their'}`;
    div.innerHTML = m.type === 'text' ? m.text : `<img src="${m.text}">`;
    flow.appendChild(div);
    flow.scrollTop = flow.scrollHeight;
}

// Отправка и Типизация
function notifyTyping() {
    if (currentChat) socket.emit('typing', { from: me.username, to: currentChat });
}

socket.on('is_typing', data => {
    if (currentChat === data.from && data.to === me.username) {
        document.getElementById('typing-status').innerText = 'печатает...';
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => document.getElementById('typing-status').innerText = 'в сети', 2000);
    }
});

function handleFileSelect(input) {
    const reader = new FileReader();
    reader.onload = (e) => {
        pendingImage = e.target.result;
        document.getElementById('image-preview-img').src = pendingImage;
        document.getElementById('image-preview-container').classList.remove('hidden');
    };
    reader.readAsDataURL(input.files[0]);
}

function cancelImage() {
    pendingImage = null;
    document.getElementById('image-preview-container').classList.add('hidden');
    document.getElementById('img-in').value = '';
}

function sendTxt() {
    const txt = document.getElementById('msg-in').value.trim();
    if (pendingImage) {
        socket.emit('msg', { to: currentChat, text: pendingImage, type: 'img' });
        cancelImage();
    }
    if (txt) {
        socket.emit('msg', { to: currentChat, text: txt, type: 'text' });
        document.getElementById('msg-in').value = '';
    }
}

// Служебные
socket.on('chat_history', h => { allMessages = h; renderChatList(); });
socket.on('msg_receive', m => { 
    allMessages.push(m); 
    if (currentChat === m.from || currentChat === m.to) appendMsgUI(m);
    else renderChatList();
});

function closeChat() { showView('main-screen'); currentChat = null; renderChatList(); }
function showProfile(s) { document.getElementById('profile-modal').classList.toggle('hidden', !s); }
function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}
function renderProfile() {
    document.getElementById('my-name').innerText = '@' + me.username;
    document.getElementById('prof-user-label').innerText = '@' + me.username;
    const av = getAvStyle(me);
    document.getElementById('my-avatar').style = av;
    document.getElementById('my-avatar').innerText = me.avatar ? '' : me.username.charAt(0).toUpperCase();
    document.getElementById('prof-preview').style = av;
    document.getElementById('prof-preview').innerText = me.avatar ? '' : me.username.charAt(0).toUpperCase();
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

const saved = localStorage.getItem('voxa_auth');
if (saved) {
    const p = JSON.parse(saved);
    socket.emit('auth', { login: p.l, password: p.p, isReg: false });
}
