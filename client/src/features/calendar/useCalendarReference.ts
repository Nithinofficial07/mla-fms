import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchReferenceData } from './calendarApi';

/**
 * The office's calendar lookup/label data (holidays, world days, away
 * presets, ~440 English->Kannada labels) - fetched once from the server
 * (single source of truth, see server/src/assets/calendar-reference-data.json)
 * and cached for the session. `tCal(text)` looks a label up in Kannada when
 * the app is switched to Kannada, otherwise returns it unchanged.
 */
export function useCalendarReference() {
  const { i18n } = useTranslation();
  const query = useQuery({
    queryKey: ['calendar', 'reference'],
    queryFn: fetchReferenceData,
    staleTime: 60 * 60 * 1000,
  });
  const isKannada = i18n.language === 'kn';
  const labels = query.data?.kannadaLabels ?? {};

  const tCal = (text: string | undefined | null): string => {
    if (!text) return '';
    if (!isKannada) return text;
    return labels[text] ?? text;
  };

  return { ...query, tCal, isKannada };
}
