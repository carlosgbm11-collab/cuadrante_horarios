import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/themeContext';
import { useUndo } from '../../lib/undoContext';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  label,
  icon,
  iconFocused,
  focused,
}: {
  label: string;
  icon: IoniconName;
  iconFocused: IoniconName;
  focused: boolean;
}) {
  const { colors } = useTheme();
  const color = focused ? colors.primary : colors.textMuted;
  return (
    <View style={styles.tabIcon}>
      <Ionicons name={focused ? iconFocused : icon} size={22} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </View>
  );
}

const TAB_BAR_HEIGHT = 70;

export default function TabLayout() {
  const { undo, canUndo, topLabel, stackSize } = useUndo();
  const { colors } = useTheme();
  const [undoing, setUndoing] = useState(false);

  const handleUndo = async () => {
    if (!canUndo || undoing) return;
    setUndoing(true);
    try {
      await undo();
    } catch (_) {}
    setUndoing(false);
  };

  return (
    <View style={{ flex: 1 }}>
      {canUndo && (
        <Pressable
          style={[styles.undoBar, { backgroundColor: colors.undoBg }, undoing && { opacity: 0.6 }]}
          onPress={handleUndo}
          disabled={undoing}
        >
          <Ionicons name="arrow-undo" size={16} color="#FFFFFF" />
          <Text style={styles.undoBarText} numberOfLines={1}>
            {undoing ? 'Deshaciendo...' : topLabel}
          </Text>
          {stackSize > 1 && (
            <View style={styles.undoBarBadge}>
              <Text style={styles.undoBarBadgeText}>×{stackSize}</Text>
            </View>
          )}
        </Pressable>
      )}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.tabBarBg,
            borderTopColor: colors.tabBarBorder,
            borderTopWidth: 1,
            height: TAB_BAR_HEIGHT,
            paddingBottom: 8,
            paddingTop: 4,
          },
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon label="Mes" icon="calendar-outline" iconFocused="calendar" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="week"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon label="Semana" icon="calendar-clear-outline" iconFocused="calendar-clear" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="workers"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon label="Equipo" icon="people-outline" iconFocused="people" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="admin"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon label="Admin" icon="settings-outline" iconFocused="settings" focused={focused} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    gap: 3,
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  undoBar: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  undoBarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  undoBarBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  undoBarBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
