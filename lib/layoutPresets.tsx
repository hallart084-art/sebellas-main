import React from 'react';

export interface VectorLayoutPreset {
  id: string;
  name: string;
  label: string;
  shortDesc: string;
  itemsCount: number;
  layoutKey: string;
  iconName: string;
}

export const VECTOR_LAYOUT_PRESETS: readonly VectorLayoutPreset[] = [
  {
    id: 'Single Image',
    name: 'Single Image',
    label: 'Single Hero (1 Objek Utama)',
    shortDesc: '1 Subjek utama di tengah kanvas bersih',
    itemsCount: 1,
    layoutKey: 'single',
    iconName: 'crop_portrait'
  },
  {
    id: 'Layout 1 (1+4)',
    name: 'Layout 1 (1+4)',
    label: 'Layout 1: Hero Kiri + 4 Grid (5 Item)',
    shortDesc: '1 Panel Besar Kiri + 4 Kotak Sub-Grid Kanan',
    itemsCount: 5,
    layoutKey: 'hero_left_4_grid',
    iconName: 'view_quilt'
  },
  {
    id: 'Layout 2 (4+1)',
    name: 'Layout 2 (4+1)',
    label: 'Layout 2: 4 Grid Kiri + Hero Kanan (5 Item)',
    shortDesc: '4 Kotak Sub-Grid Kiri + 1 Panel Besar Kanan',
    itemsCount: 5,
    layoutKey: 'hero_right_4_grid',
    iconName: 'view_quilt'
  },
  {
    id: 'Layout 3 (2+1+2)',
    name: 'Layout 3 (2+1+2)',
    label: 'Layout 3: Center Hero Spotlight (5 Item)',
    shortDesc: '2 Kotak Kiri + 1 Center Hero + 2 Kotak Kanan',
    itemsCount: 5,
    layoutKey: 'center_hero_triptych',
    iconName: 'view_column'
  },
  {
    id: 'Layout 4 (2x3)',
    name: 'Layout 4 (2x3)',
    label: 'Layout 4: 6-Card Matrix Pack (6 Item)',
    shortDesc: 'Matriks Simetris 2 Baris x 3 Kolom',
    itemsCount: 6,
    layoutKey: 'matrix_6_cards',
    iconName: 'grid_view'
  },
  {
    id: 'Layout 5 (3x4)',
    name: 'Layout 5 (3x4)',
    label: 'Layout 5: 12-Mega Grid Sheet (12 Item)',
    shortDesc: 'Matriks Koleksi Besar 3 Baris x 4 Kolom',
    itemsCount: 12,
    layoutKey: 'matrix_12_grid',
    iconName: 'apps'
  },
  {
    id: 'Layout 6 (2x2)',
    name: 'Layout 6 (2x2)',
    label: 'Layout 6: 4-Quad Balanced Sheet (4 Item)',
    shortDesc: 'Matriks 4 Kotak Seimbang (2x2)',
    itemsCount: 4,
    layoutKey: 'quad_4_cards',
    iconName: 'grid_view'
  },
  {
    id: 'Layout 7 (1x3)',
    name: 'Layout 7 (1x3)',
    label: 'Layout 7: 3-Column Triptych (3 Item)',
    shortDesc: '3 Kolom Vertikal Berdampingan',
    itemsCount: 3,
    layoutKey: 'triptych_3_columns',
    iconName: 'view_week'
  },
  {
    id: 'Sticker Pack / Set',
    name: 'Sticker Pack / Set',
    label: 'Sticker Pack / Die-Cut Set',
    shortDesc: 'Koleksi stiker die-cut dengan white border',
    itemsCount: 6,
    layoutKey: 'sticker_pack',
    iconName: 'loyalty'
  },
  {
    id: 'Pattern / Seamless',
    name: 'Pattern / Seamless',
    label: 'Seamless Surface Pattern',
    shortDesc: 'Pola tekstil / wallpaper berulang tanpa batas',
    itemsCount: 1,
    layoutKey: 'seamless',
    iconName: 'texture'
  }
] as const;

export const VECTOR_PRESET_NAMES = VECTOR_LAYOUT_PRESETS.map(p => p.name);

export const LayoutMiniPreview: React.FC<{ layoutId: string; className?: string }> = ({ layoutId, className = 'w-12 h-7' }) => {
  switch (layoutId) {
    case 'Layout 1 (1+4)':
      return (
        <svg viewBox="0 0 100 56" className={className}>
          <rect x="2" y="2" width="40" height="52" rx="3" className="fill-blue-500" />
          <rect x="46" y="2" width="24" height="24" rx="2" className="fill-blue-500" />
          <rect x="74" y="2" width="24" height="24" rx="2" className="fill-blue-500" />
          <rect x="46" y="30" width="24" height="24" rx="2" className="fill-blue-500" />
          <rect x="74" y="30" width="24" height="24" rx="2" className="fill-blue-500" />
        </svg>
      );
    case 'Layout 2 (4+1)':
      return (
        <svg viewBox="0 0 100 56" className={className}>
          <rect x="2" y="2" width="24" height="24" rx="2" className="fill-blue-500" />
          <rect x="30" y="2" width="24" height="24" rx="2" className="fill-blue-500" />
          <rect x="2" y="30" width="24" height="24" rx="2" className="fill-blue-500" />
          <rect x="30" y="30" width="24" height="24" rx="2" className="fill-blue-500" />
          <rect x="58" y="2" width="40" height="52" rx="3" className="fill-blue-500" />
        </svg>
      );
    case 'Layout 3 (2+1+2)':
      return (
        <svg viewBox="0 0 100 56" className={className}>
          <rect x="2" y="2" width="25" height="24" rx="2" className="fill-blue-500" />
          <rect x="2" y="30" width="25" height="24" rx="2" className="fill-blue-500" />
          <rect x="31" y="2" width="38" height="52" rx="3" className="fill-blue-500" />
          <rect x="73" y="2" width="25" height="24" rx="2" className="fill-blue-500" />
          <rect x="73" y="30" width="25" height="24" rx="2" className="fill-blue-500" />
        </svg>
      );
    case 'Layout 4 (2x3)':
      return (
        <svg viewBox="0 0 100 56" className={className}>
          <rect x="2" y="2" width="29" height="24" rx="2" className="fill-blue-500" />
          <rect x="35.5" y="2" width="29" height="24" rx="2" className="fill-blue-500" />
          <rect x="69" y="2" width="29" height="24" rx="2" className="fill-blue-500" />
          <rect x="2" y="30" width="29" height="24" rx="2" className="fill-blue-500" />
          <rect x="35.5" y="30" width="29" height="24" rx="2" className="fill-blue-500" />
          <rect x="69" y="30" width="29" height="24" rx="2" className="fill-blue-500" />
        </svg>
      );
    case 'Layout 5 (3x4)':
      return (
        <svg viewBox="0 0 100 56" className={className}>
          {[0, 1, 2].map(row =>
            [0, 1, 2, 3].map(col => (
              <rect
                key={`${row}-${col}`}
                x={2 + col * 24.5}
                y={2 + row * 18}
                width="22.5"
                height="16"
                rx="1.5"
                className="fill-blue-500"
              />
            ))
          )}
        </svg>
      );
    case 'Layout 6 (2x2)':
      return (
        <svg viewBox="0 0 100 56" className={className}>
          <rect x="2" y="2" width="46" height="24" rx="2" className="fill-blue-500" />
          <rect x="52" y="2" width="46" height="24" rx="2" className="fill-blue-500" />
          <rect x="2" y="30" width="46" height="24" rx="2" className="fill-blue-500" />
          <rect x="52" y="30" width="46" height="24" rx="2" className="fill-blue-500" />
        </svg>
      );
    case 'Layout 7 (1x3)':
      return (
        <svg viewBox="0 0 100 56" className={className}>
          <rect x="2" y="2" width="29" height="52" rx="3" className="fill-blue-500" />
          <rect x="35.5" y="2" width="29" height="52" rx="3" className="fill-blue-500" />
          <rect x="69" y="2" width="29" height="52" rx="3" className="fill-blue-500" />
        </svg>
      );
    case 'Sticker Pack / Set':
      return (
        <svg viewBox="0 0 100 56" className={className}>
          <circle cx="20" cy="18" r="14" className="fill-blue-500" />
          <rect x="42" y="4" width="24" height="24" rx="6" className="fill-blue-500" />
          <polygon points="85,4 97,28 73,28" className="fill-blue-500" />
          <rect x="8" y="34" width="36" height="18" rx="4" className="fill-blue-500" />
          <circle cx="60" cy="42" r="11" className="fill-blue-500" />
          <rect x="76" y="34" width="20" height="18" rx="4" className="fill-blue-500" />
        </svg>
      );
    case 'Pattern / Seamless':
      return (
        <svg viewBox="0 0 100 56" className={className}>
          <rect x="2" y="2" width="96" height="52" rx="3" className="fill-blue-500/20 stroke-blue-500" strokeWidth="2" strokeDasharray="4 2" />
          <circle cx="25" cy="20" r="8" className="fill-blue-500" />
          <circle cx="75" cy="20" r="8" className="fill-blue-500" />
          <circle cx="50" cy="38" r="8" className="fill-blue-500" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 100 56" className={className}>
          <rect x="15" y="4" width="70" height="48" rx="4" className="fill-blue-500" />
        </svg>
      );
  }
};
