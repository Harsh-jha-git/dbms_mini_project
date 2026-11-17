import { redirect } from 'next/navigation';
import { getUser } from '@/lib/session';

export default function Home() {
  const u = getUser();
  redirect(u ? '/' + u.role : '/login');
}
