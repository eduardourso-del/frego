import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

/// Resultado do envio do SMS — mobile usa verificationId; web usa ConfirmationResult.
class PhoneAuthChallenge {
  PhoneAuthChallenge._({this.verificationId, this.confirmationResult});

  factory PhoneAuthChallenge.mobile(String verificationId) =>
      PhoneAuthChallenge._(verificationId: verificationId);

  factory PhoneAuthChallenge.web(ConfirmationResult result) =>
      PhoneAuthChallenge._(confirmationResult: result);

  final String? verificationId;
  final ConfirmationResult? confirmationResult;

  Future<UserCredential> confirm(String smsCode) async {
    final web = confirmationResult;
    if (web != null) {
      return web.confirm(smsCode);
    }
    final id = verificationId;
    if (id == null) {
      throw Exception('Sessão de verificação inválida');
    }
    final credential = PhoneAuthProvider.credential(
      verificationId: id,
      smsCode: smsCode,
    );
    return FirebaseAuth.instance.signInWithCredential(credential);
  }
}

/// Envia OTP. No web usa reCAPTCHA; no mobile usa verifyPhoneNumber.
Future<PhoneAuthChallenge> sendPhoneOtp({
  required String phoneE164,
  required void Function(PhoneAuthCredential credential) onAutoVerified,
  required void Function(FirebaseAuthException error) onFailed,
}) async {
  if (kIsWeb) {
    final result =
        await FirebaseAuth.instance.signInWithPhoneNumber(phoneE164);
    return PhoneAuthChallenge.web(result);
  }

  final completer = Completer<PhoneAuthChallenge>();
  await FirebaseAuth.instance.verifyPhoneNumber(
    phoneNumber: phoneE164,
    verificationCompleted: onAutoVerified,
    verificationFailed: (e) {
      onFailed(e);
      if (!completer.isCompleted) {
        completer.completeError(e);
      }
    },
    codeSent: (verificationId, _) {
      if (!completer.isCompleted) {
        completer.complete(PhoneAuthChallenge.mobile(verificationId));
      }
    },
    codeAutoRetrievalTimeout: (_) {},
  );
  return completer.future;
}
