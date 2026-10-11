import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color?: ColorValue }) {
  return <MaterialCommunityIcons name={name} size={size} color={color as string} />;
}
