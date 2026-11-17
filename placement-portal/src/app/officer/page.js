import { rows } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { reviewOpportunity } from '../actions';
import { Flash, Title } from '../components';
import { pay } from '@/lib/format';

export default async function OfficerHome({ searchParams }) {
  requireRole('officer');
  const pending = await rows("SELECT * FROM v_opportunity_overview WHERE approval_status = 'Pending' ORDER BY opportunity_id");
  const branch = await rows('SELECT * FROM v_branch_placement ORDER BY placement_pct DESC');
  const top = await rows('SELECT * FROM v_student_branch_rank WHERE branch_rank = 1 ORDER BY avg_score DESC');
  const [t] = await rows(
    `SELECT (SELECT COUNT(*) FROM student) AS students, (SELECT COUNT(*) FROM opportunity WHERE approval_status = 'Approved') AS opps,
            (SELECT COUNT(*) FROM application) AS apps, (SELECT COUNT(*) FROM offer WHERE status = 'Accepted') AS accepted`);

  return (
    <>
      <Title>Placement overview</Title>
      <Flash sp={searchParams} />
      <div className="mb-8 grid grid-cols-4 border border-rule bg-card text-center">
        {[['Students', t.students], ['Live opportunities', t.opps], ['Applications', t.apps], ['Offers accepted', t.accepted]].map(([k, v]) => (
          <div key={k} className="border-r border-rule p-4 last:border-r-0"><div className="font-serif text-3xl">{v}</div><div className="text-xs uppercase tracking-wide text-mute">{k}</div></div>
        ))}
      </div>

      <h2 className="mb-2 text-lg">Waiting for approval ({pending.length})</h2>
      <table className="tbl mb-10">
        <thead><tr><th>Role</th><th>Company</th><th>Type</th><th>Pay</th><th>Openings</th><th></th></tr></thead>
        <tbody>
          {pending.map((o) => (
            <tr key={o.opportunity_id}>
              <td className="font-medium">{o.title}</td><td>{o.company_name}</td>
              <td>{o.type}{o.tier ? ` · ${o.tier}` : ''}</td><td>{pay(o.type, o.stipend_or_ctc)}</td><td>{o.openings}</td>
              <td>
                <form action={reviewOpportunity} className="flex gap-2">
                  <input type="hidden" name="opp" value={o.opportunity_id} />
                  <button name="decision" value="approve" className="btn">Approve</button>
                  <button name="decision" value="reject" className="btn-ghost">Reject</button>
                </form>
              </td>
            </tr>
          ))}
          {!pending.length && <tr><td colSpan={6} className="py-4 text-mute">Nothing pending.</td></tr>}
        </tbody>
      </table>

      <div className="grid gap-10 md:grid-cols-2">
        <section>
          <h2 className="mb-2 text-lg">Placement by branch</h2>
          <table className="tbl">
            <thead><tr><th>Branch</th><th>Students</th><th>Placed</th><th>%</th></tr></thead>
            <tbody>{branch.map((b) => <tr key={b.branch_id}><td>{b.branch_name}</td><td>{b.students}</td><td>{b.placed}</td><td>{b.placement_pct}</td></tr>)}</tbody>
          </table>
        </section>
        <section>
          <h2 className="mb-2 text-lg">Top student per branch</h2>
          <table className="tbl">
            <thead><tr><th>Branch</th><th>Student</th><th>Avg score</th></tr></thead>
            <tbody>{top.map((s) => <tr key={s.student_id}><td>{s.branch_name}</td><td>{s.name}</td><td>{s.avg_score}</td></tr>)}</tbody>
          </table>
        </section>
      </div>
    </>
  );
}
