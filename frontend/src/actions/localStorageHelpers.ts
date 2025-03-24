import api from './api';
import { League, LeagueSchema } from '../../../backend/src/types';
import { config } from '../../../local-config';

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

export default {
    getLeagueFromLocalStorage,
    setLeagueInLocalStorage,
};
