import os
import json
import sys
import shutil
import urllib.parse
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = 8080
if len(sys.argv) > 1:
    try:
        PORT = int(sys.argv[1])
    except ValueError:
        pass


def get_data_dir():
    """Returns the path to the writable data directory (cloud disk or local)."""
    if os.path.exists('/data'):
        return '/data'
    return os.path.join(os.getcwd(), 'data')


def read_json_file(filename):
    """Read a JSON file from data dir. Returns empty list/dict on error."""
    path = os.path.join(get_data_dir(), filename)
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return [] if filename in ('messages.json', 'audit_log.json', 'products.json') else {}


def write_json_file(filename, data):
    """Write data as JSON to the data directory."""
    path = os.path.join(get_data_dir(), filename)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def append_audit_log(action_type, details, user='admin'):
    """Append an entry to the audit log."""
    log = read_json_file('audit_log.json')
    if not isinstance(log, list):
        log = []
    log.insert(0, {
        'id': f"log-{len(log)+1}-{int(datetime.now().timestamp())}",
        'timestamp': datetime.now().isoformat(),
        'action': action_type,
        'details': details,
        'user': user
    })
    # Keep only the last 500 log entries
    write_json_file('audit_log.json', log[:500])


class CustomServerHandler(SimpleHTTPRequestHandler):

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        
        # Only disable cache for API endpoints and JSON data
        path = self.path.split('?')[0]
        if path.startswith('/api/') or path.startswith('/data/') or path.endswith('.json'):
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        else:
            # Allow caching of static assets (HTML, CSS, JS, images, etc.) for 1 hour
            self.send_header('Cache-Control', 'public, max-age=3600')
            
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # --- API: GET ALL MESSAGES ---
        if path == '/api/get-messages':
            messages = read_json_file('messages.json')
            self.send_json(200, messages)
            return

        # --- API: GET AUDIT LOG ---
        elif path == '/api/get-audit-log':
            log = read_json_file('audit_log.json')
            self.send_json(200, log)
            return

        # --- API: GET ORDERS ---
        elif path == '/api/get-orders':
            orders = read_json_file('orders.json')
            self.send_json(200, orders)
            return

        # --- API: GET USERS ---
        elif path == '/api/get-users':
            users = read_json_file('users.json')
            self.send_json(200, users)
            return

        # Serve products.json and config.json from writable data directory (persistent or local)
        if path == '/data/products.json':
            self.serve_file(os.path.join(get_data_dir(), 'products.json'), 'application/json')
            return
        elif path == '/data/config.json':
            self.serve_file(os.path.join(get_data_dir(), 'config.json'), 'application/json')
            return

        # Serve assets from the writable data directory if they exist there
        if path.startswith('/assets/'):
            filename = path.split('/assets/')[1]
            target = os.path.join(get_data_dir(), 'assets', filename)
            if os.path.exists(target):
                ctype = self._guess_image_type(target)
                self.serve_file(target, ctype)
                return

        super().do_GET()

    def do_POST(self):
        path = self.path
        body = None if path == '/api/upload-image' else self._read_body()

        # --- API: SAVE PRODUCTS ---
        if path == '/api/save-products':
            try:
                products = json.loads(body)
                write_json_file('products.json', products)
                append_audit_log('catalog_update', f"Updated product catalog ({len(products)} items)")
                self.send_json(200, {"success": True, "message": "Products saved"})
            except Exception as e:
                self.send_json(500, {"success": False, "error": str(e)})

        # --- API: SAVE CONFIG ---
        elif path == '/api/save-config':
            try:
                config = json.loads(body)
                write_json_file('config.json', config)
                append_audit_log('config_update', "Updated website configuration and settings")
                self.send_json(200, {"success": True, "message": "Configuration saved"})
            except Exception as e:
                self.send_json(500, {"success": False, "error": str(e)})

        # --- API: UPLOAD IMAGE ---
        elif path == '/api/upload-image':
            try:
                content_type = self.headers.get('Content-Type', '')
                if 'multipart/form-data' not in content_type:
                    self.send_json(400, {"success": False, "error": "Requires multipart/form-data"})
                    return

                if 'boundary=' not in content_type:
                    self.send_json(400, {"success": False, "error": "Missing boundary in Content-Type"})
                    return
                boundary = content_type.split("boundary=")[1].strip().strip('"').encode()
                raw = self._read_body_raw()
                filename, file_bytes = self._parse_multipart(raw, boundary)

                if not filename:
                    self.send_json(400, {"success": False, "error": "No file found in upload"})
                    return

                assets_dir = os.path.join(get_data_dir(), 'assets')
                os.makedirs(assets_dir, exist_ok=True)
                target = os.path.join(assets_dir, filename)
                with open(target, 'wb') as f:
                    f.write(file_bytes)

                url = f"assets/{filename}"
                append_audit_log('media_upload', f"Uploaded image: {filename}")
                self.send_json(200, {"success": True, "url": url, "message": "Uploaded successfully"})
            except Exception as e:
                self.send_json(500, {"success": False, "error": str(e)})

        # --- API: SUBMIT CUSTOMER INQUIRY (called from main website) ---
        elif path == '/api/submit-inquiry':
            try:
                inquiry = json.loads(body)
                messages = read_json_file('messages.json')
                if not isinstance(messages, list):
                    messages = []

                new_msg = {
                    'id': f"msg-{len(messages)+1}-{int(datetime.now().timestamp())}",
                    'timestamp': datetime.now().isoformat(),
                    'name': inquiry.get('name', 'Unknown'),
                    'email': inquiry.get('email', ''),
                    'service': inquiry.get('service', ''),
                    'date': inquiry.get('date', ''),
                    'time': inquiry.get('time', ''),
                    'notes': inquiry.get('notes', ''),
                    'status': 'unread',
                    'replies': []
                }
                messages.insert(0, new_msg)
                write_json_file('messages.json', messages)
                self.send_json(200, {"success": True, "message": "Inquiry received"})
            except Exception as e:
                self.send_json(500, {"success": False, "error": str(e)})

        # --- API: ADMIN REPLY TO MESSAGE ---
        elif path == '/api/reply-message':
            try:
                payload = json.loads(body)
                msg_id = payload.get('id')
                reply_text = payload.get('reply', '').strip()

                if not msg_id or not reply_text:
                    self.send_json(400, {"success": False, "error": "Missing id or reply"})
                    return

                messages = read_json_file('messages.json')
                found = False
                for msg in messages:
                    if msg['id'] == msg_id:
                        msg['status'] = 'replied'
                        if 'replies' not in msg:
                            msg['replies'] = []
                        msg['replies'].append({
                            'timestamp': datetime.now().isoformat(),
                            'text': reply_text,
                            'from': 'admin'
                        })
                        found = True
                        break

                if not found:
                    self.send_json(404, {"success": False, "error": "Message not found"})
                    return

                write_json_file('messages.json', messages)
                append_audit_log('message_reply', f"Replied to inquiry from: {msg.get('name', '?')} ({msg_id})")
                self.send_json(200, {"success": True, "message": "Reply saved"})
            except Exception as e:
                self.send_json(500, {"success": False, "error": str(e)})

        # --- API: LOG ADMIN ACTION ---
        elif path == '/api/log-action':
            try:
                payload = json.loads(body)
                append_audit_log(
                    payload.get('action', 'unknown'),
                    payload.get('details', ''),
                    payload.get('user', 'admin')
                )
                self.send_json(200, {"success": True})
            except Exception as e:
                self.send_json(500, {"success": False, "error": str(e)})

        # --- API: MARK MESSAGE AS READ ---
        elif path == '/api/mark-read':
            try:
                payload = json.loads(body)
                msg_id = payload.get('id')
                messages = read_json_file('messages.json')
                for msg in messages:
                    if msg['id'] == msg_id:
                        msg['status'] = 'read'
                        break
                write_json_file('messages.json', messages)
                self.send_json(200, {"success": True})
            except Exception as e:
                self.send_json(500, {"success": False, "error": str(e)})

        # --- API: SUBMIT ORDER ---
        elif path == '/api/submit-order':
            try:
                payload = json.loads(body)
                orders = read_json_file('orders.json')
                if not isinstance(orders, list):
                    orders = []
                
                # Deduct stock if matching catalog items
                items = payload.get('items', [])
                products = read_json_file('products.json')
                for item in items:
                    prod_id = item.get('product', {}).get('id')
                    qty = int(item.get('quantity', 1))
                    for p in products:
                        if p['id'] == prod_id:
                            if 'stock' in p:
                                p['stock'] = max(0, p['stock'] - qty)
                write_json_file('products.json', products)

                # Generate order ID
                import random
                order_id = f"MM-{random.randint(100000, 999999)}"
                new_order = {
                    'id': order_id,
                    'timestamp': datetime.now().isoformat(),
                    'items': items,
                    'total': payload.get('total', '$0'),
                    'shipping': payload.get('shipping', {}),
                    'status': 'Processing',
                    'discount_applied': payload.get('discount_applied', '')
                }
                orders.insert(0, new_order)
                write_json_file('orders.json', orders)
                append_audit_log('order_created', f"Order {order_id} placed by {new_order['shipping'].get('name', 'Customer')} ({new_order['total']})")
                self.send_json(200, {"success": True, "orderId": order_id})
            except Exception as e:
                self.send_json(500, {"success": False, "error": str(e)})

        # --- API: UPDATE ORDER STATUS ---
        elif path == '/api/update-order-status':
            try:
                payload = json.loads(body)
                order_id = payload.get('id')
                new_status = payload.get('status')
                
                orders = read_json_file('orders.json')
                found = False
                for o in orders:
                    if o['id'] == order_id:
                        o['status'] = new_status
                        found = True
                        break
                
                if found:
                    write_json_file('orders.json', orders)
                    append_audit_log('order_status_update', f"Order {order_id} status updated to {new_status}")
                    self.send_json(200, {"success": True})
                else:
                    self.send_json(404, {"success": False, "error": "Order not found"})
            except Exception as e:
                self.send_json(500, {"success": False, "error": str(e)})

        # --- API: USER AUTH ---
        elif path == '/api/auth-user':
            try:
                payload = json.loads(body)
                action = payload.get('action') # 'login' or 'signup'
                email = payload.get('email', '').strip().lower()
                password = payload.get('password', '')
                
                users = read_json_file('users.json')
                if not isinstance(users, list):
                    users = []
                
                if action == 'login':
                    found_user = None
                    for u in users:
                        if u.get('email', '').lower() == email and u.get('password') == password:
                            found_user = u
                            break
                    if found_user:
                        self.send_json(200, {"success": True, "user": {"email": found_user['email'], "name": found_user['name']}})
                    else:
                        self.send_json(401, {"success": False, "error": "Invalid email or password"})
                elif action == 'signup':
                    # check if exists
                    exists = False
                    for u in users:
                        if u.get('email', '').lower() == email:
                            exists = True
                            break
                    if exists:
                        self.send_json(400, {"success": False, "error": "Email already registered"})
                    else:
                        new_user = {
                            "email": email,
                            "password": password,
                            "name": payload.get('name', 'Valued Customer'),
                            "role": "customer",
                            "wishlist": [],
                            "orders": []
                        }
                        users.append(new_user)
                        write_json_file('users.json', users)
                        append_audit_log('user_signup', f"New user signed up: {email}")
                        self.send_json(200, {"success": True, "user": {"email": email, "name": new_user['name']}})
                else:
                    self.send_json(400, {"success": False, "error": "Invalid action"})
            except Exception as e:
                self.send_json(500, {"success": False, "error": str(e)})

        else:
            self.send_json(404, {"success": False, "error": "Unknown endpoint"})

    # --- HELPERS ---
    def _read_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        return self.rfile.read(content_length).decode('utf-8', errors='replace')

    def _read_body_raw(self):
        content_length = int(self.headers.get('Content-Length', 0))
        return self.rfile.read(content_length)

    def _parse_multipart(self, raw, boundary):
        parts = raw.split(b'--' + boundary)
        for part in parts:
            if b'filename="' in part:
                header_body = part.split(b'\r\n\r\n', 1)
                if len(header_body) < 2:
                    continue
                header, body = header_body
                
                # Safe strip of trailing boundary/newlines without corrupting file bytes
                if body.endswith(b'\r\n--\r\n'):
                    body = body[:-6]
                elif body.endswith(b'\r\n--'):
                    body = body[:-4]
                elif body.endswith(b'\r\n'):
                    body = body[:-2]
                elif body.endswith(b'\n'):
                    body = body[:-1]
                
                header_str = header.decode('utf-8', errors='ignore')
                for line in header_str.split('\r\n'):
                    if 'filename=' in line:
                        raw_fn = line.split('filename=')[1].strip('"').strip()
                        fn = os.path.basename(raw_fn).replace(' ', '_')
                        return fn, body
        return None, None

    def _guess_image_type(self, path):
        if path.endswith('.png'): return 'image/png'
        if path.endswith('.webp'): return 'image/webp'
        if path.endswith('.svg'): return 'image/svg+xml'
        if path.endswith('.gif'): return 'image/gif'
        if path.endswith('.mp4'): return 'video/mp4'
        if path.endswith('.webm'): return 'video/webm'
        if path.endswith('.mov'): return 'video/quicktime'
        return 'image/jpeg'

    def serve_file(self, file_path, content_type):
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', len(content))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_json(404, {"error": str(e)})

    def send_json(self, code, data):
        payload = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(payload))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format, *args):
        # Suppress noisy SSL handshake errors in console
        msg = format % args
        if '400' not in msg or 'Bad request' not in msg:
            sys.stderr.write(f"[{self.log_date_time_string()}] {msg}\n")


if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    # Initialize persistent cloud disk if present
    if os.path.exists('/data'):
        print("Persistent volume at /data detected. Initializing...")
        os.makedirs('/data/assets', exist_ok=True)
        for db_file in ['products.json', 'config.json', 'messages.json', 'audit_log.json', 'orders.json', 'users.json']:
            target = os.path.join('/data', db_file)
            if not os.path.exists(target):
                src = os.path.join(os.getcwd(), 'data', db_file)
                if os.path.exists(src):
                    shutil.copy(src, target)
                    print(f"  Copied data/{db_file} → {target}")

        hero_src = os.path.join(os.getcwd(), 'assets', 'jewelry_hero_bg.png')
        hero_dst = '/data/assets/jewelry_hero_bg.png'
        if not os.path.exists(hero_dst) and os.path.exists(hero_src):
            shutil.copy(hero_src, hero_dst)

    httpd = HTTPServer(('', PORT), CustomServerHandler)
    print(f"✦ MM Jewels Server running at http://localhost:{PORT}")
    print(f"  Admin Console: http://localhost:{PORT}/admin.html")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        sys.exit(0)
