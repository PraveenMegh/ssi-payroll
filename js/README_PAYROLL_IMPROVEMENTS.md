# SSI Payroll Only - Improvements

This package keeps the payroll system separate from operations and protects existing payroll/attendance history.

## Added/Changed

1. Only two active users are kept by default:
   - Admin
   - Accounts

   Old Sales/Stock/Dispatch users are not deleted. They are disabled so old audit/payroll references remain safe.

2. Dashboard is payroll-only.
   - Sales, clients, inventory and dispatch dashboard data is hidden.

3. Salary calculation updated:
   - Salary is divided by 30 days.
   - Sundays are included in monthly salary.
   - If all Monday-Saturday working days are present, full monthly salary is paid.
   - Short hours/absence reduce salary proportionately.
   - OT is hourly: Monthly Salary / 30 / 8.

4. Amounts display in whole rupees.

5. Payroll page has:
   - Attendance Panel button
   - Deduction Panel button
   - Existing per-employee deduction edit remains available.

## Data Safety

- Existing payroll records are not deleted.
- Paid payroll records are not overwritten when generating payroll.
- Old users and old data are preserved in backup/state, but non-payroll users are disabled.
