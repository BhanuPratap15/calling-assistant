import { redirect } from 'next/navigation';

// "/" khola → dashboard (login nahi hai to proxy pehle hi /login bhej dega)
export default function Home() {
  redirect('/dashboard');
}
