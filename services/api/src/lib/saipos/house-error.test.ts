import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { saiposErrorForHouse } from './house-error.js';

describe('saiposErrorForHouse', () => {
  it('hides a database pool timeout', () => {
    assert.equal(
      saiposErrorForHouse(
        'Timed out acquiring connection from connection pool.',
        'connected',
      ),
      'A última atualização das vendas não terminou. A Saipos continua conectada. A próxima é às 5h, 13h ou 21h.',
    );
  });

  it('keeps a house sentence we already wrote', () => {
    assert.equal(
      saiposErrorForHouse('Não foi possível falar com a Saipos.', 'connected'),
      'Não foi possível falar com a Saipos.',
    );
  });

  it('says the token was refused when the connection is in error', () => {
    assert.equal(
      saiposErrorForHouse('Unauthorized', 'error'),
      'A Saipos recusou o token. Peça outro à Saipos e troque aqui.',
    );
  });
});
