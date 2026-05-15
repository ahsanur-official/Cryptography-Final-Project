// Login Page Handler
document.addEventListener('DOMContentLoaded', async () => {
  const navbarContainer = document.getElementById('navbar-container');
  const navbarResponse = await fetch('/navbar.html');
  navbarContainer.innerHTML = await navbarResponse.text();
  initializeNavbar();
  
  const auth = JSON.parse(localStorage.getItem('auth_session') || 'null');
  if (auth && auth.token) {
    window.location.href = '/chat.html';
    return;
  }

  const signInButton = document.getElementById('btnSignIn');
  const clearAllButton = document.getElementById('btnClearAllLogin');
  const senderClearButton = document.getElementById('btnSenderClear');
  const receiverClearButton = document.getElementById('btnReceiverClear');

  if (signInButton) {
    signInButton.addEventListener('click', handleLogin);
  }
  if (clearAllButton) {
    clearAllButton.addEventListener('click', clearAllLogin);
  }
  if (senderClearButton) {
    senderClearButton.addEventListener('click', () => clearLoginForm('sender'));
  }
  if (receiverClearButton) {
    receiverClearButton.addEventListener('click', () => clearLoginForm('receiver'));
  }
});

async function handleLogin() {
  const role = document.querySelector('input[name="loginRole"]:checked')?.value || 'sender';
  const usernameInput = document.getElementById(`${role}LoginUsername`);
  const passwordInput = document.getElementById(`${role}LoginPassword`);

  if (!usernameInput || !passwordInput) {
    showToast('Login fields are not available', 'error');
    return;
  }

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showToast(`Please enter ${role} username and password`, 'warning');
    return;
  }

  try {
    const response = await api.login(username, password);
    if (!response || !response.token) {
      showToast('Login failed: Invalid credentials', 'error');
      return;
    }

    const userDetails = {
      token: response.token,
      username: response.username,
      uid: response.uid,
      role,
      createdAt: new Date().toISOString()
    };

    localStorage.setItem('auth_session', JSON.stringify(userDetails));
    localStorage.setItem('auth_token', response.token);

    showToast(`✓ Logged in as ${role} ${username}!`, 'success');

    setTimeout(() => {
      window.location.href = '/chat.html';
    }, 1200);
  } catch (err) {
    console.error('Login error:', err);
    showToast(`Login failed: ${err.message}`, 'error');
  }
}

function clearLoginForm(role) {
  const usernameInput = document.getElementById(`${role}LoginUsername`);
  const passwordInput = document.getElementById(`${role}LoginPassword`);
  if (usernameInput) usernameInput.value = '';
  if (passwordInput) passwordInput.value = '';
  if (usernameInput) usernameInput.focus();
}

function clearAllLogin() {
  clearLoginForm('sender');
  clearLoginForm('receiver');
}

function handleForgotPassword(event) {
  event.preventDefault();
  showToast('Password recovery feature coming soon', 'info');
}
