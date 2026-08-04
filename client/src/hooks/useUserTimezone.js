import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { DEFAULT_TIMEZONE, isValidTimezone } from '../utils/dateOnly.js';

export function useUserTimezone() {
  const auth = useContext(AuthContext);
  const timezone = auth?.user?.timezone;
  return isValidTimezone(timezone) ? timezone.trim() : DEFAULT_TIMEZONE;
}
