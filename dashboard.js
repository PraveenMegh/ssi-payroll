/* SSI Dashboard Module - Enhanced */
const SSIDashboard = (() => {

  function render(area) {
    if (!SSIApp.hasRole('ADMIN','ACCOUNTANT','ACCOUNTS')) {
      area.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><p>Access Denied</p></div>';
      return;
    }
    const st  = SSIApp.getState();
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear  = now.getFullYear();

    // ── Stats ──────────────────────────────────────────────────
    const totalProducts = st.products.filter(p => p.active !== false).length;
    const totalClients  = st.clients.filter(c => c.active !== false).length;

    const ordersThisMonth = st.orders.filter(o => {
      const d = new Date(o.created_at);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    const pendingOrders = st.orders.filter(o => o.status === 'SUBMITTED').length;
    const urgentOrders  = st.orders.filter(o => o.status === 'SUBMITTED' && o.urgent).length;

    const dispatchedThisMonth = ordersThisMonth.filter(o => o.status === 'DISPATCHED').length;
    const revenueThisMonth    = ordersThisMonth
      .filter(o => o.status === 'DISPATCHED')
      .reduce((s, o) => {
        const val = o.dispatch_modified ? (o.dispatched_value || 0) : (o.total_value || 0);
        return s + val;
      }, 0);

    // ── Low Stock ──────────────────────────────────────────────
    const lowStock = [];
    st.products.filter(p => p.active && p.reorder_level > 0).forEach(p => {
      st.units.filter(u => u.active).forEach(u => {
        const qty = SSIApp.getStock(p.id, u.id);
        if (qty <= p.reorder_level) {
          lowStock.push({ product: p.name, unit: u.name, qty, reorder: p.reorder_level });
        }
      });
    });

    // ── Recent Orders (last 10) ────────────────────────────────
    const recentOrders = [...st.orders]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10);

    // ── Quick Actions ──────────────────────────────────────────
    const quickActions = [
      { icon: '📦', label: 'Add Product', action: 'SSIApp.navigate("products")' },
      { icon: '👥', label: 'Add Client', action: 'SSIApp.navigate("clients")' },
      { icon: '🛒', label: 'New Order', action: 'SSIApp.navigate("orders")' },
      { icon: '📊', label: 'View Reports', action: 'SSIApp.navigate("reports")' },
    ];

    // ── Render ─────────────────────────────────────────────────
    area.innerHTML = `
      <div style="padding:0 0 24px;">

        <!-- Welcome Banner -->
        <div style="background:linear-gradient(135deg, #C0392B 0%, #8B1A1A 100%);padding:28px 32px;border-radius:16px;margin-bottom:28px;box-shadow:0 8px 16px rgba(192,57,43,0.15);">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
            <div>
              <h1 style="font-size:28px;font-weight:700;color:#fff;margin:0 0 8px;">Welcome back, ${SSIApp.state.currentUser?.name || 'Admin'} 👋</h1>
              <p style="font-size:15px;color:rgba(255,255,255,0.9);margin:0;">Here's what's happening with your inventory today.</p>
            </div>
            <div style="font-size:48px;">📊</div>
          </div>
        </div>

        <!-- Stats Grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:18px;margin-bottom:28px;">
          ${statCard('📦', 'Products',     totalProducts,                         'Active products',           '#e11d2e', '0 4px 12px rgba(225,29,46,0.1)')}
          ${statCard('👥', 'Clients',      totalClients,                          'Active clients',            '#C0392B', '0 4px 12px rgba(192,57,43,0.1)')}
          ${statCard('🛒', 'Pending',      pendingOrders,                         'Awaiting dispatch',         '#d97706', '0 4px 12px rgba(217,119,6,0.1)')}
          ${statCard('🚨', 'Urgent',       urgentOrders,                          'Urgent orders',             '#dc2626', '0 4px 12px rgba(220,38,38,0.1)')}
          ${statCard('🚚', 'Dispatched',   dispatchedThisMonth,                   'This month',                '#16a34a', '0 4px 12px rgba(22,163,74,0.1)')}
          ${statCard('💰', 'Revenue',      SSIApp.moneyFmt(revenueThisMonth),     'This month (dispatched)',   '#7c3aed', '0 4px 12px rgba(124,58,237,0.1)')}
        </div>

        <!-- Quick Actions -->
        <div style="margin-bottom:28px;">
          <h3 style="font-size:18px;font-weight:700;color:#111827;margin-bottom:14px;">⚡ Quick Actions</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;">
            ${quickActions.map(qa => `
              <button onclick="${qa.action}" style="background:#fff;border:2px solid #e2e8f0;border-radius:12px;padding:18px;cursor:pointer;transition:all 0.2s;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,0.04);"
                onmouseover="this.style.borderColor='#C0392B';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(192,57,43,0.15)'"
                onmouseout="this.style.borderColor='#e2e8f0';this.style.transform='translateY(0)';this.style.boxShadow='0 2px 6px rgba(0,0,0,0.04)'">
                <div style="font-size:32px;margin-bottom:8px;">${qa.icon}</div>
                <div style="font-size:14px;font-weight:600;color:#111827;">${qa.label}</div>
              </button>
            `).join('')}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">

          <!-- Low Stock Alerts -->
          <div class="card" style="box-shadow:0 4px 12px rgba(0,0,0,0.06);border-radius:14px;">
            <h3 style="font-size:18px;font-weight:700;color:#111827;margin-bottom:18px;display:flex;align-items:center;gap:8px;">
              🔴 Low Stock Alerts
              ${lowStock.length > 0 ? `<span style="background:#fee2e2;color:#991b1b;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;">${lowStock.length}</span>` : ''}
            </h3>
            ${lowStock.length === 0
              ? '<div style="text-align:center;padding:32px;"><div style="font-size:48px;margin-bottom:12px;">✅</div><p style="color:#16a34a;font-size:15px;font-weight:500;">All products are well stocked!</p></div>'
              : `<div style="display:flex;flex-direction:column;gap:10px;max-height:360px;overflow-y:auto;">
                  ${lowStock.slice(0, 8).map(l => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:#fee2e2;border-left:4px solid #dc2626;border-radius:10px;">
                      <div style="flex:1;">
                        <div style="font-size:14px;font-weight:600;color:#991b1b;margin-bottom:4px;">${l.product}</div>
                        <div style="font-size:12px;color:#dc2626;display:flex;align-items:center;gap:6px;">
                          <span>📍 ${l.unit}</span>
                          <span style="color:#cbd5e1;">•</span>
                          <span>Reorder: ${SSIApp.qtyFmt(l.reorder)}</span>
                        </div>
                      </div>
                      <div style="text-align:right;">
                        <div style="font-size:20px;font-weight:700;color:#dc2626;">${SSIApp.qtyFmt(l.qty)}</div>
                        <div style="font-size:11px;color:#991b1b;font-weight:500;">IN STOCK</div>
                      </div>
                    </div>
                  `).join('')}
                  ${lowStock.length > 8 ? `<div style="text-align:center;padding:10px;"><a href="#" onclick="SSIApp.navigate('reports');return false;" style="color:#C0392B;font-size:13px;font-weight:600;text-decoration:none;">View all ${lowStock.length} alerts →</a></div>` : ''}
                </div>`
            }
          </div>

          <!-- Recent Orders -->
          <div class="card" style="box-shadow:0 4px 12px rgba(0,0,0,0.06);border-radius:14px;">
            <h3 style="font-size:18px;font-weight:700;color:#111827;margin-bottom:18px;display:flex;align-items:center;gap:8px;">
              🕐 Recent Orders
              ${recentOrders.length > 0 ? `<span style="background:#f1f5f9;color:#475569;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;">${recentOrders.length}</span>` : ''}
            </h3>
            ${recentOrders.length === 0
              ? '<div style="text-align:center;padding:32px;color:#94a3b8;"><div style="font-size:48px;margin-bottom:12px;">📭</div><p>No orders yet</p></div>'
              : `<div style="display:flex;flex-direction:column;gap:8px;max-height:360px;overflow-y:auto;">
                  ${recentOrders.map(o => {
                    const client = st.clients.find(c => c.id === o.client_id);
                    const statusColors = {
                      DRAFT:      { bg:'#f1f5f9', color:'#475569' },
                      SUBMITTED:  { bg:'#fef3c7', color:'#92400e' },
                      DISPATCHED: { bg:'#dcfce7', color:'#166534' },
                      CANCELLED:  { bg:'#fee2e2', color:'#991b1b' },
                    };
                    const sc = statusColors[o.status] || statusColors.DRAFT;
                    return `
                      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:#f8fafc;border-radius:10px;border-left:3px solid ${sc.color};cursor:pointer;transition:all 0.2s;"
                        onclick="SSIApp.navigate('orders')"
                        onmouseover="this.style.background='#f1f5f9'"
                        onmouseout="this.style.background='#f8fafc'">
                        <div style="flex:1;">
                          <div style="font-size:13px;font-weight:600;color:#111827;margin-bottom:4px;">${o.order_no || '—'}</div>
                          <div style="font-size:12px;color:#64748b;">${client?.name || 'Unknown'}</div>
                        </div>
                        <div style="text-align:right;">
                          <div style="font-size:13px;font-weight:600;color:#111827;margin-bottom:4px;">${SSIApp.moneyFmt(o.total_value || 0)}</div>
                          <span style="background:${sc.bg};color:${sc.color};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;">${o.status}</span>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>`
            }
          </div>

        </div>

      </div>
    `;
  }

  function statCard(icon, label, value, sub, color, shadow) {
    return `
      <div style="background:#fff;padding:22px;border-radius:14px;box-shadow:${shadow};border-left:4px solid ${color};transition:all 0.2s;cursor:default;"
        onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='${shadow.replace('12px', '16px')}'"
        onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='${shadow}'">
        <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:12px;">
          <div style="font-size:36px;">${icon}</div>
          <div style="width:40px;height:40px;background:${color}10;border-radius:10px;display:flex;align-items:center;justify-content:center;">
            <div style="width:8px;height:8px;background:${color};border-radius:50%;"></div>
          </div>
        </div>
        <div style="font-size:28px;font-weight:700;color:#111827;margin-bottom:6px;">${value}</div>
        <div style="font-size:13px;font-weight:600;color:${color};margin-bottom:4px;">${label}</div>
        <div style="font-size:12px;color:#94a3b8;">${sub}</div>
      </div>
    `;
  }

  return { render };
})();
