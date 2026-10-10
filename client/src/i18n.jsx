import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { LANGS, t as tr, levelName } from '../../shared/i18n.js';

const Ctx = createContext(null);
export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => { try { return localStorage.getItem('dhara.lang') || 'en'; } catch { return 'en'; } });
  useEffect(() => { try { localStorage.setItem('dhara.lang', lang); } catch {} document.documentElement.lang = lang === 'lus' ? 'lus' : lang; }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t: (k, v) => tr(lang, k, v), level: (l) => levelName(lang, l), LANGS }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);
