import 'package:flutter/scheduler.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';

void removeFregoNativeSplash() {
  SchedulerBinding.instance.addPostFrameCallback((_) {
    FlutterNativeSplash.remove();
  });
}
