"""Entry point for the PyInstaller-packaged backend.
Starts uvicorn on 127.0.0.1:$PORT for the Electron shell.
"""

import os
import sys
from pathlib import Path

# PyInstaller temp/runtime path
BASE_DIR = getattr(sys, "_MEIPASS", Path(__file__).resolve().parent)

# backend folder
BACKEND_DIR = Path(BASE_DIR) / "backend"

# add paths
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(BASE_DIR))

from server import app
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "51808"))
    host = os.environ.get("HOST", "127.0.0.1")

    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
        reload=False,
    )