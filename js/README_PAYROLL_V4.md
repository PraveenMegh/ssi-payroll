# SSI Payroll Only v4 - Safe Improvements

This version keeps the payroll-only Render app and does not delete historical payroll, attendance, employees, backups, or old inactive users.

## Added in v4

- Payment tracking:
  - Paid Amount
  - Balance Amount
  - Payment Date
  - Payment Mode
  - Partial payment support
  - Payment history log

- Dashboard improvements:
  - Amount Paid
  - Pending Payment
  - Arrears
  - Net Payable
  - Payroll status

- Post-payment revision:
  - Revised Net Pay
  - Difference calculation
  - Same month adjustment
  - Next month recovery/arrear entry
  - Revision log

- Admin-only salary revision and arrear:
  - Old salary
  - New salary
  - Effective month
  - Arrear payable month
  - Automatic arrear calculation
  - Salary revision history

- Freeze visibility:
  - Payroll month freezes on 15th of following month
  - Example: May 2026 freezes on 15 June 2026
  - Frozen month is shown as locked
  - Old paid records are preserved

## Safety rules

- No payroll record history is deleted automatically.
- No attendance record history is deleted automatically.
- No employee master is deleted automatically.
- Existing backups remain compatible.
- Old sales/inventory users remain stored but inactive.
- Only Admin and Accounts users remain active.
