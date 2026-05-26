# SSI Inventory Management System v9
## Shree Sai Industries — Production Ready

### 🔐 Default Login Credentials
| Role     | Username   | Password     |
|----------|------------|--------------|
| Admin    | admin      | admin123     |
| Stock    | stock1     | stock123     |
| Dispatch | dispatch1  | dispatch123  |
| Sales 1  | sales1     | sales123     |
| Sales 2  | sales2     | sales123     |

### 🚀 Quick Start (Local)
**Mac/Linux:**
```bash
cd ~/Downloads/ssi-inventory-v9
python3 -m http.server 8000
```
**Windows:**
```cmd
cd C:\Users\YourName\Downloads\ssi-inventory-v9
python -m http.server 8000
```
Open browser → http://localhost:8000

### 🌐 Deployed URL
https://ssi-inventory-hmwp.onrender.com

### 📋 Feature Summary
- ✅ Role-based access (Admin / Sales / Stock / Dispatch)
- ✅ Products with SKU, pack sizes, carton standard, reorder alerts
- ✅ Clients/Vendors with GST Number, address, phone
- ✅ Smart Inventory IN/OUT (Bags × Size, Cartons, Direct KG, NOS)
- ✅ Sales Orders (Bag × Count = Total KG, Urgent flag)
- ✅ Salesperson sees ONLY own orders + dispatch status
- ✅ Dispatch queue (Urgent first → FIFO) + History
- ✅ Demand Analysis (product trends, top clients)
- ✅ Monthly reports + Salesperson performance
- ✅ Excel import/export everywhere
- ✅ Multi-currency (INR/USD/EUR/GBP)

### 🔄 To Deploy on Render.com
1. Replace files in GitHub repo (PraveenMegh/ssi-inventory)
2. Render auto-deploys on push
