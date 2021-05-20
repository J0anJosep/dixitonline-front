import { useContext, useEffect, useCallback, useReducer, useState } from 'react';
import gql from 'graphql-tag';
import { firebaseApp } from '../firebase-app';
import { useLazyQuery, useMutation } from '@apollo/client';
import { AuthStateContext } from '../AuthContext';
import { PhaseFragment } from '../turn-phases/phase-fragment';

const GameFragment = gql`
  fragment Game on Game {
    id
    currentTurnId
    endCondition {
      __typename
      ... on GameRemainingTurnsEndCondition {
        remainingTurns
      }
      ... on GameScoreLimitEndCondition {
        scoreLimit
      }
    }
    status
    host {
      id
      username: name
    }
    players {
      id
      username: name
      score
    }
  }
`;

const GET_GAME = gql`
  query GetGame($gameId: ID!) {
    game(gameId: $gameId) {
      ...Game
    }
  }
  ${GameFragment}
`;

const START_GAME = gql`
  mutation GameStartGame($startGameInput: GameStartGameInput!) {
    gameStartGame(startGameInput: $startGameInput) {
      __typename
      ... on GameStartGameResultError {
        type
      }
      ... on GameStartGameResultSuccess {
        game {
          ...Game
        }
      }
    }
  }
  ${GameFragment}
`;

const GET_TURN_PHASE = gql`
  query GetTurnPhase($turnId: ID!) {
    getTurnPhase(turnId: $turnId) {
      ...Phase
    }
  }
  ${PhaseFragment}
`;

const defaultState = {
  game: {
    error: null,
    loading: false,
    data: null,
  },
  phase: {
    error: null,
    loading: false,
    data: null,
  },
  shouldPollGame: true,
  shouldPollPhase: false,
};

const gameReducer = (game = defaultState.game, action) => {
  switch (action.type) {
    case 'game/fetched':
      return {
        ...action.payload,
        loading: game.data ? false : action.payload.loading,
      };
    default:
      return game;
  }
};

const phaseReducer = (phase = defaultState.phase, action) => {
  switch (action.type) {
    case 'phase/fetched':
      return {
        ...action.payload,
        loading: phase.data ? false : action.payload.loading,
      };
    default:
      return phase;
  }
};

const shouldPollGameReducer = (shouldPollGame = defaultState.shouldPollGame, action) => {
  switch (action.type) {
    case 'game/fetched':
      return (
        ['WAITING_FOR_PLAYERS', 'ENDED'].includes(action.payload.data?.status) ||
        action.payload.data?.currentTurnId == null
      );
    default:
      return shouldPollGame;
  }
};

const shouldPollPhaseReducer = (shouldPollPhase = defaultState.shouldPollPhase, action) => {
  switch (action.type) {
    case 'game/fetched': {
      const game = action.payload.data;
      if (!game) return shouldPollPhase;

      if (game.status === 'STARTED') {
        console.log('shouldPollPhaseReducer', game.currentTurnId, game.currentTurnId !== null);
        return game.currentTurnId !== null;
      }
      return false;
    }
    default:
      return shouldPollPhase;
  }
};

const reducer = (state = defaultState, action) => ({
  game: gameReducer(state.game, action),
  phase: phaseReducer(state.phase, action),
  shouldPollGame: shouldPollGameReducer(state.shouldPollGame, action),
  shouldPollPhase: shouldPollPhaseReducer(state.shouldPollPhase, action),
});

const useGamePolling = ({ gameId, setGame }) => {
  const [fetchGame, { called, loading, refetch, startPolling, stopPolling, error, data }] = useLazyQuery(GET_GAME, {
    variables: { gameId },
    pollInterval: 2000,
  });

  const [shouldPoll, setShouldPoll] = useState(false);

  const refetchGame = useCallback(() => {
    refetch().then(({ loading, error, data }) => {
      setGame({
        loading,
        error,
        data: data?.game,
      });
    });
  }, [refetch, setGame]);

  useEffect(() => {
    let didCancel = false;
    if (shouldPoll) {
      if (!called) fetchGame();
      if (startPolling) startPolling(2000);
    }

    if (!didCancel) {
      setGame({
        loading,
        error,
        data: data?.game,
      });
    }

    return () => {
      didCancel = true;
      if (stopPolling) stopPolling();
    };
  }, [called, data, error, loading, fetchGame, setGame, shouldPoll, startPolling, stopPolling]);

  const startGamePolling = useCallback(() => {
    setShouldPoll(true);
  }, [setShouldPoll]);

  const stopGamePolling = useCallback(() => {
    setShouldPoll(false);
  }, [setShouldPoll]);

  return { refetchGame, startGamePolling, stopGamePolling: stopGamePolling };
};

const usePhasePolling = ({ turnId, setPhase }) => {
  const [fetchPhase, { called, loading, startPolling, stopPolling, error, data }] = useLazyQuery(GET_TURN_PHASE, {
    variables: { turnId },
    fetchPolicy: 'network-only',
    pollInterval: 2000,
  });
  const [shouldPoll, setShouldPoll] = useState(false);

  useEffect(() => {
    let didCancel = false;
    if (shouldPoll) {
      if (!called && turnId) fetchPhase();
      if (startPolling && turnId) startPolling(2000);
    }

    if (!didCancel) {
      setPhase({
        loading,
        error,
        data: data?.getTurnPhase,
      });
    }

    return () => {
      didCancel = true;
      if (stopPolling) stopPolling();
    };
  }, [called, turnId, data, error, loading, fetchPhase, setPhase, shouldPoll, startPolling, stopPolling]);

  const startPhasePolling = useCallback(() => {
    setShouldPoll(true);
  }, [setShouldPoll]);

  const stopPhasePolling = useCallback(() => {
    setShouldPoll(false);
  }, [setShouldPoll]);

  return { startPhasePolling, stopPhasePolling };
};

const useStartGame = ({ gameId, setGame, resetPhase }) => {
  const [doStartGame, { data, error, loading, called }] = useMutation(START_GAME, {
    variables: { startGameInput: { gameId } },
  });
  const { currentUser } = useContext(AuthStateContext);

  const startGameErrorMessage = error || data?.gameStartGame.type;

  const startGame = useCallback(() => {
    firebaseApp.analytics().logEvent('game_started', {
      userId: currentUser.id,
      gameId,
    });
    resetPhase();
    doStartGame();
  }, [doStartGame, gameId, resetPhase, currentUser]);

  useEffect(() => {
    if (called) {
      setGame({ loading, data: data?.gameStartGame.game, error: startGameErrorMessage });
    }
  }, [called, setGame, loading, data, startGameErrorMessage]);

  return {
    startGame,
    startGameLoading: loading,
  };
};

export const useGameState = ({ gameId }) => {
  const [state, dispatch] = useReducer(reducer, defaultState);
  const setGame = useCallback(
    (payload) =>
      dispatch({
        type: 'game/fetched',
        payload,
      }),
    [dispatch]
  );
  const setPhase = useCallback(
    (payload) =>
      dispatch({
        type: 'phase/fetched',
        payload,
      }),
    [dispatch]
  );
  const resetPhase = useCallback(
    () =>
      dispatch({
        type: 'phase/fetched',
        payload: {
          ...state.phase,
          data: undefined,
        },
      }),
    [dispatch, state.phase]
  );
  const turnId = state.game.data?.currentTurnId;

  const gamePolling = useGamePolling({ gameId, setGame });
  const phasePolling = usePhasePolling({ turnId, setPhase });
  const { startGame, startGameLoading } = useStartGame({ gameId, setGame, resetPhase });

  console.log({ state });

  useEffect(() => {
    if (state.shouldPollGame) {
      if (!state.game.loading) {
        gamePolling.startGamePolling();
      }

      return gamePolling.stopGamePolling;
    }
    gamePolling.stopGamePolling();
  }, [state.shouldPollGame, state.game.loading, state.game.data, gamePolling]);

  useEffect(() => {
    if (state.shouldPollPhase) {
      if (!state.phase.loading) {
        phasePolling.startPhasePolling();
      }
      return phasePolling.stopPhasePolling;
    }
    phasePolling.stopPhasePolling();
  }, [state, phasePolling]);

  return {
    game: state.game,
    phase: state.phase,
    refetchGame: gamePolling.refetchGame,
    startGame,
    startGameLoading,
  };
};
