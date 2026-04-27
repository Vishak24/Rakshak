import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api.dart' as api;
import '../models/sos_alert.dart';
import '../models/patrol.dart';

class ApiService {
  static const _timeout = Duration(seconds: 8);

  // ── SOS ──────────────────────────────────────────────────────────────────
  static Future<List<SosAlert>> fetchLiveSos() async {
    try {
      final res = await http
          .get(Uri.parse(api.sosLive))
          .timeout(_timeout);
      if (res.statusCode == 200) {
        final List<dynamic> data = jsonDecode(res.body);
        return data.map((e) => SosAlert.fromJson(e as Map<String, dynamic>)).toList();
      }
    } catch (_) {}
    return SosAlert.mockAlerts();
  }

  static Future<void> dispatchSos(String sosId) async {
    try {
      await http
          .post(Uri.parse('${api.sosDispatch}/$sosId'))
          .timeout(_timeout);
    } catch (_) {}
  }

  static Future<void> resolveSos(String sosId) async {
    try {
      await http
          .patch(Uri.parse('${api.sosResolve}/$sosId'))
          .timeout(_timeout);
    } catch (_) {}
  }

  // ── Patrols ───────────────────────────────────────────────────────────────
  static Future<List<Patrol>> fetchPatrols() async {
    try {
      final res = await http
          .get(Uri.parse(api.patrolsList))
          .timeout(_timeout);
      if (res.statusCode == 200) {
        final List<dynamic> data = jsonDecode(res.body);
        return data.map((e) => Patrol.fromJson(e as Map<String, dynamic>)).toList();
      }
    } catch (_) {}
    return [];
  }

  // ── Score Refresh ─────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> refreshScores(List<Map<String, dynamic>> zones) async {
    try {
      final res = await http
          .post(
            Uri.parse(api.scoreRefresh),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'zones': zones}),
          )
          .timeout(_timeout);
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
    } catch (_) {}
    return {};
  }
}
