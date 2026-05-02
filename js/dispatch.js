// Dispatch Module
async function loadDispatchPending(content, user) {
    const orders = await API.getAll('orders');
    
    // Get pipeline orders sorted by date (FIFO) with urgent orders first
    const pipelineOrders = orders
        .filter(o => o.status === 'Pipeline')
        .sort((a, b) => {
            // Urgent orders first
            if (a.is_urgent && !b.is_urgent) return -1;
            if (!a.is_urgent && b.is_urgent) return 1;
            // Then by date (oldest first - FIFO)
            return new Date(a.order_date) - new Date(b.order_date);
        });
    
    content.innerHTML = `
        <div class="mb-6 flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold text-gray-800">Pending Dispatch</h1>
                <p class="text-gray-600">Orders ready for dispatch (FIFO - First In First Out)</p>
            </div>
            <button onclick="generateDispatchSlip()" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-200">
                <i class="fas fa-file-alt mr-2"></i>Generate Dispatch Slip
            </button>
        </div>
        
        <!-- Stats -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Total Pending</p>
                        <p class="text-3xl font-bold text-gray-800 mt-2">${pipelineOrders.length}</p>
                    </div>
                    <div class="bg-yellow-100 p-3 rounded-full">
                        <i class="fas fa-clock text-2xl text-yellow-600"></i>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Urgent Orders</p>
                        <p class="text-3xl font-bold text-red-600 mt-2">${pipelineOrders.filter(o => o.is_urgent).length}</p>
                    </div>
                    <div class="bg-red-100 p-3 rounded-full">
                        <i class="fas fa-exclamation-triangle text-2xl text-red-600"></i>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Selected for Dispatch</p>
                        <p class="text-3xl font-bold text-blue-600 mt-2" id="selectedCount">0</p>
                    </div>
                    <div class="bg-blue-100 p-3 rounded-full">
                        <i class="fas fa-check-circle text-2xl text-blue-600"></i>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">
                                <input type="checkbox" id="selectAll" onchange="toggleSelectAll()">
                            </th>
                            <th class="text-left py-3 px-4">Priority</th>
                            <th class="text-left py-3 px-4">Order No.</th>
                            <th class="text-left py-3 px-4">Order Date</th>
                            <th class="text-left py-3 px-4">Buyer</th>
                            <th class="text-left py-3 px-4">Product</th>
                            <th class="text-left py-3 px-4">Quantity</th>
                            <th class="text-left py-3 px-4">Unit</th>
                            <th class="text-left py-3 px-4">Amount</th>
                            <th class="text-left py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pipelineOrders.map((order, index) => `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="py-3 px-4">
                                    <input type="checkbox" class="order-checkbox" value="${order.id}" onchange="updateSelectedCount()">
                                </td>
                                <td class="py-3 px-4">
                                    ${order.is_urgent ? 
                                        '<span class="urgent-badge">URGENT</span>' : 
                                        `<span class="text-sm text-gray-500">#${index + 1}</span>`
                                    }
                                </td>
                                <td class="py-3 px-4 font-medium">${order.order_number}</td>
                                <td class="py-3 px-4">${Utils.formatDate(order.order_date)}</td>
                                <td class="py-3 px-4">${order.buyer_name}</td>
                                <td class="py-3 px-4">${order.product_name}</td>
                                <td class="py-3 px-4">${order.quantity} ${order.unit_type}</td>
                                <td class="py-3 px-4">${order.manufacturing_unit}</td>
                                <td class="py-3 px-4">${Utils.formatCurrency(order.total_amount, order.currency)}</td>
                                <td class="py-3 px-4">
                                    <button onclick="editDispatchOrder('${order.id}')" class="text-blue-600 hover:text-blue-800 mr-2" title="Edit Quantity">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="viewOrder('${order.id}')" class="text-green-600 hover:text-green-800" title="View Details">
                                        <i class="fas fa-eye"></i>
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

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
    updateSelectedCount();
}

function updateSelectedCount() {
    const checked = document.querySelectorAll('.order-checkbox:checked').length;
    document.getElementById('selectedCount').textContent = checked;
}

async function editDispatchOrder(orderId) {
    const order = await API.getById('orders', orderId);
    
    const formHtml = `
        <form id="editDispatchOrderForm" class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-lg mb-4">
                <p class="text-sm text-blue-800"><i class="fas fa-info-circle mr-2"></i>
                You can adjust the quantity based on stock availability.</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Order Number</label>
                    <input type="text" value="${order.order_number}" readonly class="w-full px-4 py-2 border rounded-lg bg-gray-100">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Buyer</label>
                    <input type="text" value="${order.buyer_name}" readonly class="w-full px-4 py-2 border rounded-lg bg-gray-100">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Product</label>
                    <input type="text" value="${order.product_name}" readonly class="w-full px-4 py-2 border rounded-lg bg-gray-100">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Original Quantity</label>
                    <input type="text" value="${order.quantity} ${order.unit_type}" readonly class="w-full px-4 py-2 border rounded-lg bg-gray-100">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">New Quantity *</label>
                    <input type="number" name="quantity" value="${order.quantity}" min="0" required onchange="recalculateDispatchTotal()" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Unit Price</label>
                    <input type="number" value="${order.unit_price}" readonly class="w-full px-4 py-2 border rounded-lg bg-gray-100">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Total Amount</label>
                    <input type="number" id="dispatchTotalAmount" value="${order.total_amount}" readonly class="w-full px-4 py-2 border rounded-lg bg-gray-100">
                </div>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Reason for Change (if any)</label>
                <textarea name="notes" rows="2" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">${order.notes || ''}</textarea>
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
            function recalculateDispatchTotal() {
                const quantity = parseFloat(document.querySelector('[name="quantity"]').value);
                const unitPrice = ${order.unit_price};
                document.getElementById('dispatchTotalAmount').value = (quantity * unitPrice).toFixed(2);
            }
        </script>
    `;
    
    showModal('Edit Dispatch Order', formHtml, 'max-w-3xl');
    
    document.getElementById('editDispatchOrderForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const updateData = {
            ...order,
            quantity: parseFloat(formData.get('quantity')),
            total_amount: parseFloat(document.getElementById('dispatchTotalAmount').value),
            notes: formData.get('notes') || order.notes
        };
        
        try {
            await API.update('orders', orderId, updateData);
            Utils.showNotification('Order updated successfully', 'success');
            closeModal();
            loadPage('dispatch-pending');
        } catch (error) {
            Utils.showNotification('Error updating order', 'error');
        }
    });
}

async function generateDispatchSlip() {
    const selectedCheckboxes = document.querySelectorAll('.order-checkbox:checked');
    
    if (selectedCheckboxes.length === 0) {
        Utils.showNotification('Please select at least one order to dispatch', 'warning');
        return;
    }
    
    const selectedOrderIds = Array.from(selectedCheckboxes).map(cb => cb.value);
    const orders = await API.getAll('orders');
    const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id));
    
    const user = authManager.getCurrentUser();
    const slipNumber = 'DS-' + Date.now();
    
    // Create dispatch slip
    const slipData = {
        id: Utils.generateId('slip'),
        slip_number: slipNumber,
        dispatch_date: new Date().toISOString(),
        order_ids: selectedOrderIds.join(','),
        dispatched_by: user.username,
        total_items: selectedOrders.length,
        notes: '',
        status: 'Prepared'
    };
    
    try {
        await API.create('dispatch_slips', slipData);
        
        // Update orders to Dispatched status
        for (const orderId of selectedOrderIds) {
            await API.patch('orders', orderId, {
                status: 'Dispatched',
                dispatch_date: new Date().toISOString()
            });
        }
        
        // Show dispatch slip
        showDispatchSlipPreview(slipData, selectedOrders);
    } catch (error) {
        Utils.showNotification('Error generating dispatch slip', 'error');
    }
}

function showDispatchSlipPreview(slip, orders) {
    const totalQuantity = orders.reduce((sum, o) => sum + o.quantity, 0);
    const totalAmount = orders.reduce((sum, o) => sum + o.total_amount, 0);
    
    const previewHtml = `
        <div id="dispatchSlipContent">
            <div class="border-b pb-4 mb-4">
                <div class="flex justify-between items-start">
                    <div class="flex items-start space-x-3">
                        <img src="https://page.gensparksite.com/v1/base64_upload/9df1f51ca725382bf845fb19357a7ef5" alt="SSI Logo" style="height: 70px; width: auto; background: white; padding: 5px; border-radius: 5px;">
                        <div>
                            <h2 class="text-2xl font-bold text-gray-800">DISPATCH SLIP</h2>
                            <p class="text-gray-600 mt-1">Shree Sai Industries</p>
                            <p class="text-sm text-gray-500">Modinagar, UP • Patla, UP</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-medium">Slip No: ${slip.slip_number}</p>
                        <p class="text-sm text-gray-600">Date: ${Utils.formatDate(slip.dispatch_date)}</p>
                        <p class="text-sm text-gray-600">Prepared by: ${slip.dispatched_by}</p>
                    </div>
                </div>
            </div>
            
            <table class="w-full mb-6">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="text-left py-2 px-3 text-sm">Order No.</th>
                        <th class="text-left py-2 px-3 text-sm">Buyer</th>
                        <th class="text-left py-2 px-3 text-sm">Product</th>
                        <th class="text-left py-2 px-3 text-sm">Quantity</th>
                        <th class="text-left py-2 px-3 text-sm">Unit</th>
                        <th class="text-right py-2 px-3 text-sm">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => `
                        <tr class="border-b">
                            <td class="py-2 px-3 text-sm">${order.order_number}</td>
                            <td class="py-2 px-3 text-sm">${order.buyer_name}</td>
                            <td class="py-2 px-3 text-sm">${order.product_name}</td>
                            <td class="py-2 px-3 text-sm">${order.quantity} ${order.unit_type}</td>
                            <td class="py-2 px-3 text-sm">${order.manufacturing_unit}</td>
                            <td class="py-2 px-3 text-sm text-right">${Utils.formatCurrency(order.total_amount, order.currency)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot class="bg-gray-50">
                    <tr>
                        <td colspan="3" class="py-2 px-3 text-sm font-bold">Total</td>
                        <td class="py-2 px-3 text-sm font-bold">${totalQuantity} items</td>
                        <td class="py-2 px-3 text-sm"></td>
                        <td class="py-2 px-3 text-sm text-right font-bold">${Utils.formatCurrency(totalAmount, 'INR')}</td>
                    </tr>
                </tfoot>
            </table>
            
            <div class="border-t pt-4 mt-6">
                <div class="grid grid-cols-2 gap-8">
                    <div>
                        <p class="text-sm text-gray-600 mb-2">Prepared By:</p>
                        <div class="border-b border-gray-400 w-48 mt-8"></div>
                        <p class="text-xs text-gray-500 mt-1">Signature & Date</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-600 mb-2">Received By:</p>
                        <div class="border-b border-gray-400 w-48 mt-8"></div>
                        <p class="text-xs text-gray-500 mt-1">Signature & Date</p>
                    </div>
                </div>
            </div>
            
            <div class="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p class="text-xs text-yellow-800">
                    <i class="fas fa-info-circle mr-1"></i>
                    This dispatch slip has been auto-sent to Accounts Department for invoice generation.
                </p>
            </div>
        </div>
        
        <div class="flex justify-end space-x-4 mt-6 no-print">
            <button onclick="window.print()" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                <i class="fas fa-print mr-2"></i>Print Dispatch Slip
            </button>
            <button onclick="confirmDispatch('${slip.id}')" class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition duration-200">
                <i class="fas fa-check mr-2"></i>Confirm & Close
            </button>
        </div>
    `;
    
    showModal('Dispatch Slip Generated', previewHtml, 'max-w-4xl');
}

async function confirmDispatch(slipId) {
    try {
        await API.patch('dispatch_slips', slipId, { status: 'Dispatched' });
        Utils.showNotification('Dispatch completed successfully!', 'success');
        closeModal();
        loadPage('dispatch-pending');
    } catch (error) {
        Utils.showNotification('Error confirming dispatch', 'error');
    }
}

async function loadDispatchSlips(content, user) {
    const slips = await API.getAll('dispatch_slips');
    
    content.innerHTML = `
        <div class="mb-6">
            <h1 class="text-3xl font-bold text-gray-800">Dispatch Slips</h1>
            <p class="text-gray-600">All dispatch slip records</p>
        </div>
        
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Slip No.</th>
                            <th class="text-left py-3 px-4">Date</th>
                            <th class="text-left py-3 px-4">Dispatched By</th>
                            <th class="text-left py-3 px-4">Total Items</th>
                            <th class="text-left py-3 px-4">Status</th>
                            <th class="text-left py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${slips.map(slip => `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="py-3 px-4 font-medium">${slip.slip_number}</td>
                                <td class="py-3 px-4">${Utils.formatDate(slip.dispatch_date)}</td>
                                <td class="py-3 px-4">${slip.dispatched_by}</td>
                                <td class="py-3 px-4">${slip.total_items}</td>
                                <td class="py-3 px-4">
                                    <span class="px-3 py-1 rounded-full text-sm font-medium ${
                                        slip.status === 'Dispatched' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                    }">
                                        ${slip.status}
                                    </span>
                                </td>
                                <td class="py-3 px-4">
                                    <button onclick="viewDispatchSlip('${slip.id}')" class="text-blue-600 hover:text-blue-800 mr-2">
                                        <i class="fas fa-eye"></i> View
                                    </button>
                                    <button onclick="printDispatchSlip('${slip.id}')" class="text-green-600 hover:text-green-800">
                                        <i class="fas fa-print"></i> Print
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

async function viewDispatchSlip(slipId) {
    const slip = await API.getById('dispatch_slips', slipId);
    const orderIds = slip.order_ids.split(',');
    const allOrders = await API.getAll('orders');
    const slipOrders = allOrders.filter(o => orderIds.includes(o.id));
    
    showDispatchSlipPreview(slip, slipOrders);
}

async function printDispatchSlip(slipId) {
    await viewDispatchSlip(slipId);
    setTimeout(() => window.print(), 500);
}
