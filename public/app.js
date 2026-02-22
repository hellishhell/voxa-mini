const socket = io();
let me = null;
let currentChat = null;
let isRegMode = false;
let allMessages = [];

function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
}

function getAvStyle(user) {
    if (user && user.avatar) return `background-image:url(${user.avatar})`;
    const name = (user && user.username) ? user.username : "User";
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return `background-color: hsl(${Math.abs(hash) % 360}, 60%, 70%)`;
}

// АВТОРИЗАЦИЯ
function toggleAuth(reg) {
    isRegMode = reg;
    document.getElementById('t-login').classList.toggle('active', !reg);
    document.getElementById('t-reg').classList.toggle('active', reg);
    document.getElementById('usr-in').classList.toggle('hidden', !reg);
    // Очищаем поля при переключении
    document.getElementById('log-in').value = "";
    document.getElementById('pas-in').value = "";
    document.getElementById('usr-in').value = "";
}

function doAuth() {
    const l = document.getElementById('log-in').value.trim();
    const p = document.getElementById('pas-in').value.trim();
    const u = document.getElementById('usr-in').value.trim();

    if(!l || !p) return alert("Введите логин и пароль");
    if(isRegMode && !u) return alert("Введите @username для регистрации");

    const data = {
        login: l,
        password: p,
        username: isRegMode ? u : "",
        isReg: isRegMode
    };

    console.log("Попытка входа/рег:", data);
    socket.emit('auth', data);
}

// Слушаем успешную регистрацию
socket.on('reg_success', () => {
    alert("Регистрация успешна! Теперь войдите в аккаунт.");
    toggleAuth(false); // Переключаем на вход
});

socket.on('auth_error', err => {
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
    users.forEach(u => {
        if(u.username !== me.username) renderUserItem(u, list);
    });
});

function renderUserItem(user, container) {
    const item = document.createElement('div');
    item.className = 'contact-item'; // Убрал лишний класс glass, если его нет в CSS
    const st = getAvStyle(user);
    const letter = user.avatar ? '' : user.username.charAt(0).toUpperCase();
    item.innerHTML = `
        <div class="avatar-circle sm" style="${st}">${letter}</div>
        <div class="contact-info">
            <b style="display:block;">@${user.username}</b>
            <span class="last-msg" style="font-size:13px; color:#888;">${user.lastMsg || 'Написать...'}</span>
        </div>
    `;
    item.onclick = () => openChat(user);
    container.appendChild(item);
}

function renderChatList() {
    const list = document.getElementById('contacts-list');
    list.innerHTML = '';
    if (!allMessages.length) {
        list.innerHTML = '<p style="text-align:center; margin-top:20px; color:#888;">Нет чатов</p>';
        return;
    }
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
    const avatarElem = document.getElementById('chat-avatar');
    avatarElem.style = st;
    avatarElem.innerText = user.avatar ? '' : user.username.charAt(0).toUpperCase();
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
    if (txt && currentChat) {
        socket.emit('msg', { to: currentChat, text: txt, type: 'text' });
        document.getElementById('msg-in').value = '';
    }
}

function closeChat() { showView('main-screen'); currentChat = null; renderChatList(); }

// ПРОФИЛЬ
function showProfile(s) { document.getElementById('profile-modal').classList.toggle('hidden', !s); }

function renderProfile() {
    if(!me) return;
    const st = getAvStyle(me);
    const letter = me.avatar ? '' : me.username.charAt(0).toUpperCase();
    
    document.getElementById('my-avatar').style = st;
    document.getElementById('my-avatar').innerText = letter;
    
    document.getElementById('prof-preview').style = st;
    document.getElementById('prof-preview').innerText = letter;
    
    document.getElementById('prof-user-label').innerText = '@' + me.username;
}

function logout() { 
    localStorage.removeItem('voxa_auth'); 
    location.reload(); 
}

// СОКЕТЫ
socket.on('chat_history', h => { 
    allMessages = h; 
    if(me) renderChatList(); 
});

socket.on('msg_receive', m => { 
    allMessages.push(m); 
    if (currentChat === m.from || currentChat === m.to) renderMessages();
    else renderChatList();
});

// АВТО-ВХОД
window.onload = () => {
    const saved = localStorage.getItem('voxa_auth');
    if (saved) {
        try {
            const p = JSON.parse(saved);
            if(p.l && p.p) socket.emit('auth', { login: p.l, password: p.p, isReg: false });
        } catch(e) {
            localStorage.removeItem('voxa_auth');
        }
    }
};
