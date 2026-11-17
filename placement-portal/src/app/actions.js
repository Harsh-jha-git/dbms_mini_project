'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { pool, rows } from '@/lib/db';
import { getUser, requireRole, setSession } from '@/lib/session';
import { invalidatePattern } from '@/lib/redis';

const go = (path, kind, text) => redirect(`${path}?${kind}=${encodeURIComponent(text)}`);

// Runs fn; database errors (including SIGNAL messages from our triggers) are shown to the user.
async function run(path, fn, okMsg) {
  try {
    await fn();
  } catch (e) {
    go(path, 'err', e.sqlMessage || e.message);
  }
  go(path, 'ok', okMsg);
}

export async function login(formData) {
  const [u] = await rows(
    'SELECT user_id, username, role, student_id, recruiter_id FROM users WHERE username = ? AND password_hash = SHA2(?, 256)',
    [String(formData.get('username')).trim(), String(formData.get('password'))]
  );
  if (!u) go('/login', 'err', 'Wrong username or password');
  setSession({ id: u.user_id, username: u.username, role: u.role, student_id: u.student_id, recruiter_id: u.recruiter_id });
  redirect('/' + u.role);
}

export async function logout() {
  cookies().delete('sid');
  redirect('/login');
}

// ---------- student ----------
export async function applyTo(formData) {
  const u = requireRole('student');
  await run('/student', () => pool.query('CALL sp_apply(?, ?)', [u.student_id, Number(formData.get('opp'))]), 'Application submitted');
}

export async function respondOffer(formData) {
  const u = requireRole('student');
  const id = Number(formData.get('offer'));
  const accept = formData.get('answer') === 'accept' ? 1 : 0;
  await run(
    '/student/applications',
    async () => {
      const [o] = await rows(
        'SELECT a.student_id FROM offer f JOIN application a ON a.application_id = f.application_id WHERE f.offer_id = ?', [id]);
      if (!o || o.student_id !== u.student_id) throw new Error('That offer is not yours');
      await pool.query('CALL sp_respond_offer(?, ?)', [id, accept]);
    },
    accept ? 'Offer accepted. Your other applications at the same or lower tier were withdrawn.' : 'Offer declined'
  );
}

// ---------- recruiter ----------
export async function postOpportunity(formData) {
  const u = requireRole('recruiter');
  const f = (k) => formData.get(k);
  const branches = formData.getAll('branches').map(Number);
  await run(
    '/recruiter',
    async () => {
      if (!branches.length) throw new Error('Pick at least one branch');
      const [rec] = await rows('SELECT company_id FROM recruiter WHERE recruiter_id = ?', [u.recruiter_id]);
      const c = await pool.getConnection();
      try {
        await c.beginTransaction();
        const [r] = await c.query(
          `INSERT INTO opportunity (company_id, recruiter_id, title, \`type\`, stipend_or_ctc, location, \`mode\`, start_date,
             application_deadline, status, approval_status, openings)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', 'Pending', ?)`,
          [rec.company_id, u.recruiter_id, f('title'), f('type'), Number(f('amount')), f('location'), f('mode'),
           f('start_date') || null, f('deadline'), Number(f('openings'))]
        );
        await c.query(
          'INSERT INTO eligibility_criteria (opportunity_id, min_cgpa, max_backlogs, min_attendance, min_aptitude_score, min_communication_score) VALUES (?, ?, ?, ?, ?, ?)',
          [r.insertId, Number(f('min_cgpa')), Number(f('max_backlogs')), Number(f('min_attendance')), Number(f('min_aptitude')), Number(f('min_comm'))]
        );
        for (const b of branches) await c.query('INSERT INTO opportunity_branch (opportunity_id, branch_id) VALUES (?, ?)', [r.insertId, b]);
        await c.commit();
        await invalidatePattern('student:opps:*');
      } catch (e) {
        await c.rollback();
        throw e;
      } finally {
        c.release();
      }
    },
    'Submitted. The placement officer must approve it before students can see it.'
  );
}

export async function setStatus(formData) {
  const u = requireRole('recruiter');
  const app = Number(formData.get('app'));
  const opp = Number(formData.get('opp'));
  await run(
    `/recruiter/${opp}`,
    async () => {
      const [o] = await rows(
        'SELECT o.recruiter_id FROM application a JOIN opportunity o ON o.opportunity_id = a.opportunity_id WHERE a.application_id = ? AND o.opportunity_id = ?',
        [app, opp]);
      if (!o || o.recruiter_id !== u.recruiter_id) throw new Error('That application is not for one of your opportunities');
      await pool.query('CALL sp_set_application_status(?, ?)', [app, String(formData.get('status'))]);
    },
    'Status updated'
  );
}

// ---------- officer ----------
export async function reviewOpportunity(formData) {
  requireRole('officer');
  const decision = formData.get('decision') === 'approve' ? 'Approved' : 'Rejected';
  await run(
    '/officer',
    async () => {
      await pool.query("UPDATE opportunity SET approval_status = ? WHERE opportunity_id = ? AND approval_status = 'Pending'",
        [decision, Number(formData.get('opp'))]);
      await invalidatePattern('student:opps:*');
    },
    `Opportunity ${decision.toLowerCase()}`
  );
}
