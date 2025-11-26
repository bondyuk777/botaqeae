import os
import asyncio
import websockets
from urllib.parse import urlparse, parse_qs, unquote

ALLOWED_HOST = "sploop.io"  # страховка, чтобы не превратить прокси в общий анонимайзер

async def proxy_handler(client_ws, path):
    print("New client:", path)

    # path вида: "/?target=wss%3A%2F%2Fserver.sploop.io%2Fws%3Ftoken%3D123"
    parsed = urlparse(path)
    qs = parse_qs(parsed.query)
    target_list = qs.get("target")

    if not target_list:
        print("No target provided, closing")
        await client_ws.close()
        return

    upstream_url = unquote(target_list[0])

    # Немного безопасности
    try:
        u = urlparse(upstream_url)
        if ALLOWED_HOST not in u.netloc:
            print("Blocked upstream:", upstream_url)
            await client_ws.close()
            return
    except Exception as e:
        print("Bad upstream url:", upstream_url, e)
        await client_ws.close()
        return

    print("Connecting to upstream:", upstream_url)

    try:
        async with websockets.connect(upstream_url) as upstream_ws:

            async def client_to_upstream():
                async for message in client_ws:
                    await upstream_ws.send(message)

            async def upstream_to_client():
                async for message in upstream_ws:
                    await client_ws.send(message)

            await asyncio.gather(client_to_upstream(), upstream_to_client())

    except Exception as e:
        print("Error in proxy:", e)
        try:
            await client_ws.close()
        except:
            pass

async def main():
    port = int(os.environ.get("PORT", 8000))
    async with websockets.serve(proxy_handler, "0.0.0.0", port):
        print(f"Proxy server running on port {port}")
        await asyncio.Future()  # чтобы не завершаться

if __name__ == "__main__":
    asyncio.run(main())
