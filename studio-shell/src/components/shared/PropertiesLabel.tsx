import type { InputHTMLAttributes } from 'react'
import styles from './PropertiesLabel.module.css'

interface PropertiesLabelProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'readOnly'> {
  value: string
}

/** Read-only display field for Properties panel: no outline, subtle #D0D9FB background */
export function PropertiesLabel({ value, className, ...props }: PropertiesLabelProps) {
  return (
    <input
      type="text"
      readOnly
      value={value}
      className={`${styles.propertiesLabel} ${className ?? ''}`}
      {...props}
    />
  )
}
