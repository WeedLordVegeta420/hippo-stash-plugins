#!/usr/bin/env python3
"""GalleryMode frame server (WebSocket).

Three modes, selected by sys.argv[1]:

  start  (default) — Stash task. Reads Stash connection info from stdin,
                     spawns a detached 'server' subprocess, writes a PID file,
                     and exits so the Stash task completes immediately.

  stop             — Stash task. Reads the PID file and sends SIGTERM.

  server           — Internal. Accepts config as CLI flags and runs the
                     WebSocket server indefinitely.

WebSocket API (ws://127.0.0.1:{port}):
  Single frame:
    {"type":"frame","request_id":"frame-1","scene_id":"123","t":30.5,"scale":0.5}
  Prefetch batch:
    {"type":"prefetch_batch","request_id":"prefetch-1","scene_id":"123","times":[5,10,15],"scale":0.5}
  Cancel:
    {"type":"cancel","request_id":"prefetch-1"}

  Server responds with text JSON:
    {"type":"frame_result","request_id":"...","t":30.5,"ok":true,"image":"<base64-jpeg>"}
    {"type":"frame_result","request_id":"...","t":30.5,"ok":false,"error":"Frame unavailable"}
    {"type":"batch_done","request_id":"..."}
"""

import argparse
import base64
import hashlib
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
import urllib.parse
import urllib.request
from collections import OrderedDict

DEFAULT_PORT = 9876
PLUGIN_ID = 'GalleryMode'
_WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
SPRITE_WIDTH_GUESS = 160  # matches JS constant
SCENE_CACHE_MAX = 128
FRAME_CACHE_MAX = 256
PREFETCH_CONCURRENCY = 2
PREFETCH_BATCH_MAX = 8
PROCESS_POLL_INTERVAL = 0.05

_SCRIPT = os.path.abspath(__file__)
_SCRIPT_DIR = os.path.dirname(_SCRIPT)
_PID_FILE = os.path.join(_SCRIPT_DIR, 'frame_server.pid')


class RequestCancelled(Exception):
    """Raised when a frame request is cancelled while ffmpeg is running."""


# ── GraphQL helpers ───────────────────────────────────────────────────────────

def gql(graphql_url, api_key, query, variables=None):
    body = json.dumps({'query': query, 'variables': variables or {}}).encode()
    headers = {'Content-Type': 'application/json'}
    if api_key:
        headers['ApiKey'] = api_key
    req = urllib.request.Request(graphql_url, data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


def get_scene_data(graphql_url, api_key, scene_id):
    """Return (stream_url, sprite_url, duration) for the given scene."""
    cached = _cache_get(_scene_cache, _scene_cache_lock, _scene_cache_key(scene_id))
    if cached is not None:
        return cached

    data = gql(graphql_url, api_key,
               'query FindScene($id: ID!) { findScene(id: $id) { files { duration } paths { stream sprite } } }',
               {'id': scene_id})
    scene = (data.get('data') or {}).get('findScene')
    if not scene:
        return None, None, 0
    duration = ((scene.get('files') or [{}])[0]).get('duration', 0)
    paths = scene.get('paths') or {}
    result = (paths.get('stream'), paths.get('sprite'), duration)
    _cache_set(_scene_cache, _scene_cache_lock, _scene_cache_key(scene_id), result, SCENE_CACHE_MAX)
    return result


# ── ffmpeg ────────────────────────────────────────────────────────────────────

def _terminate_process(proc):
    try:
        proc.kill()
    except OSError:
        pass
    try:
        proc.communicate(timeout=1)
    except Exception:
        pass


def _run_process(cmd, timeout, cancel_event=None, text=False):
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=text
    )
    deadline = time.monotonic() + timeout

    while True:
        if cancel_event and cancel_event.is_set():
            _terminate_process(proc)
            raise RequestCancelled()

        if proc.poll() is not None:
            return proc.communicate()

        if time.monotonic() >= deadline:
            _terminate_process(proc)
            raise subprocess.TimeoutExpired(cmd, timeout)

        time.sleep(PROCESS_POLL_INTERVAL)


def extract_frame(ffmpeg_path, stream_url, timestamp, scale, api_key='', cancel_event=None):
    cmd = [ffmpeg_path, '-ss', str(timestamp)]
    if api_key:
        cmd += ['-headers', f'ApiKey: {api_key}\r\n']
    cmd += ['-i', stream_url, '-vframes', '1', '-q:v', '3']
    if scale and scale < 1.0:
        cmd += ['-vf', f'scale=iw*{scale}:ih*{scale}']
    cmd += ['-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1']
    stdout, _ = _run_process(cmd, timeout=12, cancel_event=cancel_event)
    return stdout if stdout else None


def extract_sprite_fallback(ffmpeg_path, sprite_url, timestamp, duration, api_key='', cancel_event=None):
    """Crop the pre-generated sprite sheet to get an approximate frame.

    Falls back to this when ffmpeg times out on network-mounted content
    (e.g. rclone VFS with vfs_cache_mode: full) that requires a full sequential
    download before seeks can be served.
    """
    if not sprite_url or not duration:
        return None

    ffprobe = (os.path.join(os.path.dirname(ffmpeg_path), 'ffprobe')
               if os.path.dirname(ffmpeg_path) else 'ffprobe')

    probe_cmd = [ffprobe, '-v', 'error', '-select_streams', 'v:0',
                 '-show_entries', 'stream=width,height', '-of', 'csv=p=0']
    if api_key:
        probe_cmd += ['-headers', f'ApiKey: {api_key}\r\n']
    probe_cmd.append(sprite_url)
    try:
        r = subprocess.run(probe_cmd, capture_output=True, timeout=5, text=True)
        sheet_w, sheet_h = map(int, r.stdout.strip().split(','))
    except Exception:
        return None

    cols = round(sheet_w / SPRITE_WIDTH_GUESS)
    if cols < 1:
        return None
    single_h = (sheet_w / cols) * (9 / 16)
    rows = round(sheet_h / single_h)
    if rows < 1:
        return None

    total = cols * rows
    idx = min(int((timestamp / duration) * total), total - 1)
    col_idx, row_idx = idx % cols, idx // cols
    sw, sh = sheet_w // cols, sheet_h // rows
    x, y = col_idx * sw, row_idx * sh

    cmd = [ffmpeg_path]
    if api_key:
        cmd += ['-headers', f'ApiKey: {api_key}\r\n']
    cmd += ['-i', sprite_url,
            '-vf', f'crop={sw}:{sh}:{x}:{y},scale={sw * 2}:{sh * 2}',
            '-frames:v', '1', '-q:v', '3',
            '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1']
    stdout, _ = _run_process(cmd, timeout=8, cancel_event=cancel_event)
    return stdout if stdout else None


def get_frame_jpeg(scene_id, timestamp, scale, scene_data=None, cancel_event=None):
    if scene_data is None:
        scene_data = get_scene_data(_cfg['graphql_url'], _cfg['api_key'], scene_id)

    stream_url, sprite_url, duration = scene_data
    if not stream_url:
        return None, 'Scene not found', scene_data

    cached_jpeg = _cache_get(_frame_cache, _frame_cache_lock, _frame_cache_key(scene_id, timestamp, scale))
    if cached_jpeg is not None:
        return cached_jpeg, None, scene_data

    jpeg = None
    try:
        jpeg = extract_frame(
            _cfg['ffmpeg_path'],
            stream_url,
            timestamp,
            scale,
            _cfg['api_key'],
            cancel_event=cancel_event
        )
    except subprocess.TimeoutExpired:
        jpeg = extract_sprite_fallback(
            _cfg['ffmpeg_path'],
            sprite_url,
            timestamp,
            duration,
            _cfg['api_key'],
            cancel_event=cancel_event
        )

    if not jpeg:
        return None, 'Frame unavailable', scene_data

    _cache_set(_frame_cache, _frame_cache_lock, _frame_cache_key(scene_id, timestamp, scale), jpeg, FRAME_CACHE_MAX)
    return jpeg, None, scene_data


# ── WebSocket protocol ────────────────────────────────────────────────────────

class _WSConn:
    """Minimal WebSocket framing over a raw socket."""

    def __init__(self, sock):
        self._s = sock
        self._send_lock = threading.Lock()

    def _recv_exact(self, n):
        buf = bytearray()
        while len(buf) < n:
            chunk = self._s.recv(n - len(buf))
            if not chunk:
                raise ConnectionError('connection closed')
            buf.extend(chunk)
        return bytes(buf)

    def recv_message(self):
        """Return payload bytes of the next frame, or None on close frame."""
        hdr = self._recv_exact(2)
        b1, b2 = hdr[0], hdr[1]
        opcode = b1 & 0x0F
        if opcode == 0x8:   # close
            return None
        masked = bool(b2 & 0x80)
        length = b2 & 0x7F
        if length == 126:
            length = struct.unpack('>H', self._recv_exact(2))[0]
        elif length == 127:
            length = struct.unpack('>Q', self._recv_exact(8))[0]
        mask = self._recv_exact(4) if masked else None
        payload = bytearray(self._recv_exact(length))
        if masked:
            for i in range(length):
                payload[i] ^= mask[i % 4]
        return bytes(payload)

    def _send_frame(self, opcode, payload):
        n = len(payload)
        frame = bytearray([0x80 | opcode])  # FIN bit set
        if n < 126:
            frame.append(n)
        elif n < 65536:
            frame.append(126)
            frame.extend(struct.pack('>H', n))
        else:
            frame.append(127)
            frame.extend(struct.pack('>Q', n))
        frame.extend(payload)
        with self._send_lock:
            self._s.sendall(bytes(frame))

    def send_binary(self, data):
        self._send_frame(0x02, data)

    def send_text(self, text):
        self._send_frame(0x01, text.encode())

    def close(self):
        try:
            self._s.close()
        except OSError:
            pass


class WebSocketServer:
    def __init__(self, host, port):
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._sock.bind((host, port))
        self._sock.listen(16)
        self._prefetch_semaphore = threading.BoundedSemaphore(PREFETCH_CONCURRENCY)

    def serve_forever(self):
        while True:
            try:
                conn, _ = self._sock.accept()
            except OSError:
                break
            threading.Thread(target=self._handle, args=(conn,), daemon=True).start()

    def server_close(self):
        try:
            self._sock.close()
        except OSError:
            pass

    def _handle(self, raw_sock):
        conn_state = {
            'cancelled': set(),
            'cancel_events': {},
            'cancel_lock': threading.Lock(),
            'closed': False
        }
        try:
            # Read HTTP Upgrade request
            buf = b''
            while b'\r\n\r\n' not in buf:
                chunk = raw_sock.recv(4096)
                if not chunk:
                    raw_sock.close()
                    return
                buf += chunk

            head = buf.split(b'\r\n\r\n')[0].decode(errors='replace')
            headers = {}
            for line in head.split('\r\n')[1:]:
                if ':' in line:
                    k, v = line.split(':', 1)
                    headers[k.strip().lower()] = v.strip()

            key = headers.get('sec-websocket-key', '')
            accept = base64.b64encode(
                hashlib.sha1((key + _WS_MAGIC).encode()).digest()
            ).decode()

            raw_sock.sendall((
                'HTTP/1.1 101 Switching Protocols\r\n'
                'Upgrade: websocket\r\n'
                'Connection: Upgrade\r\n'
                f'Sec-WebSocket-Accept: {accept}\r\n'
                'Access-Control-Allow-Origin: *\r\n'
                '\r\n'
            ).encode())

            ws = _WSConn(raw_sock)
            while True:
                payload = ws.recv_message()
                if payload is None:
                    break
                self._dispatch(ws, payload, conn_state)
        except Exception:
            pass
        finally:
            conn_state['closed'] = True
            try:
                raw_sock.close()
            except OSError:
                pass

    def _mark_cancelled(self, conn_state, request_id):
        if not request_id:
            return
        with conn_state['cancel_lock']:
            conn_state['cancelled'].add(str(request_id))
            cancel_event = conn_state['cancel_events'].get(str(request_id))
        if cancel_event:
            cancel_event.set()

    def _is_cancelled(self, conn_state, request_id):
        if not request_id:
            return False
        with conn_state['cancel_lock']:
            return str(request_id) in conn_state['cancelled'] or conn_state.get('closed', False)

    def _get_cancel_event(self, conn_state, request_id):
        if not request_id:
            return None
        with conn_state['cancel_lock']:
            cancel_event = conn_state['cancel_events'].get(str(request_id))
            if cancel_event is None:
                cancel_event = threading.Event()
                conn_state['cancel_events'][str(request_id)] = cancel_event
            if str(request_id) in conn_state['cancelled']:
                cancel_event.set()
            return cancel_event

    def _clear_request_state(self, conn_state, request_id):
        if not request_id:
            return
        with conn_state['cancel_lock']:
            conn_state['cancelled'].discard(str(request_id))
            conn_state['cancel_events'].pop(str(request_id), None)

    def _send_frame_result(self, ws, request_id, timestamp, jpeg=None, error='Frame unavailable'):
        payload = {
            'type': 'frame_result',
            'request_id': request_id,
            't': timestamp,
            'ok': bool(jpeg)
        }
        if jpeg:
            payload['image'] = base64.b64encode(jpeg).decode()
        else:
            payload['error'] = error
        ws.send_text(json.dumps(payload))

    def _send_batch_done(self, ws, request_id):
        ws.send_text(json.dumps({
            'type': 'batch_done',
            'request_id': request_id
        }))

    def _dispatch_frame_request(self, ws, request_id, scene_id, timestamp, scale, conn_state):
        cancel_event = self._get_cancel_event(conn_state, request_id)
        if self._is_cancelled(conn_state, request_id):
            return
        try:
            jpeg, error, _ = get_frame_jpeg(scene_id, timestamp, scale, cancel_event=cancel_event)
            if self._is_cancelled(conn_state, request_id):
                return
            self._send_frame_result(ws, request_id, timestamp, jpeg=jpeg, error=error or 'Frame unavailable')
        except RequestCancelled:
            return
        except Exception as exc:
            if self._is_cancelled(conn_state, request_id):
                return
            try:
                self._send_frame_result(ws, request_id, timestamp, error=str(exc))
            except Exception:
                pass
        finally:
            self._clear_request_state(conn_state, request_id)

    def _dispatch_prefetch_batch(self, ws, request_id, scene_id, times, scale, conn_state):
        cancel_event = self._get_cancel_event(conn_state, request_id)
        scene_data = get_scene_data(_cfg['graphql_url'], _cfg['api_key'], scene_id)
        work_items = list(times[:PREFETCH_BATCH_MAX])
        work_lock = threading.Lock()

        def next_time():
            with work_lock:
                if not work_items:
                    return None
                return work_items.pop(0)

        def worker():
            while True:
                if self._is_cancelled(conn_state, request_id):
                    return
                timestamp = next_time()
                if timestamp is None:
                    return
                with self._prefetch_semaphore:
                    if self._is_cancelled(conn_state, request_id):
                        return
                    try:
                        jpeg, error, _ = get_frame_jpeg(
                            scene_id,
                            timestamp,
                            scale,
                            scene_data,
                            cancel_event=cancel_event
                        )
                        if self._is_cancelled(conn_state, request_id):
                            return
                        self._send_frame_result(
                            ws,
                            request_id,
                            timestamp,
                            jpeg=jpeg,
                            error=error or 'Frame unavailable'
                        )
                    except RequestCancelled:
                        return
                    except Exception as exc:
                        if self._is_cancelled(conn_state, request_id):
                            return
                        try:
                            self._send_frame_result(ws, request_id, timestamp, error=str(exc))
                        except Exception:
                            return

        try:
            workers = [
                threading.Thread(target=worker, daemon=True)
                for _ in range(min(PREFETCH_CONCURRENCY, len(work_items)))
            ]
            for worker_thread in workers:
                worker_thread.start()
            for worker_thread in workers:
                worker_thread.join()
            if not self._is_cancelled(conn_state, request_id):
                self._send_batch_done(ws, request_id)
        except Exception:
            pass
        finally:
            self._clear_request_state(conn_state, request_id)

    def _dispatch(self, ws, payload, conn_state):
        request_id = ''
        try:
            msg = json.loads(payload)
            request_type = str(msg.get('type') or 'frame')
            request_id = str(msg.get('request_id', ''))

            if request_type == 'cancel':
                self._mark_cancelled(conn_state, request_id)
                return

            scene_id = str(msg.get('scene_id', ''))
            scale = float(msg.get('scale', 1.0))

            if request_type == 'prefetch_batch':
                times = [
                    float(timestamp)
                    for timestamp in (msg.get('times') or [])
                ]
                threading.Thread(
                    target=self._dispatch_prefetch_batch,
                    args=(ws, request_id, scene_id, times[:PREFETCH_BATCH_MAX], scale, conn_state),
                    daemon=True
                ).start()
                return

            timestamp = float(msg.get('t', 0))
            threading.Thread(
                target=self._dispatch_frame_request,
                args=(ws, request_id, scene_id, timestamp, scale, conn_state),
                daemon=True
            ).start()
        except Exception as e:
            try:
                ws.send_text(json.dumps({'type': 'frame_error', 'request_id': request_id, 'error': str(e)}))
            except Exception:
                pass


# ── Runtime config (set once by cmd_server) ───────────────────────────────────

_cfg = {'graphql_url': '', 'api_key': '', 'ffmpeg_path': 'ffmpeg'}
_scene_cache = OrderedDict()
_frame_cache = OrderedDict()
_scene_cache_lock = threading.Lock()
_frame_cache_lock = threading.Lock()


def _cache_get(cache, lock, key):
    with lock:
        value = cache.get(key)
        if value is None:
            return None
        cache.move_to_end(key)
        return value


def _cache_set(cache, lock, key, value, max_size):
    with lock:
        cache[key] = value
        cache.move_to_end(key)
        while len(cache) > max_size:
            cache.popitem(last=False)


def _scene_cache_key(scene_id):
    return str(scene_id)


def _frame_cache_key(scene_id, timestamp, scale):
    rounded_time = round(float(timestamp), 3)
    rounded_scale = round(float(scale), 3)
    return f'{scene_id}:{rounded_time:.3f}:{rounded_scale:.3f}'


# ── PID management ────────────────────────────────────────────────────────────

def _write_pid(pid):
    with open(_PID_FILE, 'w') as f:
        f.write(str(pid))


def _iter_matching_server_pids():
    """Yield running SpriteTab server PIDs for this script.

    The PID file can become stale or point at a process in a different PID
    namespace, so start/stop also need to search the process table.
    """
    if os.name == 'nt':
        return

    try:
        result = subprocess.run(
            ['ps', '-eo', 'pid=,args='],
            capture_output=True,
            text=True,
            timeout=2
        )
    except Exception:
        return

    if result.returncode != 0:
        return

    script_path = os.path.abspath(_SCRIPT)
    current_pid = os.getpid()
    pid_pattern = re.compile(r'^\s*(\d+)\s+(.*)$')
    for line in result.stdout.splitlines():
        match = pid_pattern.match(line)
        if not match:
            continue

        pid = int(match.group(1))
        args = match.group(2)
        if pid == current_pid:
            continue
        if script_path not in args or ' server' not in args:
            continue
        yield pid


def _kill_pid(pid):
    try:
        os.kill(pid, signal.SIGTERM)
    except (ProcessLookupError, ValueError, OSError):
        return False
    return True


def _kill_existing():
    killed = False
    if not os.path.exists(_PID_FILE):
        pid = None
    else:
        try:
            with open(_PID_FILE) as f:
                pid = int(f.read().strip())
        except (ValueError, OSError):
            pid = None
        if pid is not None:
            killed = _kill_pid(pid) or killed

    for pid in _iter_matching_server_pids() or []:
        killed = _kill_pid(pid) or killed

    try:
        os.remove(_PID_FILE)
    except OSError:
        pass
    return killed


def _wait_for_port_release(port, timeout=2.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with socket.create_connection(('127.0.0.1', int(port)), timeout=0.2):
                threading.Event().wait(0.1)
                continue
        except OSError:
            return


# ── Stash plugin input helpers ────────────────────────────────────────────────

def _read_stash_input():
    raw = sys.stdin.read()
    return json.loads(raw) if raw.strip() else {}


def _read_stash_api_key():
    """Read the API key from Stash's config.yml (two levels up from the plugin dir)."""
    config_path = os.path.join(_SCRIPT_DIR, '..', '..', 'config.yml')
    try:
        with open(config_path) as f:
            for line in f:
                if line.startswith('api_key:'):
                    return line.split(':', 1)[1].strip()
    except OSError:
        pass
    return ''


def _resolve_config(plugin_input):
    conn = plugin_input.get('server_connection', {})
    scheme = conn.get('Scheme', 'http')
    host = conn.get('Host', 'localhost')
    if host in ('0.0.0.0', '::'):
        host = '127.0.0.1'
    stash_port = conn.get('Port', 9999)
    # Prefer the key from config.yml; fall back to whatever Stash passed in
    api_key = _read_stash_api_key() or conn.get('ApiKey', '')
    graphql_url = f'{scheme}://{host}:{stash_port}/graphql'

    ffmpeg_path = 'ffmpeg'
    try:
        data = gql(graphql_url, api_key, '{ configuration { general { ffmpegPath } } }')
        fp = (((data.get('data') or {}).get('configuration') or {})
              .get('general', {}).get('ffmpegPath', ''))
        if fp:
            ffmpeg_path = fp
    except Exception:
        pass

    port = DEFAULT_PORT
    try:
        data = gql(graphql_url, api_key, '{ configuration { plugins } }')
        plugins = (((data.get('data') or {}).get('configuration') or {})
                   .get('plugins', {}))
        plugin_cfg = plugins.get(PLUGIN_ID) or {}
        if plugin_cfg.get('frame_server_port'):
            port = int(plugin_cfg['frame_server_port'])
        if plugin_cfg.get('stash_api_key'):
            api_key = plugin_cfg['stash_api_key']
    except Exception:
        pass

    return graphql_url, api_key, ffmpeg_path, port


# ── Mode: start ───────────────────────────────────────────────────────────────

def cmd_start():
    plugin_input = _read_stash_input()
    graphql_url, api_key, ffmpeg_path, port = _resolve_config(plugin_input)

    if _kill_existing():
        _wait_for_port_release(port)

    cmd = [sys.executable, _SCRIPT, 'server',
           '--url', graphql_url, '--api-key', api_key,
           '--ffmpeg', ffmpeg_path, '--port', str(port)]
    devnull = dict(stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if sys.platform == 'win32':
        proc = subprocess.Popen(cmd, **devnull,
                                creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP)
    else:
        proc = subprocess.Popen(cmd, **devnull, start_new_session=True)

    # Fail loudly if the child exits immediately, which usually means an old
    # server is still bound to the port or startup crashed for another reason.
    for _ in range(20):
        if proc.poll() is not None:
            print(json.dumps({
                'error': f'GalleryMode frame server failed to start (exit code {proc.returncode}) on port {port}'
            }), flush=True)
            sys.exit(1)
        threading.Event().wait(0.1)

    _write_pid(proc.pid)
    print(json.dumps({'output': f'GalleryMode frame server started (PID {proc.pid}) on port {port}'}),
          flush=True)


# ── Mode: stop ────────────────────────────────────────────────────────────────

def cmd_stop():
    _read_stash_input()
    _kill_existing()
    print(json.dumps({'output': 'GalleryMode frame server stopped'}), flush=True)


# ── Mode: server (blocking) ───────────────────────────────────────────────────

def cmd_server(argv):
    p = argparse.ArgumentParser()
    p.add_argument('--url', default='http://localhost:9999/graphql')
    p.add_argument('--api-key', default='')
    p.add_argument('--ffmpeg', default='ffmpeg')
    p.add_argument('--port', type=int, default=DEFAULT_PORT)
    args = p.parse_args(argv)

    _cfg['graphql_url'] = args.url
    _cfg['api_key'] = args.api_key
    _cfg['ffmpeg_path'] = args.ffmpeg

    try:
        server = WebSocketServer('0.0.0.0', args.port)
    except OSError as e:
        sys.stderr.write(f'GalleryMode: failed to bind port {args.port}: {e}\n')
        sys.exit(1)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'start'
    if mode == 'stop':
        cmd_stop()
    elif mode == 'server':
        cmd_server(sys.argv[2:])
    else:
        cmd_start()


if __name__ == '__main__':
    main()
