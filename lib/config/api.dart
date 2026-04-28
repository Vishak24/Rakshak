const String apiBase = 'https://aksdwfbnn5.execute-api.ap-south-1.amazonaws.com';

const String sosLive         = '$apiBase/sos/live';
const String sosDispatch     = '$apiBase/sos/dispatch';
const String sosResolve      = '$apiBase/sos/resolve';
const String policeSosActive = '$apiBase/police/sos/active';
const String policeSosAccept = '$apiBase/police/sos';   // PATCH /police/sos/{id}/status
const String patrolsList     = '$apiBase/patrols';
const String patrolStatus    = '$apiBase/patrols';
const String scoreRefresh    = '$apiBase/score/refresh';
const String patrolOptimizer = '$apiBase/patrol/optimize';

const String citizensActive = '$apiBase/police/citizens/active';
const String policeRoute    = '$apiBase/police/route';
const String sosActive      = '$apiBase/police/sos/active';
