import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ViewStyle,
  ScrollView,
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

type PickerView = 'days' | 'months' | 'years';

const MIN_YEAR = 1900;

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const monthsShort = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

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
  const [pickerView, setPickerView] = useState<PickerView>('days');
  const [selectedYear, setSelectedYear] = useState(value?.getFullYear() || new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(value?.getMonth() || new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(value?.getDate() || null);
  const yearScrollRef = useRef<ScrollView>(null);

  const maxYear = maxDate?.getFullYear() || new Date().getFullYear();
  const minYear = minDate?.getFullYear() || MIN_YEAR;

  // Scroll to selected year when year picker opens
  useEffect(() => {
    if (pickerView === 'years' && yearScrollRef.current) {
      const yearIndex = selectedYear - minYear;
      const row = Math.floor(yearIndex / 4);
      // Each row is ~44px tall; scroll to center the selected year
      const offset = Math.max(0, row * 44 - 100);
      setTimeout(() => {
        yearScrollRef.current?.scrollTo({ y: offset, animated: false });
      }, 50);
    }
  }, [pickerView, selectedYear, minYear]);

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
    if (minDate && date < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true;
    if (maxDate && date > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) return true;
    return false;
  };

  const isMonthDisabled = (month: number) => {
    if (minDate && selectedYear === minDate.getFullYear() && month < minDate.getMonth()) return true;
    if (maxDate && selectedYear === maxDate.getFullYear() && month > maxDate.getMonth()) return true;
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
    setPickerView('days');
  };

  const handleClear = () => {
    onChange(null);
    setSelectedDay(null);
    setIsOpen(false);
    setPickerView('days');
  };

  const handleClose = () => {
    setIsOpen(false);
    setPickerView('days');
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

  const handleSelectYear = (year: number) => {
    setSelectedYear(year);
    setSelectedDay(null);
    setPickerView('months');
  };

  const handleSelectMonth = (month: number) => {
    setSelectedMonth(month);
    setSelectedDay(null);
    setPickerView('days');
  };

  const handleHeaderPress = () => {
    if (pickerView === 'days') {
      setPickerView('years');
    } else {
      setPickerView('days');
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderYearGrid = () => {
    const years: number[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      years.push(y);
    }

    const rows: number[][] = [];
    for (let i = 0; i < years.length; i += 4) {
      rows.push(years.slice(i, i + 4));
    }

    return (
      <ScrollView
        ref={yearScrollRef}
        style={styles.yearScrollView}
        showsVerticalScrollIndicator={false}
      >
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.yearRow}>
            {row.map((year) => {
              const isSelected = year === selectedYear;
              const isCurrentYear = year === new Date().getFullYear();
              return (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.yearCell,
                    isSelected && { backgroundColor: colors.primary },
                    isCurrentYear && !isSelected && { borderWidth: 1, borderColor: colors.primary },
                  ]}
                  onPress={() => handleSelectYear(year)}
                >
                  <Text
                    style={[
                      styles.yearText,
                      { color: colors.text },
                      isSelected && { color: '#fff', fontWeight: '600' },
                      isCurrentYear && !isSelected && { color: colors.primary, fontWeight: '600' },
                    ]}
                  >
                    {year}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderMonthGrid = () => {
    const rows: number[][] = [];
    for (let i = 0; i < 12; i += 3) {
      rows.push([i, i + 1, i + 2]);
    }

    return (
      <View style={styles.monthGridContainer}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.monthRow}>
            {row.map((month) => {
              const isSelected = month === selectedMonth && pickerView === 'months';
              const disabled = isMonthDisabled(month);
              return (
                <TouchableOpacity
                  key={month}
                  style={[
                    styles.monthCell,
                    isSelected && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => handleSelectMonth(month)}
                  disabled={disabled}
                >
                  <Text
                    style={[
                      styles.monthCellText,
                      { color: colors.text },
                      isSelected && { color: '#fff', fontWeight: '600' },
                      disabled && { color: colors.textTertiary },
                    ]}
                  >
                    {monthsShort[month]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
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

  // Header text changes based on current view
  const headerText =
    pickerView === 'years'
      ? `${minYear} – ${maxYear}`
      : pickerView === 'months'
        ? `${selectedYear}`
        : `${months[selectedMonth]} ${selectedYear}`;

  // Show month arrows only in days view
  const showMonthNav = pickerView === 'days';

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
        onRequestClose={handleClose}
      >
        <TouchableOpacity
          style={[styles.overlay, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={handleClose}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.calendar, { backgroundColor: colors.surface }]}
          >
            {/* Header */}
            <View style={styles.calendarHeader}>
              {showMonthNav ? (
                <TouchableOpacity onPress={prevMonth} style={styles.navButton}>
                  <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
              ) : (
                <View style={styles.navButton} />
              )}

              <TouchableOpacity onPress={handleHeaderPress} style={styles.headerTextButton}>
                <Text style={[styles.monthYear, { color: colors.text }]}>
                  {headerText}
                </Text>
                <Ionicons
                  name={pickerView !== 'days' ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textSecondary}
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>

              {showMonthNav ? (
                <TouchableOpacity onPress={nextMonth} style={styles.navButton}>
                  <Ionicons name="chevron-forward" size={24} color={colors.text} />
                </TouchableOpacity>
              ) : (
                <View style={styles.navButton} />
              )}
            </View>

            {/* Body */}
            <View style={styles.calendarBody}>
              {pickerView === 'years' && renderYearGrid()}
              {pickerView === 'months' && renderMonthGrid()}
              {pickerView === 'days' && renderCalendarDays()}
            </View>

            {/* Footer */}
            <View style={styles.calendarFooter}>
              <Button
                title="Cancel"
                onPress={handleClose}
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
    width: 40,
  },
  headerTextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
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
  // Year picker
  yearScrollView: {
    maxHeight: 260,
  },
  yearRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  yearCell: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    marginHorizontal: 2,
    marginVertical: 2,
  },
  yearText: {
    fontSize: FontSizes.md,
  },
  // Month picker
  monthGridContainer: {
    paddingVertical: Spacing.sm,
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: Spacing.xs,
  },
  monthCell: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    marginHorizontal: 4,
  },
  monthCellText: {
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
});
