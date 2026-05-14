/**
 * MerchantAvatar — Clearbit logo for known merchants, falls back to a
 * category icon. Supports both legacy text-category icons and DB category
 * icons/colours (pass `categoryIcon` + `categoryColor` for DB-backed receipts).
 */
import { useState } from 'react';
import { View, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getMerchantLogoUrl } from '../utils/merchantLogo';
import { CATEGORY_ICONS } from '../constants';
import type { Category } from '../types';

interface MerchantAvatarProps {
  merchant: string;
  category: Category;
  /** DB category icon name — overrides CATEGORY_ICONS lookup when provided */
  categoryIcon?: string;
  /** DB category colour — used as icon colour + background tint when provided */
  categoryColor?: string;
  /** Overall container size in dp (default 44) */
  size?: number;
  /** Fallback icon size (default: size * 0.5) */
  iconSize?: number;
  /** Color for the fallback icon (ignored if categoryColor set) */
  iconColor: string;
  /** Background color (ignored if categoryColor set) */
  backgroundColor: string;
  /** Corner radius; defaults to size * 0.28 */
  borderRadius?: number;
}

export function MerchantAvatar({
  merchant,
  category,
  categoryIcon,
  categoryColor,
  size = 44,
  iconSize,
  iconColor,
  backgroundColor,
  borderRadius,
}: MerchantAvatarProps) {
  const [logoFailed, setLogoFailed] = useState(false);

  const logoUrl = getMerchantLogoUrl(merchant);
  const showLogo = !!logoUrl && !logoFailed;
  const radius = borderRadius ?? Math.round(size * 0.28);
  const resolvedIconSize = iconSize ?? Math.round(size * 0.5);

  // DB category overrides legacy lookup
  const resolvedIcon = categoryIcon ?? (CATEGORY_ICONS[category] ?? 'tag');
  const resolvedIconColor = categoryColor ?? iconColor;
  const resolvedBg = categoryColor ? categoryColor + '20' : backgroundColor;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: showLogo ? '#ffffff' : resolvedBg,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {showLogo ? (
        <Image
          source={{ uri: logoUrl! }}
          style={{ width: size * 0.72, height: size * 0.72 }}
          resizeMode="contain"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <MaterialCommunityIcons
          name={resolvedIcon as any}
          size={resolvedIconSize}
          color={resolvedIconColor}
        />
      )}
    </View>
  );
}
