import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Button } from './Button';

interface DatePickerProps {
  label?: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  error?: string;
  containerStyle?: ViewStyle;
  minDate?: Date;
  maxDate?: Date;
}

export function DatePicker({
  label,
  value,
  onChange,
  placeholder = 'Select a date',
  error,
  containerStyle,
  minDate,
  maxDate,
}: DatePickerProps) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(value?.getFullYear() || new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(value?.getMonth() || new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(value?.getDate() || null);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const firstDay = getFirstDayOfMonth(selectedYear, selectedMonth);

  const isDateDisabled = (day: number) => {
    const date = new Date(selectedYear, selectedMonth, day);
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const handleSelectDate = (day: number) => {
    if (isDateDisabled(day)) return;
    setSelectedDay(day);
  };

  const handleConfirm = () => {
    if (selectedDay) {
      onChange(new Date(selectedYear, selectedMonth, selectedDay));
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setSelectedDay(null);
    setIsOpen(false);
  };

  const prevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
    setSelectedDay(null);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderCalendarDays = () => {
    const days = [];
    const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    // Week header
    days.push(
      <View key="header" style={styles.weekHeader}>
        {weekDays.map((day) => (
          <Text key={day} style={[styles.weekDay, { color: colors.textSecondary }]}>
            {day}
          </Text>
        ))}
      </View>
    );

    // Calendar grid
    const rows = [];
    let cells = [];

    // Empty cells for days before first day of month
    for (let i = 0; i < firstDay; i++) {
      cells.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = day === selectedDay;
      const isDisabled = isDateDisabled(day);
      const isToday =
        day === new Date().getDate() &&
        selectedMonth === new Date().getMonth() &&
        selectedYear === new Date().getFullYear();

      cells.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.dayCell,
            isSelected && { backgroundColor: colors.primary },
            isToday && !isSelected && { borderWidth: 1, borderColor: colors.primary },
          ]}
          onPress={() => handleSelectDate(day)}
          disabled={isDisabled}
        >
          <Text
            style={[
              styles.dayText,
              { color: colors.text },
              isSelected && styles.dayTextSelected,
              isDisabled && { color: colors.textTertiary },
              isToday && !isSelected && { color: colors.primary, fontWeight: '600' },
            ]}
          >
            {day}
          </Text>
        </TouchableOpacity>
      );

      if ((firstDay + day) % 7 === 0 || day === daysInMonth) {
        rows.push(
          <View key={`row-${rows.length}`} style={styles.weekRow}>
            {cells}
          </View>
        );
        cells = [];
      }
    }

    // Fill remaining cells in last row
    while (cells.length > 0 && cells.length < 7) {
      cells.push(<View key={`empty-end-${cells.length}`} style={styles.dayCell} />);
    }
    if (cells.length > 0) {
      rows.push(
        <View key={`row-${rows.length}`} style={styles.weekRow}>
          {cells}
        </View>
      );
    }

    days.push(...rows);
    return days;
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: colors.text }]}>{label}</Text>}

      <TouchableOpacity
        style={[
          styles.selectButton,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          error && { borderColor: colors.error },
        ]}
        onPress={() => setIsOpen(true)}
      >
        <Ionicons name="calendar-outline" size={20} color={colors.textTertiary} />
        <Text
          style={[
            styles.selectText,
            { color: colors.text },
            !value && { color: colors.textTertiary },
          ]}
        >
          {value ? formatDate(value) : placeholder}
        </Text>
        {value && (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={[styles.overlay, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.calendar, { backgroundColor: colors.surface }]}
          >
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={prevMonth} style={styles.navButton}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.monthYear, { color: colors.text }]}>
                {months[selectedMonth]} {selectedYear}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={styles.navButton}>
                <Ionicons name="chevron-forward" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarBody}>
              {renderCalendarDays()}
            </View>

            <View style={styles.calendarFooter}>
              <Button
                title="Cancel"
                onPress={() => setIsOpen(false)}
                variant="ghost"
                size="sm"
              />
              <Button
                title="Confirm"
                onPress={handleConfirm}
                variant="primary"
                size="sm"
                disabled={!selectedDay}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 48,
  },
  selectText: {
    fontSize: FontSizes.md,
    flex: 1,
  },
  error: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  calendar: {
    borderRadius: BorderRadius.xl,
    width: '100%',
    maxWidth: 350,
    padding: Spacing.lg,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  navButton: {
    padding: Spacing.sm,
  },
  monthYear: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  calendarBody: {
    marginBottom: Spacing.lg,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
  },
  dayText: {
    fontSize: FontSizes.md,
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  calendarFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
});
