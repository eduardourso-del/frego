import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';

class DeviceFix {
  const DeviceFix({required this.latitude, required this.longitude});

  final double latitude;
  final double longitude;
}

/// The phone's position, only after she allows it.
class DeviceLocation {
  static const _latKey = 'frego_device_lat';
  static const _lngKey = 'frego_device_lng';
  static const _offeredKey = 'frego_location_offered';

  static Future<bool> wasOffered() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getBool(_offeredKey) ?? false;
    } catch (_) {
      return true;
    }
  }

  static Future<void> markOffered() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_offeredKey, true);
    } catch (_) {}
  }

  /// Shows the system prompt. Null when she does not allow, or no fix comes back.
  static Future<DeviceFix?> request() async {
    try {
      final enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) return null;
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (!_allowed(permission)) return null;
      return await _capture(const Duration(seconds: 12));
    } catch (_) {
      return null;
    }
  }

  /// A fresh fix when she already allowed it. Does not show the prompt.
  /// A slow reading falls back to the last one we kept.
  static Future<DeviceFix?> currentIfAllowed() async {
    try {
      final permission = await Geolocator.checkPermission();
      if (!_allowed(permission)) {
        await _clear();
        return null;
      }
      try {
        return await _capture(const Duration(seconds: 4));
      } catch (_) {
        return _saved();
      }
    } catch (_) {
      return _saved();
    }
  }

  static bool _allowed(LocationPermission permission) {
    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  static Future<DeviceFix?> _capture(Duration timeLimit) async {
    final position = await Geolocator.getCurrentPosition(
      locationSettings: LocationSettings(
        accuracy: LocationAccuracy.medium,
        timeLimit: timeLimit,
      ),
    );
    final fix = DeviceFix(
      latitude: position.latitude,
      longitude: position.longitude,
    );
    await _save(fix);
    return fix;
  }

  static Future<void> _save(DeviceFix fix) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setDouble(_latKey, fix.latitude);
      await prefs.setDouble(_lngKey, fix.longitude);
    } catch (_) {}
  }

  static Future<DeviceFix?> _saved() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final latitude = prefs.getDouble(_latKey);
      final longitude = prefs.getDouble(_lngKey);
      if (latitude == null || longitude == null) return null;
      return DeviceFix(latitude: latitude, longitude: longitude);
    } catch (_) {
      return null;
    }
  }

  static Future<void> _clear() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_latKey);
      await prefs.remove(_lngKey);
    } catch (_) {}
  }
}
