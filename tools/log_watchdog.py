#!/usr/bin/env python3
"""
WABA Docker Log Watchdog
========================
Real-time monitoring of all Docker containers with anomaly detection.
Serves a live web dashboard at http://localhost:9090

Usage:
    python3 tools/log_watchdog.py
    python3 tools/log_watchdog.py --port 8888
    python3 tools/log_watchdog.py --services state-manager,genesys-api
    python3 tools/log_watchdog.py --quiet
    python3 tools/log_watchdog.py --dashboard-interval 30
"""

import argparse
import base64
import hashlib
import http.server
import json
import os
import re
import signal
import socket
import struct
import subprocess
import sys
import threading
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

# ── ANSI Colors ──────────────────────────────────────────────────────────────

RESET  = "\033[0m"
BOLD   = "\033[1m"
DIM    = "\033[2m"
RED    = "\033[91m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
MAGENTA= "\033[95m"
CYAN   = "\033[96m"
WHITE  = "\033[97m"
BG_RED = "\033[41m"

SEVERITY_COLORS = {
    "CRITICAL": f"{BG_RED}{WHITE}{BOLD}",
    "HIGH":     f"{RED}{BOLD}",
    "MEDIUM":   f"{YELLOW}",
    "LOW":      f"{DIM}",
}

SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}

SERVICE_COLORS = [CYAN, GREEN, MAGENTA, BLUE, YELLOW, WHITE]

def _svc_color(name: str) -> str:
    idx = sum(ord(c) for c in name) % len(SERVICE_COLORS)
    return SERVICE_COLORS[idx]

# ── Anomaly Rules ────────────────────────────────────────────────────────────

ANOMALY_RULES = [
    ("DLQ Routing",         "CRITICAL", re.compile(r"routing to DLQ|routeToDLQ|routed to DLQ|DLQ", re.I)),
    ("Unhandled Exception", "CRITICAL", re.compile(r"unhandledRejection|uncaughtException|FATAL", re.I)),
    ("Service Crash",       "CRITICAL", re.compile(r"exited with code|OOMKilled|killed|segfault", re.I)),
    ("Error Log",           "HIGH",     re.compile(r'"level"\s*:\s*"(ERROR|error)"|\blevel:\s*error\b|ERROR\b', re.I)),
    ("Connection Failure",  "HIGH",     re.compile(r"ECONNREFUSED|ETIMEDOUT|ECONNRESET|connection refused|connect EHOSTUNREACH", re.I)),
    ("Auth Failure",        "HIGH",     re.compile(r"OAUTH_EXCHANGE_FAILED|401 Unauthorized|403 Forbidden|invalid.?token", re.I)),
    ("Health Check Fail",   "HIGH",     re.compile(r"unhealthy|health.?check.?fail", re.I)),
    ("RabbitMQ Issue",      "MEDIUM",   re.compile(r"channel closed|channel.?error|connection lost|heartbeat missed|AMQP", re.I)),
    ("DB Issue",            "MEDIUM",   re.compile(r"deadlock|connection terminated|too many clients|ECONNREFUSED.*5432", re.I)),
    ("Max Retries",         "MEDIUM",   re.compile(r"Max retries exceeded|retry.?count|retryCount", re.I)),
]

# ── Stats ────────────────────────────────────────────────────────────────────

class Stats:
    def __init__(self):
        self.lock = threading.Lock()
        self.total_lines = 0
        self.anomalies_by_severity = defaultdict(int)
        self.anomalies_by_service = defaultdict(int)
        self.anomalies_by_rule = defaultdict(int)
        self.service_status = {}
        self.start_time = time.time()

    def record_line(self):
        with self.lock:
            self.total_lines += 1

    def record_anomaly(self, service, severity, rule_name):
        with self.lock:
            self.anomalies_by_severity[severity] += 1
            self.anomalies_by_service[service] += 1
            self.anomalies_by_rule[rule_name] += 1

    def set_status(self, service, status):
        with self.lock:
            self.service_status[service] = status

    def snapshot(self):
        with self.lock:
            return {
                "total_lines": self.total_lines,
                "uptime_seconds": int(time.time() - self.start_time),
                "by_severity": dict(self.anomalies_by_severity),
                "by_service": dict(self.anomalies_by_service),
                "by_rule": dict(self.anomalies_by_rule),
                "service_status": dict(self.service_status),
            }

stats = Stats()

# ── WebSocket Server (raw socket) ────────────────────────────────────────────

ws_clients = []
ws_lock = threading.Lock()
recent_alerts = []
recent_alerts_lock = threading.Lock()
MAX_RECENT = 200

def _ws_frame(data: str) -> bytes:
    """Build a WebSocket text frame (server→client, unmasked)."""
    payload = data.encode("utf-8")
    length = len(payload)
    if length <= 125:
        header = struct.pack("!BB", 0x81, length)
    elif length <= 65535:
        header = struct.pack("!BBH", 0x81, 126, length)
    else:
        header = struct.pack("!BBQ", 0x81, 127, length)
    return header + payload

def broadcast_ws(msg_dict):
    """Send JSON to all connected WebSocket clients."""
    data = json.dumps(msg_dict, default=str)
    frame = _ws_frame(data)
    dead = []
    with ws_lock:
        for client in ws_clients:
            try:
                client.sendall(frame)
            except Exception:
                dead.append(client)
        for d in dead:
            ws_clients.remove(d)
            try: d.close()
            except: pass

def _do_ws_handshake(conn: socket.socket) -> bool:
    """Read HTTP upgrade request from raw socket and send WS handshake response."""
    try:
        data = conn.recv(4096).decode("utf-8", errors="replace")
    except Exception:
        return False

    key_match = re.search(r"Sec-WebSocket-Key:\s*(.+)\r\n", data)
    if not key_match:
        return False

    accept_key = key_match.group(1).strip()
    magic = "258EAFA5-E914-47DA-95CA-5AB5A7F6391E"
    accept_val = base64.b64encode(
        hashlib.sha1((accept_key + magic).encode()).digest()
    ).decode()

    response = (
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Accept: {accept_val}\r\n\r\n"
    )
    try:
        conn.sendall(response.encode())
    except Exception:
        return False
    return True

def _handle_ws_client(conn: socket.socket, stop_event: threading.Event):
    """Handle a single WebSocket client connection."""
    if not _do_ws_handshake(conn):
        conn.close()
        return

    with ws_lock:
        ws_clients.append(conn)

    # Send initial state
    try:
        snap = stats.snapshot()
        conn.sendall(_ws_frame(json.dumps({"type": "init", **snap}, default=str)))
        with recent_alerts_lock:
            for alert in recent_alerts:
                conn.sendall(_ws_frame(json.dumps(alert, default=str)))
    except Exception:
        pass

    # Keep alive — read pings/pongs/close frames
    conn.settimeout(1.0)
    try:
        while not stop_event.is_set():
            try:
                data = conn.recv(1024)
                if not data:
                    break
                # Check for close frame
                if len(data) >= 2 and (data[0] & 0x0F) == 0x08:
                    break
                # Respond to ping with pong
                if len(data) >= 2 and (data[0] & 0x0F) == 0x09:
                    pong = bytearray(data)
                    pong[0] = (pong[0] & 0xF0) | 0x0A
                    conn.sendall(bytes(pong))
            except socket.timeout:
                continue
            except Exception:
                break
    finally:
        with ws_lock:
            if conn in ws_clients:
                ws_clients.remove(conn)
        try: conn.close()
        except: pass

def run_ws_server(port: int, stop_event: threading.Event):
    """Run a raw WebSocket server on the given port."""
    server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_sock.settimeout(1.0)
    server_sock.bind(("0.0.0.0", port))
    server_sock.listen(5)

    while not stop_event.is_set():
        try:
            conn, addr = server_sock.accept()
            t = threading.Thread(target=_handle_ws_client, args=(conn, stop_event), daemon=True)
            t.start()
        except socket.timeout:
            continue
        except Exception:
            break

    server_sock.close()

# ── Anomaly Detector ─────────────────────────────────────────────────────────

def detect_anomalies(service: str, line: str, min_severity: str = "LOW"):
    hits = []
    for name, severity, pattern in ANOMALY_RULES:
        if SEVERITY_ORDER.get(severity, 99) > SEVERITY_ORDER.get(min_severity, 3):
            continue
        if pattern.search(line):
            hits.append((name, severity))
    return hits

# ── Alert Formatting ─────────────────────────────────────────────────────────

def format_alert_terminal(service: str, rule: str, severity: str, line: str) -> str:
    sev_col = SEVERITY_COLORS.get(severity, "")
    ts = datetime.now().strftime("%H:%M:%S")
    truncated = (line[:200] + "…") if len(line) > 200 else line
    return (
        f"\n{sev_col}{'━' * 60}{RESET}\n"
        f"{sev_col}  ⚠  {severity} │ {rule}{RESET}\n"
        f"  {DIM}{ts}{RESET}  {_svc_color(service)}{service}{RESET}\n"
        f"  {truncated}\n"
        f"{sev_col}{'━' * 60}{RESET}\n"
    )

def emit_alert(service: str, rule: str, severity: str, line: str, quiet: bool = False):
    stats.record_anomaly(service, severity, rule)
    if not quiet or severity in ("CRITICAL", "HIGH"):
        sys.stdout.write(format_alert_terminal(service, rule, severity, line))
        sys.stdout.flush()
    if severity == "CRITICAL":
        sys.stdout.write("\a")
        sys.stdout.flush()

    alert_obj = {
        "type": "alert",
        "service": service,
        "rule": rule,
        "severity": severity,
        "message": line[:500],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    with recent_alerts_lock:
        recent_alerts.append(alert_obj)
        if len(recent_alerts) > MAX_RECENT:
            del recent_alerts[: len(recent_alerts) - MAX_RECENT]
    broadcast_ws(alert_obj)

# ── Log File Writer ──────────────────────────────────────────────────────────

_log_file = None
_log_lock = threading.Lock()

def init_log_file(path: str):
    global _log_file
    _log_file = open(path, "a", encoding="utf-8")

def write_log(msg: str):
    if _log_file:
        with _log_lock:
            _log_file.write(msg + "\n")
            _log_file.flush()

# ── Docker Log Streamer ─────────────────────────────────────────────────────

def stream_container_logs(container: str, min_severity: str, quiet: bool, stop_event: threading.Event):
    color = _svc_color(container)
    short = container.replace("whatsapp-", "wa-").replace("genesys-", "gc-")
    label = f"{color}{short:>20}{RESET}"

    cmd = ["docker", "logs", "-f", "--since", "5m", "--timestamps", container]
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    except Exception as e:
        sys.stderr.write(f"{RED}Failed to attach to {container}: {e}{RESET}\n")
        return

    stats.set_status(container, "running")
    broadcast_ws({"type": "status", "service": container, "status": "running"})

    try:
        while not stop_event.is_set():
            line = proc.stdout.readline()
            if not line:
                break
            line = line.rstrip()
            if not line:
                continue

            stats.record_line()
            broadcast_ws({
                "type": "log",
                "service": container,
                "message": line[:1000],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

            hits = detect_anomalies(container, line, min_severity)
            if hits:
                for rule_name, severity in hits:
                    emit_alert(container, rule_name, severity, line, quiet)
                    write_log(f"[{datetime.now().isoformat()}] [{severity}] [{container}] [{rule_name}] {line}")
            elif not quiet:
                sys.stdout.write(f"  {label} │ {DIM}{line[:160]}{RESET}\n")
                sys.stdout.flush()
    except Exception:
        pass
    finally:
        proc.terminate()
        stats.set_status(container, "stopped")
        broadcast_ws({"type": "status", "service": container, "status": "stopped"})

# ── Docker Event Monitor ─────────────────────────────────────────────────────

def monitor_docker_events(stop_event: threading.Event, quiet: bool):
    cmd = ["docker", "events", "--filter", "type=container",
           "--format", "{{.Actor.Attributes.name}} {{.Action}}"]
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
    except Exception:
        return

    try:
        while not stop_event.is_set():
            line = proc.stdout.readline()
            if not line:
                break
            parts = line.strip().split(maxsplit=1)
            if len(parts) < 2:
                continue
            name, action = parts

            if action in ("die", "stop", "kill", "oom"):
                stats.set_status(name, "stopped")
                emit_alert(name, "Service Crash", "CRITICAL",
                           f"Container {action}: {name}", quiet)
            elif action == "restart":
                stats.set_status(name, "restarting")
                emit_alert(name, "Service Restart", "HIGH",
                           f"Container restarting: {name}", quiet)
            elif action == "start":
                stats.set_status(name, "running")
                broadcast_ws({"type": "status", "service": name, "status": "running"})
            elif action == "health_status: unhealthy":
                emit_alert(name, "Health Check Fail", "HIGH",
                           f"Container unhealthy: {name}", quiet)
    except Exception:
        pass
    finally:
        proc.terminate()

# ── Dashboard Stats Printer ──────────────────────────────────────────────────

def dashboard_printer(interval: int, stop_event: threading.Event):
    while not stop_event.is_set():
        stop_event.wait(interval)
        if stop_event.is_set():
            break
        snap = stats.snapshot()
        mins = snap["uptime_seconds"] // 60
        sys.stdout.write(
            f"\n{CYAN}{'─' * 60}{RESET}\n"
            f"  {BOLD}📊 WATCHDOG DASHBOARD{RESET}  {DIM}(uptime: {mins}m, lines: {snap['total_lines']}){RESET}\n"
        )
        if snap["by_severity"]:
            parts = []
            for sev in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
                cnt = snap["by_severity"].get(sev, 0)
                if cnt:
                    parts.append(f"{SEVERITY_COLORS[sev]}{sev}: {cnt}{RESET}")
            sys.stdout.write("  " + "  │  ".join(parts) + "\n")

        if snap["by_service"]:
            top = sorted(snap["by_service"].items(), key=lambda x: -x[1])[:5]
            for svc, cnt in top:
                bar = "█" * min(cnt, 30)
                sys.stdout.write(f"  {_svc_color(svc)}{svc:>30}{RESET} │ {RED}{bar}{RESET} {cnt}\n")

        sys.stdout.write(f"{CYAN}{'─' * 60}{RESET}\n\n")
        sys.stdout.flush()
        broadcast_ws({"type": "stats", **snap})

# ── HTTP Server ──────────────────────────────────────────────────────────────

HTML_PATH = Path(__file__).parent / "log_watchdog.html"

class WatchdogHTTPHandler(http.server.BaseHTTPRequestHandler):
    ws_port = 9091  # will be set by main

    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self._serve_html()
        elif self.path == "/api/stats":
            self._serve_json(stats.snapshot())
        elif self.path == "/api/alerts":
            with recent_alerts_lock:
                self._serve_json(list(recent_alerts))
        elif self.path == "/api/ws-port":
            self._serve_json({"port": self.ws_port})
        else:
            self.send_error(404)

    def _serve_html(self):
        try:
            content = HTML_PATH.read_text(encoding="utf-8")
            # Inject the WS port so the HTML knows where to connect
            content = content.replace("__WS_PORT__", str(self.ws_port))
            content_bytes = content.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content_bytes)))
            self.end_headers()
            self.wfile.write(content_bytes)
        except FileNotFoundError:
            self.send_error(500, "log_watchdog.html not found")

    def _serve_json(self, data):
        body = json.dumps(data, default=str).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

def run_http_server(port: int, stop_event: threading.Event):
    server = http.server.ThreadingHTTPServer(("0.0.0.0", port), WatchdogHTTPHandler)
    server.daemon_threads = True
    server.timeout = 1
    while not stop_event.is_set():
        server.handle_request()
    server.server_close()

# ── Container Discovery ──────────────────────────────────────────────────────

def get_running_containers(name_filter=None):
    result = subprocess.run(
        ["docker", "ps", "--format", "{{.Names}}"],
        capture_output=True, text=True
    )
    containers = [c.strip() for c in result.stdout.strip().split("\n") if c.strip()]
    if name_filter:
        containers = [c for c in containers if any(f in c for f in name_filter)]
    return sorted(containers)

# ── Banner ───────────────────────────────────────────────────────────────────

BANNER = f"""
{CYAN}╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   {BOLD}🐕  WABA LOG WATCHDOG{RESET}{CYAN}                                     ║
║   {DIM}Real-time Docker log monitoring & anomaly detection{RESET}{CYAN}        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝{RESET}
"""

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="WABA Docker Log Watchdog")
    parser.add_argument("--port", type=int, default=9090, help="Web dashboard port (default: 9090)")
    parser.add_argument("--ws-port", type=int, default=None, help="WebSocket port (default: http_port + 1)")
    parser.add_argument("--services", type=str, default=None, help="Comma-separated service name filters")
    parser.add_argument("--min-severity", type=str, default="LOW",
                        choices=["CRITICAL", "HIGH", "MEDIUM", "LOW"])
    parser.add_argument("--quiet", action="store_true", help="Terminal: anomalies only")
    parser.add_argument("--dashboard-interval", type=int, default=60)
    args = parser.parse_args()

    ws_port = args.ws_port or (args.port + 1)
    WatchdogHTTPHandler.ws_port = ws_port

    sys.stdout.write(BANNER)

    name_filter = args.services.split(",") if args.services else None
    containers = get_running_containers(name_filter)

    if not containers:
        sys.stderr.write(f"{RED}No running Docker containers found!{RESET}\n")
        sys.exit(1)

    sys.stdout.write(f"  {BOLD}Monitoring {len(containers)} containers:{RESET}\n")
    for c in containers:
        stats.set_status(c, "running")
        sys.stdout.write(f"    {GREEN}●{RESET} {_svc_color(c)}{c}{RESET}\n")
    sys.stdout.write(f"\n  {BOLD}Web Dashboard:{RESET}  {CYAN}http://localhost:{args.port}{RESET}\n")
    sys.stdout.write(f"  {BOLD}WebSocket:{RESET}      {CYAN}ws://localhost:{ws_port}{RESET}\n")
    sys.stdout.write(f"  {BOLD}Min Severity:{RESET}   {args.min_severity}\n")
    sys.stdout.write(f"  {BOLD}Quiet Mode:{RESET}     {'ON' if args.quiet else 'OFF'}\n")
    sys.stdout.write(f"  {DIM}Press Ctrl+C to stop{RESET}\n\n")

    log_path = Path(__file__).parent / "watchdog_alerts.log"
    init_log_file(str(log_path))

    stop_event = threading.Event()
    threads = []

    def shutdown(sig=None, frame=None):
        sys.stdout.write(f"\n{YELLOW}Shutting down watchdog...{RESET}\n")
        stop_event.set()

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # HTTP server
    t = threading.Thread(target=run_http_server, args=(args.port, stop_event), daemon=True)
    t.start(); threads.append(t)

    # WebSocket server
    t = threading.Thread(target=run_ws_server, args=(ws_port, stop_event), daemon=True)
    t.start(); threads.append(t)

    # Docker event monitor
    t = threading.Thread(target=monitor_docker_events, args=(stop_event, args.quiet), daemon=True)
    t.start(); threads.append(t)

    # Dashboard printer
    t = threading.Thread(target=dashboard_printer, args=(args.dashboard_interval, stop_event), daemon=True)
    t.start(); threads.append(t)

    # Log streamers
    for container in containers:
        t = threading.Thread(
            target=stream_container_logs,
            args=(container, args.min_severity, args.quiet, stop_event),
            daemon=True,
        )
        t.start(); threads.append(t)

    try:
        while not stop_event.is_set():
            stop_event.wait(0.5)
    except KeyboardInterrupt:
        shutdown()

    # Final summary
    snap = stats.snapshot()
    sys.stdout.write(
        f"\n{CYAN}{'═' * 60}{RESET}\n"
        f"  {BOLD}📋 FINAL SUMMARY{RESET}\n"
        f"  Total lines processed: {snap['total_lines']}\n"
        f"  Uptime: {snap['uptime_seconds'] // 60}m {snap['uptime_seconds'] % 60}s\n"
    )
    if snap["by_severity"]:
        for sev in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
            cnt = snap["by_severity"].get(sev, 0)
            if cnt:
                sys.stdout.write(f"  {SEVERITY_COLORS[sev]}{sev}: {cnt}{RESET}\n")
    if snap["by_service"]:
        sys.stdout.write(f"\n  {BOLD}Anomalies by service:{RESET}\n")
        for svc, cnt in sorted(snap["by_service"].items(), key=lambda x: -x[1]):
            sys.stdout.write(f"    {_svc_color(svc)}{svc}{RESET}: {cnt}\n")
    sys.stdout.write(f"{CYAN}{'═' * 60}{RESET}\n")
    sys.stdout.write(f"  Alerts saved to: {log_path}\n\n")

    if _log_file:
        _log_file.close()

if __name__ == "__main__":
    main()
