import React from 'react';
import { Link } from 'react-router-dom';
import { Image } from 'semantic-ui-react';

export const Logo = () => (
  <Link to="/">
    <Image src="/dixit.png" centered style={{ padding: '20px' }} />
  </Link>
);
