import { redirect } from 'next/navigation'
import { richiediRuolo } from '@/auth/sessione'

export default async function Admin() {
  await richiediRuolo('admin')
  redirect('/admin/menu')
}
