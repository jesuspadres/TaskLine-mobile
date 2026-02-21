import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { ENV } from '@/lib/env';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export interface AddressComponents {
  formatted_address: string;
  street: string;
  unit: string;
  city: string;
  state: string;
  state_short: string;
  zip: string;
  country: string;
  country_short: string;
  lat: number;
  lng: number;
  place_id: string;
}

/**
 * Geocode an address string to lat/lng using Google Geocoding API.
 * Returns null if geocoding fails or no results found.
 */
export async function geocodeAddress(
  address: string,
  apiKey: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!address.trim() || !apiKey) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.status === 'OK' && data.results?.length > 0) {
      const loc = data.results[0].geometry.location;
      if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        return { lat: loc.lat, lng: loc.lng };
      }
    } else {
      console.warn('[geocodeAddress] Failed:', data.status, data.error_message || '');
    }
  } catch (err) {
    console.warn('[geocodeAddress] Error:', err);
  }
  return null;
}

interface Props {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onAddressSelect: (address: AddressComponents) => void;
  error?: string;
}

export function AddressAutocomplete({
  label,
  placeholder,
  value,
  onChangeText,
  onAddressSelect,
  error,
}: Props) {
  const { colors } = useTheme();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSearch = useRef(false);
  const [isFocused, setIsFocused] = useState(false);

  const apiKey = ENV.GOOGLE_MAPS_API_KEY;

  const fetchPredictions = useCallback(async (input: string) => {
    if (!apiKey || input.length < 3) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}&types=address&components=country:us`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.predictions?.length > 0) {
        setPredictions(data.predictions.slice(0, 5));
        setShowDropdown(true);
      } else {
        console.warn('[AddressAutocomplete] Autocomplete response:', data.status, data.error_message || '');
        setPredictions([]);
        setShowDropdown(false);
      }
    } catch (err) {
      console.warn('[AddressAutocomplete] Autocomplete error:', err);
      setPredictions([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  const handleTextChange = (text: string) => {
    onChangeText(text);

    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }

    // Don't autocomplete on web (CORS) or when API key is missing
    if (Platform.OS === 'web' || !apiKey) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.length >= 3) {
      debounceRef.current = setTimeout(() => fetchPredictions(text), 300);
    } else {
      setPredictions([]);
      setShowDropdown(false);
    }
  };

  const parseAddressComponents = (components: any[]) => {
    let street_number = '';
    let route = '';
    let unit = '';
    let city = '';
    let state = '';
    let state_short = '';
    let zip = '';
    let country = '';
    let country_short = '';

    for (const comp of components) {
      const types: string[] = comp.types || [];
      if (types.includes('street_number')) {
        street_number = comp.long_name;
      } else if (types.includes('route')) {
        route = comp.long_name;
      } else if (types.includes('subpremise')) {
        unit = comp.long_name;
      } else if (types.includes('locality')) {
        city = comp.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        state = comp.long_name;
        state_short = comp.short_name;
      } else if (types.includes('postal_code')) {
        zip = comp.long_name;
      } else if (types.includes('country')) {
        country = comp.long_name;
        country_short = comp.short_name;
      }
    }

    const street = [street_number, route].filter(Boolean).join(' ');
    return { street, unit, city, state, state_short, zip, country, country_short };
  };

  const fetchPlaceDetails = async (placeId: string): Promise<AddressComponents | null> => {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}&fields=address_components,formatted_address,geometry,place_id`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.result) {
        const place = data.result;
        const components = parseAddressComponents(place.address_components || []);
        const lat = place.geometry?.location?.lat;
        const lng = place.geometry?.location?.lng;

        if (lat == null || lng == null) {
          console.warn('[AddressAutocomplete] Place Details missing geometry:', placeId);
        }

        return {
          formatted_address: place.formatted_address || '',
          street: components.street,
          unit: components.unit,
          city: components.city,
          state: components.state,
          state_short: components.state_short,
          zip: components.zip,
          country: components.country,
          country_short: components.country_short,
          lat: typeof lat === 'number' ? lat : 0,
          lng: typeof lng === 'number' ? lng : 0,
          place_id: place.place_id || placeId,
        };
      } else {
        console.warn('[AddressAutocomplete] Place Details failed:', data.status, data.error_message);
      }
    } catch (err) {
      console.warn('[AddressAutocomplete] Place Details error:', err);
    }
    return null;
  };

  const handleSelectPrediction = async (prediction: Prediction) => {
    Keyboard.dismiss();
    setShowDropdown(false);
    setPredictions([]);
    setLoading(true);

    // Set the street text immediately
    skipNextSearch.current = true;
    onChangeText(prediction.structured_formatting.main_text);

    const details = await fetchPlaceDetails(prediction.place_id);
    setLoading(false);

    if (details) {
      skipNextSearch.current = true;
      onChangeText(details.street);
      onAddressSelect(details);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: colors.text }]}>{label}</Text>}

      <View
        style={[
          styles.inputWrapper,
          { backgroundColor: colors.surface, borderColor: colors.border },
          isFocused && { borderColor: colors.primary, borderWidth: 2 },
          !!error && { borderColor: colors.error },
        ]}
      >
        <Ionicons
          name="location-outline"
          size={20}
          color={error ? colors.error : colors.textTertiary}
          style={styles.leftIcon}
        />
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={handleTextChange}
          autoCapitalize="words"
          onFocus={() => {
            setIsFocused(true);
            if (predictions.length > 0) setShowDropdown(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            // Delay hiding so taps on predictions register
            setTimeout(() => setShowDropdown(false), 250);
          }}
        />
        {loading && <ActivityIndicator size="small" color={colors.primary} style={styles.rightIcon} />}
        {!loading && value.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              onChangeText('');
              setPredictions([]);
              setShowDropdown(false);
            }}
            style={styles.rightIcon}
          >
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}

      {/* Predictions list (inline, pushes content down) */}
      {showDropdown && predictions.length > 0 && (
        <View style={[styles.predictionsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {predictions.map((prediction, idx) => (
            <TouchableOpacity
              key={prediction.place_id}
              style={[
                styles.predictionRow,
                idx < predictions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
              ]}
              onPress={() => handleSelectPrediction(prediction)}
            >
              <Ionicons name="location" size={16} color={colors.primary} style={styles.predictionIcon} />
              <View style={styles.predictionText}>
                <Text style={[styles.predictionMain, { color: colors.text }]} numberOfLines={1}>
                  {prediction.structured_formatting.main_text}
                </Text>
                <Text style={[styles.predictionSecondary, { color: colors.textSecondary }]} numberOfLines={1}>
                  {prediction.structured_formatting.secondary_text}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  leftIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
  },
  rightIcon: {
    padding: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  errorText: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
  predictionsContainer: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.xs,
    overflow: 'hidden',
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  predictionIcon: {
    marginRight: Spacing.sm,
  },
  predictionText: {
    flex: 1,
  },
  predictionMain: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  predictionSecondary: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
});
