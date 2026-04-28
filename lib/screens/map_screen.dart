import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import '../models/sos_alert.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import 'optimised_route_screen.dart';

// ── String helper ─────────────────────────────────────────────────────────────
extension _StringX on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}

// ── Nominatim pincode boundary fetcher ───────────────────────────────────────
// Fetches polygon boundaries from OSM Nominatim — no file assets needed.

Future<List<Polygon>> fetchPincodePolygon(String pincode, String risk) async {
  try {
    final url = Uri.parse(
      'https://nominatim.openstreetmap.org/search'
      '?q=$pincode,Chennai,Tamil+Nadu,India'
      '&format=geojson&polygon_geojson=1&limit=1',
    );
    final res = await http
        .get(url, headers: {'User-Agent': 'Rakshak/1.0'})
        .timeout(const Duration(seconds: 8));
    if (res.statusCode != 200) return [];

    final geo      = jsonDecode(res.body) as Map<String, dynamic>;
    final features = geo['features'] as List<dynamic>;
    if (features.isEmpty) return [];

    final fillColor = risk == 'HIGH'
        ? const Color(0xFFef4444).withValues(alpha: 0.40)
        : risk == 'MEDIUM'
            ? const Color(0xFFf59e0b).withValues(alpha: 0.35)
            : const Color(0xFF22c55e).withValues(alpha: 0.25);

    final borderColor = risk == 'HIGH'
        ? const Color(0xFFef4444)
        : risk == 'MEDIUM'
            ? const Color(0xFFf59e0b)
            : const Color(0xFF22c55e);

    final polygons = <Polygon>[];
    final geom     = features[0]['geometry'] as Map<String, dynamic>;
    final type     = geom['type'] as String;
    final coords   = geom['coordinates'] as List<dynamic>;

    final rings = <List<dynamic>>[];
    if (type == 'Polygon') {
      rings.add(coords[0] as List<dynamic>);
    } else if (type == 'MultiPolygon') {
      for (final p in coords) {
        rings.add((p as List<dynamic>)[0] as List<dynamic>);
      }
    }

    for (final ring in rings) {
      final points = ring.map((c) {
        final coord = c as List<dynamic>;
        return LatLng(
          (coord[1] as num).toDouble(),
          (coord[0] as num).toDouble(),
        );
      }).toList();
      if (points.length >= 3) {
        polygons.add(Polygon(
          points:            points,
          color:             fillColor,
          borderColor:       borderColor,
          borderStrokeWidth: 1.5,
          isFilled:          true,
        ));
      }
    }
    return polygons;
  } catch (_) {
    return [];
  }
}

// ── MapScreen ─────────────────────────────────────────────────────────────────

class MapScreen extends StatefulWidget {
  final String officerBadge;
  final String officerName;

  const MapScreen({
    super.key,
    required this.officerBadge,
    required this.officerName,
  });

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> with TickerProviderStateMixin {
  static const _bg      = Color(0xFF0d1117);
  static const _surface = Color(0xFF161b22);
  static const _teal    = Color(0xFF00d4b4);
  static const _red     = Color(0xFFef4444);
  static const _textPri = Color(0xFFf0f6fc);
  static const _textMut = Color(0xFF8b949e);

  // Zone risk — seeded with defaults, updated every 60s from /score/refresh
  Map<String, String> _zoneRisk = {
    '600017': 'HIGH',
    '600081': 'HIGH',
    '600006': 'MEDIUM',
    '600004': 'MEDIUM',
    '600058': 'LOW',
  };

  // Cached polygon ring geometry per pincode (avoids re-fetching Nominatim)
  final Map<String, List<List<LatLng>>> _polygonRings = {};

  int _tab = 0;
  LatLng _officerPos = const LatLng(13.0827, 80.2707);
  List<SosAlert> _alerts    = [];
  List<Polygon>  _kmlPolygons = [];
  bool _zonesLoading = true;
  Timer? _pollTimer;
  Timer? _riskTimer;
  late AnimationController _pulseCtrl;
  late Animation<double>   _pulseAnim;
  final MapController _mapController = MapController();

  // ── Active incident — set when officer accepts a SOS ─────────────────────
  SosAlert? _activeIncident;
  bool _accepting = false;   // true while PATCH is in-flight

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _pulseAnim = Tween<double>(begin: 0.4, end: 1.0).animate(_pulseCtrl);

    _initLocation();
    _loadZones();
    _pollSos();
    _pollTimer = Timer.periodic(const Duration(seconds: 10), (_) => _pollSos());
    // Refresh zone risk scores every 60 seconds from /score/refresh
    _riskTimer = Timer.periodic(const Duration(seconds: 60), (_) => _refreshRisk());
  }

  Future<void> _initLocation() async {
    final pos = await LocationService.getCurrentLocation();
    if (mounted) setState(() => _officerPos = pos);
  }

  Future<void> _loadZones() async {
    final all = <Polygon>[];
    for (final entry in _zoneRisk.entries) {
      final polys = await fetchPincodePolygon(entry.key, entry.value);
      all.addAll(polys);
      // Cache ring geometry so we can recolor without re-fetching Nominatim
      _polygonRings[entry.key] = polys.map((p) => p.points).toList();
      // Nominatim rate limit: 1 req/sec
      await Future.delayed(const Duration(milliseconds: 300));
    }
    if (mounted) setState(() { _kmlPolygons = all; _zonesLoading = false; });
  }

  /// Poll /score/refresh every 60s and recolor zones if risk levels change.
  Future<void> _refreshRisk() async {
    final zones = _zoneRisk.keys.map((code) => {
      'pincode': code,
      'hour': DateTime.now().hour,
      'day_of_week': DateTime.now().weekday % 7,
    }).toList();

    final result = await ApiService.refreshScores(zones);
    if (result.isEmpty || !mounted) return;

    final raw = result['results'] ?? result['zones'] ?? result;
    if (raw is! List) return;

    bool changed = false;
    for (final r in raw) {
      final code  = r['pincode']?.toString() ?? '';
      final level = (r['risk_level'] ?? r['riskLevel'])?.toString().toUpperCase() ?? '';
      if (code.isNotEmpty && level.isNotEmpty && _zoneRisk[code] != level) {
        _zoneRisk[code] = level;
        changed = true;
      }
    }

    if (changed) _rebuildPolygons();
  }

  /// Rebuild Polygon objects from cached ring geometry with updated risk colors.
  void _rebuildPolygons() {
    final all = <Polygon>[];
    for (final entry in _polygonRings.entries) {
      final risk        = _zoneRisk[entry.key] ?? 'LOW';
      final fillColor   = risk == 'HIGH'
          ? const Color(0xFFef4444).withValues(alpha: 0.40)
          : risk == 'MEDIUM'
              ? const Color(0xFFf59e0b).withValues(alpha: 0.35)
              : const Color(0xFF22c55e).withValues(alpha: 0.25);
      final borderColor = risk == 'HIGH'
          ? const Color(0xFFef4444)
          : risk == 'MEDIUM'
              ? const Color(0xFFf59e0b)
              : const Color(0xFF22c55e);
      for (final points in entry.value) {
        if (points.length >= 3) {
          all.add(Polygon(
            points:            points,
            color:             fillColor,
            borderColor:       borderColor,
            borderStrokeWidth: 1.5,
            isFilled:          true,
          ));
        }
      }
    }
    if (mounted) setState(() => _kmlPolygons = all);
  }

  Future<void> _pollSos() async {
    final alerts = await ApiService.fetchActiveSos(
      officerLat: _officerPos.latitude,
      officerLng: _officerPos.longitude,
    );
    if (mounted) setState(() => _alerts = alerts);
  }

  /// Accept a SOS — PATCH backend, set as active incident, switch to map tab.
  Future<void> _acceptSos(SosAlert alert) async {
    if (_accepting) return;
    setState(() => _accepting = true);

    final sosId = alert.sosId ?? alert.id;
    if (sosId.isNotEmpty) {
      await ApiService.acceptSos(sosId);
    }

    if (mounted) {
      setState(() {
        _activeIncident = alert;
        _accepting = false;
        _tab = 0;   // switch to MAP tab to show route
      });
      // Pan map to SOS location
      if (alert.lat != null && alert.lng != null) {
        _mapController.move(LatLng(alert.lat!, alert.lng!), 14.0);
      }
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _riskTimer?.cancel();
    _pulseCtrl.dispose();
    super.dispose();
  }

  // ── Zoom button ───────────────────────────────────────────────────────────
  Widget _zoomBtn(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36, height: 36,
        decoration: BoxDecoration(
          color: const Color(0xFF1c2128),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: Colors.white12),
        ),
        child: Icon(icon, color: Colors.white70, size: 18),
      ),
    );
  }

  Widget _buildMap() {
    final incident = _activeIncident;
    return Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: const MapOptions(
            initialCenter: LatLng(13.0827, 80.2707),
            initialZoom: 11.0,
            minZoom: 9.0,
            maxZoom: 16.0,
            backgroundColor: Color(0xFF0d1117),
          ),
          children: [
            TileLayer(
              urlTemplate:
                  'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
              userAgentPackageName: 'com.rakshak.police',
            ),
            // Zone polygons
            if (_kmlPolygons.isNotEmpty)
              PolygonLayer(polygons: _kmlPolygons),
            // Active incident marker only — no simulated patrol dots
            if (incident != null && incident.lat != null && incident.lng != null)
              MarkerLayer(
                markers: [
                  Marker(
                    point: LatLng(incident.lat!, incident.lng!),
                    width: 48, height: 48,
                    child: AnimatedBuilder(
                      animation: _pulseAnim,
                      builder: (_, __) => Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _red.withValues(alpha: _pulseAnim.value * 0.35),
                          border: Border.all(color: _red, width: 2.5),
                        ),
                        child: const Icon(Icons.sos, color: _red, size: 22),
                      ),
                    ),
                  ),
                ],
              ),
            // Officer position
            MarkerLayer(
              markers: [
                Marker(
                  point: _officerPos,
                  width: 44, height: 44,
                  child: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFF3b82f6).withValues(alpha: 0.2),
                      border: Border.all(color: const Color(0xFF3b82f6), width: 2),
                    ),
                    child: const Icon(Icons.person_pin_circle,
                        color: Color(0xFF3b82f6), size: 22),
                  ),
                ),
              ],
            ),
          ],
        ),

        // Zoom buttons
        Positioned(
          bottom: 100, right: 12,
          child: Column(
            children: [
              _zoomBtn(Icons.add, () => _mapController.move(
                _mapController.camera.center,
                _mapController.camera.zoom + 1,
              )),
              const SizedBox(height: 4),
              _zoomBtn(Icons.remove, () => _mapController.move(
                _mapController.camera.center,
                _mapController.camera.zoom - 1,
              )),
            ],
          ),
        ),

        // Active incident banner
        if (incident != null)
          Positioned(
            top: 12, left: 12, right: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: _red.withValues(alpha: 0.92),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.sos, color: Colors.white, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'RESPONDING TO: ${incident.zoneName}',
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                          letterSpacing: 0.5),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => setState(() => _activeIncident = null),
                    child: const Icon(Icons.close, color: Colors.white70, size: 18),
                  ),
                ],
              ),
            ),
          ),

        // No active incident — empty state
        if (incident == null && _alerts.isEmpty && !_zonesLoading)
          Positioned(
            bottom: 80, left: 0, right: 0,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: _surface.withValues(alpha: 0.9),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  'No active incidents right now.',
                  style: TextStyle(color: _textMut, fontSize: 12),
                ),
              ),
            ),
          ),

        // Route button — only when incident is active
        if (incident != null)
          Positioned(
            bottom: 16, left: 16, right: 16,
            child: ElevatedButton.icon(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => OptimisedRouteScreen(
                    officerPos: _officerPos,
                    alerts: [incident],
                  ),
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: _teal,
                foregroundColor: const Color(0xFF00382e),
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                elevation: 0,
              ),
              icon: const Icon(Icons.navigation, size: 18),
              label: const Text('NAVIGATE TO SOS',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 1)),
            ),
          ),

        // Loading zones indicator
        if (_zonesLoading)
          Positioned(
            top: incident != null ? 70 : 12, left: 0, right: 0,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: _surface.withValues(alpha: 0.9),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: 10, height: 10,
                      child: CircularProgressIndicator(
                          strokeWidth: 1.5, color: Color(0xFF00d4b4)),
                    ),
                    SizedBox(width: 6),
                    Text('Loading zones…',
                        style: TextStyle(color: Color(0xFF8b949e), fontSize: 11)),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildAlertsTab() {
    if (_alerts.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.check_circle_outline, color: Color(0xFF22c55e), size: 48),
            SizedBox(height: 12),
            Text('No active incidents right now.',
                style: TextStyle(color: Color(0xFF8b949e), fontSize: 14)),
            SizedBox(height: 6),
            Text('Live SOS alerts will appear here.',
                style: TextStyle(color: Color(0xFF8b949e), fontSize: 12)),
          ],
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _alerts.length,
      itemBuilder: (_, i) {
        final a = _alerts[i];
        final isActive = _activeIncident?.id == a.id;
        final timeAgo  = _timeAgo(a.timestamp);
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            color: _surface,
            borderRadius: BorderRadius.circular(8),
            border: Border(
              left: BorderSide(
                color: isActive ? _teal : _red,
                width: 3,
              ),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Zone + risk badge
                Row(
                  children: [
                    Icon(Icons.sos, color: isActive ? _teal : _red, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(a.zoneName,
                          style: const TextStyle(
                              color: _textPri,
                              fontWeight: FontWeight.w700,
                              fontSize: 14)),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: _red.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(a.riskLevel,
                          style: const TextStyle(
                              color: _red, fontSize: 10, fontWeight: FontWeight.w800)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                // Pincode + time
                Row(
                  children: [
                    if (a.pincode != null) ...[
                      const Icon(Icons.location_on_outlined, color: _textMut, size: 13),
                      const SizedBox(width: 3),
                      Text(a.pincode!, style: const TextStyle(color: _textMut, fontSize: 11)),
                      const SizedBox(width: 12),
                    ],
                    const Icon(Icons.access_time, color: _textMut, size: 13),
                    const SizedBox(width: 3),
                    Text(timeAgo, style: const TextStyle(color: _textMut, fontSize: 11)),
                  ],
                ),
                const SizedBox(height: 12),
                // Accept / Active button
                SizedBox(
                  width: double.infinity,
                  height: 40,
                  child: isActive
                      ? OutlinedButton.icon(
                          onPressed: () => setState(() => _tab = 0),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: _teal,
                            side: const BorderSide(color: _teal),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(6)),
                          ),
                          icon: const Icon(Icons.navigation, size: 16),
                          label: const Text('VIEW ON MAP',
                              style: TextStyle(
                                  fontSize: 12, fontWeight: FontWeight.w700)),
                        )
                      : ElevatedButton.icon(
                          onPressed: _accepting ? null : () => _acceptSos(a),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _red,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(6)),
                            elevation: 0,
                          ),
                          icon: _accepting
                              ? const SizedBox(
                                  width: 14, height: 14,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: Colors.white))
                              : const Icon(Icons.check, size: 16),
                          label: Text(_accepting ? 'Accepting…' : 'ACCEPT & RESPOND',
                              style: const TextStyle(
                                  fontSize: 12, fontWeight: FontWeight.w700)),
                        ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  String _timeAgo(DateTime ts) {
    final diff = DateTime.now().difference(ts);
    if (diff.inSeconds < 60) return '${diff.inSeconds}s ago';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    return '${diff.inHours}h ago';
  }

  @override
  Widget build(BuildContext context) {
    final hasActive = _activeIncident != null;

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Column(
          children: [
            // ── Top bar ──────────────────────────────────────────────────
            Container(
              color: _surface,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: [
                  const Icon(Icons.shield, color: _teal, size: 22),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.officerName,
                            style: const TextStyle(
                                color: _textPri,
                                fontSize: 14,
                                fontWeight: FontWeight.w600)),
                        Text(widget.officerBadge,
                            style: const TextStyle(
                                color: _textMut,
                                fontSize: 11,
                                fontFamily: 'monospace')),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF22c55e).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                          color: const Color(0xFF22c55e).withValues(alpha: 0.4)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.circle, color: Color(0xFF22c55e), size: 8),
                        SizedBox(width: 4),
                        Text('ON DUTY',
                            style: TextStyle(
                                color: Color(0xFF22c55e),
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1)),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // ── Content ──────────────────────────────────────────────────
            Expanded(
              child: IndexedStack(
                index: _tab,
                children: [
                  _buildMap(),
                  _buildAlertsTab(),
                  _buildResponseTab(),
                ],
              ),
            ),

            // ── Bottom nav ───────────────────────────────────────────────
            Container(
              color: _surface,
              child: Row(
                children: [
                  _navItem(0, Icons.map_outlined, 'MAP'),
                  _navItem(1, Icons.warning_amber_outlined, 'ALERTS',
                      badge: _alerts.isNotEmpty ? _alerts.length.toString() : null),
                  _navItem(2, Icons.bolt_outlined, 'RESPONSE',
                      badge: hasActive ? '1' : null),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResponseTab() {
    final incident = _activeIncident;

    if (incident == null) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.shield_outlined, color: Color(0xFF8b949e), size: 48),
            SizedBox(height: 12),
            Text('No active incidents right now.',
                style: TextStyle(color: Color(0xFF8b949e), fontSize: 14)),
            SizedBox(height: 6),
            Text('Accept a SOS from the Alerts tab to begin.',
                style: TextStyle(color: Color(0xFF8b949e), fontSize: 12)),
          ],
        ),
      );
    }

    final riskColor = incident.riskLevel == 'HIGH'
        ? _red
        : incident.riskLevel == 'MEDIUM'
            ? const Color(0xFFf59e0b)
            : const Color(0xFF22c55e);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Active incident header
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _red.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: _red.withValues(alpha: 0.4)),
          ),
          child: Row(
            children: [
              const Icon(Icons.sos, color: _red, size: 24),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('ACTIVE INCIDENT',
                        style: TextStyle(
                            color: _red, fontSize: 10,
                            fontWeight: FontWeight.w800, letterSpacing: 1)),
                    Text(incident.zoneName,
                        style: const TextStyle(
                            color: _textPri, fontSize: 16,
                            fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: riskColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(incident.riskLevel,
                    style: TextStyle(
                        color: riskColor, fontSize: 11,
                        fontWeight: FontWeight.w800)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // Pincode
        if (incident.pincode != null)
          _responseCard(
            icon: Icons.location_on,
            iconColor: _teal,
            title: 'PINCODE',
            value: incident.pincode!,
            subtitle: 'SOS origin zone',
            subtitleColor: _textMut,
          ),
        if (incident.pincode != null) const SizedBox(height: 12),

        // Coordinates
        if (incident.lat != null && incident.lng != null)
          _responseCard(
            icon: Icons.gps_fixed,
            iconColor: _teal,
            title: 'COORDINATES',
            value: '${incident.lat!.toStringAsFixed(4)}, ${incident.lng!.toStringAsFixed(4)}',
            subtitle: 'Tap Navigate to open route',
            subtitleColor: _textMut,
          ),
        if (incident.lat != null) const SizedBox(height: 12),

        // Status
        _responseCard(
          icon: Icons.check_circle_outline,
          iconColor: const Color(0xFF22c55e),
          title: 'STATUS',
          value: 'Dispatched',
          subtitle: 'You accepted this incident',
          subtitleColor: _textMut,
        ),
        const SizedBox(height: 20),

        // Navigate button
        SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton.icon(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => OptimisedRouteScreen(
                  officerPos: _officerPos,
                  alerts: [incident],
                ),
              ),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: _teal,
              foregroundColor: const Color(0xFF00382e),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
              elevation: 0,
            ),
            icon: const Icon(Icons.navigation, size: 18),
            label: const Text('NAVIGATE TO SOS',
                style: TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 1)),
          ),
        ),
        const SizedBox(height: 12),

        // Clear incident
        SizedBox(
          width: double.infinity,
          height: 44,
          child: OutlinedButton(
            onPressed: () => setState(() => _activeIncident = null),
            style: OutlinedButton.styleFrom(
              foregroundColor: _textMut,
              side: const BorderSide(color: Colors.white12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
            ),
            child: const Text('MARK RESOLVED',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }

  Widget _responseCard({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String value,
    required String subtitle,
    required Color subtitleColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white12),
      ),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        color: _textMut, fontSize: 10,
                        fontWeight: FontWeight.w700, letterSpacing: 1)),
                const SizedBox(height: 2),
                Text(value,
                    style: const TextStyle(
                        color: _textPri, fontSize: 18,
                        fontWeight: FontWeight.w700)),
                Text(subtitle,
                    style: TextStyle(color: subtitleColor, fontSize: 11)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _navItem(int index, IconData icon, String label, {String? badge}) {
    final active = _tab == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _tab = index),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          color: Colors.transparent,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(icon, color: active ? _teal : _textMut, size: 22),
                  if (badge != null)
                    Positioned(
                      top: -4, right: -6,
                      child: Container(
                        padding: const EdgeInsets.all(3),
                        decoration: const BoxDecoration(
                            color: _red, shape: BoxShape.circle),
                        child: Text(badge,
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 8,
                                fontWeight: FontWeight.w700)),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 3),
              Text(label,
                  style: TextStyle(
                      color: active ? _teal : _textMut,
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5)),
            ],
          ),
        ),
      ),
    );
  }
}
