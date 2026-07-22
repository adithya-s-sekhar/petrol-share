import { CircleAlert, Plus, Trash2, Users } from 'lucide-react'
import type { TripDraft } from '../../../domain'
import { FieldError, IconButton } from '../ui/AppControls'
import type { ErrorMap } from '../../utils/tripDraftUtils'
import { classes } from '../../styles'
import { CollapsibleSection, SectionHeading } from './CollapsibleSection'

interface PeoplePanelProps {
  draft: TripDraft
  errors: ErrorMap
  open: boolean
  complete: boolean
  submitted: boolean
  buttonRef: (node: HTMLButtonElement | null) => void
  onOpen: () => void
  onDone: () => void
  onAdd: () => void
  onRemove: (personId: string, name: string, index: number) => void
  onUpdate: (draft: TripDraft) => void
}

export function PeoplePanel({ draft, errors, open, complete, submitted, buttonRef, onOpen, onDone, onAdd, onRemove, onUpdate }: PeoplePanelProps) {
  return <CollapsibleSection controls="people" open={open} step={3} title="Who was riding?" summary={`${draft.people.length} ${draft.people.length === 1 ? 'rider' : 'riders'}`} buttonRef={buttonRef} onOpen={onOpen}>
    <>
      <SectionHeading controls="people" step={3} title="Who was riding?">Add everyone who should share the fuel cost. <strong>Include the driver if they share the cost.</strong></SectionHeading>
      <div id="people-content" className={classes('people-list')}>
        {draft.people.map((person, index) => {
          const error = errors[`people.${index}.name`]
          const errorId = `person-${person.id}-error`
          return <div className={classes('person-row')} key={person.id}><div className={classes('field-grow')}><label className={classes('row-label')} htmlFor={`person-${person.id}`}>Passenger {index + 1}</label><div className={classes('input-with-icon')}><Users size={18} /><input id={`person-${person.id}`} aria-label={`Person ${index + 1} name`} placeholder="Person's name" value={person.name} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onUpdate({ ...draft, people: draft.people.map((item) => item.id === person.id ? { ...item, name: event.target.value } : item) })} /></div><FieldError id={errorId} message={error} /></div><IconButton label={`Remove ${person.name || `person ${index + 1}`}`} destructive onClick={() => onRemove(person.id, person.name, index)}><Trash2 /></IconButton></div>
        })}
      </div>
      <button className={classes('secondary-button full-button')} type="button" onClick={onAdd}><Plus size={18} /> Add person</button>
      {submitted && errors.people && <div className={classes('notice error-notice')} role="alert"><CircleAlert />{errors.people}</div>}
      {complete && <button className={classes('done-button')} type="button" onClick={onDone}>Done adding riders <Users size={18} /></button>}
    </>
  </CollapsibleSection>
}
