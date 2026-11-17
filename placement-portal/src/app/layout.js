import './globals.css';
import Link from 'next/link';
import { getUser } from '@/lib/session';
import { logout } from './actions';

export const metadata = { title: 'Campus Placement Portal' };

const links = {
  student: [['/student', 'Opportunities'], ['/student/applications', 'My applications']],
  recruiter: [['/recruiter', 'My opportunities']],
  officer: [['/officer', 'Overview']],
};

export default function RootLayout({ children }) {
  const user = getUser();
  return (
    <html lang="en">
      <body>
        <header className="border-b-2 border-ink">
          <div className="mx-auto flex max-w-5xl items-baseline gap-6 px-4 py-3">
            <Link href="/" className="font-serif text-lg font-bold">Placement Cell</Link>
            {user && (
              <nav className="flex gap-4 text-sm">
                {links[user.role].map(([href, label]) => (
                  <Link key={href} href={href} className="hover:text-accent">{label}</Link>
                ))}
              </nav>
            )}
            {user && (
              <form action={logout} className="ml-auto flex items-baseline gap-3 text-sm">
                <span className="text-mute">{user.username} · {user.role}</span>
                <button className="btn-ghost">Sign out</button>
              </form>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
