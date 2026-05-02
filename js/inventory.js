// Inventory Management Module
async function loadInventory(content, user) {
    const products = await API.getAll('products');
    
    // Group by unit
    const modinagarProducts = products.filter(p => p.unit === 'Modinagar');
    const patlaProducts = products.filter(p => p.unit === 'Patla');
    
    // Calculate stats
    const totalProducts = products.length;
    const lowStockCount = products.filter(p => p.current_stock <= p.min_stock_level).length;
    const totalValue = products.reduce((sum, p) => sum + (p.current_stock * p.price_inr), 0);
    
    content.innerHTML = `
        <div class="mb-6 flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold text-gray-800">Inventory Management</h1>
                <p class="text-gray-600">Stock levels across all units</p>
            </div>
            ${user.role === 'Admin' ? `
                <div class="flex space-x-2">
                    <button onclick="showBulkProductUploadModal()" class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition duration-200">
                        <i class="fas fa-upload mr-2"></i>Bulk Upload
                    </button>
                    <button onclick="showAddProductModal()" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-200">
                        <i class="fas fa-plus mr-2"></i>Add Product
                    </button>
                </div>
            ` : ''}
        </div>
        
        <!-- Stats -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Total Products</p>
                        <p class="text-3xl font-bold text-gray-800 mt-2">${totalProducts}</p>
                    </div>
                    <div class="bg-blue-100 p-3 rounded-full">
                        <i class="fas fa-box text-2xl text-blue-600"></i>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Low Stock Items</p>
                        <p class="text-3xl font-bold text-red-600 mt-2">${lowStockCount}</p>
                    </div>
                    <div class="bg-red-100 p-3 rounded-full">
                        <i class="fas fa-exclamation-triangle text-2xl text-red-600"></i>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Inventory Value</p>
                        <p class="text-2xl font-bold text-green-600 mt-2">${Utils.formatCurrency(totalValue, 'INR')}</p>
                    </div>
                    <div class="bg-green-100 p-3 rounded-full">
                        <i class="fas fa-rupee-sign text-2xl text-green-600"></i>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Units</p>
                        <p class="text-3xl font-bold text-purple-600 mt-2">2</p>
                        <p class="text-xs text-gray-500 mt-1">Modinagar • Patla</p>
                    </div>
                    <div class="bg-purple-100 p-3 rounded-full">
                        <i class="fas fa-industry text-2xl text-purple-600"></i>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Modinagar Unit -->
        <div class="bg-white rounded-lg shadow mb-6">
            <div class="bg-blue-600 text-white px-6 py-4 rounded-t-lg">
                <h2 class="text-xl font-bold flex items-center">
                    <i class="fas fa-industry mr-2"></i>
                    Modinagar Unit - Head Office
                </h2>
                <p class="text-sm text-blue-100">Products: Rock Salt, Black Salt</p>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Product</th>
                            <th class="text-left py-3 px-4">Category</th>
                            <th class="text-left py-3 px-4">Packaging</th>
                            <th class="text-left py-3 px-4">Current Stock</th>
                            <th class="text-left py-3 px-4">Min Level</th>
                            <th class="text-left py-3 px-4">Price (INR)</th>
                            <th class="text-left py-3 px-4">Price (USD)</th>
                            <th class="text-left py-3 px-4">Status</th>
                            ${user.role === 'Admin' ? '<th class="text-left py-3 px-4">Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${renderInventoryRows(modinagarProducts, user)}
                    </tbody>
                </table>
            </div>
        </div>
        
        <!-- Patla Unit -->
        <div class="bg-white rounded-lg shadow">
            <div class="bg-green-600 text-white px-6 py-4 rounded-t-lg">
                <h2 class="text-xl font-bold flex items-center">
                    <i class="fas fa-industry mr-2"></i>
                    Patla Unit
                </h2>
                <p class="text-sm text-green-100">Products: Water Melon Seeds, Kasuri Methi</p>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4">Product</th>
                            <th class="text-left py-3 px-4">Category</th>
                            <th class="text-left py-3 px-4">Packaging</th>
                            <th class="text-left py-3 px-4">Current Stock</th>
                            <th class="text-left py-3 px-4">Min Level</th>
                            <th class="text-left py-3 px-4">Price (INR)</th>
                            <th class="text-left py-3 px-4">Price (USD)</th>
                            <th class="text-left py-3 px-4">Status</th>
                            ${user.role === 'Admin' ? '<th class="text-left py-3 px-4">Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${renderInventoryRows(patlaProducts, user)}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderInventoryRows(products, user) {
    if (products.length === 0) {
        return '<tr><td colspan="9" class="text-center py-8 text-gray-500">No products found</td></tr>';
    }
    
    return products.map(product => {
        const isLowStock = product.current_stock <= product.min_stock_level;
        
        return `
            <tr class="border-b hover:bg-gray-50 ${isLowStock ? 'bg-red-50' : ''}">
                <td class="py-3 px-4 font-medium">${product.product_name}</td>
                <td class="py-3 px-4">${product.category}</td>
                <td class="py-3 px-4">${product.packaging}</td>
                <td class="py-3 px-4 ${isLowStock ? 'text-red-600 font-bold' : 'font-medium'}">
                    ${product.current_stock} ${product.unit_type}
                </td>
                <td class="py-3 px-4">${product.min_stock_level}</td>
                <td class="py-3 px-4">${Utils.formatCurrency(product.price_inr, 'INR')}</td>
                <td class="py-3 px-4">${Utils.formatCurrency(product.price_usd, 'USD')}</td>
                <td class="py-3 px-4">
                    ${isLowStock ? 
                        '<span class="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">Low Stock</span>' :
                        '<span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">In Stock</span>'
                    }
                </td>
                ${user.role === 'Admin' ? `
                    <td class="py-3 px-4">
                        <button onclick="updateStock('${product.id}')" class="text-blue-600 hover:text-blue-800 mr-2" title="Update Stock">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="editProduct('${product.id}')" class="text-green-600 hover:text-green-800 mr-2" title="Edit Product">
                            <i class="fas fa-cog"></i>
                        </button>
                        <button onclick="deleteProduct('${product.id}')" class="text-red-600 hover:text-red-800" title="Delete Product">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                ` : ''}
            </tr>
        `;
    }).join('');
}

async function showAddProductModal() {
    const formHtml = `
        <form id="addProductForm" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
                    <input type="text" name="product_name" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                    <select name="category" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select Category</option>
                        <option value="Rock Salt">Rock Salt</option>
                        <option value="Black Salt">Black Salt</option>
                        <option value="Water Melon Seeds">Water Melon Seeds</option>
                        <option value="Kasuri Methi">Kasuri Methi</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Manufacturing Unit *</label>
                    <select name="unit" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select Unit</option>
                        <option value="Modinagar">Modinagar</option>
                        <option value="Patla">Patla</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Packaging *</label>
                    <input type="text" name="packaging" required placeholder="e.g., 1kg, 500g, 25kg" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Unit Type *</label>
                    <select name="unit_type" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="kg">kg</option>
                        <option value="nos">nos</option>
                        <option value="units">units</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Price (INR) *</label>
                    <input type="number" name="price_inr" required step="0.01" min="0" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Price (USD) *</label>
                    <input type="number" name="price_usd" required step="0.01" min="0" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Current Stock *</label>
                    <input type="number" name="current_stock" required min="0" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Minimum Stock Level *</label>
                    <input type="number" name="min_stock_level" required min="0" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
            </div>
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition duration-200">
                    Cancel
                </button>
                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-save mr-2"></i>Save Product
                </button>
            </div>
        </form>
    `;
    
    showModal('Add New Product', formHtml, 'max-w-4xl');
    
    document.getElementById('addProductForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const productData = {
            id: Utils.generateId('prod'),
            product_name: formData.get('product_name'),
            category: formData.get('category'),
            unit: formData.get('unit'),
            packaging: formData.get('packaging'),
            unit_type: formData.get('unit_type'),
            price_inr: parseFloat(formData.get('price_inr')),
            price_usd: parseFloat(formData.get('price_usd')),
            current_stock: parseFloat(formData.get('current_stock')),
            min_stock_level: parseFloat(formData.get('min_stock_level'))
        };
        
        try {
            await API.create('products', productData);
            Utils.showNotification('Product created successfully', 'success');
            closeModal();
            loadPage('inventory');
        } catch (error) {
            Utils.showNotification('Error creating product', 'error');
        }
    });
}

async function updateStock(productId) {
    const product = await API.getById('products', productId);
    
    const formHtml = `
        <form id="updateStockForm" class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-lg mb-4">
                <p class="font-medium text-blue-800">${product.product_name}</p>
                <p class="text-sm text-blue-600">Current Stock: ${product.current_stock} ${product.unit_type}</p>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">New Stock Quantity *</label>
                <input type="number" name="current_stock" value="${product.current_stock}" required min="0" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition duration-200">
                    Cancel
                </button>
                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-save mr-2"></i>Update Stock
                </button>
            </div>
        </form>
    `;
    
    showModal('Update Stock', formHtml);
    
    document.getElementById('updateStockForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            await API.patch('products', productId, {
                current_stock: parseFloat(formData.get('current_stock'))
            });
            Utils.showNotification('Stock updated successfully', 'success');
            closeModal();
            loadPage('inventory');
        } catch (error) {
            Utils.showNotification('Error updating stock', 'error');
        }
    });
}

async function editProduct(productId) {
    const product = await API.getById('products', productId);
    
    const formHtml = `
        <form id="editProductForm" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
                    <input type="text" name="product_name" value="${product.product_name}" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                    <select name="category" required class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="Rock Salt" ${product.category === 'Rock Salt' ? 'selected' : ''}>Rock Salt</option>
                        <option value="Black Salt" ${product.category === 'Black Salt' ? 'selected' : ''}>Black Salt</option>
                        <option value="Water Melon Seeds" ${product.category === 'Water Melon Seeds' ? 'selected' : ''}>Water Melon Seeds</option>
                        <option value="Kasuri Methi" ${product.category === 'Kasuri Methi' ? 'selected' : ''}>Kasuri Methi</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Price (INR) *</label>
                    <input type="number" name="price_inr" value="${product.price_inr}" required step="0.01" min="0" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Price (USD) *</label>
                    <input type="number" name="price_usd" value="${product.price_usd}" required step="0.01" min="0" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Minimum Stock Level *</label>
                    <input type="number" name="min_stock_level" value="${product.min_stock_level}" required min="0" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
            </div>
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition duration-200">
                    Cancel
                </button>
                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-save mr-2"></i>Update Product
                </button>
            </div>
        </form>
    `;
    
    showModal('Edit Product', formHtml, 'max-w-3xl');
    
    document.getElementById('editProductForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const updateData = {
            ...product,
            product_name: formData.get('product_name'),
            category: formData.get('category'),
            price_inr: parseFloat(formData.get('price_inr')),
            price_usd: parseFloat(formData.get('price_usd')),
            min_stock_level: parseFloat(formData.get('min_stock_level'))
        };
        
        try {
            await API.update('products', productId, updateData);
            Utils.showNotification('Product updated successfully', 'success');
            closeModal();
            loadPage('inventory');
        } catch (error) {
            Utils.showNotification('Error updating product', 'error');
        }
    });
}

async function deleteProduct(productId) {
    if (Utils.confirm('Are you sure you want to delete this product?')) {
        try {
            await API.delete('products', productId);
            Utils.showNotification('Product deleted successfully', 'success');
            loadPage('inventory');
        } catch (error) {
            Utils.showNotification('Error deleting product', 'error');
        }
    }
}

function showBulkProductUploadModal() {
    const formHtml = `
        <div class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-lg">
                <h3 class="font-medium text-blue-800 mb-2">CSV Format Requirements:</h3>
                <p class="text-sm text-blue-700 mb-2">Your CSV file should have these columns:</p>
                <code class="text-xs bg-white px-2 py-1 rounded block">
                    product_name,category,unit,packaging,unit_type,price_inr,price_usd,current_stock,min_stock_level
                </code>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Upload CSV File</label>
                <input type="file" id="productCsvFile" accept=".csv" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            
            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" onclick="closeModal()" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition duration-200">
                    Cancel
                </button>
                <button onclick="processBulkProductUpload()" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                    <i class="fas fa-upload mr-2"></i>Upload Products
                </button>
            </div>
        </div>
    `;
    
    showModal('Bulk Upload Products', formHtml);
}

async function processBulkProductUpload() {
    const fileInput = document.getElementById('productCsvFile');
    const file = fileInput.files[0];
    
    if (!file) {
        Utils.showNotification('Please select a CSV file', 'warning');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const csvData = Utils.parseCSV(e.target.result);
            
            for (const row of csvData) {
                const productData = {
                    id: Utils.generateId('prod'),
                    product_name: row.product_name || '',
                    category: row.category || '',
                    unit: row.unit || '',
                    packaging: row.packaging || '',
                    unit_type: row.unit_type || 'kg',
                    price_inr: parseFloat(row.price_inr) || 0,
                    price_usd: parseFloat(row.price_usd) || 0,
                    current_stock: parseFloat(row.current_stock) || 0,
                    min_stock_level: parseFloat(row.min_stock_level) || 0
                };
                
                await API.create('products', productData);
            }
            
            Utils.showNotification(`Successfully uploaded ${csvData.length} products`, 'success');
            closeModal();
            loadPage('inventory');
        } catch (error) {
            console.error('Bulk upload error:', error);
            Utils.showNotification('Error processing CSV file', 'error');
        }
    };
    
    reader.readAsText(file);
}
