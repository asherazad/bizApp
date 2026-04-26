import { Wallet } from 'lucide-react';

export default function Payroll() {
  return (
    <div className="coming-soon-page">
      <Wallet size={48} />
      <h2>Payroll & Loans</h2>
      <p>Manage monthly payroll runs, overtime, salary deductions, loans, and advances.</p>
      <p className="text-sm">Full CRUD available via <code>/api/payroll</code></p>
    </div>
  );
}
