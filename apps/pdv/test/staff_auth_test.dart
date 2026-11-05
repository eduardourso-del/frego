import 'package:flutter_test/flutter_test.dart';
import 'package:frego_pdv/session/staff_auth.dart';

void main() {
  test('maps Identity Toolkit login failures', () {
    expect(
      identityToolkitErrorCode({
        'error': {'message': 'INVALID_LOGIN_CREDENTIALS'},
      }),
      'invalid-credential',
    );
    expect(
      identityToolkitErrorCode({
        'error': {'message': 'EMAIL_NOT_FOUND'},
      }),
      'invalid-credential',
    );
    expect(
      identityToolkitErrorCode({
        'error': {'message': 'INVALID_PASSWORD'},
      }),
      'invalid-credential',
    );
    expect(
      identityToolkitErrorCode({
        'error': {'message': 'TOO_MANY_ATTEMPTS_TRY_LATER'},
      }),
      'too-many-requests',
    );
    expect(
      identityToolkitErrorCode({
        'error': {'message': 'INVALID_LOGIN_CREDENTIALS : too many attempts'},
      }),
      'invalid-credential',
    );
    expect(identityToolkitErrorCode(null), 'unknown');
    expect(identityToolkitErrorCode({'error': 'nope'}), 'unknown');
  });
}
