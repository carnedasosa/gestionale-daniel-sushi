import { richiediRuolo } from '@/auth/sessione'
import { esci } from '@/app/accesso/azioni'
import { db } from '@/server/db'
import { contaAllergeniDaConfermare } from '@/menu/repo'
import { NavAdmin } from './NavAdmin'
import './admin.css'

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  await richiediRuolo('admin')
  const daConfermare = await contaAllergeniDaConfermare(db)
  return (
    <div className="b-admin">
      <NavAdmin daConfermare={daConfermare} uscita={<form action={esci}><button className="b-btn b-btn--secondario b-btn--largo">Esci</button></form>} />
      <main className="b-admin__contenuto">{children}</main>
    </div>
  )
}
