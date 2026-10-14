# Tiny local CONNECT relay: lets tools that reject a ':' in proxy usernames (aiohttp → edge-tts)
# reach the sandbox's authenticated upstream proxy. Listens on 127.0.0.1:8899, no auth.
import asyncio, base64, os, sys
from urllib.parse import urlsplit, unquote

up = urlsplit(os.environ.get("HTTPS_PROXY") or os.environ["https_proxy"])
AUTH = base64.b64encode(f"{unquote(up.username or '')}:{unquote(up.password or '')}".encode()).decode()

async def pipe(r, w):
    try:
        while (b := await r.read(65536)):
            w.write(b); await w.drain()
    except Exception:
        pass
    finally:
        try: w.close()
        except Exception: pass

async def handle(cr, cw):
    head = await cr.readuntil(b"\r\n\r\n")
    line = head.split(b"\r\n")[0].decode()
    method, target, _ = line.split(" ", 2)
    ur, uw = await asyncio.open_connection(up.hostname, up.port)
    if method == "CONNECT":
        uw.write(f"CONNECT {target} HTTP/1.1\r\nHost: {target}\r\nProxy-Authorization: Basic {AUTH}\r\n\r\n".encode())
    else:
        lines = head.split(b"\r\n")
        lines.insert(1, f"Proxy-Authorization: Basic {AUTH}".encode())
        uw.write(b"\r\n".join(lines))
    await uw.drain()
    await asyncio.gather(pipe(cr, uw), pipe(ur, cw))

async def main():
    srv = await asyncio.start_server(handle, "127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 8899)
    async with srv: await srv.serve_forever()

asyncio.run(main())
