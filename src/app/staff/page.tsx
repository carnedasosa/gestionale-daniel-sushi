import { richiediRuolo } from '@/auth/sessione'
import { esci } from '@/app/accesso/azioni'
import './staff.css'

export default async function AreaStaff() {
  await richiediRuolo('staff')
  return (
    <main className="contenitore staff-pagina">
      <h1 className="heading">Area staff</h1>
      <p>Qui arriveranno gli ordini dei tavoli e da casa.</p>
      <form action={esci}><button className="ds-btn ds-btn--secondary">Esci</button></form>
    </main>
  )
}
