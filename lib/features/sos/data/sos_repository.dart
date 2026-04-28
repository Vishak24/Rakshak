import 'dart:convert';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import '../../../config/api.dart' as api;
import '../../../core/constants/stub_data.dart';
import '../domain/sos_service.dart';

/// Live SOS repository — POSTs to /sos/live with real GPS, falls back to stub.
class SosRepository implements SosService {
  bool _sosActive = false;
  String? _activeSosId;

  @override
  Future<bool> triggerSos() async {
    double lat = 13.0827;
    double lng  = 80.2707;

    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm != LocationPermission.deniedForever &&
          perm != LocationPermission.denied) {
        final pos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
        ).timeout(const Duration(seconds: 8));
        lat = pos.latitude;
        lng = pos.longitude;
      }
    } catch (_) {}

    try {
      final res = await http
          .post(
            Uri.parse(api.sosLive),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'latitude':   lat,
              'longitude':  lng,
              'risk_level': 'HIGH',
              'status':     'active',
            }),
          )
          .timeout(const Duration(seconds: 8));

      if (res.statusCode == 200 || res.statusCode == 201) {
        _sosActive = true;
        try {
          final body = jsonDecode(res.body) as Map<String, dynamic>;
          _activeSosId = body['sos_id']?.toString();
        } catch (_) {}
        return true;
      }
    } catch (_) {}

    // Fallback: mark active locally so the UI proceeds
    _sosActive = true;
    return true;
  }

  @override
  Future<bool> cancelSos() async {
    if (_activeSosId != null) {
      try {
        await http
            .patch(Uri.parse('${api.sosResolve}/$_activeSosId'))
            .timeout(const Duration(seconds: 8));
      } catch (_) {}
    }
    _sosActive = false;
    _activeSosId = null;
    return true;
  }

  @override
  Future<Map<String, dynamic>> getSosStatus() async {
    return _sosActive ? StubData.sosActive : StubData.sosSecured;
  }

  @override
  Future<bool> isSosActive() async => _sosActive;
}
