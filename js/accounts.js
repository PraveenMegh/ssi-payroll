// Accounts Module
async function loadAccountsInvoices(content, user) {
    const [invoices, orders] = await Promise.all([
        API.getAll('invoices'),
        API.getAll('orders')
    ]);
    
    // Get dispatched orders without invoices
    const dispatchedOrders = orders.filter(o => o.status === 'Dispatched' && !o.invoice_number);
    
    content.innerHTML = `
        <div class="mb-6 flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold text-gray-800">Invoice Management</h1>
                <p class="text-gray-600">Generate and manage invoices</p>
            </div>
            <button onclick="showCreateInvoiceModal()" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-200">
                <i class="fas fa-plus mr-2"></i>Create Invoice
            </button>
        </div>
        
        <!-- Pending Invoices Alert -->
        ${dispatchedOrders.length > 0 ? `
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div class="flex items-center">
                    <i class="fas fa-exclamation-triangle text-yellow-600 text-2xl mr-3"></i>
                    <div>
                        <p class="font-medium text-yellow-800">Pending Invoices</p>
                        <p class="text-sm text-yellow-700">
                            ${dispatchedOrders.length} dispatched orders are waiting for invoice generation
                        </p>
                    </div>
                    <button onclick="showPendingInvoices()" class="ml-auto bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700">
                        View Pending
                    </button>
                </div>
            </div>
        ` : ''}
        
        <!-- Stats -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Total Invoices</p>
                        <p class="text-3xl font-bold text-gray-800 mt-2">${invoices.length}</p>
                    </div>
                    <div class="bg-blue-100 p-3 rounded-full">
                        <i class="fas fa-file-invoice text-2xl text-blue-600"></i>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Total Revenue</p>
                        <p class="text-2xl font-bold text-green-600 mt-2">
                            ${Utils.formatCurrency(invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0), 'INR')}
                        </p>
                    </div>
                    <div class="bg-green-100 p-3 rounded-full">
                        <i class="fas fa-rupee-sign text-2xl text-green-600"></i>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Pending</p>
                        <p class="text-3xl font-bold text-yellow-600 mt-2">${dispatchedOrders.length}</p>
                    </div>
                    <div class="bg-yellow-100 p-3 rounded-full">
                        <i class="fas fa-clock text-2xl text-yellow-600"></i>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">This Month</p>
                        <p class="text-3xl font-bold text-purple-600 mt-2">
                            ${invoices.filter(inv => {
                                const invDate = new Date(inv.invoice_date);
                                const now = new Date();
                                return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
                            }).length}
                        </p>
                    </div>
                    <div class="bg-purple-100 p-3 rounded-full">
                        <i class="fas fa-calendar text-2xl text-purple-600"></i>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Invoices Table -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="p-4 border-b">
                <input type="text" id="invoiceSearch" placeholder="Search invoices..." 
                    class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onkeyup="searchInvoices()">
            </div>
            <div class="overflow-x-auto">
                <table class="w-full" id="invoicesTable">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Invoice No.</th>
                            <th class="text-left py-3 px-4">Date</th>
                            <th class="text-left py-3 px-4">Buyer</th>
                            <th class="text-left py-3 px-4">Order No.</th>
                            <th class="text-left py-3 px-4">Amount</th>
                            <th class="text-left py-3 px-4">Status</th>
                            <th class="text-left py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invoices.map(invoice => `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="py-3 px-4 font-medium">${invoice.invoice_number}</td>
                                <td class="py-3 px-4">${Utils.formatDate(invoice.invoice_date)}</td>
                                <td class="py-3 px-4">${invoice.buyer_name}</td>
                                <td class="py-3 px-4">${invoice.order_id}</td>
                                <td class="py-3 px-4 font-medium">${Utils.formatCurrency(invoice.total_amount, invoice.currency)}</td>
                                <td class="py-3 px-4">
                                    <span class="px-3 py-1 rounded-full text-sm font-medium ${
                                        invoice.status === 'Paid' ? 'bg-green-100 text-green-800' : 
                                        invoice.status === 'Sent' ? 'bg-blue-100 text-blue-800' : 
                                        'bg-gray-100 text-gray-800'
                                    }">
                                        ${invoice.status}
                                    </span>
                                </td>
                                <td class="py-3 px-4">
                                    <button onclick="viewInvoice('${invoice.id}')" class="text-blue-600 hover:text-blue-800 mr-2" title="View">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button onclick="printInvoice('${invoice.id}')" class="text-green-600 hover:text-green-800 mr-2" title="Print">
                                        <i class="fas fa-print"></i>
                                    </button>
                                    <button onclick="downloadInvoice('${invoice.id}')" class="text-purple-600 hover:text-purple-800" title="Download">
                                        <i class="fas fa-download"></i>
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

function searchInvoices() {
    const searchTerm = document.getElementById('invoiceSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#invoicesTable tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

async function showPendingInvoices() {
    const orders = await API.getAll('orders');
    const dispatchedOrders = orders.filter(o => o.status === 'Dispatched' && !o.invoice_number);
    
    const pendingHtml = `
        <div class="space-y-4">
            <p class="text-gray-600">Select orders to generate invoices:</p>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-2 px-3 text-sm">Order No.</th>
                            <th class="text-left py-2 px-3 text-sm">Buyer</th>
                            <th class="text-left py-2 px-3 text-sm">Amount</th>
                            <th class="text-left py-2 px-3 text-sm">Dispatch Date</th>
                            <th class="text-left py-2 px-3 text-sm">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dispatchedOrders.map(order => `
                            <tr class="border-b">
                                <td class="py-2 px-3 text-sm">${order.order_number}</td>
                                <td class="py-2 px-3 text-sm">${order.buyer_name}</td>
                                <td class="py-2 px-3 text-sm">${Utils.formatCurrency(order.total_amount, order.currency)}</td>
                                <td class="py-2 px-3 text-sm">${Utils.formatDate(order.dispatch_date)}</td>
                                <td class="py-2 px-3 text-sm">
                                    <button onclick="generateInvoiceForOrder('${order.id}')" class="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700">
                                        Generate Invoice
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    showModal('Pending Invoices', pendingHtml, 'max-w-4xl');
}

async function showCreateInvoiceModal() {
    const orders = await API.getAll('orders');
    const dispatchedOrders = orders.filter(o => o.status === 'Dispatched' && !o.invoice_number);
    
    if (dispatchedOrders.length === 0) {
        Utils.showNotification('No dispatched orders available for invoicing', 'info');
        return;
    }
    
    const formHtml = `
        <form id="createInvoiceForm" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Select Order *</label>
                <select name="order_id" id="orderSelectInvoice" required onchange="loadOrderDetailsForInvoice()" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select Order</option>
                    ${dispatchedOrders.map(o => `
                        <option value="${o.id}" 
                            data-buyer-id="${o.buyer_id}"
                            data-buyer-name="${o.buyer_name}"
                            data-product="${o.product_name}"
                            data-quantity="${o.quantity}"
                            data-unit="${o.unit_type}"
                            data-price="${o.unit_price}"
                            data-total="${o.total_amount}"
                            data-currency="${o.currency}">
                            ${o.order_number} - ${o.buyer_name} - ${Utils.formatCurrency(o.total_amount, o.currency)}
                        </option>
                    `).join('')}
                </select>
            </div>
            
            <div id="invoiceDetails" class="hidden space-y-4">
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h3 class="font-medium mb-2">Order Details</h3>
                    <div id="orderDetailsContent"></div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Tax %</label>
                        <input type="number" name="tax_percent" value="18" min="0" max="100" step="0.01" onchange="calculateInvoiceTotal()" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Tax Amount</label>
                        <input type="number" id="taxAmount" readonly class="w-full px-4 py-2 border rounded-lg bg-gray-100">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Subtotal</label>
                        <input type="number" id="invoiceSubtotal" readonly class="w-full px-4 py-2 border rounded-lg bg-gray-100">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Total Amount</label>
                        <input type="number" id="invoiceTotal" readonly class="w-full px-4 py-2 border rounded-lg bg-gray-100 font-bold">
                    </div>
                </div>
            </div>
            
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition duration-200">
                    Cancel
                </button>
                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-file-invoice mr-2"></i>Generate Invoice
                </button>
            </div>
        </form>
    `;
    
    showModal('Create Invoice', formHtml, 'max-w-3xl');
    
    window.selectedOrderData = null;
    
    document.getElementById('createInvoiceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await generateInvoiceFromForm();
    });
}

function loadOrderDetailsForInvoice() {
    const select = document.getElementById('orderSelectInvoice');
    const selectedOption = select.options[select.selectedIndex];
    
    if (selectedOption.value) {
        const orderData = {
            id: selectedOption.value,
            buyer_id: selectedOption.dataset.buyerId,
            buyer_name: selectedOption.dataset.buyerName,
            product: selectedOption.dataset.product,
            quantity: selectedOption.dataset.quantity,
            unit: selectedOption.dataset.unit,
            price: parseFloat(selectedOption.dataset.price),
            total: parseFloat(selectedOption.dataset.total),
            currency: selectedOption.dataset.currency
        };
        
        window.selectedOrderData = orderData;
        
        document.getElementById('orderDetailsContent').innerHTML = `
            <div class="space-y-1 text-sm">
                <p><span class="font-medium">Buyer:</span> ${orderData.buyer_name}</p>
                <p><span class="font-medium">Product:</span> ${orderData.product}</p>
                <p><span class="font-medium">Quantity:</span> ${orderData.quantity} ${orderData.unit}</p>
                <p><span class="font-medium">Unit Price:</span> ${Utils.formatCurrency(orderData.price, orderData.currency)}</p>
                <p><span class="font-medium">Amount:</span> ${Utils.formatCurrency(orderData.total, orderData.currency)}</p>
            </div>
        `;
        
        document.getElementById('invoiceDetails').classList.remove('hidden');
        calculateInvoiceTotal();
    }
}

function calculateInvoiceTotal() {
    if (!window.selectedOrderData) return;
    
    const orderTotal = window.selectedOrderData.total;
    const taxPercent = parseFloat(document.querySelector('[name="tax_percent"]').value) || 0;
    const taxAmount = (orderTotal * taxPercent) / 100;
    const total = orderTotal + taxAmount;
    
    document.getElementById('invoiceSubtotal').value = orderTotal.toFixed(2);
    document.getElementById('taxAmount').value = taxAmount.toFixed(2);
    document.getElementById('invoiceTotal').value = total.toFixed(2);
}

async function generateInvoiceFromForm() {
    const orderData = window.selectedOrderData;
    if (!orderData) return;
    
    const order = await API.getById('orders', orderData.id);
    const buyer = await API.getById('buyers', order.buyer_id);
    
    await generateInvoiceForOrder(order.id, true);
}

async function generateInvoiceForOrder(orderId, fromModal = false) {
    try {
        const order = await API.getById('orders', orderId);
        const buyer = await API.getById('buyers', order.buyer_id);
        const user = authManager.getCurrentUser();
        
        const invoiceNumber = 'INV-' + Date.now();
        const taxPercent = 18; // GST
        const subtotal = order.total_amount;
        const taxAmount = (subtotal * taxPercent) / 100;
        const totalAmount = subtotal + taxAmount;
        
        const invoiceData = {
            id: Utils.generateId('invoice'),
            invoice_number: invoiceNumber,
            invoice_date: new Date().toISOString(),
            order_id: order.order_number,
            buyer_id: buyer.id,
            buyer_name: buyer.company_name,
            buyer_gstin: buyer.gstin,
            buyer_address: `${buyer.address}, ${buyer.city}, ${buyer.state} - ${buyer.pincode}`,
            product_details: JSON.stringify({
                product_name: order.product_name,
                quantity: order.quantity,
                unit_type: order.unit_type,
                unit_price: order.unit_price
            }),
            subtotal: subtotal,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            currency: order.currency,
            created_by: user.username,
            status: 'Draft'
        };
        
        await API.create('invoices', invoiceData);
        
        // Update order with invoice number
        await API.patch('orders', orderId, {
            status: 'Invoiced',
            invoice_number: invoiceNumber
        });
        
        Utils.showNotification('Invoice generated successfully!', 'success');
        
        if (fromModal) {
            closeModal();
        }
        
        loadPage('accounts-invoices');
        
        // Show invoice preview
        setTimeout(() => viewInvoice(invoiceData.id), 500);
        
    } catch (error) {
        console.error('Invoice generation error:', error);
        Utils.showNotification('Error generating invoice', 'error');
    }
}

async function viewInvoice(invoiceId) {
    const invoice = await API.getById('invoices', invoiceId);
    const productDetails = JSON.parse(invoice.product_details);
    
    const invoiceHtml = `
        <div id="invoiceContent">
            <!-- Invoice Header -->
            <div class="border-b-2 border-gray-300 pb-4 mb-6">
                <div class="flex justify-between items-start">
                    <div class="flex items-start space-x-3">
                        <img src="https://page.gensparksite.com/v1/base64_upload/9df1f51ca725382bf845fb19357a7ef5" alt="SSI Logo" style="height: 80px; width: auto; background: white; padding: 6px; border-radius: 6px;">
                        <div>
                            <h1 class="text-3xl font-bold text-gray-800">TAX INVOICE</h1>
                            <h2 class="text-xl font-semibold text-blue-600 mt-2">Shree Sai Industries</h2>
                            <p class="text-sm text-gray-600 mt-1">Head Office: Modinagar, Uttar Pradesh</p>
                            <p class="text-sm text-gray-600">Unit 2: Patla, Uttar Pradesh</p>
                            <p class="text-sm text-gray-600 mt-2">GSTIN: [Your GSTIN]</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="bg-blue-600 text-white px-4 py-2 rounded">
                            <p class="text-sm">Invoice No.</p>
                            <p class="text-lg font-bold">${invoice.invoice_number}</p>
                        </div>
                        <p class="text-sm text-gray-600 mt-2">Date: ${Utils.formatDate(invoice.invoice_date)}</p>
                        <p class="text-sm text-gray-600">Order: ${invoice.order_id}</p>
                    </div>
                </div>
            </div>
            
            <!-- Buyer Details -->
            <div class="mb-6">
                <h3 class="font-bold text-gray-700 mb-2">Bill To:</h3>
                <div class="bg-gray-50 p-4 rounded">
                    <p class="font-medium text-gray-800">${invoice.buyer_name}</p>
                    <p class="text-sm text-gray-600">${invoice.buyer_address}</p>
                    <p class="text-sm text-gray-600 mt-1">GSTIN: ${invoice.buyer_gstin}</p>
                </div>
            </div>
            
            <!-- Invoice Items -->
            <table class="w-full mb-6">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="text-left py-3 px-4 text-sm font-medium">Description</th>
                        <th class="text-right py-3 px-4 text-sm font-medium">Quantity</th>
                        <th class="text-right py-3 px-4 text-sm font-medium">Unit Price</th>
                        <th class="text-right py-3 px-4 text-sm font-medium">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="border-b">
                        <td class="py-3 px-4">${productDetails.product_name}</td>
                        <td class="py-3 px-4 text-right">${productDetails.quantity} ${productDetails.unit_type}</td>
                        <td class="py-3 px-4 text-right">${Utils.formatCurrency(productDetails.unit_price, invoice.currency)}</td>
                        <td class="py-3 px-4 text-right">${Utils.formatCurrency(invoice.subtotal, invoice.currency)}</td>
                    </tr>
                </tbody>
            </table>
            
            <!-- Totals -->
            <div class="flex justify-end mb-6">
                <div class="w-64">
                    <div class="flex justify-between py-2 border-b">
                        <span class="text-gray-600">Subtotal:</span>
                        <span class="font-medium">${Utils.formatCurrency(invoice.subtotal, invoice.currency)}</span>
                    </div>
                    <div class="flex justify-between py-2 border-b">
                        <span class="text-gray-600">Tax (GST 18%):</span>
                        <span class="font-medium">${Utils.formatCurrency(invoice.tax_amount, invoice.currency)}</span>
                    </div>
                    <div class="flex justify-between py-3 bg-blue-50 px-2 rounded">
                        <span class="font-bold text-lg">Total Amount:</span>
                        <span class="font-bold text-lg text-blue-600">${Utils.formatCurrency(invoice.total_amount, invoice.currency)}</span>
                    </div>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="border-t pt-4 mt-8">
                <div class="grid grid-cols-2 gap-8">
                    <div>
                        <p class="text-sm text-gray-600 mb-2">Terms & Conditions:</p>
                        <ul class="text-xs text-gray-500 space-y-1">
                            <li>• Payment due within 30 days</li>
                            <li>• Please make checks payable to Shree Sai Industries</li>
                        </ul>
                    </div>
                    <div class="text-right">
                        <p class="text-sm text-gray-600 mb-4">For Shree Sai Industries</p>
                        <div class="border-b border-gray-400 w-48 ml-auto mt-12"></div>
                        <p class="text-xs text-gray-500 mt-1">Authorized Signatory</p>
                    </div>
                </div>
            </div>
            
            <div class="mt-6 text-center">
                <p class="text-xs text-gray-500">
                    This is a computer-generated invoice and does not require a signature.
                </p>
            </div>
        </div>
        
        <div class="flex justify-end space-x-4 mt-6 no-print">
            <button onclick="window.print()" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                <i class="fas fa-print mr-2"></i>Print Invoice
            </button>
            <button onclick="markInvoiceAsSent('${invoice.id}')" class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition duration-200">
                <i class="fas fa-paper-plane mr-2"></i>Mark as Sent
            </button>
        </div>
    `;
    
    showModal('Invoice Preview', invoiceHtml, 'max-w-4xl');
}

async function printInvoice(invoiceId) {
    await viewInvoice(invoiceId);
    setTimeout(() => window.print(), 500);
}

async function downloadInvoice(invoiceId) {
    await viewInvoice(invoiceId);
    Utils.showNotification('Use browser Print > Save as PDF to download', 'info');
}

async function markInvoiceAsSent(invoiceId) {
    try {
        await API.patch('invoices', invoiceId, { status: 'Sent' });
        Utils.showNotification('Invoice marked as sent', 'success');
        closeModal();
        loadPage('accounts-invoices');
    } catch (error) {
        Utils.showNotification('Error updating invoice status', 'error');
    }
}
