import Link from 'next/link';
import { notFound } from 'next/navigation';
import { rows } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { setStatus } from '../../actions';
import { Badge, Flash, Title } from '../../components';
import { pay } from '@/lib/format';

const NEXT = {
  Applied: ['Shortlisted', 'Rejected'],
  Shortlisted: ['Interview', 'Rejected'],
  Interview: ['Selected', 'Rejected'],
};

export default async function Applicants({ params, searchParams }) {
  const u = requireRole('recruiter');
  const id = Number(params.id);
  const [opp] = await rows('SELECT * FROM v_opportunity_overview WHERE opportunity_id = ? AND recruiter_id = ?', [id, u.recruiter_id]);
  if (!opp) notFound();
  const apps = await rows(
    `SELECT a.application_id, a.status, a.applied_on, s.name, s.cgpa, s.backlogs, b.branch_name, f.status AS offer_status
       FROM application a
       JOIN student s ON s.student_id = a.student_id
       JOIN branch b ON b.branch_id = s.branch_id
       LEFT JOIN offer f ON f.application_id = a.application_id
      WHERE a.opportunity_id = ? ORDER BY s.cgpa DESC`, [id]);

  return (
    <>
      <Link href="/recruiter" className="text-sm text-mute hover:text-accent">← All opportunities</Link>
      <div className="mt-2"><Title sub={`${opp.type}${opp.tier ? ' · ' + opp.tier : ''} · ${pay(opp.type, opp.stipend_or_ctc)} · ${opp.filled} of ${opp.openings} filled`}>{opp.title}</Title></div>
      <Flash sp={searchParams} />
      <table className="tbl">
        <thead><tr><th>Student</th><th>CGPA</th><th>Backlogs</th><th>Status</th><th>Offer</th><th>Move to</th></tr></thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.application_id}>
              <td><div className="font-medium">{a.name}</div><div className="text-xs text-mute">{a.branch_name}</div></td>
              <td>{a.cgpa}</td>
              <td>{a.backlogs}</td>
              <td><Badge>{a.status}</Badge></td>
              <td>{a.offer_status ? <Badge>{a.offer_status}</Badge> : <span className="text-mute">—</span>}</td>
              <td>
                <form action={setStatus} className="flex gap-2">
                  <input type="hidden" name="app" value={a.application_id} />
                  <input type="hidden" name="opp" value={id} />
                  {(NEXT[a.status] || []).map((s) => <button key={s} name="status" value={s} className={s === 'Rejected' ? 'btn-ghost' : 'btn'}>{s}</button>)}
                </form>
              </td>
            </tr>
          ))}
          {!apps.length && <tr><td colSpan={6} className="py-6 text-mute">No applicants yet.</td></tr>}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-mute">Selecting a candidate creates their offer automatically and reserves one slot.</p>
    </>
  );
}
