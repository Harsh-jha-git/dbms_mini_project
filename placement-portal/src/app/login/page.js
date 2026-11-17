import { login } from '../actions';
import { Flash } from '../components';

export default function Login({ searchParams }) {
  return (
    <div className="mx-auto mt-10 max-w-sm">
      <h1 className="mb-1 text-3xl">Sign in</h1>
      <p className="mb-6 text-sm text-mute">Campus internship and recruitment portal</p>
      <Flash sp={searchParams} />
      <form action={login} className="space-y-3 border border-rule bg-card p-5">
        <div><label className="label">Username</label><input name="username" className="field" required autoFocus /></div>
        <div><label className="label">Password</label><input name="password" type="password" className="field" required /></div>
        <button className="btn w-full">Sign in</button>
      </form>
      <p className="mt-4 text-xs text-mute">
        Demo accounts, password <b>demo123</b>: <code>officer</code>, <code>student1</code> to <code>student200</code>,{' '}
        <code>recruiter1</code> to <code>recruiter32</code>.
      </p>
    </div>
  );
}
