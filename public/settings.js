// Settings Page Management
document.addEventListener('DOMContentLoaded', async () => {
  const navbarContainer = document.getElementById('navbar-container');
  const navbarResponse = await fetch('/navbar.html');
  navbarContainer.innerHTML = await navbarResponse.text();
  initializeNavbar();
  
  const auth = JSON.parse(localStorage.getItem('auth_session') || 'null');
  if (!auth || !auth.token) {
    window.location.href = '/';
    return;
  }
  
  loadSettings(auth);
  loadKeysDisplay(auth.username);
});

async function loadSettings(auth) {
  document.getElementById('settingsUsername').textContent = auth.username;
  document.getElementById('settingsEmail').textContent = auth.email || 'No email set';
  document.getElementById('settingsFullName').textContent = auth.fullName || 'No name set';
  document.getElementById('settingsRole').textContent = auth.role || 'User';
}

async function editUsername() {
  const auth = JSON.parse(localStorage.getItem('auth_session') || 'null');
  if (!auth || !auth.token) {
    showToast('You must be logged in to change username', 'warning');
    return;
  }

  const currentUsername = auth.username;
  const newUsername = prompt('Enter new username:', currentUsername);
  if (newUsername === null) return;

  const normalized = newUsername.trim();
  if (!normalized) {
    showToast('Username cannot be empty', 'warning');
    return;
  }
  if (normalized === currentUsername) {
    showToast('Username unchanged', 'info');
    return;
  }

  try {
    const response = await fetch('/api/profile/username', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${auth.token}`
      },
      body: JSON.stringify({ newUsername: normalized })
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.error || 'Failed to update username', 'error');
      return;
    }

    // migrate localStorage key material to the new username prefix
    migrateCryptoKeys(currentUsername, normalized);

    const updatedAuth = {
      ...auth,
      username: data.username,
      token: data.token
    };
    localStorage.setItem('auth_session', JSON.stringify(updatedAuth));
    localStorage.setItem('auth_token', data.token);

    document.getElementById('settingsUsername').textContent = data.username;
    showToast('Username updated successfully', 'success');

    setTimeout(() => {
      window.location.reload();
    }, 900);
  } catch (err) {
    showToast(`Username update error: ${err.message}`, 'error');
  }
}

function migrateCryptoKeys(oldUsername, newUsername) {
  const mappings = [
    ['rsa_private_', 'rsa_private_'],
    ['rsa_public_', 'rsa_public_'],
    ['rsa_private_encrypt_', 'rsa_private_encrypt_'],
    ['rsa_public_encrypt_', 'rsa_public_encrypt_']
  ];

  mappings.forEach(([prefix]) => {
    const value = localStorage.getItem(`${prefix}${oldUsername}`);
    if (value) {
      localStorage.setItem(`${prefix}${newUsername}`, value);
      localStorage.removeItem(`${prefix}${oldUsername}`);
    }
  });
}

async function loadKeysDisplay(username) {
  const signingKey = localStorage.getItem(`rsa_public_${username}`);
  const encryptionKey = localStorage.getItem(`rsa_public_encrypt_${username}`);
  
  if (signingKey) {
    document.getElementById('rsaSigningKey').textContent = signingKey.slice(0, 100) + '...';
  }
  
  if (encryptionKey) {
    document.getElementById('rsaEncryptionKey').textContent = encryptionKey.slice(0, 100) + '...';
  }
}

function editEmail() {
  const currentEmail = document.getElementById('settingsEmail').textContent;
  const newEmail = prompt('Enter new email address:', currentEmail === 'No email set' ? '' : currentEmail);
  
  if (newEmail !== null) {
    const auth = JSON.parse(localStorage.getItem('auth_session'));
    auth.email = newEmail;
    localStorage.setItem('auth_session', JSON.stringify(auth));
    document.getElementById('settingsEmail').textContent = newEmail || 'No email set';
    showToast('Email updated successfully', 'success');
  }
}

function editFullName() {
  const currentName = document.getElementById('settingsFullName').textContent;
  const newName = prompt('Enter full name:', currentName === 'No name set' ? '' : currentName);
  
  if (newName !== null) {
    const auth = JSON.parse(localStorage.getItem('auth_session'));
    auth.fullName = newName;
    localStorage.setItem('auth_session', JSON.stringify(auth));
    document.getElementById('settingsFullName').textContent = newName || 'No name set';
    showToast('Full name updated successfully', 'success');
  }
}

function changePassword() {
  showToast('Password change feature coming soon', 'info');
}

function toggleSetting(element) {
  element.classList.toggle('active');
  showToast('Setting updated', 'info');
}

function downloadKeys() {
  const auth = JSON.parse(localStorage.getItem('auth_session'));
  const username = auth.username;
  
  const signingKey = localStorage.getItem(`rsa_public_${username}`);
  const encryptionKey = localStorage.getItem(`rsa_public_encrypt_${username}`);
  
  const keyData = {
    username,
    signingPublicKey: signingKey,
    encryptionPublicKey: encryptionKey,
    exportedAt: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(keyData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${username}-public-keys.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('Public keys downloaded', 'success');
}

function clearKeys() {
  if (!confirm('⚠️ This will remove all your cryptographic keys from browser storage. You will need to generate new keys on next login. Are you sure?')) {
    return;
  }
  
  const auth = JSON.parse(localStorage.getItem('auth_session'));
  const username = auth.username;
  
  localStorage.removeItem(`rsa_private_${username}`);
  localStorage.removeItem(`rsa_public_${username}`);
  localStorage.removeItem(`rsa_private_encrypt_${username}`);
  localStorage.removeItem(`rsa_public_encrypt_${username}`);
  
  document.getElementById('rsaSigningKey').textContent = 'Cleared - will regenerate on next login';
  document.getElementById('rsaEncryptionKey').textContent = 'Cleared - will regenerate on next login';
  
  showToast('Keys cleared from browser storage', 'info');
}

function logout() {
  if (!confirm('Are you sure you want to logout?')) {
    return;
  }
  
  localStorage.removeItem('auth_session');
  localStorage.removeItem('auth_token');
  showToast('Logged out successfully', 'info');
  
  setTimeout(() => {
    window.location.href = '/';
  }, 1000);
}
