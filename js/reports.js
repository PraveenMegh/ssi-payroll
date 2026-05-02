// Reports and Analytics Module
async function loadReports(content, user) {
    const [orders, products, buyers, invoices] = await Promise.all([
        API.getAll('orders'),
        API.getAll('products'),
        API.getAll('buyers'),
        API.getAll('invoices')
    ]);
    
    content.innerHTML = `
        <div class="mb-6">
            <h1 class="text-3xl font-bold text-gray-800">Reports & Analytics</h1>
            <p class="text-gray-600">Comprehensive business intelligence and insights</p>
        </div>
        
        <!-- Report Selection -->
        <div class="bg-white rounded-lg shadow p-6 mb-6">
            <h2 class="text-xl font-bold text-gray-800 mb-4">Select Report Type</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button onclick="showMonthlySalesReport()" class="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition duration-200 text-left">
                    <i class="fas fa-calendar-alt text-2xl text-blue-600 mb-2"></i>
                    <p class="font-medium">Monthly Sales</p>
                    <p class="text-sm text-gray-500">Sales trends by month</p>
                </button>
                
                <button onclick="showProductWiseReport()" class="p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition duration-200 text-left">
                    <i class="fas fa-box text-2xl text-green-600 mb-2"></i>
                    <p class="font-medium">Product-wise Sales</p>
                    <p class="text-sm text-gray-500">Sales by product category</p>
                </button>
                
                <button onclick="showUnitWiseReport()" class="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition duration-200 text-left">
                    <i class="fas fa-industry text-2xl text-purple-600 mb-2"></i>
                    <p class="font-medium">Unit-wise Performance</p>
                    <p class="text-sm text-gray-500">Compare Modinagar vs Patla</p>
                </button>
                
                <button onclick="showDemandAnalysis()" class="p-4 border-2 border-gray-200 rounded-lg hover:border-yellow-500 hover:bg-yellow-50 transition duration-200 text-left">
                    <i class="fas fa-chart-line text-2xl text-yellow-600 mb-2"></i>
                    <p class="font-medium">Demand Analysis</p>
                    <p class="text-sm text-gray-500">Product demand forecasting</p>
                </button>
                
                <button onclick="showSalesPersonReport()" class="p-4 border-2 border-gray-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition duration-200 text-left">
                    <i class="fas fa-users text-2xl text-red-600 mb-2"></i>
                    <p class="font-medium">Sales Person Performance</p>
                    <p class="text-sm text-gray-500">Individual sales metrics</p>
                </button>
                
                <button onclick="showBuyerAnalysis()" class="p-4 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition duration-200 text-left">
                    <i class="fas fa-handshake text-2xl text-indigo-600 mb-2"></i>
                    <p class="font-medium">Buyer Analysis</p>
                    <p class="text-sm text-gray-500">Top buyers and patterns</p>
                </button>
                
                <button onclick="showRevenueReport()" class="p-4 border-2 border-gray-200 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition duration-200 text-left">
                    <i class="fas fa-rupee-sign text-2xl text-teal-600 mb-2"></i>
                    <p class="font-medium">Revenue Report</p>
                    <p class="text-sm text-gray-500">Income and growth trends</p>
                </button>
                
                <button onclick="showInventoryReport()" class="p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition duration-200 text-left">
                    <i class="fas fa-boxes text-2xl text-orange-600 mb-2"></i>
                    <p class="font-medium">Inventory Report</p>
                    <p class="text-sm text-gray-500">Stock levels and turnover</p>
                </button>
            </div>
        </div>
        
        <!-- Report Display Area -->
        <div id="reportDisplay">
            <div class="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                <i class="fas fa-chart-bar text-6xl text-gray-300 mb-4"></i>
                <p class="text-lg">Select a report type to view analytics</p>
            </div>
        </div>
    `;
    
    // Store data globally for reports
    window.reportData = { orders, products, buyers, invoices, user };
}

async function showMonthlySalesReport() {
    const { orders } = window.reportData;
    
    // Group orders by month
    const monthlyData = {};
    orders.forEach(order => {
        if (order.status === 'Invoiced') {
            const date = new Date(order.order_date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    month: monthKey,
                    orders: 0,
                    revenue: 0,
                    quantity: 0
                };
            }
            
            monthlyData[monthKey].orders++;
            monthlyData[monthKey].revenue += order.total_amount;
            monthlyData[monthKey].quantity += order.quantity;
        }
    });
    
    const months = Object.keys(monthlyData).sort();
    const data = months.map(m => monthlyData[m]);
    
    const reportHtml = `
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">
                    <i class="fas fa-calendar-alt text-blue-600 mr-2"></i>
                    Monthly Sales Report
                </h2>
                <button onclick="exportReport('monthly_sales')" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    <i class="fas fa-download mr-2"></i>Export CSV
                </button>
            </div>
            
            <!-- Summary Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="bg-blue-50 p-4 rounded-lg">
                    <p class="text-sm text-blue-600 font-medium">Total Months</p>
                    <p class="text-2xl font-bold text-blue-800">${months.length}</p>
                </div>
                <div class="bg-green-50 p-4 rounded-lg">
                    <p class="text-sm text-green-600 font-medium">Total Revenue</p>
                    <p class="text-2xl font-bold text-green-800">${Utils.formatCurrency(data.reduce((sum, d) => sum + d.revenue, 0), 'INR')}</p>
                </div>
                <div class="bg-purple-50 p-4 rounded-lg">
                    <p class="text-sm text-purple-600 font-medium">Total Orders</p>
                    <p class="text-2xl font-bold text-purple-800">${data.reduce((sum, d) => sum + d.orders, 0)}</p>
                </div>
            </div>
            
            <!-- Chart -->
            <div style="height: 400px;" class="mb-6">
                <canvas id="monthlyChart"></canvas>
            </div>
            
            <!-- Data Table -->
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Month</th>
                            <th class="text-right py-3 px-4">Orders</th>
                            <th class="text-right py-3 px-4">Quantity Sold</th>
                            <th class="text-right py-3 px-4">Revenue (INR)</th>
                            <th class="text-right py-3 px-4">Avg Order Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(row => `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="py-3 px-4 font-medium">${row.month}</td>
                                <td class="py-3 px-4 text-right">${row.orders}</td>
                                <td class="py-3 px-4 text-right">${row.quantity}</td>
                                <td class="py-3 px-4 text-right">${Utils.formatCurrency(row.revenue, 'INR')}</td>
                                <td class="py-3 px-4 text-right">${Utils.formatCurrency(row.revenue / row.orders, 'INR')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    document.getElementById('reportDisplay').innerHTML = reportHtml;
    
    // Render chart
    const ctx = document.getElementById('monthlyChart');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Revenue (INR)',
                data: data.map(d => d.revenue),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4
            }, {
                label: 'Orders',
                data: data.map(d => d.orders),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    position: 'left',
                    title: { display: true, text: 'Revenue (INR)' }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'Number of Orders' }
                }
            }
        }
    });
    
    window.currentReportData = data;
}

async function showProductWiseReport() {
    const { orders } = window.reportData;
    
    // Group by product
    const productData = {};
    orders.forEach(order => {
        if (order.status === 'Invoiced') {
            const key = order.product_name;
            if (!productData[key]) {
                productData[key] = {
                    product: key,
                    orders: 0,
                    quantity: 0,
                    revenue: 0
                };
            }
            productData[key].orders++;
            productData[key].quantity += order.quantity;
            productData[key].revenue += order.total_amount;
        }
    });
    
    const data = Object.values(productData).sort((a, b) => b.revenue - a.revenue);
    
    const reportHtml = `
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">
                    <i class="fas fa-box text-green-600 mr-2"></i>
                    Product-wise Sales Report
                </h2>
                <button onclick="exportReport('product_wise')" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                    <i class="fas fa-download mr-2"></i>Export CSV
                </button>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <!-- Chart -->
                <div style="height: 400px;">
                    <canvas id="productChart"></canvas>
                </div>
                
                <!-- Top Products -->
                <div>
                    <h3 class="font-bold text-gray-800 mb-4">Top 5 Products by Revenue</h3>
                    <div class="space-y-3">
                        ${data.slice(0, 5).map((product, index) => `
                            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div class="flex items-center">
                                    <span class="bg-green-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3">
                                        ${index + 1}
                                    </span>
                                    <div>
                                        <p class="font-medium">${product.product}</p>
                                        <p class="text-sm text-gray-500">${product.orders} orders</p>
                                    </div>
                                </div>
                                <p class="font-bold text-green-600">${Utils.formatCurrency(product.revenue, 'INR')}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <!-- Data Table -->
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Product</th>
                            <th class="text-right py-3 px-4">Orders</th>
                            <th class="text-right py-3 px-4">Quantity Sold</th>
                            <th class="text-right py-3 px-4">Revenue (INR)</th>
                            <th class="text-right py-3 px-4">% of Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(row => {
                            const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
                            const percentage = (row.revenue / totalRevenue * 100).toFixed(1);
                            return `
                                <tr class="border-b hover:bg-gray-50">
                                    <td class="py-3 px-4 font-medium">${row.product}</td>
                                    <td class="py-3 px-4 text-right">${row.orders}</td>
                                    <td class="py-3 px-4 text-right">${row.quantity}</td>
                                    <td class="py-3 px-4 text-right">${Utils.formatCurrency(row.revenue, 'INR')}</td>
                                    <td class="py-3 px-4 text-right">${percentage}%</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    document.getElementById('reportDisplay').innerHTML = reportHtml;
    
    // Render chart
    const ctx = document.getElementById('productChart');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.product),
            datasets: [{
                data: data.map(d => d.revenue),
                backgroundColor: [
                    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                    '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
    
    window.currentReportData = data;
}

async function showUnitWiseReport() {
    const { orders } = window.reportData;
    
    const unitData = {
        Modinagar: { orders: 0, revenue: 0, quantity: 0 },
        Patla: { orders: 0, revenue: 0, quantity: 0 }
    };
    
    orders.forEach(order => {
        if (order.status === 'Invoiced' && order.manufacturing_unit) {
            const unit = order.manufacturing_unit;
            unitData[unit].orders++;
            unitData[unit].revenue += order.total_amount;
            unitData[unit].quantity += order.quantity;
        }
    });
    
    const reportHtml = `
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">
                    <i class="fas fa-industry text-purple-600 mr-2"></i>
                    Unit-wise Performance Report
                </h2>
                <button onclick="exportReport('unit_wise')" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
                    <i class="fas fa-download mr-2"></i>Export CSV
                </button>
            </div>
            
            <!-- Comparison -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <!-- Modinagar -->
                <div class="border-2 border-blue-200 rounded-lg p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-xl font-bold text-blue-800">Modinagar Unit (HO)</h3>
                        <i class="fas fa-industry text-3xl text-blue-600"></i>
                    </div>
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-gray-600">Total Orders:</span>
                            <span class="font-bold text-blue-800">${unitData.Modinagar.orders}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Quantity Sold:</span>
                            <span class="font-bold text-blue-800">${unitData.Modinagar.quantity}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Revenue:</span>
                            <span class="font-bold text-blue-800">${Utils.formatCurrency(unitData.Modinagar.revenue, 'INR')}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Avg Order Value:</span>
                            <span class="font-bold text-blue-800">
                                ${unitData.Modinagar.orders > 0 ? Utils.formatCurrency(unitData.Modinagar.revenue / unitData.Modinagar.orders, 'INR') : '₹0'}
                            </span>
                        </div>
                    </div>
                </div>
                
                <!-- Patla -->
                <div class="border-2 border-green-200 rounded-lg p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-xl font-bold text-green-800">Patla Unit</h3>
                        <i class="fas fa-industry text-3xl text-green-600"></i>
                    </div>
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-gray-600">Total Orders:</span>
                            <span class="font-bold text-green-800">${unitData.Patla.orders}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Quantity Sold:</span>
                            <span class="font-bold text-green-800">${unitData.Patla.quantity}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Revenue:</span>
                            <span class="font-bold text-green-800">${Utils.formatCurrency(unitData.Patla.revenue, 'INR')}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Avg Order Value:</span>
                            <span class="font-bold text-green-800">
                                ${unitData.Patla.orders > 0 ? Utils.formatCurrency(unitData.Patla.revenue / unitData.Patla.orders, 'INR') : '₹0'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Charts -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div style="height: 300px;">
                    <canvas id="unitRevenueChart"></canvas>
                </div>
                <div style="height: 300px;">
                    <canvas id="unitOrdersChart"></canvas>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('reportDisplay').innerHTML = reportHtml;
    
    // Revenue Chart
    new Chart(document.getElementById('unitRevenueChart'), {
        type: 'bar',
        data: {
            labels: ['Modinagar', 'Patla'],
            datasets: [{
                label: 'Revenue (INR)',
                data: [unitData.Modinagar.revenue, unitData.Patla.revenue],
                backgroundColor: ['#3b82f6', '#10b981']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Revenue Comparison' } }
        }
    });
    
    // Orders Chart
    new Chart(document.getElementById('unitOrdersChart'), {
        type: 'pie',
        data: {
            labels: ['Modinagar', 'Patla'],
            datasets: [{
                data: [unitData.Modinagar.orders, unitData.Patla.orders],
                backgroundColor: ['#3b82f6', '#10b981']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Orders Distribution' } }
        }
    });
}

async function showDemandAnalysis() {
    const { orders, products } = window.reportData;
    
    // Calculate demand metrics
    const demandData = {};
    
    products.forEach(product => {
        demandData[product.id] = {
            product_name: product.product_name,
            category: product.category,
            unit: product.unit,
            current_stock: product.current_stock,
            total_ordered: 0,
            total_dispatched: 0,
            avg_order_quantity: 0,
            order_frequency: 0
        };
    });
    
    orders.forEach(order => {
        if (demandData[order.product_id]) {
            demandData[order.product_id].total_ordered += order.quantity;
            if (order.status === 'Dispatched' || order.status === 'Invoiced') {
                demandData[order.product_id].total_dispatched += order.quantity;
            }
            demandData[order.product_id].order_frequency++;
        }
    });
    
    // Calculate averages and forecast
    const data = Object.values(demandData).map(item => {
        item.avg_order_quantity = item.order_frequency > 0 ? item.total_ordered / item.order_frequency : 0;
        item.stock_days = item.avg_order_quantity > 0 ? item.current_stock / item.avg_order_quantity : 999;
        item.reorder_needed = item.stock_days < 30;
        item.forecast_monthly = item.avg_order_quantity * 4; // Estimate 4 orders per month
        return item;
    }).sort((a, b) => a.stock_days - b.stock_days);
    
    const reportHtml = `
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">
                    <i class="fas fa-chart-line text-yellow-600 mr-2"></i>
                    Demand Analysis & Forecasting
                </h2>
                <button onclick="exportReport('demand_analysis')" class="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700">
                    <i class="fas fa-download mr-2"></i>Export CSV
                </button>
            </div>
            
            <!-- Alert for reorder -->
            ${data.filter(d => d.reorder_needed).length > 0 ? `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <div class="flex items-center">
                        <i class="fas fa-exclamation-triangle text-red-600 text-2xl mr-3"></i>
                        <div>
                            <p class="font-medium text-red-800">Reorder Alert</p>
                            <p class="text-sm text-red-700">
                                ${data.filter(d => d.reorder_needed).length} products need reordering based on current demand
                            </p>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <!-- Data Table -->
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Product</th>
                            <th class="text-left py-3 px-4">Unit</th>
                            <th class="text-right py-3 px-4">Current Stock</th>
                            <th class="text-right py-3 px-4">Total Ordered</th>
                            <th class="text-right py-3 px-4">Avg Order Qty</th>
                            <th class="text-right py-3 px-4">Order Frequency</th>
                            <th class="text-right py-3 px-4">Est. Stock Days</th>
                            <th class="text-right py-3 px-4">Monthly Forecast</th>
                            <th class="text-left py-3 px-4">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(row => `
                            <tr class="border-b hover:bg-gray-50 ${row.reorder_needed ? 'bg-red-50' : ''}">
                                <td class="py-3 px-4 font-medium">${row.product_name}</td>
                                <td class="py-3 px-4">${row.unit}</td>
                                <td class="py-3 px-4 text-right ${row.reorder_needed ? 'text-red-600 font-bold' : ''}">${row.current_stock}</td>
                                <td class="py-3 px-4 text-right">${row.total_ordered}</td>
                                <td class="py-3 px-4 text-right">${row.avg_order_quantity.toFixed(1)}</td>
                                <td class="py-3 px-4 text-right">${row.order_frequency}</td>
                                <td class="py-3 px-4 text-right">${row.stock_days < 999 ? Math.floor(row.stock_days) + ' days' : '∞'}</td>
                                <td class="py-3 px-4 text-right">${row.forecast_monthly.toFixed(0)}</td>
                                <td class="py-3 px-4">
                                    ${row.reorder_needed ? 
                                        '<span class="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">Reorder</span>' :
                                        '<span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">Adequate</span>'
                                    }
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    document.getElementById('reportDisplay').innerHTML = reportHtml;
    window.currentReportData = data;
}

async function showSalesPersonReport() {
    const { orders, user } = window.reportData;
    
    const salesData = {};
    
    orders.forEach(order => {
        if (order.status === 'Invoiced') {
            const person = order.sales_person;
            if (!salesData[person]) {
                salesData[person] = {
                    name: person,
                    orders: 0,
                    revenue: 0,
                    quantity: 0
                };
            }
            salesData[person].orders++;
            salesData[person].revenue += order.total_amount;
            salesData[person].quantity += order.quantity;
        }
    });
    
    const data = Object.values(salesData).sort((a, b) => b.revenue - a.revenue);
    
    const reportHtml = `
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">
                    <i class="fas fa-users text-red-600 mr-2"></i>
                    Sales Person Performance Report
                </h2>
                <button onclick="exportReport('sales_person')" class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
                    <i class="fas fa-download mr-2"></i>Export CSV
                </button>
            </div>
            
            <!-- Leaderboard -->
            <div class="mb-6">
                <h3 class="font-bold text-gray-800 mb-4">Top Performers</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    ${data.slice(0, 3).map((person, index) => `
                        <div class="bg-gradient-to-br ${
                            index === 0 ? 'from-yellow-400 to-yellow-600' :
                            index === 1 ? 'from-gray-300 to-gray-500' :
                            'from-orange-400 to-orange-600'
                        } text-white p-6 rounded-lg text-center">
                            <div class="text-5xl mb-2">
                                ${index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                            </div>
                            <p class="text-xl font-bold">${person.name}</p>
                            <p class="text-3xl font-bold my-2">${Utils.formatCurrency(person.revenue, 'INR')}</p>
                            <p class="text-sm">${person.orders} orders</p>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Chart -->
            <div style="height: 300px;" class="mb-6">
                <canvas id="salesPersonChart"></canvas>
            </div>
            
            <!-- Data Table -->
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Rank</th>
                            <th class="text-left py-3 px-4">Sales Person</th>
                            <th class="text-right py-3 px-4">Orders</th>
                            <th class="text-right py-3 px-4">Quantity Sold</th>
                            <th class="text-right py-3 px-4">Revenue (INR)</th>
                            <th class="text-right py-3 px-4">Avg Order Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map((row, index) => `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="py-3 px-4">
                                    <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">
                                        #${index + 1}
                                    </span>
                                </td>
                                <td class="py-3 px-4 font-medium">${row.name}</td>
                                <td class="py-3 px-4 text-right">${row.orders}</td>
                                <td class="py-3 px-4 text-right">${row.quantity}</td>
                                <td class="py-3 px-4 text-right">${Utils.formatCurrency(row.revenue, 'INR')}</td>
                                <td class="py-3 px-4 text-right">${Utils.formatCurrency(row.revenue / row.orders, 'INR')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    document.getElementById('reportDisplay').innerHTML = reportHtml;
    
    // Chart
    new Chart(document.getElementById('salesPersonChart'), {
        type: 'bar',
        data: {
            labels: data.map(d => d.name),
            datasets: [{
                label: 'Revenue (INR)',
                data: data.map(d => d.revenue),
                backgroundColor: '#ef4444'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y'
        }
    });
    
    window.currentReportData = data;
}

async function showBuyerAnalysis() {
    const { orders, buyers } = window.reportData;
    
    const buyerData = {};
    
    orders.forEach(order => {
        if (order.status === 'Invoiced') {
            const buyer = order.buyer_name;
            if (!buyerData[buyer]) {
                buyerData[buyer] = {
                    name: buyer,
                    orders: 0,
                    revenue: 0,
                    last_order: order.order_date
                };
            }
            buyerData[buyer].orders++;
            buyerData[buyer].revenue += order.total_amount;
            if (new Date(order.order_date) > new Date(buyerData[buyer].last_order)) {
                buyerData[buyer].last_order = order.order_date;
            }
        }
    });
    
    const data = Object.values(buyerData).sort((a, b) => b.revenue - a.revenue);
    
    const reportHtml = `
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">
                    <i class="fas fa-handshake text-indigo-600 mr-2"></i>
                    Buyer Analysis Report
                </h2>
                <button onclick="exportReport('buyer_analysis')" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                    <i class="fas fa-download mr-2"></i>Export CSV
                </button>
            </div>
            
            <!-- Top Buyers -->
            <div class="mb-6">
                <h3 class="font-bold text-gray-800 mb-4">Top 5 Buyers by Revenue</h3>
                <div class="space-y-3">
                    ${data.slice(0, 5).map((buyer, index) => {
                        const percentage = (buyer.revenue / data.reduce((sum, b) => sum + b.revenue, 0) * 100).toFixed(1);
                        return `
                            <div class="flex items-center justify-between p-4 bg-indigo-50 rounded-lg">
                                <div class="flex items-center flex-1">
                                    <span class="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold mr-3">
                                        ${index + 1}
                                    </span>
                                    <div class="flex-1">
                                        <p class="font-medium">${buyer.name}</p>
                                        <p class="text-sm text-gray-500">${buyer.orders} orders • Last: ${Utils.formatDate(buyer.last_order)}</p>
                                        <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
                                            <div class="bg-indigo-600 h-2 rounded-full" style="width: ${percentage}%"></div>
                                        </div>
                                    </div>
                                </div>
                                <div class="text-right ml-4">
                                    <p class="font-bold text-indigo-600">${Utils.formatCurrency(buyer.revenue, 'INR')}</p>
                                    <p class="text-sm text-gray-500">${percentage}%</p>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <!-- Data Table -->
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Buyer Name</th>
                            <th class="text-right py-3 px-4">Total Orders</th>
                            <th class="text-right py-3 px-4">Total Revenue (INR)</th>
                            <th class="text-right py-3 px-4">Avg Order Value</th>
                            <th class="text-left py-3 px-4">Last Order Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(row => `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="py-3 px-4 font-medium">${row.name}</td>
                                <td class="py-3 px-4 text-right">${row.orders}</td>
                                <td class="py-3 px-4 text-right">${Utils.formatCurrency(row.revenue, 'INR')}</td>
                                <td class="py-3 px-4 text-right">${Utils.formatCurrency(row.revenue / row.orders, 'INR')}</td>
                                <td class="py-3 px-4">${Utils.formatDate(row.last_order)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    document.getElementById('reportDisplay').innerHTML = reportHtml;
    window.currentReportData = data;
}

async function showRevenueReport() {
    const { invoices } = window.reportData;
    
    const totalRevenue = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    const totalTax = invoices.reduce((sum, inv) => sum + inv.tax_amount, 0);
    const avgInvoice = invoices.length > 0 ? totalRevenue / invoices.length : 0;
    
    // Monthly trend
    const monthlyRevenue = {};
    invoices.forEach(inv => {
        const date = new Date(inv.invoice_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyRevenue[monthKey]) {
            monthlyRevenue[monthKey] = 0;
        }
        monthlyRevenue[monthKey] += inv.total_amount;
    });
    
    const months = Object.keys(monthlyRevenue).sort();
    
    const reportHtml = `
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">
                    <i class="fas fa-rupee-sign text-teal-600 mr-2"></i>
                    Revenue Report
                </h2>
                <button onclick="exportReport('revenue')" class="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700">
                    <i class="fas fa-download mr-2"></i>Export CSV
                </button>
            </div>
            
            <!-- Summary -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-teal-50 p-4 rounded-lg">
                    <p class="text-sm text-teal-600 font-medium">Total Revenue</p>
                    <p class="text-2xl font-bold text-teal-800">${Utils.formatCurrency(totalRevenue, 'INR')}</p>
                </div>
                <div class="bg-blue-50 p-4 rounded-lg">
                    <p class="text-sm text-blue-600 font-medium">Total Invoices</p>
                    <p class="text-2xl font-bold text-blue-800">${invoices.length}</p>
                </div>
                <div class="bg-purple-50 p-4 rounded-lg">
                    <p class="text-sm text-purple-600 font-medium">Tax Collected</p>
                    <p class="text-2xl font-bold text-purple-800">${Utils.formatCurrency(totalTax, 'INR')}</p>
                </div>
                <div class="bg-green-50 p-4 rounded-lg">
                    <p class="text-sm text-green-600 font-medium">Avg Invoice Value</p>
                    <p class="text-2xl font-bold text-green-800">${Utils.formatCurrency(avgInvoice, 'INR')}</p>
                </div>
            </div>
            
            <!-- Chart -->
            <div style="height: 400px;">
                <canvas id="revenueChart"></canvas>
            </div>
        </div>
    `;
    
    document.getElementById('reportDisplay').innerHTML = reportHtml;
    
    // Chart
    new Chart(document.getElementById('revenueChart'), {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Monthly Revenue (INR)',
                data: months.map(m => monthlyRevenue[m]),
                borderColor: '#14b8a6',
                backgroundColor: 'rgba(20, 184, 166, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

async function showInventoryReport() {
    const { products } = window.reportData;
    
    const totalValue = products.reduce((sum, p) => sum + (p.current_stock * p.price_inr), 0);
    const lowStock = products.filter(p => p.current_stock <= p.min_stock_level);
    
    const reportHtml = `
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">
                    <i class="fas fa-boxes text-orange-600 mr-2"></i>
                    Inventory Report
                </h2>
                <button onclick="exportReport('inventory')" class="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700">
                    <i class="fas fa-download mr-2"></i>Export CSV
                </button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="bg-orange-50 p-4 rounded-lg">
                    <p class="text-sm text-orange-600 font-medium">Total Products</p>
                    <p class="text-2xl font-bold text-orange-800">${products.length}</p>
                </div>
                <div class="bg-green-50 p-4 rounded-lg">
                    <p class="text-sm text-green-600 font-medium">Inventory Value</p>
                    <p class="text-2xl font-bold text-green-800">${Utils.formatCurrency(totalValue, 'INR')}</p>
                </div>
                <div class="bg-red-50 p-4 rounded-lg">
                    <p class="text-sm text-red-600 font-medium">Low Stock Items</p>
                    <p class="text-2xl font-bold text-red-800">${lowStock.length}</p>
                </div>
            </div>
            
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Product</th>
                            <th class="text-left py-3 px-4">Unit</th>
                            <th class="text-right py-3 px-4">Stock</th>
                            <th class="text-right py-3 px-4">Value (INR)</th>
                            <th class="text-left py-3 px-4">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.map(p => `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="py-3 px-4">${p.product_name}</td>
                                <td class="py-3 px-4">${p.unit}</td>
                                <td class="py-3 px-4 text-right">${p.current_stock}</td>
                                <td class="py-3 px-4 text-right">${Utils.formatCurrency(p.current_stock * p.price_inr, 'INR')}</td>
                                <td class="py-3 px-4">
                                    ${p.current_stock <= p.min_stock_level ? 
                                        '<span class="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm">Low</span>' :
                                        '<span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">OK</span>'
                                    }
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    document.getElementById('reportDisplay').innerHTML = reportHtml;
}

function exportReport(reportType) {
    if (!window.currentReportData) {
        Utils.showNotification('No data to export', 'warning');
        return;
    }
    
    Utils.exportToCSV(window.currentReportData, reportType);
}
