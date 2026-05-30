# SSI Payroll-Only Render App

This package keeps only Payroll / Attendance / Employees / Users on the existing Render-style frontend app.

## Data safety
- Do not delete the old full app until this payroll-only app is tested.
- This app does not intentionally delete products, clients, inventory, orders, dispatch, or reports data from Firebase.
- The non-payroll arrays are still preserved inside the loaded app state when saved.
- Take a Firebase export/backup before deploying.

## Kept modules
- js/firebase.js
- js/app.js
- js/auth.js
- js/dashboard.js
- js/users.js
- js/employees.js
- js/attendance.js
- js/payroll.js
- js/backup.js

## Removed from UI/package
Products, Clients/Vendors, Inventory, Orders, Dispatch, Reports, Units, old sales files.

## Recommended deployment
Create a new Render service or new branch first. Do not overwrite production until login, attendance save, employee master and payroll are verified.
