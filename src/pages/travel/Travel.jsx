import { Plane } from 'lucide-react';

export default function Travel() {
  return (
    <div className="coming-soon-page">
      <Plane size={48} />
      <h2>Travel Records</h2>
      <p>Track business travel, destinations, expenses, and associate with resources and wings.</p>
      <p className="text-sm">Full CRUD available via <code>/api/travel</code></p>
    </div>
  );
}
