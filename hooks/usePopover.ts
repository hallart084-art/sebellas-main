
import React, { useRef, useEffect, useLayoutEffect, RefObject, useState } from 'react';

interface UsePopoverOptions {
 isOpen: boolean;
 onClose: () => void;
 triggerRef: RefObject<HTMLElement>;
 options?: {
 offsetX?: number;
 offsetY?: number;
 position?: 'bottom-end' | 'bottom-start';
 anchorElementId?: string;
 anchorGap?: number;
 };
}

export const usePopover = ({ isOpen, onClose, triggerRef, options }: UsePopoverOptions) => {
 const popoverRef = useRef<HTMLDivElement>(null);
 const [style, setStyle] = useState<React.CSSProperties>({
 opacity: 0,
 pointerEvents: 'none',
 position: 'fixed',
 zIndex: 10000,
 });

 const { offsetX = 0, offsetY = 8, position = 'bottom-end', anchorElementId, anchorGap = 6 } = options || {};

 useLayoutEffect(() => {
 const calculatePosition = () => {
 if (!triggerRef.current || !popoverRef.current) return;
 
 const popoverRect = popoverRef.current.getBoundingClientRect();

 let top: number;
 let left: number;

 // If anchorElementId is provided, position to the left of that element
 if (anchorElementId) {
 const anchorEl = document.getElementById(anchorElementId);
 if (!anchorEl) return;
 const anchorRect = anchorEl.getBoundingClientRect();
 top = anchorRect.top;
 left = anchorRect.left - popoverRect.width - anchorGap;
 } else {
 const triggerRect = triggerRef.current.getBoundingClientRect();
 top = triggerRect.bottom + offsetY;

 if (position === 'bottom-end') {
 left = triggerRect.right - popoverRect.width + offsetX;
 } else { // bottom-start
 left = triggerRect.left + offsetX;
 }
 }
 
 // Boundary checks
 if (left < 8) left = 8;
 if (left + popoverRect.width > window.innerWidth - 8) {
 left = window.innerWidth - popoverRect.width - 8;
 }
 if (top + popoverRect.height > window.innerHeight - 8) {
 top = window.innerHeight - popoverRect.height - 8;
 }
 if (top < 8) top = 8;

 setStyle({
 position: 'fixed',
 top: `${top}px`,
 left: `${left}px`,
 opacity: 1,
 pointerEvents: 'auto',
 zIndex: 10000,
 });
 };
 
 if (isOpen) {
 // requestAnimationFrame ensures the popover has been rendered and has dimensions.
 requestAnimationFrame(calculatePosition);

 window.addEventListener('resize', calculatePosition);
 window.addEventListener('scroll', calculatePosition, true);
 
 let resizeObserver: ResizeObserver | null = null;
 if (popoverRef.current) {
 resizeObserver = new ResizeObserver(() => {
 requestAnimationFrame(calculatePosition);
 });
 resizeObserver.observe(popoverRef.current);
 }
 
 return () => {
 window.removeEventListener('resize', calculatePosition);
 window.removeEventListener('scroll', calculatePosition, true);
 if (resizeObserver) {
 resizeObserver.disconnect();
 }
 };
 } else {
 setStyle(prev => ({ ...prev, opacity: 0, pointerEvents: 'none' }));
 }
 }, [isOpen, triggerRef, popoverRef, offsetX, offsetY, position, anchorElementId, anchorGap]);

 useEffect(() => {
 if (!isOpen) return;

 const handleKeyDown = (event: KeyboardEvent) => {
 if (event.key === 'Escape') {
 onClose();
 }
 };
 
 const handleClickOutside = (event: MouseEvent) => {
 if (
 popoverRef.current && !popoverRef.current.contains(event.target as Node) &&
 triggerRef.current && !triggerRef.current.contains(event.target as Node)
 ) {
 // Don't close if clicking inside another dropdown-menu-portal
 const target = event.target as Element;
 if (target.closest && target.closest('.dropdown-menu-portal')) {
 return;
 }
 onClose();
 }
 };

 document.addEventListener('keydown', handleKeyDown);
 document.addEventListener('mousedown', handleClickOutside);

 return () => {
 document.removeEventListener('keydown', handleKeyDown);
 document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, triggerRef, popoverRef]);

  return { popoverRef, style };
};
