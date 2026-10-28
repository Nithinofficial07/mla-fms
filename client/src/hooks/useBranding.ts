import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

export interface Branding {
  appName: string;
  constituencyName: string;
  leaderName: string;
  leaderTitle: string;
}

/**
 * Leader name/title + constituency for the photo caption. Uses the public
 * endpoint so the login page can show it before anyone signs in; the
 * Settings page invalidates ['branding'] when these are edited.
 */
export const useBranding = () =>
  useQuery({
    queryKey: ['branding'],
    queryFn: () => api.get('/public/branding').then((r) => r.data as Branding),
    staleTime: 5 * 60_000,
  });
