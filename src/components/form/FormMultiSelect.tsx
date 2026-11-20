import { KeyboardEvent, useEffect, useRef, useState } from 'react'
import './FormControls.css'

export type MultiSelectOption = {
  value: string
  label: string
  description?: string
}

type FormMultiSelectProps = {
  id: string
  values: string[]
  options: readonly MultiSelectOption[]
  onChange: (values: string[]) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  loading?: boolean
  error?: string
  onRetry?: () => void
  ariaInvalid?: boolean
  ariaDescribedBy?: string
}

function FormMultiSelect({
  id,
  values,
  options,
  onChange,
  placeholder = 'Seleccione uno o varios lugares',
  disabled = false,
  required = false,
  loading = false,
  error,
  onRetry,
  ariaInvalid = false,
  ariaDescribedBy,
}: FormMultiSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const listboxId = `${id}-listbox`
  const unavailable = disabled || loading || Boolean(error)
  const selectedOptions = values
    .map((value) => options.find((option) => option.value === value))
    .filter((option): option is MultiSelectOption => Boolean(option))

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  const toggleValue = (value: string) => {
    onChange(
      values.includes(value)
        ? values.filter((current) => current !== value)
        : [...values, value],
    )
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (unavailable || options.length === 0) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (isOpen) setActiveIndex((current) => (current + 1) % options.length)
        else setIsOpen(true)
        break
      case 'ArrowUp':
        event.preventDefault()
        if (isOpen) {
          setActiveIndex((current) => (current - 1 + options.length) % options.length)
        } else {
          setActiveIndex(options.length - 1)
          setIsOpen(true)
        }
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
          setActiveIndex(options.length - 1)
        }
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (isOpen) {
          const option = options[activeIndex]
          if (option) toggleValue(option.value)
        } else {
          setIsOpen(true)
        }
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
    }
  }

  return (
    <div className="form-multiselect" ref={rootRef}>
      <div className="form-multiselect-picker">
        <div
          className="form-multiselect-control"
          data-disabled={unavailable || undefined}
          data-invalid={ariaInvalid || undefined}
          data-open={isOpen || undefined}
        >
          <button
            ref={triggerRef}
            id={id}
            className="form-multiselect-trigger"
            type="button"
            role="combobox"
            aria-controls={listboxId}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-activedescendant={isOpen ? `${id}-option-${activeIndex}` : undefined}
            aria-invalid={ariaInvalid || undefined}
            aria-describedby={ariaDescribedBy}
            aria-required={required || undefined}
            disabled={unavailable}
            onClick={() => setIsOpen((current) => !current)}
            onKeyDown={handleKeyDown}
          >
            <span className={values.length === 0 ? 'form-control-placeholder' : undefined}>
              {loading
                ? 'Cargando lugares…'
                : values.length === 0
                  ? placeholder
                  : `${values.length} lugar${values.length === 1 ? '' : 'es'} seleccionado${
                      values.length === 1 ? '' : 's'
                    }`}
            </span>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m4 6 4 4 4-4" />
            </svg>
          </button>
        </div>

        {isOpen && (
          <ul
            className="form-select-listbox form-multiselect-listbox"
            id={listboxId}
            role="listbox"
            aria-multiselectable="true"
          >
            {options.map((option, index) => {
              const selected = values.includes(option.value)
              return (
                <li
                  id={`${id}-option-${index}`}
                  className={`${index === activeIndex ? 'is-active' : ''}${
                    selected ? ' is-selected' : ''
                  }`}
                  key={option.value}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => toggleValue(option.value)}
                >
                  <span className="form-multiselect-checkbox" aria-hidden="true">
                    {selected && (
                      <svg viewBox="0 0 16 16">
                        <path d="m3 8 3 3 7-7" />
                      </svg>
                    )}
                  </span>
                  <span className="form-multiselect-option-label">{option.label}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {selectedOptions.length > 0 && (
        <div className="form-multiselect-chips" aria-label="Lugares seleccionados">
          {selectedOptions.map((option) => (
            <span className="form-multiselect-chip" key={option.value}>
              <span>{option.label}</span>
              {!unavailable && (
                <button
                  type="button"
                  aria-label={`Quitar ${option.label}`}
                  onClick={() => toggleValue(option.value)}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="m4 4 8 8M12 4l-8 8" />
                  </svg>
                </button>
              )}
            </span>
          ))}
        </div>
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

export default FormMultiSelect
