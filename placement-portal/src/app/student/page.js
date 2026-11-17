import { rows } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { applyTo } from '../actions';
import { Badge, Flash, Title } from '../components';
import { pay, TIER_BY_RANK } from '@/lib/format';
import { getCached, setCached } from '@/lib/redis';
import GraphPanels, { SaveButton } from './GraphPanels';

export default async function StudentHome({ searchParams }) {
  const u = requireRole('student');
  const [me] = await rows(
    'SELECT s.name, s.cgpa, b.branch_name, fn_student_tier_lock(s.student_id) AS tier_lock FROM student s JOIN branch b ON b.branch_id = s.branch_id WHERE s.student_id = ?',
    [u.student_id]);

  const cacheKey = `student:opps:${u.student_id}`;
  let opps = await getCached(cacheKey);
  if (!opps) {
    opps = await rows(
      `SELECT v.* FROM v_opportunity_overview v
         JOIN opportunity_branch ob ON ob.opportunity_id = v.opportunity_id
         JOIN student s ON s.branch_id = ob.branch_id AND s.student_id = ?
        WHERE v.approval_status = 'Approved' AND v.status = 'Open' AND v.application_deadline >= CURDATE()
        ORDER BY v.application_deadline`, [u.student_id]);
    await setCached(cacheKey, opps, 60);
  }

  const applied = new Set((await rows('SELECT opportunity_id FROM application WHERE student_id = ?', [u.student_id])).map((r) => r.opportunity_id));

  return (
    <>
      <Title sub={`${me.branch_name} · CGPA ${me.cgpa}`}>Hello, {me.name}</Title>
      <Flash sp={searchParams} />
      {me.tier_lock > 0 && (
        <p className="mb-4 border border-accent bg-card px-3 py-2 text-sm">
          You have accepted a <b>{TIER_BY_RANK[me.tier_lock]}</b> full-time offer. You can now apply only to full-time roles
          above that tier (internships are unaffected).
        </p>
      )}
      <GraphPanels>
        <h2 className="mb-2 text-lg">Open for your branch ({opps.length})</h2>
        <table className="tbl">
          <thead><tr><th>Role</th><th>Type</th><th>Pay</th><th>Deadline</th><th>Slots</th><th></th></tr></thead>
          <tbody>
            {opps.map((o) => {
              const locked = o.type === 'Full-time' && o.tier_rank <= me.tier_lock;
              return (
                <tr key={o.opportunity_id}>
                  <td><div className="font-medium">{o.title}</div><div className="text-xs text-mute">{o.company_name} · {o.location}</div></td>
                  <td>{o.type}{o.tier && <div className="text-xs text-mute">{o.tier}</div>}</td>
                  <td>{pay(o.type, o.stipend_or_ctc)}</td>
                  <td>{o.application_deadline}</td>
                  <td>{o.slots_left} of {o.openings}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      {applied.has(o.opportunity_id) ? <Badge>Applied</Badge>
                        : locked ? <span className="btn-off" title="Tier lock">Locked</span>
                        : <form action={applyTo}><input type="hidden" name="opp" value={o.opportunity_id} /><button className="btn">Apply</button></form>}
                      <SaveButton opportunityId={o.opportunity_id} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!opps.length && <tr><td colSpan={6} className="py-6 text-mute">Nothing open for your branch right now.</td></tr>}
          </tbody>
        </table>
      </GraphPanels>
    </>
  );
}
