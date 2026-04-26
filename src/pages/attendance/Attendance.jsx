import { Calendar } from 'lucide-react';

export default function Attendance() {
  return (
    <div className="coming-soon-page">
      <Calendar size={48} />
      <h2>Attendance & Leave</h2>
      <p>Track daily attendance, check-ins, overtime, and leave requests.</p>
      <p className="text-sm">Full CRUD available via <code>/api/attendance</code></p>
    </div>
  );
}
