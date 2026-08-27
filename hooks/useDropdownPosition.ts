
import { useState, useRef, useLayoutEffect, useEffect, RefObject, CSSProperties } from 'react';

interface UseDropdownPositionOptions {
 isOpen: boolean;
 triggerRef: RefObject<HTMLElement>;
 onClose: () => void;
 horizontalAlign?: 'start' | 'center' | 'end';
 matchTriggerWidth?: boolean;
 minWidth?: number;
 horizontalOffset?: number;
 forceDownward?: boolean;
}

export const useDropdownPosition = ({
 isOpen,
 triggerRef,
 onClose,
 horizontalAlign = 'start',
 matchTriggerWidth = true,
 minWidth = 160,
 horizontalOffset = 0,
 forceDownward = false,
}: UseDropdownPositionOptions) => {
 const dropdownRef = useRef<HTMLDivElement>(null);
 const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({
 opacity: 0,
 pointerEvents: 'none',
 position: 'fixed',
 zIndex: 10500,
 });

 useEffect(() => {
 if (!isOpen) return;

 const handleClickOutside = (event: MouseEvent) => {
 if (
 triggerRef.current &&
 !triggerRef.current.contains(event.target as Node) &&
 dropdownRef.current &&
 !dropdownRef.current.contains(event.target as Node)
 ) {
 onClose();
 }
 };
 document.addEventListener('mousedown', handleClickOutside);
 return () => {
 document.removeEventListener('mousedown', handleClickOutside);
 };
 }, [isOpen, onClose, triggerRef]);

 useLayoutEffect(() => {
 if (isOpen && triggerRef.current && dropdownRef.current) {
 const triggerRect = triggerRef.current.getBoundingClientRect();
 // Ensure dropdown has dimensions before calculating
 const dropdownRect = dropdownRef.current.getBoundingClientRect();
 if (dropdownRect.width === 0 && dropdownRect.height === 0) return;

 const dropdownWidth = matchTriggerWidth
 ? Math.max(triggerRect.width, minWidth)
 : Math.max(dropdownRect.width, minWidth);
 const gap = 6;

 // Default: buka ke BAWAH
 let top = triggerRect.bottom + gap;

 // Balik ke atas HANYA jika tidak muat di bawah DAN ada ruang di atas
 if (!forceDownward) {
 const fitsBelow = top + dropdownRect.height <= window.innerHeight - 8;
 const fitsAbove = triggerRect.top - dropdownRect.height - gap >= 8;
 if (!fitsBelow && fitsAbove) {
 top = triggerRect.top - dropdownRect.height - gap;
 } else if (!fitsBelow && !fitsAbove) {
 // Tidak muat kedua arah — tempel ke bawah viewport
 top = window.innerHeight - dropdownRect.height - 8;
 }
 }
 if (top < 8) top = 8;

 // Posisi horizontal: start, center, atau end terhadap trigger
 let left = triggerRect.left;
 if (horizontalAlign === 'center') {
 left = triggerRect.left + (triggerRect.width - dropdownWidth) / 2;
 } else if (horizontalAlign === 'end') {
 left = triggerRect.right - dropdownWidth;
 }
 left += horizontalOffset;
 if (left + dropdownWidth > window.innerWidth - 8) {
 left = triggerRect.right - dropdownWidth;
 }
 if (left < 8) left = 8;

 setDropdownStyle({
 position: 'fixed', top: `${top}px`, left: `${left}px`, width: `${dropdownWidth}px`,
 opacity: 1, pointerEvents: 'auto', zIndex: 10500,
 });
 } else {
 setDropdownStyle(s => ({ ...s, opacity: 0, pointerEvents: 'none' }));
    }
  }, [isOpen, triggerRef, horizontalAlign, matchTriggerWidth, minWidth, horizontalOffset, forceDownward]);

  return { dropdownRef, dropdownStyle };
};
