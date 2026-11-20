import { KeyboardEvent, useEffect, useRef, useState } from 'react'
import './FormControls.css'

type FormSelectProps = {
  id: string
  name?: string
  value: string
  options: readonly (string | FormSelectOption)[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  loading?: boolean
  error?: string
  onRetry?: () => void
  ariaInvalid?: boolean
  ariaDescribedBy?: string
}

export type FormSelectOption = {
  value: string
  label: string
  description?: string
}

function FormSelect({
  id,
  name,
  value,
  options,
  onChange,
  placeholder = 'Seleccione una opción',
  disabled = false,
  required = false,
  loading = false,
  error,
  onRetry,
  ariaInvalid = false,
  ariaDescribedBy,
}: FormSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const typeaheadRef = useRef('')
  const typeaheadTimerRef = useRef<number | undefined>(undefined)
  const normalizedOptions: FormSelectOption[] = options.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option,
  )
  const optionValues: FormSelectOption[] = [
    { value: '', label: placeholder },
    ...normalizedOptions,
  ]
  const selectedIndex = optionValues.findIndex((option) => option.value === value)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIndex))
  const listboxId = `${id}-listbox`

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  useEffect(
    () => () => {
      if (typeaheadTimerRef.current !== undefined) {
        window.clearTimeout(typeaheadTimerRef.current)
      }
    },
    [],
  )

  const open = (preferredIndex = selectedIndex >= 0 ? selectedIndex : 0) => {
    if (disabled || loading || Boolean(error)) return
    setActiveIndex(preferredIndex)
    setIsOpen(true)
  }

  const selectOption = (index: number) => {
    const option = optionValues[index]
    if (option === undefined) return
    onChange(option.value)
    setActiveIndex(index)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  const moveActive = (offset: number) => {
    setActiveIndex(
      (current) => (current + offset + optionValues.length) % optionValues.length,
    )
  }

  const handleTypeahead = (key: string) => {
    typeaheadRef.current += key.toLocaleLowerCase('es-SV')
    if (typeaheadTimerRef.current !== undefined) {
      window.clearTimeout(typeaheadTimerRef.current)
    }
    typeaheadTimerRef.current = window.setTimeout(() => {
      typeaheadRef.current = ''
    }, 600)

    const nextIndex = optionValues.findIndex((option) =>
      option.label.toLocaleLowerCase('es-SV').startsWith(typeaheadRef.current),
    )
    if (nextIndex >= 0) {
      setActiveIndex(nextIndex)
      if (!isOpen) open(nextIndex)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || loading || Boolean(error)) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (isOpen) moveActive(1)
        else open(selectedIndex >= 0 ? selectedIndex : 0)
        break
      case 'ArrowUp':
        event.preventDefault()
        if (isOpen) moveActive(-1)
        else open(selectedIndex >= 0 ? selectedIndex : optionValues.length - 1)
        break
      case 'Home':
        if (isOpen) {
          event.preventDefault()
          setActiveIndex(0)
        }
        break
      case 'End':
        if (isOpen) {
          event.preventDefault()
          setActiveIndex(optionValues.length - 1)
        }
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (isOpen) selectOption(activeIndex)
        else open()
        break
      case 'Escape':
        if (isOpen) {
          event.preventDefault()
          event.stopPropagation()
          setIsOpen(false)
        }
        break
      case 'Tab':
        setIsOpen(false)
        break
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          handleTypeahead(event.key)
        }
    }
  }

  return (
    <div className="form-select" ref={rootRef}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef}
        id={id}
        className="form-select-trigger"
        type="button"
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-activedescendant={isOpen ? `${id}-option-${activeIndex}` : undefined}
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={ariaDescribedBy}
        aria-required={required || undefined}
        disabled={disabled || loading || Boolean(error)}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        onKeyDown={handleKeyDown}
      >
        <span className={value ? undefined : 'form-control-placeholder'}>
          {loading ? 'Cargando opciones…' : optionValues[selectedIndex]?.label || placeholder}
        </span>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>

      {isOpen && (
        <ul className="form-select-listbox" id={listboxId} role="listbox">
          {optionValues.map((option, index) => (
            <li
              id={`${id}-option-${index}`}
              className={`${index === activeIndex ? 'is-active' : ''}${
                option.value === value ? ' is-selected' : ''
              }`}
              key={option.value || '__placeholder__'}
              role="option"
              aria-selected={option.value === value}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(index)}
            >
              <span>
                {option.label}
                {option.description && <small>{option.description}</small>}
              </span>
              {option.value === value && (
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="m3 8 3 3 7-7" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <div className="form-multiselect-status" role="alert">
          <span>{error}</span>
          {onRetry && (
            <button type="button" onClick={onRetry}>
              Reintentar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default FormSelect
