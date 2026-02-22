const socket = io();
let me = null;
let currentChat = null;
let isRegMode = false;
let allMessages = [];
let pendingImage = null;
let typingTimeout = null;

function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function getAvStyle(user) {
    if (user.avatar) return `background-image:url(${user.avatar})`;
    let hash = 0;
    for (let i = 0; i < user.username.length; i++) hash = user.username.charCodeAt(i) + ((hash << 5) - hash);
    return `background-color: hsl(${Math.abs(hash) % 360}, 60%, 70%)`;
}

// АВТОРИЗАЦИЯ
function toggleAuth(reg) {
    isRegMode = reg;
    document.getElementById('t-login').className = reg ? '' : 'active';
    document.getElementById('t-reg').className = reg ? 'active' : '';
    document.getElementById('usr-in').classList.toggle('hidden', !reg);
}

function doAuth() {
    const data = {
        login: document.getElementById('log-in').value.trim(),
        password: document.getElementById('pas-in').value.trim(),
        username: document.getElementById('usr-in').value.trim(),
        isReg: isRegMode
    };
    if(!data.login || !data.password) return alert("Заполни поля");
    socket.emit('auth', data);
}

socket.on('auth_error', err => {
    // Показываем ошибку только если пользователь сам нажал кнопку, а не при авто-входе
    if (document.getElementById('auth-screen').classList.contains('active')) {
        alert(err);
    }
});

socket.on('auth_success', user => {
    me = user;
    localStorage.setItem('voxa_auth', JSON.stringify({l:user.login, p:user.password}));
    renderProfile();
    showView('main-screen');
});

// ПОИСК
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
    const st = getAvStyle(user);
    const letter = user.avatar ? '' : user.username.charAt(0).toUpperCase();
    item.innerHTML = `
        <div class="avatar-circle sm" style="${st}">${letter}</div>
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
    partners.reverse().forEach(p => {
        const chatMsgs = allMessages.filter(m => m.from === p || m.to === p);
        const last = chatMsgs[chatMsgs.length - 1];
        const prefix = last.from === me.username ? "Вы: " : "";
        renderUserItem({ username: p, lastMsg: prefix + (last.type === 'text' ? last.text : '📷 Фото') }, list);
    });
}

// ЧАТ
function openChat(user) {
    currentChat = user.username;
    document.getElementById('chat-title').innerText = '@' + user.username;
    const st = getAvStyle(user);
    document.getElementById('chat-avatar').style = st;
    document.getElementById('chat-avatar').innerText = user.avatar ? '' : user.username.charAt(0).toUpperCase();
    showView('chat-screen');
    renderMessages();
}

function renderMessages() {
    const flow = document.getElementById('chat-flow');
    flow.innerHTML = '';
    allMessages.filter(m => (m.from === me.username && m.to === currentChat) || (m.to === me.username && m.from === currentChat))
               .forEach(m => {
                    const div = document.createElement('div');
                    div.className = `msg ${m.from === me.username ? 'my' : 'their'}`;
                    div.innerHTML = m.type === 'text' ? m.text : `<img src="${m.text}" style="max-width:100%; border-radius:10px;">`;
                    flow.appendChild(div);
               });
    flow.scrollTop = flow.scrollHeight;
}

function sendTxt() {
    const txt = document.getElementById('msg-in').value.trim();
    if (txt) {
        socket.emit('msg', { to: currentChat, text: txt, type: 'text' });
        document.getElementById('msg-in').value = '';
    }
}

function closeChat() { showView('main-screen'); currentChat = null; renderChatList(); }

// ПРОФИЛЬ
function showProfile(s) { document.getElementById('profile-modal').classList.toggle('hidden', !s); }
function renderProfile() {
    document.getElementById('my-name').innerText = 'Чаты';
    const st = getAvStyle(me);
    document.getElementById('my-avatar').style = st;
    document.getElementById('my-avatar').innerText = me.avatar ? '' : me.username.charAt(0).toUpperCase();
    document.getElementById('prof-preview').style = st;
    document.getElementById('prof-preview').innerText = me.avatar ? '' : me.username.charAt(0).toUpperCase();
    document.getElementById('prof-user-label').innerText = '@' + me.username;
}
function logout() { localStorage.clear(); location.reload(); }

// СОКЕТЫ
socket.on('chat_history', h => { allMessages = h; renderChatList(); });
socket.on('msg_receive', m => { 
    allMessages.push(m); 
    if (currentChat === m.from || currentChat === m.to) renderMessages();
    else renderChatList();
});

// ПРОВЕРКА АВТО-ВХОДА (ИСПРАВЛЕНО)
const saved = localStorage.getItem('voxa_auth');
if (saved) {
    const p = JSON.parse(saved);
    if(p.l && p.p) socket.emit('auth', { login: p.l, password: p.p, isReg: false });
}
