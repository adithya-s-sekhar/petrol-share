import { Plus, Trash2 } from 'lucide-react'
import type { AdditionalExpense, TripDraft } from '../../domain'
import { FieldError, IconButton } from '../AppControls'
import { numberFromInput, type ErrorMap } from '../tripDraftUtils'
import { classes } from '../styles'
import { SectionHeading } from './CollapsibleSection'

interface ExpensesPanelProps {
  draft: TripDraft
  errors: ErrorMap
  stopsById: Map<string, string>
  onChange: (id: string, changes: Partial<AdditionalExpense>) => void
  onAdd: () => void
  onUpdate: (draft: TripDraft) => void
}

export function ExpensesPanel({ draft, errors, stopsById, onChange, onAdd, onUpdate }: ExpensesPanelProps) {
  return <section className={classes('panel')} aria-labelledby="expenses-title">
    <SectionHeading controls="expenses" step={4} title="Additional expenses">Add tolls, parking, or other fixed journey costs and choose who shares them.</SectionHeading>
    <div className={classes('expense-list')}>
      {(draft.expenses ?? []).map((expense, index) => {
        const label = expense.name || `Expense ${index + 1}`
        const amountError = errors[`expenses.${index}.amount`]
        const nameError = errors[`expenses.${index}.name`]
        const assignmentError = errors[`expenses.${index}.personIds`] ?? errors[`expenses.${index}.legId`]
        return <article className={classes('expense-row')} key={expense.id} aria-label={label}>
          <div className={classes('expense-grid')}>
            <div className={classes('form-field')}><label htmlFor={`expense-name-${expense.id}`}>Expense name</label><input id={`expense-name-${expense.id}`} aria-label={`Expense ${index + 1} name`} placeholder="e.g. Toll or parking" value={expense.name} aria-invalid={Boolean(nameError)} onChange={(event) => onChange(expense.id, { name: event.target.value })} /><FieldError id={`expense-name-${expense.id}-error`} message={nameError} /></div>
            <div className={classes('form-field')}><label htmlFor={`expense-amount-${expense.id}`}>Amount</label><input id={`expense-amount-${expense.id}`} aria-label={`${label} amount`} type="number" inputMode="decimal" min="0" step="any" value={expense.amount ?? ''} aria-invalid={Boolean(amountError)} onChange={(event) => onChange(expense.id, { amount: numberFromInput(event.target.value) })} /><FieldError id={`expense-amount-${expense.id}-error`} message={amountError} /></div>
            <IconButton label={`Remove ${expense.name || `expense ${index + 1}`}`} destructive onClick={() => onUpdate({ ...draft, expenses: (draft.expenses ?? []).filter(({ id }) => id !== expense.id) })}><Trash2 /></IconButton>
          </div>
          <div className={classes('expense-scope')} role="radiogroup" aria-label={`${label} applies to`}>
            {([['journey', 'Whole journey'], ['leg', 'A particular leg'], ['people', 'Selected riders']] as const).map(([scope, text]) => <label key={scope}><input type="radio" name={`expense-scope-${expense.id}`} checked={expense.scope === scope} onChange={() => onChange(expense.id, { scope })} />{text}</label>)}
          </div>
          {expense.scope === 'leg' && <div className={classes('form-field')}><label htmlFor={`expense-leg-${expense.id}`}>Journey leg</label><select id={`expense-leg-${expense.id}`} aria-label={`${label} journey leg`} value={expense.legId ?? ''} aria-invalid={Boolean(assignmentError)} onChange={(event) => onChange(expense.id, { legId: event.target.value || undefined })}><option value="">Choose a leg</option>{draft.legs.map((leg) => <option key={leg.id} value={leg.id}>{stopsById.get(leg.fromStopId)} → {stopsById.get(leg.toStopId)}</option>)}</select></div>}
          {expense.scope === 'people' && <div><span className={classes('row-label')}>Riders sharing this expense</span><div className={classes('expense-people')}>{draft.people.map((person) => <label key={person.id}><input type="checkbox" aria-label={`${person.name || 'Unnamed person'} shares ${label}`} checked={expense.personIds.includes(person.id)} onChange={(event) => onChange(expense.id, { personIds: event.target.checked ? [...new Set([...expense.personIds, person.id])] : expense.personIds.filter((id) => id !== person.id) })} />{person.name || 'Unnamed'}</label>)}</div></div>}
          <FieldError id={`expense-assignment-${expense.id}-error`} message={assignmentError} />
        </article>
      })}
    </div>
    <button className={classes('secondary-button full-button')} type="button" onClick={onAdd}><Plus size={18} /> Add expense</button>
  </section>
}
