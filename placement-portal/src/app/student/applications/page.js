import { rows } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { respondOffer } from '../../actions';
import { Badge, Flash, Title } from '../../components';
import { pay } from '@/lib/format';

export default async function MyApplications({ searchParams }) {
  const u = requireRole('student');
  const apps = await rows(
    `SELECT a.application_id, a.applied_on, a.status, o.title, o.\`type\`, o.tier, c.company_name,
            f.offer_id, f.status AS offer_status, f.salary_stipend, f.joining_date
       FROM application a
       JOIN opportunity o ON o.opportunity_id = a.opportunity_id
       JOIN company c ON c.company_id = o.company_id
       LEFT JOIN offer f ON f.application_id = a.application_id
      WHERE a.student_id = ? ORDER BY a.applied_on DESC`, [u.student_id]);
  const pending = apps.filter((a) => a.offer_status === 'Offered');

  return (
    <>
      <Title>My applications</Title>
      <Flash sp={searchParams} />
      {pending.length > 0 && (
        <section className="mb-8 border border-accent bg-card p-4">
          <h2 className="mb-3 text-lg">Offers waiting for your answer</h2>
          {pending.map((a) => (
            <div key={a.offer_id} className="flex items-center justify-between border-t border-rule py-2 first:border-t-0">
              <div>
                <div className="font-medium">{a.title} · {a.company_name}</div>
                <div className="text-xs text-mute">{pay(a.type, a.salary_stipend)} · joining {a.joining_date}{a.tier ? ` · ${a.tier}` : ''}</div>
              </div>
              <form action={respondOffer} className="flex gap-2">
                <input type="hidden" name="offer" value={a.offer_id} />
                <button name="answer" value="accept" className="btn">Accept</button>
                <button name="answer" value="decline" className="btn-ghost">Decline</button>
              </form>
            </div>
          ))}
          <p className="mt-3 text-xs text-mute">Accepting a full-time offer withdraws your other pending applications and offers at the same or lower tier.</p>
        </section>
      )}
      <table className="tbl">
        <thead><tr><th>Role</th><th>Applied</th><th>Status</th><th>Offer</th></tr></thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.application_id}>
              <td><div className="font-medium">{a.title}</div><div className="text-xs text-mute">{a.company_name} · {a.type}{a.tier ? ` · ${a.tier}` : ''}</div></td>
              <td>{a.applied_on.slice(0, 10)}</td>
              <td><Badge>{a.status}</Badge></td>
              <td>{a.offer_status ? <Badge>{a.offer_status}</Badge> : <span className="text-mute">—</span>}</td>
            </tr>
          ))}
          {!apps.length && <tr><td colSpan={4} className="py-6 text-mute">You haven't applied anywhere yet.</td></tr>}
        </tbody>
      </table>
    </>
  );
}
