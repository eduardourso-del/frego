import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import 'counter_lookup_page.dart';

class CustomerStampPage extends StatefulWidget {
  const CustomerStampPage({super.key, required this.lookup});

  final Map<String, dynamic> lookup;

  @override
  State<CustomerStampPage> createState() => _CustomerStampPageState();
}

class _CustomerStampPageState extends State<CustomerStampPage> {
  late Map<String, dynamic> _data;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _data = widget.lookup;
  }

  Map<String, dynamic> get _pools {
    final direct = _data['pools'] as Map<String, dynamic>?;
    if (direct != null) return direct;
    final wallet = _data['wallet'];
    if (wallet is Map<String, dynamic>) {
      return (wallet['pools'] as Map<String, dynamic>?) ??
          {'stamps': 0, 'points': 0};
    }
    return {'stamps': 0, 'points': 0};
  }

  Future<void> _addStamp() async {
    final membership = _data['membership'] as Map<String, dynamic>?;
    if (membership == null) return;
    setState(() => _loading = true);
    try {
      final res = await http.post(
        Uri.parse('$apiBaseUrl/transactions'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'membershipId': membership['id'],
          'type': 'stamp',
          'unitKind': 'stamps',
          'quantity': 1,
        }),
      );
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode >= 400) {
        throw Exception(body['error'] ?? 'Falha ao carimbar');
      }
      setState(() {
        _data = {
          ..._data,
          'wallet': body['wallet'],
          'pools': (body['wallet'] as Map<String, dynamic>?)?['pools'] ??
              body['pools'],
        };
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            body['message'] as String? ?? 'Carimbo adicionado',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final customer = _data['customer'] as Map<String, dynamic>? ?? {};
    final pools = _pools;
    final stamps = (pools['stamps'] as num?)?.toInt() ?? 0;
    final points = (pools['points'] as num?)?.toInt() ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: Text(customer['displayName'] as String? ?? 'Cliente'),
        leading: IconButton(
          icon: const Icon(FregoIcons.back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                Text(
                  customer['phoneE164'] as String? ?? '',
                  style: const TextStyle(
                    fontSize: 15,
                    color: FregoColors.neutral500,
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: _PoolCard(label: 'Carimbos', value: stamps),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _PoolCard(label: 'Pontos', value: points),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Text(
                  'O cliente escolhe a campanha e resgata no app.',
                  style: TextStyle(
                    fontSize: 14,
                    color: FregoColors.neutral500,
                  ),
                ),
              ],
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _loading ? null : _addStamp,
                  child: Text(_loading ? 'Carimbando…' : 'Dar carimbo'),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PoolCard extends StatelessWidget {
  const _PoolCard({required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: FregoColors.neutral200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: FregoColors.neutral500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '$value',
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
