// Load navbar
document.addEventListener('DOMContentLoaded', async () => {
  const navbarContainer = document.getElementById('navbar-container');
  const navbarResponse = await fetch('/navbar.html');
  navbarContainer.innerHTML = await navbarResponse.text();
  initializeNavbar();
  setupRegisterHandlers();
  setupPasswordStrengthIndicators();
});

function setupPasswordStrengthIndicators() {
  const senderPassword = document.getElementById('senderPassword');
  const receiverPassword = document.getElementById('receiverPassword');

  senderPassword.addEventListener('input', () => {
    updatePasswordStrength('sender', senderPassword.value);
  });

  receiverPassword.addEventListener('input', () => {
    updatePasswordStrength('receiver', receiverPassword.value);
  });
}

function updatePasswordStrength(side, password) {
  const strengthFill = document.getElementById(`${side}PasswordStrength`);
  const strengthText = document.getElementById(`${side}StrengthText`);
  
  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[!@#$%^&*]/.test(password)) strength++;

  const strengthClasses = ['', 'weak', 'medium', 'strong'];
  const strengthLabels = ['Weak', 'Weak', 'Medium', 'Strong'];
  
  strengthFill.className = 'strength-fill ' + (strengthClasses[strength] || '');
  strengthText.textContent = `Password strength: ${strengthLabels[strength]}`;
}

function setupRegisterHandlers() {
  const btnRegisterSender = document.getElementById('btnRegisterSender');
  const btnRegisterReceiver = document.getElementById('btnRegisterReceiver');

  btnRegisterSender.addEventListener('click', () => registerUser('sender'));
  btnRegisterReceiver.addEventListener('click', () => registerUser('receiver'));
}

async function registerUser(role) {
  const username = document.getElementById(`${role}Username`).value.trim();
  const password = document.getElementById(`${role}Password`).value;
  const email = document.getElementById(`${role}Email`).value.trim();
  const fullName = document.getElementById(`${role}FullName`).value.trim();

  if (!username || !password || !email || !fullName) {
    showToast('Please fill in all required fields', 'warning');
    return;
  }

  if (password.length < 8) {
    showToast('Password must be at least 8 characters', 'warning');
    return;
  }

  if (!email.includes('@')) {
    showToast('Please enter a valid email address', 'warning');
    return;
  }

  try {
    showToast(`📝 Registering ${role} account...`, 'info');
    
    const response = await api.register(username, password);
    
    if (response.token) {
      // Store user details
      const userDetails = {
        token: response.token,
        username: response.username,
        uid: response.uid,
        email,
        fullName,
        role,
        createdAt: new Date().toISOString()
      };
      
      localStorage.setItem('auth_session', JSON.stringify(userDetails));
      localStorage.setItem('auth_token', response.token);
      
      showToast(`✓ ${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully!`, 'success');
      
      setTimeout(() => {
        window.location.href = '/chat.html';
      }, 1500);
    } else {
      showToast(response.error || `${role} registration failed`, 'error');
    }
  } catch (err) {
    showToast(`Registration error: ${err.message}`, 'error');
  }
}

function resetSenderForm() {
  document.getElementById('senderUsername').value = '';
  document.getElementById('senderPassword').value = '';
  document.getElementById('senderEmail').value = '';
  document.getElementById('senderFullName').value = '';
  document.getElementById('senderPasswordStrength').className = 'strength-fill';
}

function resetReceiverForm() {
  document.getElementById('receiverUsername').value = '';
  document.getElementById('receiverPassword').value = '';
  document.getElementById('receiverEmail').value = '';
  document.getElementById('receiverFullName').value = '';
  document.getElementById('receiverPasswordStrength').className = 'strength-fill';
}
