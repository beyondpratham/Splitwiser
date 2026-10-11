import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

type SF = Extract<SymbolViewProps['name'], string>;

// SF Symbol → Material Symbol name for Android / web.
const MD: Partial<Record<SF, string>> = {
  'plus': 'add',
  'plus.circle.fill': 'add_circle',
  'chevron.right': 'chevron_right',
  'chevron.down': 'expand_more',
  'checkmark': 'check',
  'checkmark.circle.fill': 'check_circle',
  'circle': 'radio_button_unchecked',
  'xmark': 'close',
  'xmark.circle.fill': 'cancel',
  'person.fill': 'person',
  'person.2.fill': 'group',
  'person.3.fill': 'groups',
  'person.crop.circle.badge.plus': 'person_add',
  'person.badge.plus': 'person_add',
  'gearshape.fill': 'settings',
  'gearshape': 'settings',
  'trash': 'delete',
  'pencil': 'edit',
  'arrow.right': 'arrow_forward',
  'arrow.uturn.backward': 'undo',
  'arrow.up.circle.fill': 'arrow_circle_up',
  'banknote.fill': 'payments',
  'chart.pie.fill': 'pie_chart',
  'chart.bar.fill': 'bar_chart',
  'bell.fill': 'notifications',
  'clock.arrow.circlepath': 'history',
  'bubble.left.fill': 'chat_bubble',
  'calendar': 'calendar_today',
  'note.text': 'notes',
  'envelope.fill': 'mail',
  'rectangle.portrait.and.arrow.right': 'logout',
  'equal': 'drag_handle',
  'percent': 'percent',
  'number': 'tag',
  'list.bullet': 'list',
  'magnifyingglass': 'search',
  'ellipsis.circle': 'more_horiz',
  'arrow.left.arrow.right': 'swap_horiz',
  'sparkles': 'auto_awesome',
  'dollarsign.circle.fill': 'paid',
  'globe': 'public',
  'paintpalette.fill': 'palette',
  'exclamationmark.triangle.fill': 'warning',
};

interface Props {
  name: SF;
  /** override the Material fallback name */
  md?: string;
  size?: number;
  color?: ColorValue;
  weight?: SymbolViewProps['weight'];
}

export function Icon({ name, md, size = 20, color, weight }: Props) {
  return (
    <SymbolView
      name={{ ios: name, android: (md ?? MD[name] ?? 'circle') as never, web: (md ?? MD[name] ?? 'circle') as never }}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
    />
  );
}

export type { SF };
