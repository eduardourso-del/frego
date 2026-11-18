import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOAS_VINDAS_BODY,
  boasVindasPushCopy,
  buildBoasVindasPushMessage,
} from './push/boas-vindas-notify.js';
import {
  ENTRADA_BODY,
  buildEntradaPushMessage,
  cidadeSeesBusiness,
  entradaPushCopy,
  shouldQueueEntrada,
} from './push/entrada-notify.js';

describe('shouldQueueEntrada', () => {
  it('sends when approval makes a Visível place listed', () => {
    assert.equal(
      shouldQueueEntrada({
        previousStatus: 'pending',
        previousVisible: true,
        nextStatus: 'trial',
        nextVisible: true,
        alreadySent: false,
      }),
      true,
    );
  });

  it('sends when a trial place becomes Visível', () => {
    assert.equal(
      shouldQueueEntrada({
        previousStatus: 'trial',
        previousVisible: false,
        nextStatus: 'trial',
        nextVisible: true,
        alreadySent: false,
      }),
      true,
    );
  });

  it('waits while Visível and still pending', () => {
    assert.equal(
      shouldQueueEntrada({
        previousStatus: 'pending',
        previousVisible: false,
        nextStatus: 'pending',
        nextVisible: true,
        alreadySent: false,
      }),
      false,
    );
  });

  it('stays quiet when the place was already listed', () => {
    assert.equal(
      shouldQueueEntrada({
        previousStatus: 'active',
        previousVisible: true,
        nextStatus: 'active',
        nextVisible: true,
        alreadySent: false,
      }),
      false,
    );
  });

  it('stays quiet when Visível is turned off and on after the first Entrada', () => {
    assert.equal(
      shouldQueueEntrada({
        previousStatus: 'active',
        previousVisible: false,
        nextStatus: 'active',
        nextVisible: true,
        alreadySent: true,
      }),
      false,
    );
  });
});

describe('cidadeSeesBusiness', () => {
  it('includes her own city and a city inside the 15 km ring', () => {
    const locations = [{ id: 'am', city: 'Americana', state: 'SP' }];
    assert.equal(
      cidadeSeesBusiness({ city: 'Americana', state: 'SP' }, locations),
      true,
    );
    assert.equal(
      cidadeSeesBusiness({ city: 'Nova Odessa', state: 'SP' }, locations),
      true,
    );
  });

  it('leaves a distant Cidade out', () => {
    assert.equal(
      cidadeSeesBusiness(
        { city: 'Manaus', state: 'AM' },
        [{ id: 'am', city: 'Americana', state: 'SP' }],
      ),
      false,
    );
  });
});

describe('boas-vindas and entrada copy', () => {
  it('uses the estabelecimento name and the agreed sentences', () => {
    assert.deepEqual(boasVindasPushCopy('Padaria Sol'), {
      title: 'Padaria Sol',
      body: BOAS_VINDAS_BODY,
    });
    assert.equal(BOAS_VINDAS_BODY, 'Agora você faz parte desse estabelecimento.');
    assert.deepEqual(entradaPushCopy('Padaria Sol'), {
      title: 'Padaria Sol',
      body: ENTRADA_BODY,
    });
    assert.equal(ENTRADA_BODY, 'Acabou de chegar na sua cidade.');
  });

  it('falls back to Frego when the name is blank', () => {
    assert.equal(boasVindasPushCopy('  ').title, 'Frego');
    assert.equal(entradaPushCopy('  ').title, 'Frego');
  });
});

describe('build notice push messages', () => {
  it('opens Boas-vindas on the Clube', () => {
    const message = buildBoasVindasPushMessage({
      tokens: ['abc'],
      businessName: 'Padaria Sol',
      businessId: 'biz_1',
    });
    assert.deepEqual(message.data, {
      type: 'boas_vindas',
      businessId: 'biz_1',
      title: 'Padaria Sol',
      body: BOAS_VINDAS_BODY,
    });
  });

  it('opens Entrada through her Cidade', () => {
    const message = buildEntradaPushMessage({
      tokens: ['abc'],
      businessName: 'Padaria Sol',
      businessId: 'biz_1',
      city: 'Americana',
      state: 'SP',
    });
    assert.deepEqual(message.data, {
      type: 'entrada',
      businessId: 'biz_1',
      city: 'Americana',
      state: 'SP',
      title: 'Padaria Sol',
      body: ENTRADA_BODY,
    });
  });
});
