import React, { useContext, useEffect, useCallback } from 'react';
import { Flex } from '@chakra-ui/core';
import { useHistory, useLocation } from 'react-router-dom';
import { firebaseApp } from '../firebase-app';
import { ChoseUsername } from '../ChoseUsername';
import { Logo } from '../Logo';
import { AuthSetStateContext } from '../AuthContext';

export const Login = () => {
  const history = useHistory();
  const location = useLocation();
  const setAuthState = useContext(AuthSetStateContext);
  console.log('FIREBASE APP', firebaseApp);

  useEffect(() => {
    firebaseApp.auth().onAuthStateChanged((user) => {
      if (user) {
        const { from } = location.state || { from: { pathname: '/' } };
        history.replace(from);
      }
    });
  }, [history, location]);

  const signIn = useCallback(
    ({ username }) =>
      firebaseApp
        .auth()
        .signInAnonymously()
        .then(() => {
          setAuthState((state) => ({
            ...state,
            currentUser: {
              ...state.currentUser,
              username,
            },
          }));
          const { from } = location.state || { from: { pathname: '/' } };
          history.replace(from);
        }),
    [setAuthState, location, history]
  );

  return (
    <Flex flexDirection="column" alignItems="center" justifyItems="center">
      <Logo />
      <ChoseUsername onUsernameSubmitted={signIn} />
    </Flex>
  );
};