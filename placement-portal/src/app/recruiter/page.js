import Link from 'next/link';
import { rows } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { postOpportunity } from '../actions';
import { Badge, Flash, Title } from '../components';
import { pay } from '@/lib/format';

export default async function RecruiterHome({ searchParams }) {
  const u = requireRole('recruiter');
  const [me] = await rows('SELECT r.name, c.company_name FROM recruiter r JOIN company c ON c.company_id = r.company_id WHERE r.recruiter_id = ?', [u.recruiter_id]);
  const opps = await rows('SELECT * FROM v_opportunity_overview WHERE recruiter_id = ? ORDER BY opportunity_id DESC', [u.recruiter_id]);
  const branches = await rows('SELECT branch_id, branch_name FROM branch ORDER BY branch_name');

  return (
    <>
      <Title sub={me.company_name}>Hello, {me.name}</Title>
      <Flash sp={searchParams} />
      <table className="tbl mb-10">
        <thead><tr><th>Role</th><th>Pay</th><th>Approval</th><th>Status</th><th>Filled</th><th>Applicants</th><th></th></tr></thead>
        <tbody>
          {opps.map((o) => (
            <tr key={o.opportunity_id}>
              <td><div className="font-medium">{o.title}</div><div className="text-xs text-mute">{o.type}{o.tier ? ` · ${o.tier}` : ''} · due {o.application_deadline}</div></td>
              <td>{pay(o.type, o.stipend_or_ctc)}</td>
              <td><Badge>{o.approval_status}</Badge></td>
              <td><Badge>{o.status}</Badge></td>
              <td>{o.filled} / {o.openings}</td>
              <td>{o.applicants}</td>
              <td><Link href={`/recruiter/${o.opportunity_id}`} className="btn-ghost">Applicants</Link></td>
            </tr>
          ))}
          {!opps.length && <tr><td colSpan={7} className="py-6 text-mute">You haven't posted anything yet.</td></tr>}
        </tbody>
      </table>

      <h2 className="mb-3 text-lg">Post a new opportunity</h2>
      <form action={postOpportunity} className="grid grid-cols-2 gap-4 border border-rule bg-card p-5 md:grid-cols-3">
        <div className="col-span-2 md:col-span-3"><label className="label">Title</label><input name="title" className="field" required /></div>
        <div><label className="label">Type</label><select name="type" className="field"><option>Full-time</option><option>Internship</option></select></div>
        <div><label className="label">CTC per year / stipend per month (₹)</label><input name="amount" type="number" min="0" className="field" required /></div>
        <div><label className="label">Openings</label><input name="openings" type="number" min="1" defaultValue="1" className="field" required /></div>
        <div><label className="label">Location</label><input name="location" className="field" required /></div>
        <div><label className="label">Mode</label><select name="mode" className="field"><option>Onsite</option><option>Hybrid</option><option>Remote</option></select></div>
        <div><label className="label">Application deadline</label><input name="deadline" type="date" className="field" required /></div>
        <div><label className="label">Start date</label><input name="start_date" type="date" className="field" /></div>
        <div><label className="label">Min CGPA</label><input name="min_cgpa" type="number" step="0.1" min="0" max="10" defaultValue="6.5" className="field" /></div>
        <div><label className="label">Max backlogs</label><input name="max_backlogs" type="number" min="0" defaultValue="0" className="field" /></div>
        <div><label className="label">Min attendance %</label><input name="min_attendance" type="number" min="0" max="100" defaultValue="75" className="field" /></div>
        <div><label className="label">Min aptitude score</label><input name="min_aptitude" type="number" min="0" max="100" defaultValue="50" className="field" /></div>
        <div><label className="label">Min communication score</label><input name="min_comm" type="number" min="0" max="100" defaultValue="50" className="field" /></div>
        <fieldset className="col-span-2 md:col-span-3">
          <legend className="label">Open to branches</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {branches.map((b) => (
              <label key={b.branch_id}><input type="checkbox" name="branches" value={b.branch_id} className="mr-1" />{b.branch_name}</label>
            ))}
          </div>
        </fieldset>
        <div className="col-span-2 md:col-span-3"><button className="btn">Submit for approval</button></div>
      </form>
    </>
  );
}
