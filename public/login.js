// Login Page Handler
document.addEventListener('DOMContentLoaded', async () => {
  const navbarContainer = document.getElementById('navbar-container');
  const navbarResponse = await fetch('/navbar.html');
  navbarContainer.innerHTML = await navbarResponse.text();
  initializeNavbar();
  
  // If already logged in, redirect to chat
  const auth = JSON.parse(localStorage.getItem('auth_session') || 'null');
  if (auth && auth.token) {
    window.location.href = '/chat.html';
    return;
  }
  
  // Load saved username if "Remember me" was checked
  const rememberMe = localStorage.getItem('rememberMe');
  if (rememberMe) {
    document.getElementById('loginUsername').value = rememberMe;
    document.getElementById('rememberMe').checked = true;
  }
});

async function handleLogin(event) {
  event.preventDefault();
  
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const rememberMe = document.getElementById('rememberMe').checked;
  
  if (!username || !password) {
    showToast('Please enter username and password', 'warning');
    return;
  }
  
  try {
    const response = await api.login(username, password);
    
    if (!response || !response.token) {
      showToast('Login failed: Invalid credentials', 'error');
      return;
    }
    
    // Save auth data
    const userDetails = {
      token: response.token,
      username: response.username,
      uid: response.uid,
      createdAt: new Date().toISOString()
    };
    
    localStorage.setItem('auth_session', JSON.stringify(userDetails));
    localStorage.setItem('auth_token', response.token);
    
    // Save username if "Remember me" is checked
    if (rememberMe) {
      localStorage.setItem('rememberMe', username);
    } else {
      localStorage.removeItem('rememberMe');
    }
    
    showToast(`✓ Welcome back, ${username}!`, 'success');
    
    setTimeout(() => {
      window.location.href = '/chat.html';
    }, 1500);
    
  } catch (err) {
    console.error('Login error:', err);
    showToast(`Login failed: ${err.message}`, 'error');
  }
}

function clearLoginForm() {
  document.getElementById('loginForm').reset();
  document.getElementById('loginUsername').focus();
}

function handleForgotPassword(event) {
  event.preventDefault();
  showToast('Password recovery feature coming soon', 'info');
}
