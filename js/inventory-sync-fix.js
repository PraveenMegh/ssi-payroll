/* INVENTORY-PRODUCT SYNC FIX
 * This script recalculates and syncs all product stock levels
 * from the inventory ledger to the products table
 */

async function syncInventoryToProducts() {
  console.log('🔄 Starting inventory-product sync...');
  
  try {
    // Get current state
    const st = SSIApp.getState();
    
    // Get all API products
    const apiProducts = await API.getAll('products');
    console.log(`📦 Found ${apiProducts.length} products in products table`);
    console.log(`📋 Found ${st.inventory.length} inventory entries`);
    
    // Calculate stock per product per unit from inventory ledger
    const stockMap = {}; // key: `${unit_id}|${product_id}` or `${unit_name}|${product_name}`
    
    st.inventory.forEach(entry => {
      const key = `${entry.unit_id}|${entry.product_id}`;
      if (!stockMap[key]) {
        stockMap[key] = {
          unit_id: entry.unit_id,
          product_id: entry.product_id,
          stock: 0
        };
      }
      
      // Calculate stock (IN adds, OUT/ISSUE/TRANSFER_OUT subtracts)
      const isOut = ['OUT', 'TRANSFER_OUT', 'ISSUE'].includes(entry.type);
      if (isOut) {
        stockMap[key].stock -= (entry.qty || 0);
      } else {
        stockMap[key].stock += (entry.qty || 0);
      }
    });
    
    console.log('📊 Calculated stock levels:', stockMap);
    
    // Now sync to API products
    let updated = 0;
    let failed = 0;
    
    for (const apiProduct of apiProducts) {
      try {
        // Calculate total stock for this product across all units
        let totalStock = 0;
        
        // Try to find matching entries in stockMap
        for (const key in stockMap) {
          const [unitId, productId] = key.split('|');
          const stockEntry = stockMap[key];
          
          // Try to match by name (case-insensitive)
          const stateProduct = st.products.find(p => p.id === productId);
          if (stateProduct) {
            const apiName = (apiProduct.product_name || apiProduct.name || '').toLowerCase().trim();
            const stateName = (stateProduct.name || '').toLowerCase().trim();
            const stateSku = (stateProduct.sku || '').toLowerCase().trim();
            const apiSku = (apiProduct.sku || '').toLowerCase().trim();
            
            if (apiName === stateName || apiSku === stateSku) {
              totalStock += stockEntry.stock;
            }
          }
        }
        
        // Update the product if stock is different
        const currentStock = parseFloat(apiProduct.current_stock || 0);
        if (Math.abs(currentStock - totalStock) > 0.001) {
          await API.patch('products', apiProduct.id, {
            current_stock: Math.max(0, totalStock)
          });
          console.log(`✅ Updated ${apiProduct.product_name || apiProduct.name}: ${currentStock} → ${totalStock} KG`);
          updated++;
        }
      } catch (err) {
        console.error(`❌ Failed to update ${apiProduct.product_name || apiProduct.name}:`, err);
        failed++;
      }
    }
    
    console.log(`✅ Sync complete: ${updated} products updated, ${failed} failed`);
    SSIApp.toast(`Sync complete: ${updated} products updated`, 'success');
    
    // Reload the page to show updated values
    setTimeout(() => {
      loadPage('products');
    }, 1000);
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    SSIApp.toast('Sync failed: ' + error.message, 'error');
  }
}

// Add to window for console access
window.syncInventoryToProducts = syncInventoryToProducts;

console.log('✅ Sync function loaded. Run syncInventoryToProducts() in console to sync stock levels.');
