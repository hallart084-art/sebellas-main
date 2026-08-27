import React, { useState, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { useDropdownPosition } from '../hooks/useDropdownPosition';

interface RoleSelectorProps {
 id?: string;
 currentRole: 'user' | 'admin' | 'superadmin';
 onRoleChange: (role: 'user' | 'admin' | 'superadmin') => void;
 className?: string;
 disabled?: boolean;
 options: Array<'user' | 'admin' | 'superadmin'>;
}

const RoleSelector: React.FC<RoleSelectorProps> = ({
 id,
 currentRole,
 onRoleChange,
 className,
 disabled = false,
 options
}) => {
 const [isOpen, setIsOpen] = useState(false);
 const triggerRef = useRef<HTMLButtonElement>(null);
 const { dropdownRef, dropdownStyle } = useDropdownPosition({
 isOpen,
 triggerRef,
 onClose: () => setIsOpen(false),
 });

 const handleSelect = (role: 'user' | 'admin' | 'superadmin') => {
 onRoleChange(role);
 setIsOpen(false);
 };
 
 const dropdownClasses = `dropdown-menu-portal role-selector-menu p-1`;

 const formatRole = (r: string) => r === 'superadmin' ? 'Superadmin' : r.charAt(0).toUpperCase() + r.slice(1);

 const dropdownMenu = (
 <div
 ref={dropdownRef}
 className={dropdownClasses}
 style={dropdownStyle}
 role="menu"
 >
 <div className="max-h-60 overflow-y-auto flex flex-col gap-0.5">
 {options.map((role) => (
 <button
 key={role}
 onClick={() => handleSelect(role)}
 className={`dropdown-menu-item role-selector-item block w-full text-left px-3 py-2 text-[12px] ${role === currentRole ? 'active' : ''}`}
 role="menuitem"
 >
 {formatRole(role)}
 </button>
 ))}
 </div>
 </div>
 );
 
 const triggerButtonClasses = `admin-input role-selector-trigger flex items-center justify-between text-left w-full`;

 return (
 <div className={`relative w-full ${className || ''}`}>
 <button
 type="button"
 id={id}
 ref={triggerRef}
 onClick={() => setIsOpen(!isOpen)}
 className={triggerButtonClasses}
 aria-haspopup="true"
 aria-expanded={isOpen}
 disabled={disabled}
 >
 <span>{formatRole(currentRole)}</span>
 <svg 
 className="inline-block w-4 h-4 ml-1 transition-transform duration-[180ms] flex-shrink-0"
 style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
 fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
 </svg>
 </button>
 {isOpen && typeof document !== 'undefined' && createPortal(dropdownMenu, document.body)}
    </div>
  );
};

export default memo(RoleSelector);


