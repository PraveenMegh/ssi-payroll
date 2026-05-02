// Payroll Schema Compatibility Layer
// This file provides correct schema mappings for all payroll tables

/*
ATTENDANCE SCHEMA:
- emp_id (text)
- employee_name (text)
- month (text) - format: "2024-12"
- year (number)
- days_present (number)
- days_absent (number)
- sundays_holidays (number)
- paid_leaves (number)
- unpaid_leaves (number)
- overtime_hours (number)
- total_payable_days (number)

ADVANCES SCHEMA:
- emp_id (text)
- employee_name (text)
- advance_date (datetime)
- advance_amount (number)
- reason (text)
- deduction_start_month (text)
- monthly_deduction (number)
- total_deducted (number)
- balance_amount (number)
- status (text)
- approved_by (text)

SALARY_STRUCTURE SCHEMA:
- emp_id (text)
- employee_name (text)
- month (text)
- basic_salary (number)
- hra (number)
- gross_salary (number)
- days_present (number)
- payable_days (number)
- earned_basic (number)
- earned_hra (number)
- overtime_hours (number)
- overtime_amount (number)
- esi_deduction (number)
- epf_deduction (number)
- advance_deduction (number)
- other_deductions (number)
- leave_deduction (number)
- total_deductions (number)
- net_payable (number)
- status (text)
- edited_by (text)
- disbursed_date (datetime)
*/

// Note: This file is loaded to document the schema.
// The actual functions are implemented inline in the payroll modules.
console.log('Payroll Schema Documentation Loaded');

