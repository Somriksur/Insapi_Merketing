# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec — Insapi Marketing Workspace Backend
# AV-optimised build: no UPX, windowed mode, version info embedded, clean manifest

import os
import sys
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

block_cipher = None

# ── Data files ────────────────────────────────────────────────────────────────
datas = []
datas += [("../backend/assets", "assets")]
if os.path.exists("../backend/.env.production"):
    datas += [("../backend/.env.production", ".env")]

# ── Hidden imports ─────────────────────────────────────────────────────────────
hiddenimports = []

for pkg in ["uvicorn", "fastapi", "starlette", "pydantic", "pydantic_core",
            "numpy", "pandas", "openpyxl", "reportlab", "qrcode", "PIL",
            "aiohttp", "dotenv"]:
    try:
        hiddenimports += collect_submodules(pkg)
    except Exception:
        pass

hiddenimports += collect_submodules("encodings")
hiddenimports += [
    "encodings", "encodings.utf_8", "encodings.utf_16", "encodings.ascii",
    "encodings.latin_1", "encodings.cp1252", "encodings.idna",
    "sqlite3", "json", "csv", "datetime", "decimal", "uuid",
    "hashlib", "hmac", "base64", "ssl", "certifi", "urllib3",
    "python_dotenv", "dotenv",
]

# ── Version info (Windows resource) — makes AV trust the binary more ──────────
# Written to a temp file and passed to EXE via version=
version_info = """
VSVersionInfo(
  ffi=FixedFileInfo(
    filevers=(1, 0, 0, 0),
    prodvers=(1, 0, 0, 0),
    mask=0x3f,
    flags=0x0,
    OS=0x40004,
    fileType=0x1,
    subtype=0x0,
    date=(0, 0)
  ),
  kids=[
    StringFileInfo([
      StringTable(
        u'040904B0',
        [StringStruct(u'CompanyName',      u'Insapi Marketing'),
         StringStruct(u'FileDescription',  u'Insapi Marketing Workspace Backend Service'),
         StringStruct(u'FileVersion',      u'1.0.0.0'),
         StringStruct(u'InternalName',     u'insapi-marketing-backend'),
         StringStruct(u'LegalCopyright',   u'Copyright 2026 Insapi Marketing. All rights reserved.'),
         StringStruct(u'OriginalFilename', u'insapi-marketing-backend.exe'),
         StringStruct(u'ProductName',      u'Insapi Marketing Workspace'),
         StringStruct(u'ProductVersion',   u'1.0.0.0')])
    ]),
    VarFileInfo([VarStruct(u'Translation', [0x0409, 1200])])
  ]
)
"""
_ver_file = os.path.join(os.path.dirname(os.path.abspath(SPEC)), "version_info.txt")
with open(_ver_file, "w") as _f:
    _f.write(version_info)

# ── Analysis ──────────────────────────────────────────────────────────────────
a = Analysis(
    ["entry.py"],
    pathex=["../backend"],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    # Exclude heavy/unused modules — smaller binary = fewer AV triggers
    excludes=["tkinter", "matplotlib", "scipy", "test", "unittest",
              "distutils", "setuptools", "pip", "jupyter"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="insapi-marketing-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,           # UPX compression is the #1 AV false-positive trigger — keep OFF
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,       # Windowed mode — no black terminal window, less suspicious to AV
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon="../desktop/assets/icon.ico",
    version=_ver_file,   # Embeds company/product metadata in the PE header
)
