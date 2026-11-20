import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import './FormControls.css'

type DatePickerProps = {
  id: string
  name?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  required?: boolean
  min?: string
  max?: string
  ariaInvalid?: boolean
  ariaDescribedBy?: string
}

const weekdays = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const monthFormatter = new Intl.DateTimeFormat('es-SV', {
  month: 'long',
  year: 'numeric',
})
const dayLabelFormatter = new Intl.DateTimeFormat('es-SV', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const displayFormatter = new Intl.DateTimeFormat('es-SV', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function shiftDateByMonths(date: Date, amount: number): Date {
  const targetMonth = new Date(date.getFullYear(), date.getMonth() + amount, 1)
  const lastDay = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0,
  ).getDate()
  return new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    Math.min(date.getDate(), lastDay),
  )
}

function sameDate(first: Date, second: Date): boolean {
  return toIsoDate(first) === toIsoDate(second)
}

function DatePicker({
  id,
  name,
  value,
  onChange,
  disabled = false,
  required = false,
  min,
  max,
  ariaInvalid = false,
  ariaDescribedBy,
}: DatePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const selectedDate = parseIsoDate(value)
  const today = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])
  const [isOpen, setIsOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(selectedDate ?? today))
  const [focusedDate, setFocusedDate] = useState(() => selectedDate ?? today)
  const dialogId = `${id}-calendar`
  const minDate = min ? parseIsoDate(min) : null
  const maxDate = max ? parseIsoDate(max) : null

  const calendarDates = useMemo(() => {
    const mondayOffset = (visibleMonth.getDay() + 6) % 7
    const gridStart = addDays(visibleMonth, -mondayOffset)
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
  }, [visibleMonth])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    rootRef.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${toIsoDate(focusedDate)}"]`)
      ?.focus()
  }, [focusedDate, isOpen, visibleMonth])

  const isUnavailable = (date: Date) =>
    Boolean((minDate && date < minDate) || (maxDate && date > maxDate))

  const open = () => {
    if (disabled) return
    const initialDate = selectedDate ?? today
    setVisibleMonth(startOfMonth(initialDate))
    setFocusedDate(initialDate)
    setIsOpen(true)
  }

  const selectDate = (date: Date) => {
    if (isUnavailable(date)) return
    onChange(toIsoDate(date))
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  const focusDate = (date: Date) => {
    setFocusedDate(date)
    if (
      date.getFullYear() !== visibleMonth.getFullYear() ||
      date.getMonth() !== visibleMonth.getMonth()
    ) {
      setVisibleMonth(startOfMonth(date))
    }
  }

  const handleDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
    let nextDate: Date | null = null

    switch (event.key) {
      case 'ArrowLeft':
        nextDate = addDays(date, -1)
        break
      case 'ArrowRight':
        nextDate = addDays(date, 1)
        break
      case 'ArrowUp':
        nextDate = addDays(date, -7)
        break
      case 'ArrowDown':
        nextDate = addDays(date, 7)
        break
      case 'Home':
        nextDate = addDays(date, -((date.getDay() + 6) % 7))
        break
      case 'End':
        nextDate = addDays(date, 6 - ((date.getDay() + 6) % 7))
        break
      case 'PageUp':
        nextDate = shiftDateByMonths(date, -1)
        break
      case 'PageDown':
        nextDate = shiftDateByMonths(date, 1)
        break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        setIsOpen(false)
        triggerRef.current?.focus()
        return
      case 'Enter':
      case ' ':
        event.preventDefault()
        selectDate(date)
        return
      default:
        return
    }

    event.preventDefault()
    if (nextDate && !isUnavailable(nextDate)) focusDate(nextDate)
  }

  const changeMonth = (amount: number) => {
    const nextMonth = addMonths(visibleMonth, amount)
    setVisibleMonth(nextMonth)
    setFocusedDate(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1))
  }

  return (
    <div
      className="date-picker"
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false)
        }
      }}
    >
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef}
        id={id}
        className="date-picker-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={dialogId}
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={ariaDescribedBy}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        onKeyDown={(event) => {
          if ((event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') && !isOpen) {
            event.preventDefault()
            open()
          } else if (event.key === 'Escape' && isOpen) {
            event.preventDefault()
            event.stopPropagation()
            setIsOpen(false)
          }
        }}
      >
        <span className={selectedDate ? undefined : 'form-control-placeholder'}>
          {selectedDate ? displayFormatter.format(selectedDate) : 'Seleccione una fecha'}
        </span>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5 2v3M15 2v3M3 7h14M4 4h12a1 1 0 0 1 1 1v12H3V5a1 1 0 0 1 1-1Z" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="date-picker-dialog"
          id={dialogId}
          role="dialog"
          aria-modal="false"
          aria-label="Seleccionar fecha"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              setIsOpen(false)
              triggerRef.current?.focus()
            }
          }}
        >
          <div className="date-picker-header">
            <button type="button" aria-label="Mes anterior" onClick={() => changeMonth(-1)}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 3-5 5 5 5" /></svg>
            </button>
            <strong aria-live="polite">{monthFormatter.format(visibleMonth)}</strong>
            <button type="button" aria-label="Mes siguiente" onClick={() => changeMonth(1)}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
            </button>
          </div>
          <div className="date-picker-weekdays" aria-hidden="true">
            {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="date-picker-grid" role="grid">
            {calendarDates.map((date) => {
              const isoDate = toIsoDate(date)
              const isSelected = Boolean(selectedDate && sameDate(date, selectedDate))
              const isToday = sameDate(date, today)
              const isOutsideMonth = date.getMonth() !== visibleMonth.getMonth()
              const unavailable = isUnavailable(date)
              return (
                <button
                  className={`${isSelected ? 'is-selected ' : ''}${isToday ? 'is-today ' : ''}${
                    isOutsideMonth ? 'is-outside-month' : ''
                  }`}
                  key={isoDate}
                  type="button"
                  role="gridcell"
                  data-date={isoDate}
                  tabIndex={sameDate(date, focusedDate) ? 0 : -1}
                  aria-label={dayLabelFormatter.format(date)}
                  aria-selected={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  disabled={unavailable}
                  onClick={() => selectDate(date)}
                  onFocus={() => setFocusedDate(date)}
                  onKeyDown={(event) => handleDayKeyDown(event, date)}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>
          <div className="date-picker-footer">
            <button
              type="button"
              onClick={() => {
                onChange('')
                setIsOpen(false)
                triggerRef.current?.focus()
              }}
              disabled={!value}
            >
              Limpiar
            </button>
            <button type="button" onClick={() => selectDate(today)} disabled={isUnavailable(today)}>
              Hoy
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DatePicker
