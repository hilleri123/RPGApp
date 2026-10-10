#!/usr/bin/env python3
"""Turn a PaperVPN access key (ss:// or vless://) into a sing-box TUN."""

from __future__ import annotations

import base64
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

CONFIG_PATH = Path("/etc/sing-box/config.json")

PRIVATE_CIDRS = [
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "127.0.0.0/8",
]


def _b64decode(raw: str) -> str:
    pad = "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode(raw + pad).decode()


def parse_shadowsocks(uri: str) -> dict:
    body = uri[len("ss://"):]
    body = body.split("#", 1)[0]
    if "@" in body:
        userinfo, hostport = body.rsplit("@", 1)
        host, port_s = hostport.rsplit(":", 1)
        try:
            method_password = _b64decode(userinfo)
        except Exception:
            method_password = urllib.parse.unquote(userinfo)
        method, password = method_password.split(":", 1)
    else:
        decoded = _b64decode(body.split("?", 1)[0])
        method_password, hostport = decoded.rsplit("@", 1)
        method, password = method_password.split(":", 1)
        host, port_s = hostport.rsplit(":", 1)
    return {
        "type": "shadowsocks",
        "tag": "proxy",
        "server": host.strip("[]"),
        "server_port": int(port_s),
        "method": method,
        "password": password,
    }


def parse_vless(uri: str) -> dict:
    parsed = urllib.parse.urlparse(uri)
    if not parsed.hostname or not parsed.username or not parsed.port:
        raise ValueError("vless URI needs uuid, host and port")
    query = urllib.parse.parse_qs(parsed.query)
    def q(name: str, default: str = "") -> str:
        return (query.get(name) or [default])[0]

    security = q("security", "none")
    outbound: dict = {
        "type": "vless",
        "tag": "proxy",
        "server": parsed.hostname,
        "server_port": parsed.port,
        "uuid": urllib.parse.unquote(parsed.username),
    }
    flow = q("flow")
    if flow:
        outbound["flow"] = flow

    network = q("type", "tcp")
    if network == "ws":
        outbound["transport"] = {
            "type": "ws",
            "path": urllib.parse.unquote(q("path", "/")),
            "headers": {"Host": q("host", parsed.hostname)},
        }
    elif network == "grpc":
        outbound["transport"] = {
            "type": "grpc",
            "service_name": q("serviceName"),
        }
    elif network not in ("tcp", ""):
        raise ValueError(f"unsupported vless transport: {network}")

    if security in ("tls", "reality"):
        tls: dict = {
            "enabled": True,
            "server_name": q("sni") or q("host") or parsed.hostname,
        }
        fp = q("fp")
        if fp:
            tls["utls"] = {"enabled": True, "fingerprint": fp}
        if security == "reality":
            reality = {"enabled": True, "public_key": q("pbk")}
            sid = q("sid")
            if sid:
                reality["short_id"] = sid
            tls["reality"] = reality
        outbound["tls"] = tls
    return outbound


def resolve_key(raw: str) -> str:
    raw = raw.strip().strip('"').strip("'")
    if raw.startswith(("http://", "https://")):
        request = urllib.request.Request(raw, headers={"User-Agent": "papervpn-container"})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                body = response.read().decode("utf-8", "replace")
        except Exception as exc:
            raise ValueError(f"failed to fetch PaperVPN key: {exc}") from exc
        for line in body.splitlines():
            line = line.strip()
            if line.startswith(("ss://", "vless://")):
                return line
        raise ValueError("PaperVPN link did not return an ss:// or vless:// key")
    return raw


def parse_key(key: str) -> dict:
    key = resolve_key(key)
    if key.startswith("ss://"):
        return parse_shadowsocks(key)
    if key.startswith("vless://"):
        return parse_vless(key)
    raise ValueError("PAPERVPN_KEY must be an ss:// or vless:// access key, or an https link to one")


def build_config(proxy_outbound: dict) -> dict:
    return {
        "log": {"level": "info"},
        "inbounds": [
            {
                "type": "tun",
                "tag": "tun-in",
                "interface_name": "tun0",
                "address": ["172.19.0.1/30"],
                "mtu": 1500,
                "auto_route": True,
                "auto_redirect": True,
                "strict_route": False,
                "route_exclude_address": PRIVATE_CIDRS,
            }
        ],
        "outbounds": [
            proxy_outbound,
            {"type": "direct", "tag": "direct"},
        ],
        "route": {
            "auto_detect_interface": True,
            "rules": [
                {"ip_cidr": PRIVATE_CIDRS, "outbound": "direct"},
            ],
            "final": "proxy",
        },
    }


def main() -> None:
    key = os.environ.get("PAPERVPN_KEY", "").strip()
    if not key:
        print("PAPERVPN_KEY is empty. Paste the PaperVPN access key into .env.", file=sys.stderr)
        sys.exit(1)
    proxy = parse_key(key)
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(build_config(proxy), ensure_ascii=False, indent=2))
    os.execvp("sing-box", ["sing-box", "run", "-c", str(CONFIG_PATH)])


if __name__ == "__main__":
    main()
