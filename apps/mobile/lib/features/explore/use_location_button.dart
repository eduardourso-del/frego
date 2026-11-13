import 'package:flutter/material.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import 'city_picker.dart';
import 'device_location.dart';

/// Asks for location, then resolves the nearest city. A refusal leaves the
/// city search as it is.
class UseMyLocationButton extends StatefulWidget {
  const UseMyLocationButton({
    super.key,
    required this.onResolved,
    this.enabled = true,
  });

  final Future<void> Function(CityChoice city) onResolved;
  final bool enabled;

  @override
  State<UseMyLocationButton> createState() => _UseMyLocationButtonState();
}

class _UseMyLocationButtonState extends State<UseMyLocationButton> {
  bool _busy = false;
  String? _hint;

  Future<void> _ask() async {
    setState(() {
      _busy = true;
      _hint = null;
    });
    final fix = await DeviceLocation.request();
    if (!mounted) return;
    if (fix == null) {
      setState(() {
        _busy = false;
        _hint = 'Sem a localização, escolha a cidade.';
      });
      return;
    }
    try {
      final body = await locateCity(
        latitude: fix.latitude,
        longitude: fix.longitude,
      );
      final city = CityChoice.fromMap(body);
      if (!mounted) return;
      if (city == null) {
        setState(() {
          _busy = false;
          _hint = 'Sem a localização, escolha a cidade.';
        });
        return;
      }
      await widget.onResolved(city);
      if (!mounted) return;
      setState(() => _busy = false);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _hint = 'Sem a localização, escolha a cidade.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FregoSecondaryButton(
          label: _busy ? 'Buscando localização' : 'Usar minha localização',
          onPressed: widget.enabled && !_busy ? _ask : null,
        ),
        if (_hint != null)
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: Text(
              'Sem a localização, escolha a cidade.',
              style: TextStyle(
                fontSize: 13,
                height: 1.3,
                color: FregoColors.neutral500,
              ),
            ),
          ),
      ],
    );
  }
}
