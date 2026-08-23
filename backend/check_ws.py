import asyncio, websockets, json

async def listen():
    async with websockets.connect("ws://localhost:8000/ws") as ws:
        while True:
            msg = await ws.recv()
            data = json.loads(msg)
            if data.get("event") == "telemetry":
                print(f"WS protocol: {data.get('protocol')}")
                break

asyncio.run(listen())
