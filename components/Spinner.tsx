
import React, { memo } from 'react';

interface SpinnerProps {
 size?: string;
 color?: string; 
 thickness?: string; 
}

const Spinner: React.FC<SpinnerProps> = ({ 
 size = 'w-6 h-6', 
 color = 'border-blue-400', 
 thickness = 'border-2' 
}) => {
 // Convert Tailwind border colors to text colors so currentColor works correctly
 const textColor = color.startsWith('border-') ? color.replace('border-', 'text-') : color;

 return (
 <div 
 className={`modern-spinner ${size} ${textColor}`}
 role="status"
 >
 <span className="sr-only">Loading...</span>
    </div>
  );
};

export default memo(Spinner);
