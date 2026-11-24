import 'package:flutter_test/flutter_test.dart';
import 'package:frego_mobile/notifications/check_in_links.dart';

void main() {
  test('reads the token from frego://c/TOKEN', () {
    final token = CheckInLinks.tokenFrom(
      Uri.parse('frego://c/abcdefghijklmnop'),
    );
    expect(token, 'abcdefghijklmnop');
  });

  test('reads the printed https QR', () {
    expect(
      CheckInLinks.tokenFromScan(
        'https://frego.app.br/c/abcdefghijklmnop',
      ),
      'abcdefghijklmnop',
    );
    expect(
      CheckInLinks.tokenFromScan(
        'http://192.168.7.5:3000/c/abcdefghijklmnop',
      ),
      'abcdefghijklmnop',
    );
    expect(
      CheckInLinks.tokenFromScan('frego://c/abcdefghijklmnop'),
      'abcdefghijklmnop',
    );
    expect(CheckInLinks.tokenFromScan('https://frego.app.br/loja/x'), isNull);
  });

  test('ignores another scheme and a short token', () {
    expect(
      CheckInLinks.tokenFrom(Uri.parse('https://frego.app.br/c/abcdefghijklmnop')),
      isNull,
    );
    expect(CheckInLinks.tokenFrom(Uri.parse('frego://c/short')), isNull);
    expect(CheckInLinks.tokenFrom(Uri.parse('frego://shop/abcdefghijklmnop')), isNull);
  });
}
