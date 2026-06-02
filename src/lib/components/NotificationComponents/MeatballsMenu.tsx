'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './MeatballsMenu.module.scss';

export interface MeatballsMenuItem {
  icon?: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface MeatballsMenuProps {
  items: MeatballsMenuItem[];
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  position?: 'left' | 'right';
}

export default function MeatballsMenu({
  items,
  className,
  buttonClassName,
  menuClassName,
  position = 'right',
}: MeatballsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleItemClick = (item: MeatballsMenuItem) => {
    if (!item.disabled) {
      item.onClick();
      setIsOpen(false);
    }
  };

  return (
    <div className={`${styles.container} ${className || ''}`} ref={menuRef}>
      <button
        className={`${styles.kebabButton} ${buttonClassName || ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="More options"
        aria-expanded={isOpen}
      >
        <i className="las la-ellipsis-h"></i>
      </button>

      {isOpen && (
        <div
          className={`${styles.menu} ${position === 'left' ? styles.menuLeft : styles.menuRight} ${menuClassName || ''}`}
        >
          {items.map((item, index) => (
            <button
              key={index}
              onClick={() => handleItemClick(item)}
              disabled={item.disabled}
              className={item.disabled ? styles.disabled : ''}
            >
              {item.icon && <i className={item.icon}></i>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}