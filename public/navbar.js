// Navbar Management
function initializeNavbar() {
  const navbarToggle = document.getElementById('navbarToggle');
  const navbarMenu = document.getElementById('navbarMenu');
  const navLinks = document.querySelectorAll('.nav-link');
  const navbarUser = document.getElementById('navbarUser');
  const navbarUsername = document.getElementById('navbarUsername');
  const btnLogout = document.getElementById('btnLogout');

  // Toggle mobile menu
  if (navbarToggle) {
    navbarToggle.addEventListener('click', () => {
      navbarMenu.classList.toggle('active');
    });
  }

  // Close menu when link is clicked
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navbarMenu.classList.remove('active');
    });
  });

  // Update navbar based on auth state
  const auth = JSON.parse(localStorage.getItem('auth_session') || 'null');
  if (auth && auth.username) {
    navbarUser.style.display = 'flex';
    navbarUsername.textContent = `👤 ${auth.username}`;
  } else {
    navbarUser.style.display = 'none';
  }

  // Hide the Login nav link when user is logged in
  const loginLink = document.querySelector('.nav-link[data-page="login"]');
  if (loginLink) {
    loginLink.style.display = (auth && auth.username) ? 'none' : '';
  }
  // Logout handler
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('auth_session');
      localStorage.removeItem('auth_token');
      showToast('Logged out successfully', 'info');
      window.location.href = '/';
    });
  }

  // Set active link based on current page
  updateActiveNavLink();
}

function updateActiveNavLink() {
  const currentPage = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.href.includes(currentPage) || 
        (currentPage === '/' && link.getAttribute('data-page') === 'home')) {
      link.classList.add('active');
    }
  });
}

window.initializeNavbar = initializeNavbar;
window.updateActiveNavLink = updateActiveNavLink;

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeNavbar);
window.addEventListener('popstate', updateActiveNavLink);
