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
  const btnRegisterBoth = document.getElementById('btnRegisterBoth');
  const btnClearSender = document.getElementById('btnClearSender');
  const btnClearReceiver = document.getElementById('btnClearReceiver');
  const btnClearAll = document.getElementById('btnClearAll');

  if (btnRegisterBoth) btnRegisterBoth.addEventListener('click', registerBothUsers);
  if (btnClearSender) btnClearSender.addEventListener('click', resetSenderForm);
  if (btnClearReceiver) btnClearReceiver.addEventListener('click', resetReceiverForm);
  if (btnClearAll) btnClearAll.addEventListener('click', resetAllForms);
}

async function registerUser(role, options = {}) {
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
      // Store user details if requested
      const userDetails = {
        token: response.token,
        username: response.username,
        uid: response.uid,
        email,
        fullName,
        role,
        createdAt: new Date().toISOString()
      };

      if (options?.auth !== false) {
        localStorage.setItem('auth_session', JSON.stringify(userDetails));
        localStorage.setItem('auth_token', response.token);
      }

      if (options?.redirect !== false) {
        showToast(`✓ ${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully!`, 'success');
        setTimeout(() => {
          window.location.href = '/chat.html';
        }, 1500);
      }
    }
    return response;
  } catch (err) {
    showToast(`Registration error: ${err.message}`, 'error');
    return { error: err.message };
  }
}

async function registerBothUsers() {
  const senderFields = {
    username: document.getElementById('senderUsername').value.trim(),
    password: document.getElementById('senderPassword').value,
    email: document.getElementById('senderEmail').value.trim(),
    fullName: document.getElementById('senderFullName').value.trim()
  };
  const receiverFields = {
    username: document.getElementById('receiverUsername').value.trim(),
    password: document.getElementById('receiverPassword').value,
    email: document.getElementById('receiverEmail').value.trim(),
    fullName: document.getElementById('receiverFullName').value.trim()
  };

  if (!senderFields.username && !receiverFields.username) {
    showToast('Please provide sender or receiver details to register', 'warning');
    return;
  }

  try {
    showToast('📝 Registering accounts...', 'info');
    let senderResponse = null;
    let receiverResponse = null;

    if (senderFields.username) {
      senderResponse = await registerUser('sender', { redirect: false, auth: false });
      if (!senderResponse || !senderResponse.token) {
        showToast(senderResponse?.error || 'Sender registration failed', 'error');
        return;
      }
    }

    if (receiverFields.username) {
      receiverResponse = await registerUser('receiver', { redirect: false, auth: false });
      if (!receiverResponse || !receiverResponse.token) {
        showToast(receiverResponse?.error || 'Receiver registration failed', 'error');
        return;
      }
    }

    const activeResponse = senderResponse?.token ? senderResponse : receiverResponse;
    if (activeResponse?.token) {
      const userDetails = {
        token: activeResponse.token,
        username: activeResponse.username,
        uid: activeResponse.uid,
        email: activeResponse.email || '',
        fullName: activeResponse.fullName || '',
        role: activeResponse.role || (senderResponse ? 'sender' : 'receiver'),
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('auth_session', JSON.stringify(userDetails));
      localStorage.setItem('auth_token', activeResponse.token);
    }

    showToast('✓ Accounts registered successfully!', 'success');
    setTimeout(() => {
      window.location.href = '/chat.html';
    }, 1500);
  } catch (err) {
    showToast(`Registration error: ${err.message}`, 'error');
  }
}

function resetAllForms() {
  resetSenderForm();
  resetReceiverForm();
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

window.resetSenderForm = resetSenderForm;
window.resetReceiverForm = resetReceiverForm;
