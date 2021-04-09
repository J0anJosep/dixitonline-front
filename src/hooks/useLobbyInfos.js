import { useContext } from 'react';
import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import { I18nTranslateContext } from '../I18nContext';

export const GET_LOBBY_INFOS = gql`
  {
    lobbyInfos {
      waitingGames
      connectedPlayers
    }
  }
`;

export const useLobbyInfos = () => {
  const { data } = useQuery(GET_LOBBY_INFOS);
  const t = useContext(I18nTranslateContext);

  if (!data) {
    return {
      waitingGames: t('lobby-infos.no-waiting-games'),
      connectedPlayers: t('lobby-infos.no-connected-players'),
    };
  }

  const {
    lobbyInfos: { waitingGames, connectedPlayers },
  } = data;

  const waitingGamesString = `${
    waitingGames === 1
      ? t('lobby-infos.game')
      : waitingGames === 0
      ? t('lobby-infos.no-waiting-games')
      : t('lobby-infos.games')
  }`;
  const connectedPlayersString = `${
    connectedPlayers === 1
      ? t('lobby-infos.connected-player')
      : connectedPlayers === 0
      ? t('lobby-infos.no-connected-players')
      : t('lobby-infos.connected-players')
  }`;

  return {
    waitingGames:
      waitingGames === 0
        ? waitingGamesString
        : `${waitingGames} ${waitingGamesString} ${t('lobby-infos.waiting-players')}`,
    connectedPlayers: connectedPlayers === 0 ? connectedPlayersString : `${connectedPlayers} ${connectedPlayersString}`,
  };
};
