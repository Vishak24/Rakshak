import 'package:flutter/material.dart';
import '../widgets/zone_row.dart';

class MonitorScreen extends StatelessWidget {
  const MonitorScreen({super.key});

  static const _bg      = Color(0xFF0d1117);
  static const _surface = Color(0xFF161b22);
  static const _red     = Color(0xFFef4444);
  static const _textMut = Color(0xFF8b949e);

  static const _zones = [
    {'name': 'Mylapore',     'users': 12, 'risk': 'CRITICAL'},
    {'name': 'T. Nagar',     'users': 11, 'risk': 'CRITICAL'},
    {'name': 'Adyar',        'users': 8,  'risk': 'ELEVATED'},
    {'name': 'Besant Nagar', 'users': 6,  'risk': 'ELEVATED'},
    {'name': 'Anna Nagar',   'users': 3,  'risk': 'NORMAL'},
    {'name': 'Velachery',    'users': 2,  'risk': 'NORMAL'},
  ];

  @override
  Widget build(BuildContext context) {
    final hour = DateTime.now().hour;

    if (hour < 22) {
      return Container(
        color: _bg,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.bedtime_outlined, color: Color(0xFF8b949e), size: 48),
              const SizedBox(height: 16),
              const Text(
                'Monitor Active After 10 PM',
                style: TextStyle(color: Color(0xFFf0f6fc), fontSize: 16, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              Text(
                'Unresolved journey tracking begins at 22:00',
                style: TextStyle(color: _textMut, fontSize: 13),
              ),
            ],
          ),
        ),
      );
    }

    final now = DateTime.now();
    final timeStr = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')} PM';
    final total = _zones.fold<int>(0, (sum, z) => sum + (z['users'] as int));

    return Container(
      color: _bg,
      child: Column(
        children: [
          // Header
          Container(
            color: _surface,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Unresolved Journeys',
                        style: TextStyle(color: Color(0xFFf0f6fc), fontSize: 16, fontWeight: FontWeight.w700),
                      ),
                      Text(timeStr, style: const TextStyle(color: Color(0xFF8b949e), fontSize: 12)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: _red.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: _red.withValues(alpha: 0.4)),
                  ),
                  child: Text(
                    '$total total',
                    style: const TextStyle(color: _red, fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),

          // Zone list
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _zones.length,
              itemBuilder: (_, i) {
                final z = _zones[i];
                return ZoneRow(
                  name:  z['name'] as String,
                  users: z['users'] as int,
                  risk:  z['risk'] as String,
                  onFlag: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('${z['name']} flagged for patrol'),
                        backgroundColor: _surface,
                      ),
                    );
                  },
                );
              },
            ),
          ),

          // Fleet status footer
          Container(
            color: _surface,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _fleetStat('Active Patrols', '8', const Color(0xFF22c55e)),
                _fleetStat('Response Units', '4', const Color(0xFFf59e0b)),
                _fleetStat('Standby', '12', _textMut),
              ],
            ),
          ),

          // Alert button
          Padding(
            padding: const EdgeInsets.all(16),
            child: SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Alert sent to all units'),
                      backgroundColor: Color(0xFF161b22),
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: _red,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  elevation: 0,
                ),
                icon: const Icon(Icons.campaign, size: 20),
                label: const Text(
                  'INITIATE AREA-WIDE ALERT',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 1),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _fleetStat(String label, String value, Color color) {
    return Column(
      children: [
        Text(value, style: TextStyle(color: color, fontSize: 20, fontWeight: FontWeight.w800)),
        Text(label, style: const TextStyle(color: Color(0xFF8b949e), fontSize: 10)),
      ],
    );
  }
}
