// Sales Module
async function loadSalesOrders(content, user) {
    const orders = await API.getAll('orders');
    
    // Filter orders for sales person
    const userOrders = user.role === 'Sales' 
        ? orders.filter(o => o.sales_person === user.username)
        : orders;
    
    content.innerHTML = `
        <div class="mb-6 flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold text-gray-800">Sales Orders</h1>
                <p class="text-gray-600">${user.role === 'Sales' ? 'Your' : 'All'} orders and sales register</p>
                ${user.role === 'Sales' ? `
                    <div class="mt-2 inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        <i class="fas fa-user mr-2"></i>
                        Owner: ${user.full_name} (You)
                    </div>
                ` : ''}
            </div>
            <button onclick="showAddOrderModal()" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-200">
                <i class="fas fa-plus mr-2"></i>New Order
            </button>
        </div>
        
        <!-- Filter Tabs -->
        <div class="bg-white rounded-lg shadow mb-6 p-4">
            <div class="flex flex-wrap gap-2">
                <button onclick="filterOrders('all')" class="filter-btn px-4 py-2 rounded-lg bg-blue-600 text-white" data-filter="all">
                    All Orders (${userOrders.length})
                </button>
                <button onclick="filterOrders('Pipeline')" class="filter-btn px-4 py-2 rounded-lg bg-gray-200" data-filter="Pipeline">
                    Pipeline (${userOrders.filter(o => o.status === 'Pipeline').length})
                </button>
                <button onclick="filterOrders('Dispatched')" class="filter-btn px-4 py-2 rounded-lg bg-gray-200" data-filter="Dispatched">
                    Dispatched (${userOrders.filter(o => o.status === 'Dispatched').length})
                </button>
                <button onclick="filterOrders('Invoiced')" class="filter-btn px-4 py-2 rounded-lg bg-gray-200" data-filter="Invoiced">
                    Invoiced (${userOrders.filter(o => o.status === 'Invoiced').length})
                </button>
            </div>
        </div>
        
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="p-4 border-b">
                <input type="text" id="orderSearch" placeholder="Search orders..." 
                    class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onkeyup="searchOrders()">
            </div>
            <div class="overflow-x-auto">
                <table class="w-full" id="ordersTable">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Order No.</th>
                            <th class="text-left py-3 px-4">Date</th>
                            <th class="text-left py-3 px-4">Buyer</th>
                            <th class="text-left py-3 px-4">Product</th>
                            <th class="text-left py-3 px-4">Quantity</th>
                            <th class="text-left py-3 px-4">Amount</th>
                            <th class="text-left py-3 px-4">Unit</th>
                            <th class="text-left py-3 px-4">Status</th>
                            ${user.role === 'Admin' ? '<th class="text-left py-3 px-4">Sales Person</th>' : ''}
                            <th class="text-left py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="ordersTableBody">
                        ${renderOrderRows(userOrders, user)}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Store orders globally for filtering
    window.currentOrders = userOrders;
    window.currentUser = user;
}

function renderOrderRows(orders, user) {
    if (orders.length === 0) {
        return '<tr><td colspan="10" class="text-center py-8 text-gray-500">No orders found</td></tr>';
    }
    
    return orders.map(order => `
        <tr class="border-b hover:bg-gray-50" data-status="${order.status}">
            <td class="py-3 px-4 font-medium">
                ${order.order_number}
                ${order.is_urgent ? '<span class="urgent-badge ml-2">URGENT</span>' : ''}
            </td>
            <td class="py-3 px-4">${Utils.formatDate(order.order_date)}</td>
            <td class="py-3 px-4">${order.buyer_name}</td>
            <td class="py-3 px-4">${order.product_name}</td>
            <td class="py-3 px-4">${order.quantity} ${order.unit_type}</td>
            <td class="py-3 px-4">${Utils.formatCurrency(order.total_amount, order.currency)}</td>
            <td class="py-3 px-4">${order.manufacturing_unit}</td>
            <td class="py-3 px-4">
                <span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span>
            </td>
            ${user.role === 'Admin' ? `<td class="py-3 px-4">${order.sales_person}</td>` : ''}
            <td class="py-3 px-4">
                <button onclick="viewOrder('${order.id}')" class="text-blue-600 hover:text-blue-800 mr-2" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
                ${order.status === 'Pipeline' ? `
                    <button onclick="editOrder('${order.id}')" class="text-green-600 hover:text-green-800 mr-2" title="Edit Order">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteOrder('${order.id}')" class="text-red-600 hover:text-red-800" title="Delete Order">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

function filterOrders(status) {
    const orders = window.currentOrders;
    const filtered = status === 'all' ? orders : orders.filter(o => o.status === status);
    
    document.getElementById('ordersTableBody').innerHTML = renderOrderRows(filtered, window.currentUser);
    
    // Update button styles
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200');
    });
    document.querySelector(`[data-filter="${status}"]`).classList.add('bg-blue-600', 'text-white');
    document.querySelector(`[data-filter="${status}"]`).classList.remove('bg-gray-200');
}

function searchOrders() {
    const searchTerm = document.getElementById('orderSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#ordersTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

async function showAddOrderModal() {
    const [buyers, products] = await Promise.all([
        API.getAll('buyers'),
        API.getAll('products')
    ]);
    
    const user = authManager.getCurrentUser();
    const userBuyers = user.role === 'Sales' 
        ? buyers.filter(b => b.added_by === user.username)
        : buyers;
    
    const formHtml = `
        <form id="addOrderForm" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Buyer *</label>
                    <select name="buyer_id" id="buyerSelect" required onchange="updateBuyerInfo()" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select Buyer</option>
                        ${userBuyers.map(b => `<option value="${b.id}" data-name="${b.company_name}" data-currency="${b.preferred_currency}">${b.company_name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Product *</label>
                    <select name="product_id" id="productSelect" required onchange="updateProductInfo()" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select Product</option>
                        ${products.map(p => `
                            <option value="${p.id}" 
                                data-name="${p.product_name}" 
                                data-price-inr="${p.price_inr}"
                                data-price-usd="${p.price_usd}"
                                data-unit="${p.unit}"
                                data-unit-type="${p.unit_type}"
                                data-packaging="${p.packaging}"
                                data-stock="${p.current_stock}">
                                ${p.product_name} (${p.unit}) - Stock: ${p.current_stock} ${p.unit_type}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <!-- New: Number of Bags/Units -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">No. of Bags/Units *</label>
                    <input type="number" id="numBagsInput" min="1" required onchange="calculateQuantityAndTotal()" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter number">
                </div>
                
                <!-- New: Weight per Bag/Unit (auto-filled from product packaging) -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Weight per Bag/Unit</label>
                    <input type="text" id="weightPerBagInput" readonly class="w-full px-4 py-2 border rounded-lg bg-gray-100" placeholder="Select product first">
                </div>
                
                <!-- Auto-calculated Total Quantity -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Total Quantity (Auto)</label>
                    <div class="flex space-x-2">
                        <input type="number" name="quantity" id="quantityInput" readonly class="flex-1 px-4 py-2 border rounded-lg bg-gray-100">
                        <input type="text" id="unitTypeDisplay" readonly class="w-20 px-4 py-2 border rounded-lg bg-gray-100 text-center" placeholder="Unit">
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Currency *</label>
                    <select name="currency" id="currencySelect" required onchange="calculateQuantityAndTotal()" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                    </select>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Unit Price (Auto)</label>
                    <input type="number" name="unit_price" id="unitPriceInput" readonly class="w-full px-4 py-2 border rounded-lg bg-gray-100">
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Total Order Value (Auto)</label>
                    <input type="number" name="total_amount" id="totalAmountInput" readonly class="w-full px-4 py-2 border rounded-lg bg-gray-100 font-bold">
                </div>
                
                <div class="md:col-span-2">
                    <label class="flex items-center">
                        <input type="checkbox" name="is_urgent" class="mr-2">
                        <span class="text-sm font-medium text-gray-700">Mark as Urgent</span>
                    </label>
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                    <textarea name="notes" rows="3" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                </div>
            </div>
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition duration-200">
                    Cancel
                </button>
                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-save mr-2"></i>Save Order
                </button>
            </div>
        </form>
    `;
    
    showModal('Add New Order', formHtml, 'max-w-4xl');
    
    // Store data for calculations
    window.modalBuyers = userBuyers;
    window.modalProducts = products;
    
    document.getElementById('addOrderForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const buyerSelect = document.getElementById('buyerSelect');
        const productSelect = document.getElementById('productSelect');
        const selectedBuyer = buyerSelect.options[buyerSelect.selectedIndex];
        const selectedProduct = productSelect.options[productSelect.selectedIndex];
        
        const orderData = {
            id: Utils.generateId('order'),
            order_number: 'ORD-' + Date.now(),
            buyer_id: formData.get('buyer_id'),
            buyer_name: selectedBuyer.dataset.name,
            sales_person: user.username,
            order_date: new Date().toISOString(),
            product_id: formData.get('product_id'),
            product_name: selectedProduct.dataset.name,
            quantity: parseFloat(formData.get('quantity')),
            unit_type: selectedProduct.dataset.unitType,
            unit_price: parseFloat(formData.get('unit_price')),
            total_amount: parseFloat(formData.get('total_amount')),
            currency: formData.get('currency'),
            status: 'Pipeline',
            is_urgent: formData.get('is_urgent') === 'on',
            dispatch_date: '',
            invoice_number: '',
            notes: formData.get('notes') || '',
            manufacturing_unit: selectedProduct.dataset.unit
        };
        
        try {
            await API.create('orders', orderData);
            Utils.showNotification('Order created successfully', 'success');
            closeModal();
            loadPage('sales-orders');
        } catch (error) {
            Utils.showNotification('Error creating order', 'error');
        }
    });
}

function updateBuyerInfo() {
    const buyerSelect = document.getElementById('buyerSelect');
    const selectedOption = buyerSelect.options[buyerSelect.selectedIndex];
    if (selectedOption.value) {
        const currency = selectedOption.dataset.currency;
        document.getElementById('currencySelect').value = currency;
        calculateQuantityAndTotal();
    }
}

function updateProductInfo() {
    const productSelect = document.getElementById('productSelect');
    const selectedOption = productSelect.options[productSelect.selectedIndex];
    
    if (selectedOption.value) {
        // Show packaging weight
        const packaging = selectedOption.dataset.packaging;
        const unitType = selectedOption.dataset.unitType;
        document.getElementById('weightPerBagInput').value = packaging;
        document.getElementById('unitTypeDisplay').value = unitType;
        
        calculateQuantityAndTotal();
    }
}

function calculateQuantityAndTotal() {
    const productSelect = document.getElementById('productSelect');
    const numBags = parseFloat(document.getElementById('numBagsInput').value) || 0;
    const currency = document.getElementById('currencySelect').value;
    
    if (productSelect.value && numBags > 0) {
        const selectedOption = productSelect.options[productSelect.selectedIndex];
        const packaging = selectedOption.dataset.packaging;
        const priceInr = parseFloat(selectedOption.dataset.priceInr);
        const priceUsd = parseFloat(selectedOption.dataset.priceUsd);
        const unitType = selectedOption.dataset.unitType;
        
        // Extract numeric value from packaging (e.g., "1kg" -> 1, "500g" -> 0.5)
        let weightPerBag = 0;
        if (packaging.includes('kg')) {
            weightPerBag = parseFloat(packaging.replace('kg', ''));
        } else if (packaging.includes('g')) {
            weightPerBag = parseFloat(packaging.replace('g', '')) / 1000; // Convert to kg
        } else {
            weightPerBag = 1; // For nos/units, count as 1
        }
        
        // Calculate total quantity
        const totalQuantity = numBags * weightPerBag;
        document.getElementById('quantityInput').value = totalQuantity.toFixed(2);
        
        // Calculate pricing
        const unitPrice = currency === 'INR' ? priceInr : priceUsd;
        const totalAmount = unitPrice * numBags; // Price is per bag/package
        
        document.getElementById('unitPriceInput').value = unitPrice.toFixed(2);
        document.getElementById('totalAmountInput').value = totalAmount.toFixed(2);
    }
}

async function viewOrder(orderId) {
    const order = await API.getById('orders', orderId);
    
    const detailsHtml = `
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm text-gray-600">Order Number</p>
                    <p class="font-medium">${order.order_number}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Order Date</p>
                    <p class="font-medium">${Utils.formatDate(order.order_date)}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Buyer</p>
                    <p class="font-medium">${order.buyer_name}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Sales Person</p>
                    <p class="font-medium">${order.sales_person}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Product</p>
                    <p class="font-medium">${order.product_name}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Manufacturing Unit</p>
                    <p class="font-medium">${order.manufacturing_unit}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Quantity</p>
                    <p class="font-medium">${order.quantity} ${order.unit_type}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Unit Price</p>
                    <p class="font-medium">${Utils.formatCurrency(order.unit_price, order.currency)}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Total Amount</p>
                    <p class="font-medium text-lg">${Utils.formatCurrency(order.total_amount, order.currency)}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Status</p>
                    <p><span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span></p>
                </div>
                ${order.is_urgent ? '<div><p class="urgent-badge">URGENT ORDER</p></div>' : ''}
            </div>
            ${order.notes ? `
                <div>
                    <p class="text-sm text-gray-600">Notes</p>
                    <p class="font-medium">${order.notes}</p>
                </div>
            ` : ''}
            ${order.dispatch_date ? `
                <div>
                    <p class="text-sm text-gray-600">Dispatch Date</p>
                    <p class="font-medium">${Utils.formatDate(order.dispatch_date)}</p>
                </div>
            ` : ''}
            ${order.invoice_number ? `
                <div>
                    <p class="text-sm text-gray-600">Invoice Number</p>
                    <p class="font-medium">${order.invoice_number}</p>
                </div>
            ` : ''}
        </div>
    `;
    
    showModal('Order Details', detailsHtml);
}

async function editOrder(orderId) {
    const order = await API.getById('orders', orderId);
    const [buyers, products] = await Promise.all([
        API.getAll('buyers'),
        API.getAll('products')
    ]);
    
    const formHtml = `
        <form id="editOrderForm" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
                    <input type="number" name="quantity" value="${order.quantity}" min="1" required onchange="recalculateTotal()" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Unit Price</label>
                    <input type="number" name="unit_price" value="${order.unit_price}" readonly class="w-full px-4 py-2 border rounded-lg bg-gray-100">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Total Amount</label>
                    <input type="number" name="total_amount" id="editTotalAmount" value="${order.total_amount}" readonly class="w-full px-4 py-2 border rounded-lg bg-gray-100">
                </div>
                <div>
                    <label class="flex items-center">
                        <input type="checkbox" name="is_urgent" ${order.is_urgent ? 'checked' : ''} class="mr-2">
                        <span class="text-sm font-medium text-gray-700">Mark as Urgent</span>
                    </label>
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                    <textarea name="notes" rows="3" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">${order.notes || ''}</textarea>
                </div>
            </div>
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition duration-200">
                    Cancel
                </button>
                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-save mr-2"></i>Update Order
                </button>
            </div>
        </form>
        <script>
            function recalculateTotal() {
                const quantity = parseFloat(document.querySelector('[name="quantity"]').value);
                const unitPrice = ${order.unit_price};
                document.getElementById('editTotalAmount').value = (quantity * unitPrice).toFixed(2);
            }
        </script>
    `;
    
    showModal('Edit Order', formHtml, 'max-w-2xl');
    
    document.getElementById('editOrderForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const updateData = {
            ...order,
            quantity: parseFloat(formData.get('quantity')),
            total_amount: parseFloat(formData.get('total_amount')),
            is_urgent: formData.get('is_urgent') === 'on',
            notes: formData.get('notes') || ''
        };
        
        try {
            await API.update('orders', orderId, updateData);
            Utils.showNotification('Order updated successfully', 'success');
            closeModal();
            loadPage('sales-orders');
        } catch (error) {
            Utils.showNotification('Error updating order', 'error');
        }
    });
}

async function deleteOrder(orderId) {
    if (Utils.confirm('Are you sure you want to delete this order?')) {
        try {
            await API.delete('orders', orderId);
            Utils.showNotification('Order deleted successfully', 'success');
            loadPage('sales-orders');
        } catch (error) {
            Utils.showNotification('Error deleting order', 'error');
        }
    }
}

// Buyers Management
async function loadSalesBuyers(content, user) {
    const buyers = await API.getAll('buyers');
    
    // Filter buyers for sales person
    const userBuyers = user.role === 'Sales' 
        ? buyers.filter(b => b.added_by === user.username)
        : buyers;
    
    content.innerHTML = `
        <div class="mb-6 flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold text-gray-800">Buyer Management</h1>
                <p class="text-gray-600">${user.role === 'Sales' ? 'Your' : 'All'} buyers database</p>
                ${user.role === 'Sales' ? `
                    <div class="mt-2 inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                        <i class="fas fa-user mr-2"></i>
                        Owner: ${user.full_name} (You)
                    </div>
                ` : ''}
            </div>
            <div class="flex space-x-2">
                <button onclick="showBulkUploadModal()" class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition duration-200">
                    <i class="fas fa-upload mr-2"></i>Bulk Upload
                </button>
                <button onclick="showAddBuyerModal()" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-plus mr-2"></i>Add Buyer
                </button>
            </div>
        </div>
        
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="p-4 border-b">
                <input type="text" id="buyerSearch" placeholder="Search buyers..." 
                    class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onkeyup="searchBuyers()">
            </div>
            <div class="overflow-x-auto">
                <table class="w-full" id="buyersTable">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Company Name</th>
                            <th class="text-left py-3 px-4">Contact Person</th>
                            <th class="text-left py-3 px-4">Email</th>
                            <th class="text-left py-3 px-4">Phone</th>
                            <th class="text-left py-3 px-4">City</th>
                            <th class="text-left py-3 px-4">GSTIN</th>
                            ${user.role === 'Admin' ? '<th class="text-left py-3 px-4">Added By</th>' : ''}
                            <th class="text-left py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${userBuyers.map(buyer => `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="py-3 px-4 font-medium">${buyer.company_name}</td>
                                <td class="py-3 px-4">${buyer.contact_person}</td>
                                <td class="py-3 px-4">${buyer.email}</td>
                                <td class="py-3 px-4">${buyer.phone}</td>
                                <td class="py-3 px-4">${buyer.city}</td>
                                <td class="py-3 px-4">${buyer.gstin}</td>
                                ${user.role === 'Admin' ? `<td class="py-3 px-4">${buyer.added_by}</td>` : ''}
                                <td class="py-3 px-4">
                                    <button onclick="viewBuyer('${buyer.id}')" class="text-blue-600 hover:text-blue-800 mr-2">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button onclick="editBuyer('${buyer.id}')" class="text-green-600 hover:text-green-800 mr-2">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="deleteBuyer('${buyer.id}')" class="text-red-600 hover:text-red-800">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function searchBuyers() {
    const searchTerm = document.getElementById('buyerSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#buyersTable tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

async function showAddBuyerModal() {
    const user = authManager.getCurrentUser();
    
    const formHtml = `
        <form id="addBuyerForm" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Company Name *</label>
                    <input type="text" name="company_name" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Contact Person *</label>
                    <input type="text" name="contact_person" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input type="email" name="email" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                    <input type="tel" name="phone" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Address *</label>
                    <textarea name="address" required rows="2" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">City *</label>
                    <input type="text" name="city" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">State *</label>
                    <input type="text" name="state" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">PIN Code *</label>
                    <input type="text" name="pincode" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">GSTIN *</label>
                    <input type="text" name="gstin" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Preferred Currency *</label>
                    <select name="preferred_currency" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                    </select>
                </div>
            </div>
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition duration-200">
                    Cancel
                </button>
                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-save mr-2"></i>Save Buyer
                </button>
            </div>
        </form>
    `;
    
    showModal('Add New Buyer', formHtml, 'max-w-4xl');
    
    document.getElementById('addBuyerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const buyerData = {
            id: Utils.generateId('buyer'),
            company_name: formData.get('company_name'),
            contact_person: formData.get('contact_person'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            address: formData.get('address'),
            city: formData.get('city'),
            state: formData.get('state'),
            pincode: formData.get('pincode'),
            gstin: formData.get('gstin'),
            preferred_currency: formData.get('preferred_currency'),
            added_by: user.username
        };
        
        try {
            await API.create('buyers', buyerData);
            Utils.showNotification('Buyer created successfully', 'success');
            closeModal();
            loadPage('sales-buyers');
        } catch (error) {
            Utils.showNotification('Error creating buyer', 'error');
        }
    });
}

async function viewBuyer(buyerId) {
    const buyer = await API.getById('buyers', buyerId);
    
    const detailsHtml = `
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm text-gray-600">Company Name</p>
                    <p class="font-medium">${buyer.company_name}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Contact Person</p>
                    <p class="font-medium">${buyer.contact_person}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Email</p>
                    <p class="font-medium">${buyer.email}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Phone</p>
                    <p class="font-medium">${buyer.phone}</p>
                </div>
                <div class="col-span-2">
                    <p class="text-sm text-gray-600">Address</p>
                    <p class="font-medium">${buyer.address}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">City</p>
                    <p class="font-medium">${buyer.city}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">State</p>
                    <p class="font-medium">${buyer.state}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">PIN Code</p>
                    <p class="font-medium">${buyer.pincode}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">GSTIN</p>
                    <p class="font-medium">${buyer.gstin}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Preferred Currency</p>
                    <p class="font-medium">${buyer.preferred_currency}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Added By</p>
                    <p class="font-medium">${buyer.added_by}</p>
                </div>
            </div>
        </div>
    `;
    
    showModal('Buyer Details', detailsHtml);
}

async function editBuyer(buyerId) {
    const buyer = await API.getById('buyers', buyerId);
    
    const formHtml = `
        <form id="editBuyerForm" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Company Name *</label>
                    <input type="text" name="company_name" value="${buyer.company_name}" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Contact Person *</label>
                    <input type="text" name="contact_person" value="${buyer.contact_person}" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input type="email" name="email" value="${buyer.email}" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                    <input type="tel" name="phone" value="${buyer.phone}" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Address *</label>
                    <textarea name="address" required rows="2" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">${buyer.address}</textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">City *</label>
                    <input type="text" name="city" value="${buyer.city}" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">State *</label>
                    <input type="text" name="state" value="${buyer.state}" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">PIN Code *</label>
                    <input type="text" name="pincode" value="${buyer.pincode}" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">GSTIN *</label>
                    <input type="text" name="gstin" value="${buyer.gstin}" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Preferred Currency *</label>
                    <select name="preferred_currency" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="INR" ${buyer.preferred_currency === 'INR' ? 'selected' : ''}>INR (₹)</option>
                        <option value="USD" ${buyer.preferred_currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                    </select>
                </div>
            </div>
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition duration-200">
                    Cancel
                </button>
                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-save mr-2"></i>Update Buyer
                </button>
            </div>
        </form>
    `;
    
    showModal('Edit Buyer', formHtml, 'max-w-4xl');
    
    document.getElementById('editBuyerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const updateData = {
            ...buyer,
            company_name: formData.get('company_name'),
            contact_person: formData.get('contact_person'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            address: formData.get('address'),
            city: formData.get('city'),
            state: formData.get('state'),
            pincode: formData.get('pincode'),
            gstin: formData.get('gstin'),
            preferred_currency: formData.get('preferred_currency')
        };
        
        try {
            await API.update('buyers', buyerId, updateData);
            Utils.showNotification('Buyer updated successfully', 'success');
            closeModal();
            loadPage('sales-buyers');
        } catch (error) {
            Utils.showNotification('Error updating buyer', 'error');
        }
    });
}

async function deleteBuyer(buyerId) {
    if (Utils.confirm('Are you sure you want to delete this buyer?')) {
        try {
            await API.delete('buyers', buyerId);
            Utils.showNotification('Buyer deleted successfully', 'success');
            loadPage('sales-buyers');
        } catch (error) {
            Utils.showNotification('Error deleting buyer', 'error');
        }
    }
}

function showBulkUploadModal() {
    const formHtml = `
        <div class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-lg">
                <h3 class="font-medium text-blue-800 mb-2">CSV Format Requirements:</h3>
                <p class="text-sm text-blue-700 mb-2">Your CSV file should have these columns:</p>
                <code class="text-xs bg-white px-2 py-1 rounded block">
                    company_name,contact_person,email,phone,address,city,state,pincode,gstin,preferred_currency
                </code>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Upload CSV File</label>
                <input type="file" id="buyerCsvFile" accept=".csv" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition duration-200">
                    Cancel
                </button>
                <button onclick="processBulkBuyerUpload()" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-upload mr-2"></i>Upload Buyers
                </button>
            </div>
        </div>
    `;
    
    showModal('Bulk Upload Buyers', formHtml);
}

async function processBulkBuyerUpload() {
    const fileInput = document.getElementById('buyerCsvFile');
    const file = fileInput.files[0];
    
    if (!file) {
        Utils.showNotification('Please select a CSV file', 'warning');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const csvData = Utils.parseCSV(e.target.result);
            const user = authManager.getCurrentUser();
            
            for (const row of csvData) {
                const buyerData = {
                    id: Utils.generateId('buyer'),
                    company_name: row.company_name || '',
                    contact_person: row.contact_person || '',
                    email: row.email || '',
                    phone: row.phone || '',
                    address: row.address || '',
                    city: row.city || '',
                    state: row.state || '',
                    pincode: row.pincode || '',
                    gstin: row.gstin || '',
                    preferred_currency: row.preferred_currency || 'INR',
                    added_by: user.username
                };
                
                await API.create('buyers', buyerData);
            }
            
            Utils.showNotification(`Successfully uploaded ${csvData.length} buyers`, 'success');
            closeModal();
            loadPage('sales-buyers');
        } catch (error) {
            console.error('Bulk upload error:', error);
            Utils.showNotification('Error processing CSV file', 'error');
        }
    };
    
    reader.readAsText(file);
}
