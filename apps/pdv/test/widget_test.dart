import 'package:flutter_test/flutter_test.dart';
import 'package:frego_pdv/api/api_error.dart';
import 'package:frego_pdv/util/money.dart';
import 'package:frego_pdv/util/phone.dart';
import 'package:frego_pdv/util/voucher.dart';

void main() {
  group('phone', () {
    test('digitsOnly strips mask', () {
      expect(digitsOnly('(11) 98765-4321'), '11987654321');
    });

    test('formatPhoneBr masks mobile', () {
      expect(formatPhoneBr('11987654321'), '(11) 98765-4321');
    });

    test('phoneDigitsForApi clips to 11', () {
      expect(phoneDigitsForApi('11987654321999'), '11987654321');
    });
  });

  group('money', () {
    test('parses comma decimals to cents', () {
      expect(parseMoneyToCents('42,50'), 4250);
    });

    test('parses whole reais', () {
      expect(parseMoneyToCents('40'), 4000);
    });

    test('parses thousand separators', () {
      expect(parseMoneyToCents('1.234,56'), 123456);
    });

    test('masks digits as cents while typing', () {
      expect(maskMoneyInput('1'), '0,01');
      expect(maskMoneyInput('100'), '1,00');
      expect(maskMoneyInput('10000'), '100,00');
      expect(maskMoneyInput('122222'), '1.222,22');
    });

    test('rejects empty or zero', () {
      expect(parseMoneyToCents(''), isNull);
      expect(parseMoneyToCents('0'), isNull);
    });

    test('preview points uses floor reais', () {
      expect(previewPoints(amountCents: 4590, pointsPerReal: 1), 45);
      expect(previewPoints(amountCents: 10000, pointsPerReal: 10), 10);
      expect(previewPoints(amountCents: 999, pointsPerReal: 10), 0);
    });
  });

  group('voucher', () {
    test('formats display code', () {
      expect(formatVoucherInput('k7m2pq'), 'K7M-2PQ');
      expect(normalizeVoucherCode('K7M-2PQ'), 'K7M2PQ');
    });

    test('scan accepts whole Código only', () {
      expect(parseScannedVoucherCodigo('K7M-2PQ'), 'K7M2PQ');
      expect(parseScannedVoucherCodigo('k7m2pq'), 'K7M2PQ');
      expect(parseScannedVoucherCodigo('K7M2PQ extra'), isNull);
      expect(
        parseScannedVoucherCodigo(
          '00020126580014br.gov.bcb.pix0136pix@loja.com',
        ),
        isNull,
      );
      expect(parseScannedVoucherCodigo('https://frego.app/K7M2PQ'), isNull);
      expect(parseScannedVoucherCodigo(''), isNull);
    });
  });

  group('api errors', () {
    test('maps LOCATION_REQUIRED', () {
      expect(
        ApiException(code: 'LOCATION_REQUIRED').humanMessage,
        contains('vinculado a uma unidade'),
      );
    });
  });
}
