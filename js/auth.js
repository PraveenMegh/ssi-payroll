// ============================================================
//  SSI Inventory — Auth Module  (updated with salary module)
//  auth.js
// ============================================================

const SSIAuth = (() => {

  const NAV_ITEMS = {
    ADMIN: [
      { page: 'dashboard',  icon: '📊', label: 'Dashboard'        },
      { page: 'products',   icon: '📦', label: 'Products'          },
      { page: 'clients',    icon: '👥', label: 'Clients / Vendors'  },
      { page: 'inventory',  icon: '🏭', label: 'Inventory'         },
      { page: 'orders',     icon: '🛒', label: 'Sales Orders'      },
      { page: 'dispatch',   icon: '🚚', label: 'Dispatch'          },
      { page: 'reports',    icon: '📈', label: 'Reports'           },
      { page: 'users',      icon: '👤', label: 'Users'             },
      { page: 'units',      icon: '🏢', label: 'Units / Locations' },
      { page: 'employees',  icon: '👥', label: 'Employees'         },
      { page: 'attendance', icon: '🗓️', label: 'Attendance'        },
      { page: 'payroll',    icon: '💰', label: 'Payroll'           },
    ],
    STOCK: [
      { page: 'dashboard',  icon: '📊', label: 'Dashboard' },
      { page: 'inventory',  icon: '🏭', label: 'Inventory'  }
    ],
    DISPATCH: [
      { page: 'dashboard',  icon: '📊', label: 'Dashboard' },
      { page: 'dispatch',   icon: '🚚', label: 'Dispatch'  }
    ],
    SALES: [
      { page: 'dashboard',  icon: '📊', label: 'Dashboard'        },
      { page: 'orders',     icon: '🛒', label: 'Sales Orders'      },
      { page: 'clients',    icon: '👥', label: 'Clients / Vendors'  }
    ],
    ACCOUNTANT: [
      { page: 'dashboard',  icon: '📊', label: 'Dashboard'  },
      { page: 'employees',  icon: '👥', label: 'Employees'  },
      { page: 'attendance', icon: '🗓️', label: 'Attendance' },
      { page: 'payroll',    icon: '💰', label: 'Payroll'    },
    ],
    ACCOUNTS: [
      { page: 'dashboard',  icon: '📊', label: 'Dashboard'        },
      { page: 'products',   icon: '📦', label: 'Products'          },
      { page: 'clients',    icon: '👥', label: 'Clients / Vendors'  },
      { page: 'inventory',  icon: '🏭', label: 'Inventory'         },
      { page: 'orders',     icon: '🛒', label: 'Sales Orders'      },
      { page: 'dispatch',   icon: '🚚', label: 'Dispatch'          },
      { page: 'reports',    icon: '📈', label: 'Reports'           },
      { page: 'units',      icon: '🏢', label: 'Units / Locations' },
      { page: 'employees',  icon: '👥', label: 'Employees'         },
      { page: 'attendance', icon: '🗓️', label: 'Attendance'        },
      { page: 'payroll',    icon: '💰', label: 'Payroll'           },
    ]
  };

  function showLogin(errorMsg) {
    const loginScreen = document.getElementById('login-screen');
    const appShell    = document.getElementById('app-shell');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (appShell)    appShell.style.display = 'none';
    const uInput = document.getElementById('login-user');
    const pInput = document.getElementById('login-pass');
    if (uInput) uInput.value = '';
    if (pInput) pInput.value = '';
    const errEl = document.getElementById('login-error');
    if (errEl) {
      if (errorMsg) { errEl.textContent = errorMsg; errEl.style.display = 'block'; }
      else errEl.style.display = 'none';
    }
  }

  function showApp(user) {
    const loginScreen = document.getElementById('login-screen');
    const appShell    = document.getElementById('app-shell');
    if (loginScreen) loginScreen.style.display = 'none';
    if (appShell)    appShell.style.display = 'flex';

    const navEl = document.getElementById('sidebar-nav');
    if (navEl) {
      const items = NAV_ITEMS[user.role] || NAV_ITEMS.SALES;
      navEl.innerHTML = items.map(item => `
        <button data-nav="${item.page}"
          onclick="SSIApp.navigate('${item.page}')"
          style="display:flex;align-items:center;gap:.6rem;width:100%;padding:.6rem .75rem;border:none;background:transparent;color:#e2e8f0;border-radius:.5rem;cursor:pointer;font-size:.875rem;text-align:left;"
          onmouseover="this.style.background='rgba(255,255,255,0.1)'"
          onmouseout="if(!this.classList.contains('active'))this.style.background='transparent'">
          <span>${item.icon}</span><span>${item.label}</span>
        </button>`).join('');
    }

    const userInfoEl = document.getElementById('user-info');
    if (userInfoEl) userInfoEl.innerHTML = `
      <div style="font-weight:600;color:#e2e8f0;">${user.name}</div>
      <div style="color:#F1948A;font-size:.7rem;">${user.role}</div>`;

    const topName = document.getElementById('top-user-name');
    const topRole = document.getElementById('top-user-role');
    if (topName) topName.textContent = user.name;
    if (topRole) topRole.textContent = user.role;

    const defaultPage = {
      ADMIN:'dashboard',  STOCK:'inventory',
      DISPATCH:'dispatch', SALES:'orders',
      ACCOUNTANT:'payroll', ACCOUNTS:'dashboard'
    };
    SSIApp.navigate(defaultPage[user.role] || 'dashboard');
  }

  function init() {
    const u = SSIApp.state.currentUser;
    if (u && u.username) { showApp(u); } else { showLogin(); }
    const passEl = document.getElementById('login-pass');
    if (passEl) passEl.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  }

  function login() {
    const username = (document.getElementById('login-user')?.value || '').trim();
    const password =  document.getElementById('login-pass')?.value || '';
    const errEl    =  document.getElementById('login-error');
    if (!username || !password) {
      if (errEl) { errEl.textContent = 'Please enter username and password.'; errEl.style.display = 'block'; }
      return;
    }
    const user = (SSIApp.state.users || []).find(u => u.username === username && u.password === password && u.active !== false);
    if (!user) {
      if (errEl) { errEl.textContent = '❌ Invalid username or password.'; errEl.style.display = 'block'; }
      document.getElementById('login-pass').value = '';
      return;
    }
    SSIApp.state.currentUser = user;
    showApp(user);
  }

  function logout() {
    SSIApp.state.currentUser = null;
    showLogin();
  }

  return { init, login, logout, showApp, showLogin };
})();
