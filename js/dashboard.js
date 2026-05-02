// Dashboard Module
async function loadDashboard(content, user) {
    try {
        // Fetch all necessary data
        const [ordersData, productsData, buyersData, invoicesData] = await Promise.all([
            API.getAll('orders'),
            API.getAll('products'),
            API.getAll('buyers'),
            API.getAll('invoices')
        ]);
        
        // Calculate statistics
        const stats = calculateDashboardStats(ordersData, productsData, buyersData, invoicesData, user);
        
        // Render dashboard
        content.innerHTML = `
            <div class="mb-6">
                <h1 class="text-3xl font-bold text-gray-800">Dashboard</h1>
                <p class="text-gray-600">Welcome back, ${user.full_name}!</p>
                ${user.role === 'Sales' ? `
                    <div class="mt-2 inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        <i class="fas fa-info-circle mr-2"></i>
                        Showing your personal orders and buyers only
                    </div>
                ` : ''}
            </div>
            
            <!-- Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                ${stats.cards.map(card => `
                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-500 text-sm font-medium">${card.label}</p>
                                <p class="text-3xl font-bold text-gray-800 mt-2">${card.value}</p>
                                ${card.subtext ? `<p class="text-sm text-gray-500 mt-1">${card.subtext}</p>` : ''}
                            </div>
                            <div class="bg-${card.color}-100 p-3 rounded-full">
                                <i class="fas ${card.icon} text-2xl text-${card.color}-600"></i>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <!-- Charts Row -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <!-- Orders by Status -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-xl font-bold text-gray-800 mb-4">Orders by Status</h2>
                    <div style="height: 300px;">
                        <canvas id="ordersStatusChart"></canvas>
                    </div>
                </div>
                
                <!-- Sales by Unit -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-xl font-bold text-gray-800 mb-4">Sales by Unit</h2>
                    <div style="height: 300px;">
                        <canvas id="salesUnitChart"></canvas>
                    </div>
                </div>
            </div>
            
            <!-- Recent Activity -->
            <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-xl font-bold text-gray-800 mb-4">Recent Orders</h2>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead>
                            <tr class="border-b">
                                <th class="text-left py-3 px-4">Order No.</th>
                                <th class="text-left py-3 px-4">Buyer</th>
                                <th class="text-left py-3 px-4">Product</th>
                                <th class="text-left py-3 px-4">Quantity</th>
                                <th class="text-left py-3 px-4">Amount</th>
                                <th class="text-left py-3 px-4">Status</th>
                                <th class="text-left py-3 px-4">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${stats.recentOrders.map(order => `
                                <tr class="border-b hover:bg-gray-50">
                                    <td class="py-3 px-4 font-medium">${order.order_number}</td>
                                    <td class="py-3 px-4">${order.buyer_name}</td>
                                    <td class="py-3 px-4">${order.product_name}</td>
                                    <td class="py-3 px-4">${order.quantity} ${order.unit_type}</td>
                                    <td class="py-3 px-4">${Utils.formatCurrency(order.total_amount, order.currency)}</td>
                                    <td class="py-3 px-4">
                                        <span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span>
                                    </td>
                                    <td class="py-3 px-4">${Utils.formatDate(order.order_date)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            ${user.role === 'Admin' ? `
                <!-- Low Stock Alerts -->
                <div class="bg-white rounded-lg shadow p-6 mt-6">
                    <h2 class="text-xl font-bold text-gray-800 mb-4">
                        <i class="fas fa-exclamation-triangle text-yellow-500 mr-2"></i>
                        Low Stock Alerts
                    </h2>
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead>
                                <tr class="border-b">
                                    <th class="text-left py-3 px-4">Product</th>
                                    <th class="text-left py-3 px-4">Unit</th>
                                    <th class="text-left py-3 px-4">Current Stock</th>
                                    <th class="text-left py-3 px-4">Min Level</th>
                                    <th class="text-left py-3 px-4">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${stats.lowStockProducts.map(product => `
                                    <tr class="border-b hover:bg-gray-50">
                                        <td class="py-3 px-4">${product.product_name}</td>
                                        <td class="py-3 px-4">${product.unit}</td>
                                        <td class="py-3 px-4 font-bold text-red-600">${product.current_stock}</td>
                                        <td class="py-3 px-4">${product.min_stock_level}</td>
                                        <td class="py-3 px-4">
                                            <span class="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                                                Low Stock
                                            </span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
        `;
        
        // Render charts
        renderDashboardCharts(stats);
        
    } catch (error) {
        console.error('Dashboard error:', error);
        content.innerHTML = '<div class="text-red-500">Error loading dashboard</div>';
    }
}

function calculateDashboardStats(orders, products, buyers, invoices, user) {
    // Filter orders for sales person if not admin
    let userOrders = orders;
    if (user.role === 'Sales') {
        userOrders = orders.filter(o => o.sales_person === user.username);
    }
    
    // Calculate totals
    const totalOrders = userOrders.length;
    const pipelineOrders = userOrders.filter(o => o.status === 'Pipeline').length;
    const dispatchedOrders = userOrders.filter(o => o.status === 'Dispatched').length;
    const invoicedOrders = userOrders.filter(o => o.status === 'Invoiced').length;
    
    // Calculate revenue
    const totalRevenue = userOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    
    // Recent orders
    const recentOrders = [...userOrders]
        .sort((a, b) => new Date(b.order_date) - new Date(a.order_date))
        .slice(0, 10);
    
    // Low stock products
    const lowStockProducts = products.filter(p => p.current_stock <= p.min_stock_level);
    
    // Stats cards
    const cards = [];
    
    if (user.role === 'Admin' || user.role === 'Sales') {
        cards.push({
            label: 'Total Orders',
            value: totalOrders,
            subtext: `${pipelineOrders} in pipeline`,
            icon: 'fa-shopping-cart',
            color: 'blue'
        });
    }
    
    if (user.role === 'Admin' || user.role === 'Dispatch') {
        cards.push({
            label: 'Pending Dispatch',
            value: pipelineOrders,
            subtext: 'Orders ready to dispatch',
            icon: 'fa-truck',
            color: 'yellow'
        });
    }
    
    if (user.role === 'Admin' || user.role === 'Accounts') {
        cards.push({
            label: 'Total Revenue',
            value: Utils.formatCurrency(totalRevenue, 'INR'),
            subtext: `${invoices.length} invoices`,
            icon: 'fa-rupee-sign',
            color: 'green'
        });
    }
    
    cards.push({
        label: user.role === 'Sales' ? 'My Buyers' : 'Total Buyers',
        value: user.role === 'Sales' ? buyers.filter(b => b.added_by === user.username).length : buyers.length,
        subtext: 'Active buyers',
        icon: 'fa-handshake',
        color: 'purple'
    });
    
    // Orders by status
    const ordersByStatus = {
        Pipeline: pipelineOrders,
        Dispatched: dispatchedOrders,
        Invoiced: invoicedOrders,
        Cancelled: userOrders.filter(o => o.status === 'Cancelled').length
    };
    
    // Sales by unit
    const salesByUnit = {
        Modinagar: userOrders.filter(o => o.manufacturing_unit === 'Modinagar')
            .reduce((sum, o) => sum + (o.total_amount || 0), 0),
        Patla: userOrders.filter(o => o.manufacturing_unit === 'Patla')
            .reduce((sum, o) => sum + (o.total_amount || 0), 0)
    };
    
    return {
        cards,
        recentOrders,
        lowStockProducts,
        ordersByStatus,
        salesByUnit
    };
}

function renderDashboardCharts(stats) {
    // Orders by Status Chart
    const statusCtx = document.getElementById('ordersStatusChart');
    if (statusCtx) {
        new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(stats.ordersByStatus),
                datasets: [{
                    data: Object.values(stats.ordersByStatus),
                    backgroundColor: ['#fbbf24', '#60a5fa', '#34d399', '#f87171']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    // Sales by Unit Chart
    const unitCtx = document.getElementById('salesUnitChart');
    if (unitCtx) {
        new Chart(unitCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(stats.salesByUnit),
                datasets: [{
                    label: 'Sales (INR)',
                    data: Object.values(stats.salesByUnit),
                    backgroundColor: ['#3b82f6', '#10b981']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}
