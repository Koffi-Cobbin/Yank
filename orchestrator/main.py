import asyncio
import uvicorn
from api import app, scheduler


async def main():
    asyncio.create_task(scheduler.run())

    config_uvicorn = uvicorn.Config(
        app=app,
        host="localhost",
        port=6801,
        loop="asyncio",
        log_level="info",
    )
    server = uvicorn.Server(config_uvicorn)
    await server.serve()


if __name__ == "__main__":
    asyncio.run(main())
