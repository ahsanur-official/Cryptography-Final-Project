const api = {
  register: (u, p) => fetch('/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) }).then((r) => r.json()),
  login: (u, p) => fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) }).then((r) => r.json()),
  savePublicKey: (username, signPublicKey, encryptPublicKey, publicKeyType) => fetch('/api/public-key', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, signPublicKey, encryptPublicKey, publicKeyType }) }).then((r) => r.json()),
  getPublicKey: (username) => fetch(`/api/public-key/${encodeURIComponent(username)}`).then((r) => r.json()),
  saveProof: (proof) => fetch('/api/proofs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(proof) }).then((r) => r.json()),
  getProofs: () => fetch('/api/proofs').then((r) => r.json())
};

const $ = (id) => document.getElementById(id);

// Toast Notification System
function createToastContainer() {
  if (!document.querySelector('.toast-container')) {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return document.querySelector('.toast-container');
}

function showToast(message, type = 'info', duration = 4000) {
  const container = createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  
  toast.innerHTML = `
    <div class="toast-icon">${icons[type]}</div>
    <div class="toast-message">${message}</div>
    <button class="toast-close">✕</button>
    <div class="toast-progress" style="animation: shrink ${duration}ms linear forwards;"></div>
  `;
  
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  });
  
  container.appendChild(toast);
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

// Add animation to CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes shrink {
    from { width: 100%; }
    to { width: 0%; }
  }
`;
document.head.appendChild(style);

let socket = null;
let auth = null;
let rsaKeys = null;
let aesKeyCache = new Map();
let conversations = new Map(); // Map of username -> { username, lastMessage, timestamp }
let currentConversation = null;

function bufferToBase64(buffer) {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function digestSha256(text) {
  const encoded = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return bufferToBase64(digest);
}

async function ensureRsaKeys() {
  const storedPrivate = localStorage.getItem(`rsa_private_${auth.username}`);
  const storedPublic = localStorage.getItem(`rsa_public_${auth.username}`);
  const storedEncryptPrivate = localStorage.getItem(`rsa_private_encrypt_${auth.username}`);
  const storedEncryptPublic = localStorage.getItem(`rsa_public_encrypt_${auth.username}`);
  if (storedPrivate && storedPublic) {
    const privateKey = await crypto.subtle.importKey('pkcs8', base64ToBuffer(storedPrivate), { name: 'RSA-PSS', hash: 'SHA-256' }, true, ['sign']);
    const publicKey = await crypto.subtle.importKey('spki', base64ToBuffer(storedPublic), { name: 'RSA-PSS', hash: 'SHA-256' }, true, ['verify']);
    const privateEncryptKey = storedEncryptPrivate ? await crypto.subtle.importKey('pkcs8', base64ToBuffer(storedEncryptPrivate), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt']) : null;
    const publicEncryptKey = storedEncryptPublic ? await crypto.subtle.importKey('spki', base64ToBuffer(storedEncryptPublic), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']) : null;
    rsaKeys = { privateKey, publicKey, privateEncryptKey, publicEncryptKey, publicKeySpki: storedPublic, publicEncryptKeySpki: storedEncryptPublic };
    return rsaKeys;
  }

  const keyPairSign = await crypto.subtle.generateKey(
    { name: 'RSA-PSS', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );
  const keyPairEncrypt = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt']
  );

  const privatePkcs8 = await crypto.subtle.exportKey('pkcs8', keyPairSign.privateKey);
  const publicSpki = await crypto.subtle.exportKey('spki', keyPairSign.publicKey);
  const privateEncryptPkcs8 = await crypto.subtle.exportKey('pkcs8', keyPairEncrypt.privateKey);
  const publicEncryptSpki = await crypto.subtle.exportKey('spki', keyPairEncrypt.publicKey);
  localStorage.setItem(`rsa_private_${auth.username}`, bufferToBase64(privatePkcs8));
  localStorage.setItem(`rsa_public_${auth.username}`, bufferToBase64(publicSpki));
  localStorage.setItem(`rsa_private_encrypt_${auth.username}`, bufferToBase64(privateEncryptPkcs8));
  localStorage.setItem(`rsa_public_encrypt_${auth.username}`, bufferToBase64(publicEncryptSpki));
  rsaKeys = {
    privateKey: keyPairSign.privateKey,
    publicKey: keyPairSign.publicKey,
    privateEncryptKey: keyPairEncrypt.privateKey,
    publicEncryptKey: keyPairEncrypt.publicKey,
    publicKeySpki: bufferToBase64(publicSpki),
    publicEncryptKeySpki: bufferToBase64(publicEncryptSpki)
  };
  await api.savePublicKey(auth.username, rsaKeys.publicKeySpki, rsaKeys.publicEncryptKeySpki, 'RSA');
  return rsaKeys;
}

async function getRecipientEncryptKey(username) {
  if (aesKeyCache.has(username)) return aesKeyCache.get(username);
  const response = await api.getPublicKey(username);
  if (!response || !response.encryptPublicKey) throw new Error(`Public key not found for ${username}`);
  const publicKey = await crypto.subtle.importKey('spki', base64ToBuffer(response.encryptPublicKey), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']);
  aesKeyCache.set(username, publicKey);
  return publicKey;
}

async function signMessage(text) {
  const encoded = new TextEncoder().encode(text);
  const signature = await crypto.subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, rsaKeys.privateKey, encoded);
  return bufferToBase64(signature);
}

async function verifySignature(text, signatureBase64, senderUsername) {
  const senderKeyRecord = await api.getPublicKey(senderUsername);
  if (!senderKeyRecord || !senderKeyRecord.signPublicKey) return false;
  const senderVerifyKey = await crypto.subtle.importKey('spki', base64ToBuffer(senderKeyRecord.signPublicKey), { name: 'RSA-PSS', hash: 'SHA-256' }, true, ['verify']);
  const encoded = new TextEncoder().encode(text);
  return crypto.subtle.verify({ name: 'RSA-PSS', saltLength: 32 }, senderVerifyKey, base64ToBuffer(signatureBase64), encoded);
}

async function encryptMessageForRecipient(plaintext, recipientUsername) {
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
  const recipientKey = await getRecipientEncryptKey(recipientUsername);
  const encryptedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, recipientKey, rawAesKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(plaintext));
  return {
    ciphertext: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv),
    encryptedKey: bufferToBase64(encryptedKey),
    aesKey
  };
}

async function sendSecureMessage(recipientUsername, plaintext, previewTargetSelector, sourceLabel) {
  if (!auth || !socket) throw new Error('Please login first.');
  if (!recipientUsername || !plaintext) throw new Error('Recipient and message are required.');

  try {
    showToast('🔐 Encrypting and signing message...', 'info');
    
    const { ciphertext, iv, encryptedKey } = await encryptMessageForRecipient(plaintext, recipientUsername);
    const hash = await digestSha256(plaintext);
    const signature = await signMessage(plaintext);
    const packet = {
      toUid: recipientUsername,
      senderUsername: auth.username,
      recipientUsername,
      ciphertext,
      iv,
      hash,
      encryptedKey,
      signature,
      encryptedPreview: ciphertext.slice(0, 24),
      timestamp: new Date().toISOString()
    };

    socket.emit('secure-message', packet);
    await api.saveProof({
      type: 'send',
      senderUsername: auth.username,
      recipientUsername,
      ciphertext,
      hash,
      signature,
      status: 'sent',
      createdAt: new Date().toISOString()
    });

    // Add to conversations and render bubble
    if (!conversations.has(recipientUsername)) {
      conversations.set(recipientUsername, {
        username: recipientUsername,
        lastMessage: plaintext.slice(0, 50),
        timestamp: new Date()
      });
    } else {
      conversations.get(recipientUsername).lastMessage = plaintext.slice(0, 50);
      conversations.get(recipientUsername).timestamp = new Date();
    }
    
    if (currentConversation === recipientUsername) {
      addChatBubble($('messages'), 'sent', plaintext, new Date());
    }
    
    populateConversationsList();
    if (previewTargetSelector) {
      $(previewTargetSelector).textContent = `Ciphertext: ${ciphertext.slice(0, 56)}... | Signature: ${signature.slice(0, 24)}...`;
    }
    await refreshProofSummary();
    
    showToast('✓ Message encrypted, signed, and sent!', 'success');
    return { ciphertext, hash, signature };
  } catch (err) {
    showToast(`Failed to send: ${err.message}`, 'error');
    throw err;
  }
}

function populateConversationsList() {
  const conversationsList = $('conversationsList');
  if (conversations.size === 0) {
    conversationsList.innerHTML = '<div class="empty-state">No conversations yet</div>';
    return;
  }
  
  const sorted = Array.from(conversations.values()).sort((a, b) => b.timestamp - a.timestamp);
  conversationsList.innerHTML = sorted.map(conv => `
    <div class="conversation-item ${currentConversation === conv.username ? 'active' : ''}" data-username="${conv.username}">
      <div>
        <div class="conversation-username">${conv.username}</div>
        <div style="font-size: 0.85rem; color: var(--muted);">${conv.lastMessage || 'No messages'}</div>
      </div>
      <div class="conversation-status"></div>
    </div>
  `).join('');
  
  // Add click handlers
  document.querySelectorAll('.conversation-item').forEach(item => {
    item.addEventListener('click', () => {
      selectConversation(item.dataset.username);
    });
  });
}

function selectConversation(username) {
  currentConversation = username;
  $('toUsername').value = username;
  $('chatWithLabel').textContent = `Chat with ${username}`;
  $('messages').innerHTML = ''; // Clear message display
  
  showToast(`Opened conversation with ${username}`, 'info');
  populateConversationsList(); // Update active state
}

async function decryptIncomingMessage(packet) {
  const encryptedKey = base64ToBuffer(packet.encryptedKey);
  if (!rsaKeys.privateEncryptKey) {
    const storedPrivate = localStorage.getItem(`rsa_private_encrypt_${auth.username}`);
    if (!storedPrivate) throw new Error('missing private decrypt key');
    rsaKeys.privateEncryptKey = await crypto.subtle.importKey('pkcs8', base64ToBuffer(storedPrivate), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt']);
  }
  const aesRaw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, rsaKeys.privateEncryptKey, encryptedKey);
  const aesKey = await crypto.subtle.importKey('raw', aesRaw, { name: 'AES-GCM' }, false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBuffer(packet.iv) }, aesKey, base64ToBuffer(packet.ciphertext));
  return new TextDecoder().decode(plaintext);
}

function formatTimestamp(date) {
  if (typeof date === 'string') date = new Date(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function addChatBubble(container, direction, plaintext, timestamp) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${direction}`;
  bubble.innerHTML = `
    <div class="bubble-content">
      <p class="bubble-text">${plaintext}</p>
      <div class="bubble-timestamp">${formatTimestamp(timestamp || new Date())}</div>
    </div>
  `;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function addMessageCard(container, title, details, tone) {
  const card = document.createElement('div');
  card.className = `message-card ${tone}`;
  card.innerHTML = `<h4>${title}</h4><p>${details}</p>`;
  container.prepend(card);
}

async function refreshProofSummary() {
  const res = await api.getProofs();
  const proofs = res.proofs || [];
  if (!proofs.length) {
    $('proofSummary').textContent = 'No proofs yet.';
    return;
  }
  $('proofSummary').innerHTML = proofs.slice(0, 3).map((proof) => `
    <div class="proof-row">
      <strong>${proof.type}</strong>
      <span>${proof.status || 'stored'}</span>
      <small>${proof.senderUsername || proof.username || 'system'} → ${proof.recipientUsername || '-'}</small>
    </div>
  `).join('');
}

async function initializeSession(session) {
  auth = session;
  $('identityLabel').textContent = session.username;
  $('connectionStatus').textContent = 'Online';
  $('workspace').classList.remove('hidden');
  $('authPanel').classList.add('hidden');
  $('keysStatus').textContent = 'Generating RSA keys...';
  
  showToast('🔑 Generating your RSA keypairs...', 'info');
  
  await ensureRsaKeys();
  $('keysStatus').textContent = 'RSA public key published. AES-GCM + RSA-OAEP ready.';
  
  showToast('✓ RSA-2048 keys generated and published', 'success');

  socket = io({ auth: { token: auth.token } });
  socket.on('connect', () => {
    $('connectionStatus').textContent = 'Connected';
    showToast('Real-time connection established ✓', 'success');
  });
  socket.on('connect_error', (err) => {
    $('connectionStatus').textContent = 'Connection error';
    showToast(`Connection error: ${err.message}`, 'warning');
  });
  socket.on('disconnect', () => {
    $('connectionStatus').textContent = 'Disconnected';
    showToast('Disconnected from server', 'info');
  });
  socket.on('secure-message', async (packet) => {
    try {
      const plaintext = await decryptIncomingMessage(packet);
      const hash = await digestSha256(plaintext);
      const signatureOk = await verifySignature(plaintext, packet.signature, packet.senderUsername);
      const hashOk = hash === packet.hash;
      const proof = {
        type: 'receive',
        senderUsername: packet.senderUsername,
        recipientUsername: packet.recipientUsername,
        ciphertext: packet.ciphertext,
        decryptedText: plaintext,
        hash: packet.hash,
        calculatedHash: hash,
        signature: packet.signature,
        signatureVerified: signatureOk,
        hashVerified: hashOk,
        status: signatureOk && hashOk ? 'verified' : 'failed',
        createdAt: new Date().toISOString()
      };
      await api.saveProof(proof);
      
      // Add to conversations
      if (!conversations.has(packet.senderUsername)) {
        conversations.set(packet.senderUsername, {
          username: packet.senderUsername,
          lastMessage: plaintext.slice(0, 50),
          timestamp: new Date()
        });
      } else {
        conversations.get(packet.senderUsername).lastMessage = plaintext.slice(0, 50);
        conversations.get(packet.senderUsername).timestamp = new Date();
      }
      
      // Render bubble if viewing this conversation
      if (currentConversation === packet.senderUsername) {
        addChatBubble($('messages'), 'received', plaintext, packet.timestamp || new Date());
      }
      
      populateConversationsList();
      
      // Show notification
      if (signatureOk && hashOk) {
        showToast(`📨 Message from ${packet.senderUsername}: "${plaintext.slice(0, 40)}..."`, 'success');
      } else {
        showToast(`⚠ Unverified message from ${packet.senderUsername}`, 'warning');
      }
      
      $('proofSummary').innerHTML = `<div class="proof-row"><strong>Verified</strong><span>${signatureOk && hashOk ? 'yes' : 'no'}</span><small>${packet.senderUsername}</small></div>`;
    } catch (err) {
      showToast(`Decrypt error: ${err.message}`, 'error');
    }
  });
  await refreshProofSummary();
}

window.addEventListener('load', () => {
  $('btnRegister').addEventListener('click', async () => {
    const username = $('username').value.trim();
    const password = $('password').value;
    if (!username || !password) {
      showToast('Please enter username and password', 'warning');
      return;
    }
    const response = await api.register(username, password);
    if (response.token) {
      await initializeSession({ token: response.token, username: response.username, uid: response.uid });
      showToast(`Welcome ${response.username}! 🎉`, 'success');
    } else {
      showToast(response.error || 'Registration failed', 'error');
    }
  });

  $('btnLogin').addEventListener('click', async () => {
    const username = $('username').value.trim();
    const password = $('password').value;
    if (!username || !password) {
      showToast('Please enter username and password', 'warning');
      return;
    }
    const response = await api.login(username, password);
    if (response.token) {
      await initializeSession({ token: response.token, username: response.username, uid: response.uid });
      showToast(`Logged in as ${response.username} ✓`, 'success');
      $('authPanel').classList.add('compact');
    } else {
      showToast(response.error || 'Login failed', 'error');
    }
  });

  $('btnSend').addEventListener('click', async () => {
    try {
      const recipientUsername = $('toUsername').value.trim();
      if (!recipientUsername) {
        showToast('Please enter a recipient username', 'warning');
        return;
      }
      const plaintext = $('message').value.trim();
      if (!plaintext) {
        showToast('Message cannot be empty', 'warning');
        return;
      }
      await sendSecureMessage(recipientUsername, plaintext, 'senderPreview', 'Sender');
      $('message').value = '';
      $('message').focus();
      showToast(`Message encrypted and sent to ${recipientUsername} ✓`, 'success');
    } catch (err) {
      showToast(`Send failed: ${err.message}`, 'error');
    }
  });

  $('btnRefreshProofs').addEventListener('click', async () => {
    await refreshProofSummary();
    showToast('Proofs refreshed', 'info');
  });
});
