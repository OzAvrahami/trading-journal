export function refreshCookieOptions() {
  const production = process.env.NODE_ENV === 'production';
  return { httpOnly: true, secure: production, sameSite: production ? 'none' : 'strict', path: '/' };
}
export function clearRefreshCookie(res) {
  res.clearCookie('refreshToken', refreshCookieOptions());
}
