// two-party.js
// Handles two independent user panels (A and B) in the same page.

const $ = (id) => document.getElementById(id);

// Reuse helpers similar to main.js but keep local scope for two-party engines
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

function addPanelMessage(containerId, direction, text) {
  const container = $(containerId);
  const div = document.createElement('div');
  div.className = `msg ${direction === 'me' ? 'me' : 'peer'}`;
  div.textContent = `${direction === 'me' ? 'You: ' : ''}${text}`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function ensureRsaKeysFor(username) {
  const storedPrivate = localStorage.getItem(`rsa_private_${username}`);
  const storedPublic = localStorage.getItem(`rsa_public_${username}`);
  const storedEncryptPrivate = localStorage.getItem(`rsa_private_encrypt_${username}`);
  const storedEncryptPublic = localStorage.getItem(`rsa_public_encrypt_${username}`);
  if (storedPrivate && storedPublic) {
    const privateKey = await crypto.subtle.importKey('pkcs8', base64ToBuffer(storedPrivate), { name: 'RSA-PSS', hash: 'SHA-256' }, true, ['sign']);
    const publicKey = await crypto.subtle.importKey('spki', base64ToBuffer(storedPublic), { name: 'RSA-PSS', hash: 'SHA-256' }, true, ['verify']);
    const privateEncryptKey = storedEncryptPrivate ? await crypto.subtle.importKey('pkcs8', base64ToBuffer(storedEncryptPrivate), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt']) : null;
    const publicEncryptKey = storedEncryptPublic ? await crypto.subtle.importKey('spki', base64ToBuffer(storedEncryptPublic), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']) : null;
    return {
      privateKey, publicKey,
      privateEncryptKey, publicEncryptKey,
      publicKeySpki: storedPublic, publicEncryptKeySpki: storedEncryptPublic
    };
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
  localStorage.setItem(`rsa_private_${username}`, bufferToBase64(privatePkcs8));
  localStorage.setItem(`rsa_public_${username}`, bufferToBase64(publicSpki));
  localStorage.setItem(`rsa_private_encrypt_${username}`, bufferToBase64(privateEncryptPkcs8));
  localStorage.setItem(`rsa_public_encrypt_${username}`, bufferToBase64(publicEncryptSpki));

  // publish public key via API
  try { await api.savePublicKey(username, bufferToBase64(publicSpki), bufferToBase64(publicEncryptSpki), 'RSA'); } catch (e) { console.warn('publish key failed', e); }

  return {
    privateKey: keyPairSign.privateKey,
    publicKey: keyPairSign.publicKey,
    privateEncryptKey: keyPairEncrypt.privateKey,
    publicEncryptKey: keyPairEncrypt.publicKey,
    publicKeySpki: bufferToBase64(publicSpki),
    publicEncryptKeySpki: bufferToBase64(publicEncryptSpki)
  };
}

async function getPublicEncryptKeyFor(username) {
  const resp = await api.getPublicKey(username);
  if (!resp || !resp.encryptPublicKey) throw new Error('No public encrypt key for ' + username);
  return await crypto.subtle.importKey('spki', base64ToBuffer(resp.encryptPublicKey), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']);
}

async function encryptForRecipient(plaintext, recipientUsername) {
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
  const recipientKey = await getPublicEncryptKeyFor(recipientUsername);
  const encryptedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, recipientKey, rawAesKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(plaintext));
  return {
    ciphertext: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv),
    encryptedKey: bufferToBase64(encryptedKey)
  };
}

async function signWithPrivate(privateKey, text) {
  const encoded = new TextEncoder().encode(text);
  const sig = await crypto.subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, privateKey, encoded);
  return bufferToBase64(sig);
}

async function decryptIncoming(packet, privateEncryptKey) {
  const aesRaw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateEncryptKey, base64ToBuffer(packet.encryptedKey));
  const aesKey = await crypto.subtle.importKey('raw', aesRaw, { name: 'AES-GCM' }, false, ['decrypt']);
  const plaintextBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBuffer(packet.iv) }, aesKey, base64ToBuffer(packet.ciphertext));
  return new TextDecoder().decode(plaintextBuf);
}

// Engine factory for a panel
function createEngine(panelIdPrefix) {
  return {
    username: null,
    token: null,
    socket: null,
    keys: null,
    panel: panelIdPrefix
  };
}

const A = createEngine('a');
const B = createEngine('b');

async function connectSocketFor(engine) {
  if (!engine.token) throw new Error('missing token');
  engine.socket = io({ auth: { token: engine.token } });
  engine.socket.on('connect', () => {
    $(`${engine.panel}Status`).textContent = `Connected as ${engine.username}`;
  });
  engine.socket.on('disconnect', () => {
    $(`${engine.panel}Status`).textContent = `Disconnected`;
  });
  engine.socket.on('secure-message', async (packet) => {
    try {
      if (!engine.keys || !engine.keys.privateEncryptKey) {
        const stored = localStorage.getItem(`rsa_private_encrypt_${engine.username}`);
        if (!stored) throw new Error('no private decrypt key');
        engine.keys.privateEncryptKey = await crypto.subtle.importKey('pkcs8', base64ToBuffer(stored), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt']);
      }
      const plaintext = await decryptIncoming(packet, engine.keys.privateEncryptKey);
      addPanelMessage(`${engine.panel}Messages`, 'peer', `${packet.senderUsername}: ${plaintext}`);
      // persist proof via api
      await api.saveProof({ type: 'receive', senderUsername: packet.senderUsername, recipientUsername: packet.recipientUsername, ciphertext: packet.ciphertext, decryptedText: plaintext, hash: packet.hash, signature: packet.signature, status: 'received', createdAt: new Date().toISOString() });
    } catch (err) {
      addPanelMessage(`${engine.panel}Messages`, 'peer', `Decrypt error: ${err.message}`);
    }
  });
}

async function onRegister(engine, username, password) {
  const res = await api.register(username, password);
  if (!res || !res.token) throw new Error(res.error || 'register failed');
  engine.username = res.username;
  engine.token = res.token;
  engine.keys = await ensureRsaKeysFor(engine.username);
  await connectSocketFor(engine);
  $(`${engine.panel}Status`).textContent = `Registered & connected as ${engine.username}`;
}

async function onLogin(engine, username, password) {
  const res = await api.login(username, password);
  if (!res || !res.token) throw new Error(res.error || 'login failed');
  engine.username = res.username;
  engine.token = res.token;
  // ensure keys exist / published
  engine.keys = await ensureRsaKeysFor(engine.username);
  await connectSocketFor(engine);
  $(`${engine.panel}Status`).textContent = `Logged in & connected as ${engine.username}`;
}

function onLogout(engine) {
  if (engine.socket) engine.socket.disconnect();
  engine.username = null; engine.token = null; engine.keys = null; engine.socket = null;
  $(`${engine.panel}Status`).textContent = 'Not logged in';
}

async function onSend(engine, to, text) {
  if (!engine.username || !engine.token) { showToast('Please login first for this panel', 'warning'); return; }
  if (!to || !text) { showToast('Provide recipient and text', 'warning'); return; }
  try {
    addPanelMessage(`${engine.panel}Messages`, 'me', text);
    const enc = await encryptForRecipient(text, to);
    const hash = await digestSha256(text);
    const signature = await signWithPrivate(engine.keys.privateKey, text);
    const packet = {
      toUid: to,
      senderUsername: engine.username,
      recipientUsername: to,
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      hash,
      encryptedKey: enc.encryptedKey,
      signature,
      encryptedPreview: enc.ciphertext.slice(0, 24),
      timestamp: new Date().toISOString()
    };
    engine.socket.emit('secure-message', packet);
    await api.saveProof({ type: 'send', senderUsername: engine.username, recipientUsername: to, ciphertext: enc.ciphertext, hash, signature, status: 'sent', createdAt: new Date().toISOString() });
    showToast(`Sent from ${engine.username} → ${to}`, 'success');
  } catch (err) {
    addPanelMessage(`${engine.panel}Messages`, 'me', `Send error: ${err.message}`);
  }
}

// Wire UI events
window.addEventListener('load', () => {
  // Panel A
  $('aRegister').addEventListener('click', async () => {
    try {
      const u = $('aUsername').value.trim(); const p = $('aPassword').value;
      if (!u || !p) { showToast('Provide username/password', 'warning'); return; }
      await onRegister(A, u, p);
    } catch (e) { showToast(e.message || 'register failed', 'error'); }
  });
  $('aLogin').addEventListener('click', async () => {
    try { const u = $('aUsername').value.trim(); const p = $('aPassword').value; if (!u||!p){showToast('Provide username/password','warning');return;} await onLogin(A,u,p);} catch(e){showToast(e.message||'login failed','error');}
  });
  $('aLogout').addEventListener('click', () => onLogout(A));
  $('aSend').addEventListener('click', async () => { await onSend(A, $('aTo').value.trim(), $('aText').value.trim()); $('aText').value=''; });

  // Panel B
  $('bRegister').addEventListener('click', async () => {
    try { const u = $('bUsername').value.trim(); const p = $('bPassword').value; if (!u||!p){showToast('Provide username/password','warning');return;} await onRegister(B,u,p);} catch(e){showToast(e.message||'register failed','error');}
  });
  $('bLogin').addEventListener('click', async () => {
    try { const u = $('bUsername').value.trim(); const p = $('bPassword').value; if (!u||!p){showToast('Provide username/password','warning');return;} await onLogin(B,u,p);} catch(e){showToast(e.message||'login failed','error');}
  });
  $('bLogout').addEventListener('click', () => onLogout(B));
  $('bSend').addEventListener('click', async () => { await onSend(B, $('bTo').value.trim(), $('bText').value.trim()); $('bText').value=''; });
});
