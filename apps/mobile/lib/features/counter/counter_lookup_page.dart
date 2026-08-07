import 'dart:convert';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../config/app_config.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import 'customer_stamp_page.dart';

String get apiBaseUrl => AppConfig.apiBaseUrl;

class CounterLookupPage extends StatefulWidget {
  const CounterLookupPage({super.key});

  @override
  State<CounterLookupPage> createState() => _CounterLookupPageState();
}

class _CounterLookupPageState extends State<CounterLookupPage> {
  final _phone = TextEditingController(text: '11987654321');
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  Future<void> _lookup() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await http.post(
        Uri.parse('$apiBaseUrl/customers/lookup'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'phone': _phone.text}),
      );
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode == 404 || data['found'] == false) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Não encontrado — use o balcão web para criar por enquanto'),
          ),
        );
        return;
      }
      if (res.statusCode >= 400) {
        throw Exception(data['error'] ?? 'Falha na busca');
      }
      if (!mounted) return;
      await Navigator.of(context).push(
        CupertinoPageRoute<void>(
          builder: (_) => CustomerStampPage(lookup: data),
        ),
      );
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Balcão'),
        leading: IconButton(
          icon: const Icon(FregoIcons.back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Telefone do cliente',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.5,
                color: FregoColors.neutral700,
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                hintText: '11 98765-4321',
                errorText: _error,
                filled: true,
                fillColor: FregoColors.card,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _loading ? null : _lookup,
                child: Text(_loading ? 'Consultando Frego…' : 'Buscar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
