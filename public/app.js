const socket = io();
let me = null;
let currentChat = null;
let isRegMode = false;

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

// 2. Поиск
function doSearch() {
    const q = document.getElementById('search-in').value;
    if (q.length > 0) socket.emit('search', q);
}

socket.on('search_results', users => {
    const list = document.getElementById('contacts-list');
    list.innerHTML = '';
    users.forEach(u => {
        const item = document.createElement('div');
        item.className = 'contact-item glass';
        item.innerHTML = `<div class="avatar-circle sm" style="background-image:url(${u.avatar || ''})"></div> <b>@${u.username}</b>`;
        item.onclick = () => openChat(u);
        list.appendChild(item);
    });
});

// 3. Чат
function openChat(user) {
    currentChat = user.username;
    document.getElementById('chat-title').innerText = '@' + user.username;
    document.getElementById('chat-avatar').style.backgroundImage = `url(${user.avatar || ''})`;
    document.getElementById('chat-flow').innerHTML = '';
    showView('chat-screen');
}

function closeChat() { showView('main-screen'); currentChat = null; }

function sendTxt() {
    const text = document.getElementById('msg-in').value;
    if (!text || !currentChat) return;
    socket.emit('msg', { to: currentChat, text, type: 'text' });
    document.getElementById('msg-in').value = '';
}

function sendImg() {
    const file = document.getElementById('img-in').files[0];
    const reader = new FileReader();
    reader.onload = () => socket.emit('msg', { to: currentChat, text: reader.result, type: 'img' });
    reader.readAsDataURL(file);
}

socket.on('msg_receive', m => {
    if (m.from === me.username || m.to === me.username) {
        if (currentChat === m.from || currentChat === m.to) {
            const flow = document.getElementById('chat-flow');
            const div = document.createElement('div');
            div.className = `msg ${m.from === me.username ? 'my' : 'their'}`;
            div.innerHTML = m.type === 'text' ? m.text : `<img src="${m.text}">`;
            flow.appendChild(div);
            flow.scrollTop = flow.scrollHeight;
        }
        // Авто-добавление в список чатов здесь можно реализовать через отдельный список
    }
});

socket.on('chat_history', history => {
    // Можно отрисовать последние чаты на главном экране
});

// 4. Профиль
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

function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// Авто-вход
const saved = localStorage.getItem('voxa_auth');
if (saved) {
    const p = JSON.parse(saved);
    socket.emit('auth', { login: p.l, password: p.p, isReg: false });
}
