import { League, LeagueSchema } from '../../../backend/src/types';
import { config } from '../../../local-config';
import api from './api';

const THEME_STORAGE_KEY = 'tsl-theme-mode';

const getLeagueFromLocalStorage = (): League | undefined => {
    const leagueLocalStorage = localStorage.getItem(config.leagueLocalStorageKey);
    if (leagueLocalStorage) {
        try {
            const parsedLocalStorage = JSON.parse(leagueLocalStorage);
            if (parsedLocalStorage.leagueVal && parsedLocalStorage.ttl && parsedLocalStorage.ttl > new Date().getTime()) {
                return LeagueSchema.parse(parsedLocalStorage.leagueVal);
            }
        } catch (e) {
            console.error(`League local storage malformed: ${e}`);
        }
    }
    return undefined;
};

const getThemeModeFromLocalStorage = (): 'dark' | 'light' => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'dark' || storedTheme === 'light') {
        return storedTheme;
    }
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
};

const setLeagueInLocalStorage = async (): Promise<League> => {
    const leagues = await api.listLeagues();
    const activeLeagues = leagues.filter((league) => league.isActive === true);
    if (activeLeagues.length !== 1) {
        throw new Error(`${activeLeagues.length} active leagues found`);
    }
    localStorage.setItem(config.leagueLocalStorageKey, JSON.stringify({
        leagueVal: activeLeagues[0],
        ttl: new Date().setHours(new Date().getHours() + 1, 0, 1, 0),
    }));
    return activeLeagues[0];
};

const setThemeModeInLocalStorage = (mode: 'dark' | 'light'): void => {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
};

export default {
    getLeagueFromLocalStorage,
    getThemeModeFromLocalStorage,
    setLeagueInLocalStorage,
    setThemeModeInLocalStorage,
};

