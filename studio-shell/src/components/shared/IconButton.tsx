import type { ReactNode, ButtonHTMLAttributes, MouseEvent } from 'react'
import { forwardRef } from 'react'
import { setActiveComponent } from '../../utils/componentTracker'
import styles from './IconButton.module.css'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  active?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'default' | 'ghost' | 'accent'
  tooltip?: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { 
      icon, 
      active, 
      size = 'md', 
      variant = 'default',
      tooltip,
      className,
      onClick,
      ...props 
    },
    ref
  ) {
    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      // Track component usage
      setActiveComponent('IconButton', 'src/components/shared/IconButton.tsx')
      
      // Call original onClick if provided
      onClick?.(e)
    }

    return (
      <button
        ref={ref}
        data-component="IconButton"
        className={[
          styles.button,
          styles[size],
          variant !== 'default' ? styles[variant] : '',
          active ? styles.active : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        title={tooltip}
        onClick={handleClick}
        {...props}
      >
        {icon}
      </button>
    )
  }
)





