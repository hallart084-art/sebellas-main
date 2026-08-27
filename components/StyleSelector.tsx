
import React, { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { StyleOption, InputMode } from '../types';
import { AllTranslationKeys } from '../locales';
import { useLocalizationContext } from '../contexts/LocalizationContext';
import { useDropdownPosition } from '../hooks/useDropdownPosition';

interface StyleSelectorProps {
 id?: string;
 currentStyle: StyleOption;
 onStyleChange: (style: StyleOption) => void;
 inputMode: InputMode;
 disabled?: boolean;
 inline?: boolean;
 iconOnly?: boolean;
 showFeatureLabel?: boolean;
}

const styleOptions: readonly StyleOption[] = ['photographic', 'sameAsReference', 'isolated', 'footage', 'custom'];

const styleOptionLabels: Record<StyleOption, AllTranslationKeys> = {
 photographic: 'promptStylePhotographic',
 sameAsReference: 'promptStyleSameAsReference',
 isolated: 'promptStyleIsolated',
 custom: 'promptStyleCustom',
 footage: 'promptStyleFootage',
};


const StyleSelector: React.FC<StyleSelectorProps> = ({
 id,
 currentStyle,
 onStyleChange,
 inputMode,
 disabled = false,
 inline = false,
 iconOnly = false,
 showFeatureLabel = false,
}) => {
 const { t } = useLocalizationContext();
 const [isOpen, setIsOpen] = useState(false);
 const triggerRef = useRef<HTMLButtonElement>(null);
 const { dropdownRef, dropdownStyle } = useDropdownPosition({
 isOpen,
 triggerRef,
 onClose: () => setIsOpen(false),
 horizontalAlign: inline ? 'center' : 'start',
 });

 const handleStyleSelect = (style: StyleOption) => {
 onStyleChange(style);
 setIsOpen(false);
 };

 useEffect(() => {
 if (!isOpen || !iconOnly) return;
 const handleEsc = (e: KeyboardEvent) => {
 if (e.key === 'Escape') setIsOpen(false);
 };
 document.addEventListener('keydown', handleEsc);
 return () => document.removeEventListener('keydown', handleEsc);
 }, [isOpen, iconOnly]);
 
 const dropdownClasses = `dropdown-menu-portal p-1`;

 const dropdownMenu = (
 <div
 ref={dropdownRef}
 className={dropdownClasses}
 style={dropdownStyle}
 role="menu"
 aria-orientation="vertical"
 aria-labelledby={id || 'style-selector-button'}
 >
 <div className="selector-options-list max-h-60 overflow-y-auto flex flex-col gap-0.5">
 {styleOptions.map((option) => {
 const isDisabled = option === 'sameAsReference' && inputMode === 'text';
 return (
 <button
 key={option}
 onClick={() => handleStyleSelect(option)}
 className={`dropdown-menu-item flex items-center justify-between w-full text-left px-3 py-2 text-sm ${option === currentStyle ? 'active' : ''}`}
 role="menuitemradio"
 aria-checked={option === currentStyle}
 disabled={isDisabled}
 >
 <span>{t(styleOptionLabels[option])}</span>
 {option === currentStyle && <span className="material-symbols-outlined text-base">check</span>}
 </button>
 );
 })}
 </div>
 </div>
 );

 const popupMenu = (
 <div
 className="model-picker-overlay"
 onMouseDown={(e) => {
 if (e.target === e.currentTarget) {
 setIsOpen(false);
 }
 }}
 role="presentation"
 >
 <div
 className="model-picker-card"
 role="dialog"
 aria-modal="true"
 aria-label="Prompt style selector"
 onMouseDown={(e) => e.stopPropagation()}
 >
 <div className="model-picker-group-label">Prompt Style</div>
 <div className="model-picker-list">
 {styleOptions.map((option) => {
 const isDisabled = option === 'sameAsReference' && inputMode === 'text';
 return (
 <button
 key={option}
 type="button"
 onClick={() => handleStyleSelect(option)}
 className={`model-picker-item ${option === currentStyle ? 'active' : ''}`}
 disabled={isDisabled}
 >
 <span className="model-picker-item-left">
 <span className="material-symbols-outlined text-[16px]">palette</span>
 <span className="model-picker-item-text">{t(styleOptionLabels[option])}</span>
 </span>
 {option === currentStyle && <span className="model-picker-default-pill">Active</span>}
 </button>
 );
 })}
 </div>
 </div>
 </div>
 );
 
 const triggerButtonClasses = inline 
 ? `footer-transient-btn footer-selector-pill flex items-center ${iconOnly ? 'justify-center px-0 gap-0 w-full' : 'justify-between w-full'} text-[12px] text-gray-500 transition-colors font-medium`
 : `flat-input w-full text-sm flex items-center justify-between text-left`;


 return (
 <div className={`relative ${inline ? 'inline-flex items-center' : 'w-full'}`} style={inline ? { width: iconOnly ? '42px' : '120px', flexShrink: 0 } : undefined}>
 <button
 id={id || 'style-selector-button'}
 ref={triggerRef}
 onClick={() => setIsOpen(!isOpen)}
 className={triggerButtonClasses}
 aria-haspopup={iconOnly ? "dialog" : "true"}
 aria-expanded={isOpen}
 aria-label={`Select prompt style, current style ${t(styleOptionLabels[currentStyle])}`}
 disabled={disabled}
 >
 {iconOnly ? (
 <span className="material-symbols-outlined compact-selector-icon">palette</span>
 ) : (
 <span className="truncate min-w-0 flex-1 pr-1 text-left">{showFeatureLabel ? t('promptStyleLegend') : t(styleOptionLabels[currentStyle])}</span>
 )}
 {!iconOnly && (
 <svg 
 className="inline-block w-4 h-4 ml-0.5 transition-transform duration-[180ms] flex-shrink-0"
 style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
 fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
 </svg>
 )}
 </button>
 {isOpen && typeof document !== 'undefined' && createPortal(iconOnly ? popupMenu : dropdownMenu, document.body)}
    </div>
  );
};

export default memo(StyleSelector);


