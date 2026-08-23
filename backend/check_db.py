import aiosqlite, asyncio

async def main():
    db = await aiosqlite.connect('cvis.db')
    r = await db.execute('SELECT protocol, COUNT(*) FROM packets GROUP BY protocol')
    rows = await r.fetchall()
    for row in rows:
        print(row)
    await db.close()

asyncio.run(main())
